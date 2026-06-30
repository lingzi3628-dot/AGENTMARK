// Email (IMAP + SMTP) helpers — wraps ImapFlow for reading and nodemailer for sending.
// All public methods catch errors and return null / [] / false — never throw — so a
// single bad message can't kill the whole poll loop.
//
// Docs:
//   ImapFlow:  https://imapflow.com/
//   nodemailer:https://nodemailer.com/

import { ImapFlow, type FetchMessageObject } from "imapflow";
import nodemailer from "nodemailer";

export interface EmailClientConfig {
  /** IMAP host (e.g. imap.gmail.com). Required. */
  imapHost: string;
  /** SMTP host (e.g. smtp.gmail.com). Required. */
  smtpHost: string;
  /** IMAP port — defaults to 993 (IMAPS). */
  imapPort?: number;
  /** SMTP port — defaults to 465 (SMTPS). */
  smtpPort?: number;
  /** Login username — usually the inbox email address. */
  user: string;
  /** App password (NOT your regular account password for Gmail — see App Passwords). */
  pass: string;
  /** Use TLS. Defaults to true (always-on TLS for port 993/465). */
  tls?: boolean;
}

export interface EmailMessage {
  /** IMAP UID — used to mark the message as read later. */
  id: string;
  /** Sender email address (best-effort extracted from envelope From). */
  from: string;
  /** Sender display name (optional). */
  fromName?: string;
  /** Subject line. */
  subject: string;
  /** Message-ID header — used to set the In-Reply-To header on the reply. */
  messageId?: string;
  /** Plain-text body (preferred) — falls back to HTML stripped of tags. */
  body: string;
}

export interface SendEmailOpts {
  to: string;
  subject: string;
  body: string;
  /** Original Message-ID — sets the In-Reply-To + References headers for proper threading. */
  inReplyTo?: string;
}

/**
 * EmailClient — a single class wrapping both IMAP (ImapFlow) and SMTP (nodemailer)
 * transports with the same credentials. Use one client per integration per poll cycle.
 */
export class EmailClient {
  private readonly imapConfig: {
    host: string;
    port: number;
    secure: boolean;
    auth: { user: string; pass: string };
    logger: false;
    disableAutoIdle: true;
  };
  private readonly smtpConfig: {
    host: string;
    port: number;
    secure: boolean;
    auth: { user: string; pass: string };
  };
  private transporter: nodemailer.Transporter | null = null;

  constructor(config: EmailClientConfig) {
    const imapPort = config.imapPort || 993;
    const smtpPort = config.smtpPort || 465;
    const tls = config.tls ?? true;
    this.imapConfig = {
      host: config.imapHost,
      port: imapPort,
      secure: tls,
      auth: { user: config.user, pass: config.pass },
      logger: false,
      disableAutoIdle: true,
    };
    this.smtpConfig = {
      host: config.smtpHost,
      port: smtpPort,
      secure: tls,
      auth: { user: config.user, pass: config.pass },
    };
  }

  /**
   * Open an IMAP connection and return the client. Caller is responsible for
   * calling `.logout()` when done. Returns null on failure.
   */
  private async connectImap(): Promise<ImapFlow | null> {
    try {
      const client = new ImapFlow(this.imapConfig);
      await client.connect();
      return client;
    } catch (err) {
      console.error(
        "[email] IMAP connect failed:",
        err instanceof Error ? err.message : String(err),
      );
      return null;
    }
  }

