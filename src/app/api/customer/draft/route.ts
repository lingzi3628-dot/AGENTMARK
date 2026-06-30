import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

interface DraftBody {
  business?: string;
  audience?: string;
  tone?: string;
  language?: string;
  topic?: { title?: string; description?: string };
  channel?: string; // sms | email | social | whatsapp | push
  conversationId?: string;
  uid?: string;
}

const SYSTEM_PROMPT = `You are a copywriter who drafts ready-to-send messages for business owners.
You are given a business type, a target audience, a tone, a topic to write about, and a channel.
Draft ONE message that the business owner can copy and send to that audience on that channel, about that topic, in that tone.

Channel constraints — follow them strictly:
- sms: under 160 characters total. No subject line. Plain text. No emojis unless the tone is casual/friendly.
- whatsapp: 1-3 short paragraphs. Plain text. Up to 2 emojis total.
- email: include a Subject line on the first line (prefixed with "Subject: "), then a body of 90-160 words. Plain text.
- social: 1-3 paragraphs, under 500 characters, may include 1-3 relevant hashtags at the end.
- push: a title (under 40 chars) on the first line prefixed with "Title: ", then a body (under 100 chars).

Rules:
- Match the requested tone exactly.
- Do not include placeholders like [Your Name]. Address the audience directly.
- Do not include any preamble like "Here is your draft:" — output ONLY the message itself.
- Respond in the requested language.`;

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
  it: "Italian",
  nl: "Dutch",
  zh: "Chinese (Simplified)",
  ja: "Japanese",
  ko: "Korean",
  ar: "Arabic",
  hi: "Hindi",
  ru: "Russian",
};

const CHANNEL_GUIDE: Record<string, string> = {
  sms: "Channel: SMS (under 160 chars, plain text)",
  whatsapp: "Channel: WhatsApp message (1-3 short paragraphs, up to 2 emojis)",
  email: "Channel: Email (Subject: ... then 90-160 word body)",
  social: "Channel: Social media post (under 500 chars, may include hashtags)",
  push: "Channel: Push notification (Title: ... under 40 chars, then body under 100 chars)",
};

// Generate a ready-to-send draft for a single topic on a chosen channel
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as DraftBody;
  const uid = body.uid;
  if (!uid) {
    return NextResponse.json({ error: "uid required" }, { status: 400 });
  }
  const user = await db.user.findUnique({ where: { firebaseUid: uid } });
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });

  const business = (body.business ?? "").trim();
  const audience = (body.audience ?? "").trim();
  const tone = (body.tone ?? "friendly").trim();
  const language = (body.language ?? "en").trim();
  const channel = (body.channel ?? "email").trim();
  const topic = body.topic;
  const conversationId = (body.conversationId ?? "").trim();

  if (!business || !audience || !topic?.title) {
    return NextResponse.json(
      { error: "business, audience, and topic.title are required" },
      { status: 400 },
    );
  }

  // Verify conversation ownership if provided
  if (conversationId) {
    const conv = await db.customerConversation.findUnique({ where: { id: conversationId } });
    if (!conv || conv.userId !== user.id) {
      return NextResponse.json({ error: "conversation not found" }, { status: 404 });
    }
  }

  const languageName = LANGUAGE_NAMES[language] ?? "English";
  const channelGuide = CHANNEL_GUIDE[channel] ?? CHANNEL_GUIDE.email;

  const userMessage = `Business: ${business}
Audience: ${audience}
Tone: ${tone}
Respond in: ${languageName}
${channelGuide}

Topic to write about: ${topic.title}
${topic.description ? `What to cover: ${topic.description}` : ""}

Draft the message now. Output ONLY the message itself — no preamble, no explanation.`;

  let draft = "";
  let tokens = 0;

  try {
    const res = await fetch("https://text.pollinations.ai/openai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "openai",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      draft = (data?.choices?.[0]?.message?.content ?? "").trim();
      tokens =
        typeof data?.usage?.total_tokens === "number"
          ? data.usage.total_tokens
          : Math.max(1, Math.round(draft.length / 4));
    }
  } catch {
    // fall through to fallback
  }

  // Fallback: a simple templated draft
  if (!draft) {
    draft = fallbackDraft(business, audience, tone, topic, channel);
    tokens = Math.max(1, Math.round(draft.length / 4));
  }

  // Persist messages so the conversation is resumable
  if (conversationId) {
    try {
      await db.customerMessage.create({
        data: {
          conversationId,
          role: "user",
          content: `Draft a ${channel} message about: ${topic.title}`,
          meta: JSON.stringify({
            kind: "draft-request",
            channel,
            topic,
            business,
            audience,
            tone,
          }),
          tokens: 0,
        },
      });
      await db.customerMessage.create({
        data: {
          conversationId,
          role: "assistant",
          content: draft,
          meta: JSON.stringify({ kind: "draft", channel, topic }),
          tokens,
        },
      });
      await db.customerConversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
    } catch {
      // best-effort
    }
  }

  return NextResponse.json({ draft, channel, tokens });
}

function fallbackDraft(
  business: string,
  audience: string,
  tone: string,
  topic: { title: string; description?: string },
  channel: string,
): string {
  const opener = tone === "urgent"
    ? "Quick update"
    : tone === "professional"
      ? "Update from"
      : "Hey from";
  const line1 = `${opener} ${business} — about ${topic.title.toLowerCase()}.`;
  const line2 = topic.description
    ? topic.description
    : `We thought you'd want to know what's new.`;
  const cta = tone === "urgent"
    ? "Only for the next 48 hours."
    : "Reply to let us know what you think.";

  if (channel === "sms" || channel === "push") {
    return `${line1} ${line2} ${cta}`.slice(0, 160);
  }
  if (channel === "social") {
    return `${line1}\n\n${line2} ${cta}\n\n#${business.replace(/[^a-zA-Z]/g, "") || "LocalBusiness"}`.slice(0, 500);
  }
  if (channel === "email") {
    return `Subject: ${topic.title}\n\nHi,\n\n${line1}\n\n${line2}\n\n${cta}\n\nThanks,\nThe ${business} team`;
  }
  // whatsapp default
  return `${line1}\n\n${line2} ${cta}`;
}
