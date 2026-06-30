// Telegram Bot API helpers — setWebhook, sendMessage, deleteWebhook.

const TELEGRAM_API = "https://api.telegram.org";

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; type: string; first_name?: string; username?: string };
    from?: { id: number; first_name?: string; username?: string };
    text?: string;
  };
}

/** Register our webhook URL with Telegram so they forward messages to us. */
export async function setTelegramWebhook(botToken: string, webhookUrl: string): Promise<boolean> {
  const url = `${TELEGRAM_API}/bot${botToken}/setWebhook`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ["message"],
      drop_pending_updates: true,
    }),
  });
  const data = await res.json().catch(() => ({}));
  return data.ok === true;
}

/** Remove the webhook (called when disconnecting). */
export async function deleteTelegramWebhook(botToken: string): Promise<void> {
  await fetch(`${TELEGRAM_API}/bot${botToken}/deleteWebhook`, { method: "POST" }).catch(() => undefined);
}

/** Send a text message to a Telegram chat. */
export async function sendTelegramMessage(botToken: string, chatId: number, text: string): Promise<void> {
  await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
    }),
  }).catch(() => undefined);
}

/** Get info about the bot (validates the token). */
export async function getTelegramBotInfo(botToken: string): Promise<{ ok: boolean; username?: string; error?: string }> {
  const res = await fetch(`${TELEGRAM_API}/bot${botToken}/getMe`);
  const data = await res.json().catch(() => ({}));
  if (data.ok) return { ok: true, username: data.result?.username };
  return { ok: false, error: data.description || "Invalid token" };
}

/** Derive the public webhook URL from the incoming request. */
export function deriveWebhookUrl(req: Request): string {
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost";
  return `${proto}://${host}/api/webhooks/telegram`;
}