  private getTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport(this.smtpConfig);
    }
    return this.transporter;
  }

  /**
   * Verify both IMAP and SMTP credentials. Used by the integrations route when
   * the user clicks "Connect" — returns ok:false + a human-readable error if
   * anything fails.
   */
  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    // 1) IMAP — open + close a mailbox
    let client: ImapFlow | null = null;
    try {
      client = await this.connectImap();
      if (!client) {
        return { ok: false, error: "Could not connect to IMAP server — check host/port/credentials." };
      }
      const lock = await client.getMailboxLock("INBOX");
      try {
        await client.status("INBOX", { messages: true });
      } finally {
        lock.release();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: `IMAP error: ${msg}` };
    } finally {
      if (client) {
        await client.logout().catch(() => undefined);
      }
    }

    // 2) SMTP — verify the transport
    try {
      await this.getTransporter().verify();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: `SMTP error: ${msg}` };
    }

    return { ok: true };
  }

  /**
   * List unread messages from INBOX, newest first. Returns parsed envelopes +
   * bodies. Caps at `limit` (default 50 — safety). Returns [] on any error.
   */
  async listUnread(limit = 50): Promise<EmailMessage[]> {
    let client: ImapFlow | null = null;
    try {
      client = await this.connectImap();
      if (!client) return [];

      const lock = await client.getMailboxLock("INBOX");
      try {
        // Search for unseen messages. Returns UIDs (when { uid: true }).
        const uids = await client.search({ seen: false }, { uid: true });
        if (!uids || !Array.isArray(uids) || uids.length === 0) return [];

        // Newest first — UIDs are monotonically increasing, so reverse the sort.
        const uidList = (uids as number[]).slice().sort((a, b) => b - a).slice(0, Math.max(0, limit));
        if (uidList.length === 0) return [];

        const range = uidList.join(",");
        const messages: EmailMessage[] = [];
        for await (const msg of client.fetch(
          range,
          {
            uid: true,
            envelope: true,
            source: { maxLength: 1024 * 1024 }, // 1MB cap per message — protect RAM
            internalDate: true,
          },
          { uid: true },
        )) {
          const parsed = parseFetchMessage(msg);
          if (parsed) messages.push(parsed);
        }
        return messages;
      } finally {
        lock.release();
      }
    } catch (err) {
      console.error(
        "[email] listUnread failed:",
        err instanceof Error ? err.message : String(err),
      );
      return [];
    } finally {
      if (client) {
        await client.logout().catch(() => undefined);
      }
    }
  }

  /**
   * Mark a message (by UID) as seen. Silently swallows errors so a failure here
   * doesn't abort the rest of the poll loop — worst case, we'll reprocess the
   * same email next time (de-duped by the agent / MessageLog).
   */
  async markAsRead(uid: string): Promise<void> {
    let client: ImapFlow | null = null;
    try {
      client = await this.connectImap();
      if (!client) return;
      const lock = await client.getMailboxLock("INBOX");
      try {
        await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
      } finally {
        lock.release();
      }
    } catch (err) {
      console.error(
        "[email] markAsRead failed:",
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      if (client) {
        await client.logout().catch(() => undefined);
      }
    }
  }

  /**
   * Send an email via SMTP. Sets In-Reply-To + References when `inReplyTo` is
   * provided so the reply threads under the original in Gmail/Outlook/etc.
   */
  async sendEmail(opts: SendEmailOpts): Promise<{ ok: boolean; error?: string }> {
    try {
      const headers: Record<string, string> = {};
      if (opts.inReplyTo) {
        headers["In-Reply-To"] = opts.inReplyTo;
        headers["References"] = opts.inReplyTo;
      }
      const info = await this.getTransporter().sendMail({
        from: this.smtpConfig.auth.user,
        to: opts.to,
        subject: opts.subject,
        text: opts.body,
        headers,
      });
      return { ok: Boolean(info.messageId), error: info.messageId ? undefined : "no messageId returned" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[email] sendEmail failed:", msg);
      return { ok: false, error: msg };
    }
  }
}

// ------------------- internal helpers -------------------

function parseFetchMessage(msg: FetchMessageObject): EmailMessage | null {
  if (!msg.envelope) return null;
  const env = msg.envelope;
  const fromAddr = env.from?.[0]?.address ?? "";
  const fromName = env.from?.[0]?.name;
  if (!fromAddr) return null;

  let body = "";
  if (msg.source) {
    const raw = msg.source.toString("utf-8");
    const extracted = extractBody(raw);
    body = extracted.text || stripHtml(extracted.html) || "";
  }

  return {
    id: String(msg.uid),
    from: fromAddr,
    fromName: fromName || undefined,
    subject: env.subject || "(no subject)",
    messageId: env.messageId,
    body: body.trim().slice(0, 16000), // 16KB cap — protect the agent's context window
  };
}

/** Extract text/plain and text/html bodies from a raw RFC822 message. */
function extractBody(raw: string): { text: string; html: string } {
  // Split headers / body at the first blank line.
  const headerEnd = raw.indexOf("\r\n\r\n");
  const headerEndIdx = headerEnd >= 0 ? headerEnd + 4 : raw.indexOf("\n\n") + 2;
  const headers = headerEndIdx > 0 ? raw.slice(0, headerEndIdx) : raw;
  const body = headerEndIdx > 0 ? raw.slice(headerEndIdx) : "";

  // Find multipart boundary in headers.
  const boundaryMatch = headers.match(/boundary\s*=\s*"?([^\s";]+)"?/i);
  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = body.split(`--${boundary}`);
    let text = "";
    let html = "";
    for (const part of parts) {
      if (part === "" || part === "--\r\n" || part === "--\n") continue;
      // Each part has its own mini-headers
      const phEnd = part.indexOf("\r\n\r\n");
      const phEndIdx = phEnd >= 0 ? phEnd + 4 : part.indexOf("\n\n") + 2;
      const partHeaders = phEndIdx > 0 ? part.slice(0, phEndIdx) : part;
      const partBody = phEndIdx > 0 ? part.slice(phEndIdx) : part;
      const cte = (partHeaders.match(/content-transfer-encoding:\s*([^\r\n]+)/i)?.[1] || "").trim().toLowerCase();
      const isText = /content-type:\s*text\/plain/i.test(partHeaders);
      const isHtml = /content-type:\s*text\/html/i.test(partHeaders);
      if (isText) {
        text = decodeCTE(partBody, cte);
      } else if (isHtml) {
        html = decodeCTE(partBody, cte);
      }
    }
    return { text, html };
  }

  // Not multipart — whole body is one content-type.
  const cte = (headers.match(/content-transfer-encoding:\s*([^\r\n]+)/i)?.[1] || "").trim().toLowerCase();
  if (/content-type:\s*text\/html/i.test(headers)) {
    return { text: "", html: decodeCTE(body, cte) };
  }
  return { text: decodeCTE(body, cte), html: "" };
}

function decodeCTE(input: string, cte: string): string {
  const s = input.replace(/\r\n/g, "\n").trim();
  if (cte === "base64") {
    try {
      return Buffer.from(s, "base64").toString("utf-8");
    } catch {
      return s;
    }
  }
  if (cte === "quoted-printable") {
    return s
      .replace(/=\r?\n/g, "")
      .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => {
        try {
          return String.fromCharCode(parseInt(hex, 16));
        } catch {
          return "";
        }
      });
  }
  return s;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
