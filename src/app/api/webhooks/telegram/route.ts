import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { executeAgent } from "@/lib/ai";
import { sendTelegramMessage, type TelegramUpdate } from "@/lib/telegram";
import type { WorkflowNode, WorkflowEdge } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Telegram webhook receiver.
 * Telegram calls this endpoint whenever someone messages a connected bot.
 * We run the agent and send the reply back via Telegram's sendMessage API.
 */
export async function POST(req: NextRequest) {
  // Parse the incoming Telegram update
  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const msg = update.message;
  if (!msg || !msg.text) {
    // Not a text message (sticker, photo, etc.) — acknowledge silently
    return NextResponse.json({ ok: true, ignored: true });
  }

  const chatId = msg.chat.id;
  const userText = msg.text;

  // Ignore /start and /help commands — send a welcome message instead
  if (userText === "/start") {
    return NextResponse.json({ ok: true });
  }
  if (userText === "/help") {
    return NextResponse.json({ ok: true });
  }

  // Find which agent this bot belongs to by matching the bot token.
  // Telegram doesn't send the token in the update, so we look up all
  // telegram integrations and match by token.
  // Optimization: the webhook URL can include the integration ID, but
  // for simplicity we scan. In production you'd use a unique URL per bot.
  const telegramIntegrations = await db.integration.findMany({
    where: { platform: "telegram", enabled: true },
    include: { agent: true },
  });

  // Try to identify the bot by calling getMe for each (cached in a real app).
  // For now, we match on the first enabled telegram integration whose bot
  // token is valid. A better approach: embed the integration ID in the webhook URL.
  // Since we can't easily know WHICH bot received the message from the update alone,
  // we use the update's bot context. Telegram updates don't include the bot token,
  // so we need a different strategy: register webhooks with a per-bot URL.

  // Strategy: The webhook URL we register includes the integration ID:
  //   /api/webhooks/telegram?i={integrationId}
  // So we read it from the query string.
  const integrationId = req.nextUrl.searchParams.get("i");

  let targetIntegration;
  if (integrationId) {
    targetIntegration = telegramIntegrations.find((t) => t.id === integrationId);
  } else {
    // Fallback: if no ID in URL, try the first telegram integration (for backward compat)
    targetIntegration = telegramIntegrations[0];
  }

  if (!targetIntegration || !targetIntegration.agent) {
    return NextResponse.json({ error: "no matching agent" }, { status: 404 });
  }

  const botToken = (JSON.parse(targetIntegration.config) as Record<string, string>).botToken;
  if (!botToken) {
    return NextResponse.json({ error: "no bot token" }, { status: 400 });
  }

  const agent = targetIntegration.agent;
  const nodes: WorkflowNode[] = JSON.parse(agent.nodes);
  const edges: WorkflowEdge[] = JSON.parse(agent.edges);

  // Send a "typing..." indicator
  await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action: "typing" }),
  }).catch(() => undefined);

  // Run the agent (non-streaming — collect the full output)
  let output = "";
  try {
    for await (const ev of executeAgent(nodes, edges, { input: userText, history: [] })) {
      if (ev.type === "done" && ev.output) {
        output = ev.output;
      }
    }
  } catch (err) {
    output = "Sorry, I encountered an error processing your request.";
    console.error("[telegram webhook] agent execution error:", err);
  }

  if (!output) {
    output = "I didn't produce a response. Please try rephrasing your message.";
  }

  // Telegram messages have a 4096 char limit — split if needed
  const chunks = splitMessage(output, 4000);
  for (const chunk of chunks) {
    await sendTelegramMessage(botToken, chatId, chunk);
  }

  // Record the run in history
  await db.runHistory.create({
    data: {
      agentId: agent.id,
      input: userText.slice(0, 8000),
      output: output.slice(0, 16000),
      status: "completed",
      tokens: Math.ceil(output.length / 4),
      duration: 0,
    },
  }).catch(() => undefined);

  return NextResponse.json({ ok: true });
}

/** Split long messages into chunks that fit Telegram's 4096 char limit. */
function splitMessage(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    // Try to split at a newline
    let splitIdx = remaining.lastIndexOf("\n", maxLen);
    if (splitIdx < maxLen * 0.5) splitIdx = maxLen;
    chunks.push(remaining.slice(0, splitIdx));
    remaining = remaining.slice(splitIdx);
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}
