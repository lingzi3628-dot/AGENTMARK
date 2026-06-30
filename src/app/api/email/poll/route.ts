import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { EmailClient } from "@/lib/email";
import { executeAgent } from "@/lib/ai";
import type { WorkflowNode, WorkflowEdge } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Email auto-responder poll endpoint.
 *
 * Triggered every 5 minutes by the Vercel cron (see vercel.json → "crons"), or
 * manually via the "Test poll" button on the Email integration card.
 *
 * Auth model:
 *   - If `EMAIL_POLL_API_KEY` env var is set, the request must include it in
 *     the `x-poll-key` header or `?key=` query. This is what the cron uses.
 *   - If `EMAIL_POLL_API_KEY` env var is NOT set (dev/test mode), the route is
 *     open — convenient for the manual "Test poll" button. A warning is logged.
 *
 * Optional `?integrationId=xxx` query limits the poll to a single integration
 * (used by the test button so we don't mass-process every email integration
 * on the workspace).
 *
 * For each enabled email integration:
 *   1. Build an EmailClient from the stored config.
 *   2. List unread messages (cap 50 per integration — safety).
 *   3. For each message:
 *      a. Log to MessageLog (direction=incoming).
 *      b. Run the agent non-streaming with the email body as input.
 *      c. Send the reply via SMTP with In-Reply-To header set for threading.
 *      d. Log to MessageLog (direction=outgoing).
 *      e. Mark the original message as read so we don't reprocess it.
 *
 * Returns: { processed: N, integrations: M, errors: [...] }
 */
export async function POST(req: NextRequest) {
  // --- Auth ---
  const expectedKey = process.env.EMAIL_POLL_API_KEY;
  const singleIntegrationId = req.nextUrl.searchParams.get("integrationId") || "";
  if (expectedKey) {
    const providedKey =
      req.headers.get("x-poll-key") ||
      req.nextUrl.searchParams.get("key") ||
      "";
    if (providedKey !== expectedKey) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  } else {
    // Dev/test mode — no key configured. Allow the request through but warn.
    console.warn(
      "[email poll] EMAIL_POLL_API_KEY env var is not set — running in unauthenticated dev mode.",
    );
  }

  const errors: string[] = [];
  let processed = 0;
  let integrationsCount = 0;

  try {
    const integrations = await db.integration.findMany({
      where: {
        platform: "email",
        enabled: true,
        ...(singleIntegrationId ? { id: singleIntegrationId } : {}),
      },
      include: { agent: true },
    });

    integrationsCount = integrations.length;

    for (const integration of integrations) {
      try {
        if (!integration.agent) {
          errors.push(`integration ${integration.id}: no linked agent`);
          continue;
        }

        let cfg: Record<string, string> = {};
        try {
          cfg = JSON.parse(integration.config) as Record<string, string>;
        } catch {
          cfg = {};
        }

        const emailAddress = cfg.emailAddress || "";
        const imapHost = cfg.imapHost || "";
        const smtpHost = cfg.smtpHost || "";
        const password = cfg.password || "";
        if (!emailAddress || !imapHost || !smtpHost || !password) {
          errors.push(
            `integration ${integration.id}: missing required fields (emailAddress/imapHost/smtpHost/password)`,
          );
          continue;
        }

        const imapPort = cfg.imapPort ? Number(cfg.imapPort) : undefined;
        const smtpPort = cfg.smtpPort ? Number(cfg.smtpPort) : undefined;

        const client = new EmailClient({
          imapHost,
          smtpHost,
          imapPort,
          smtpPort,
          user: emailAddress,
          pass: password,
          tls: true,
        });

        const messages = await client.listUnread(50);
        if (messages.length === 0) continue;

        const agent = integration.agent;
        const nodes: WorkflowNode[] = safeJsonParse(agent.nodes, []);
        const edges: WorkflowEdge[] = safeJsonParse(agent.edges, []);

        for (const msg of messages) {
          const startedAt = Date.now();
          try {
            // 1. Log incoming
            await db.messageLog
              .create({
                data: {
                  integrationId: integration.id,
                  direction: "incoming",
                  platform: "email",
                  senderName: msg.fromName || msg.from,
                  senderId: msg.from,
                  content: `Subject: ${msg.subject}\n\n${msg.body.slice(0, 4000)}`,
                  status: "delivered",
                },
              })
              .catch(() => undefined);

            // 2. Run the agent
            const inputText = `From: ${msg.fromName ? `${msg.fromName} <${msg.from}>` : msg.from}\nSubject: ${msg.subject}\n\n${msg.body}`;
            let output = "";
            try {
              for await (const ev of executeAgent(nodes, edges, {
                input: inputText,
                history: [],
              })) {
                if (ev.type === "done" && ev.output) {
                  output = ev.output;
                }
              }
            } catch (err) {
              console.error(
                `[email poll] agent execution failed for msg ${msg.id}:`,
                err instanceof Error ? err.message : String(err),
              );
              output = "";
            }

            if (!output) {
              // Don't send an empty / broken reply — but still mark as read so
              // we don't get stuck in an infinite loop on the same message.
              await client.markAsRead(msg.id);
              continue;
            }

            // 3. Send the reply — use a "Re:" subject for threading clarity,
            //    plus the In-Reply-To header pointing at the original Message-ID.
            const replySubject = msg.subject.toLowerCase().startsWith("re:")
              ? msg.subject
              : `Re: ${msg.subject}`;
            const sendResult = await client.sendEmail({
              to: msg.from,
              subject: replySubject,
              body: output,
              inReplyTo: msg.messageId,
            });

            const durationMs = Date.now() - startedAt;

            // 4. Log outgoing
            await db.messageLog
              .create({
                data: {
                  integrationId: integration.id,
                  direction: "outgoing",
                  platform: "email",
                  senderName: agent.name,
                  senderId: emailAddress,
                  content: `Subject: ${replySubject}\n\n${output.slice(0, 4000)}`,
                  status: sendResult.ok ? "delivered" : "failed",
                  tokens: Math.ceil(output.length / 4),
                  durationMs,
                },
              })
              .catch(() => undefined);

            // 5. Record the run in history
            await db.runHistory
              .create({
                data: {
                  agentId: agent.id,
                  input: inputText.slice(0, 8000),
                  output: output.slice(0, 16000),
                  status: "completed",
                  tokens: Math.ceil(output.length / 4),
                  duration: durationMs,
                  source: "integration",
                },
              })
              .catch(() => undefined);

            // 6. Mark as read (so we don't reply twice)
            await client.markAsRead(msg.id);

            processed++;
          } catch (err) {
            errors.push(
              `integration ${integration.id} msg ${msg.id}: ${
                err instanceof Error ? err.message : String(err)
              }`,
            );
          }
        }
      } catch (err) {
        errors.push(
          `integration ${integration.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  } catch (err) {
    errors.push(
      `fatal: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return NextResponse.json({
    ok: true,
    processed,
    integrations: integrationsCount,
    errors: errors.slice(0, 20), // cap the response size
  });
}

function safeJsonParse<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
