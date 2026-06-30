import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

interface Topic {
  title: string;
  description: string;
}

const SYSTEM_PROMPT = `You are a marketing strategist who helps business owners think of what to say to their customers.
Given a business type, target audience, and tone, generate 5 to 7 talking points / topics the business owner can discuss with that audience in that tone.

Each topic MUST have:
- "title": a short 2-6 word title
- "description": a 1-2 sentence description of what the business owner should say about that topic and why it matters to that audience.

Respond with ONLY a JSON object in this exact shape (no markdown, no explanation, no leading text):
{
  "topics": [
    { "title": "...", "description": "..." },
    ...
  ]
}

Rules:
- Topics must be genuinely useful, specific to that business type, and tailored to that audience.
- The tone must influence wording of the descriptions (e.g. urgent → time-sensitive offers, friendly → warm check-ins).
- Vary the topics — mix promotions, education, social proof, questions, and updates.
- Keep descriptions concise (max ~30 words).`;

// Generate talking points / topics for a business + audience + tone
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const uid = body.uid as string;
  if (!uid) {
    return NextResponse.json({ error: "uid required" }, { status: 400 });
  }
  const user = await db.user.findUnique({ where: { firebaseUid: uid } });
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });

  const business = (body.business as string)?.trim();
  const audience = (body.audience as string)?.trim();
  const tone = (body.tone as string)?.trim() || "friendly";
  const language = (body.language as string)?.trim() || "en";
  const conversationId = (body.conversationId as string)?.trim() || "";

  if (!business || !audience) {
    return NextResponse.json(
      { error: "business and audience are required" },
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

  const userMessage = `Business type: ${business}
Target audience: ${audience}
Tone: ${tone}
Respond in: ${languageName}

Generate 5-7 talking points/topics for this business to share with this audience in this tone.`;

  let topics: Topic[] = [];
  let rawTokens = 0;

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
      // Pollinations can be slow on cold start
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      const raw: string = data?.choices?.[0]?.message?.content ?? "";
      rawTokens = typeof data?.usage?.total_tokens === "number" ? data.usage.total_tokens : Math.round(raw.length / 4);
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { topics?: Topic[] };
        if (Array.isArray(parsed.topics)) {
          topics = parsed.topics
            .filter((t) => t && typeof t.title === "string" && typeof t.description === "string")
            .map((t) => ({ title: String(t.title).trim(), description: String(t.description).trim() }))
            .filter((t) => t.title && t.description)
            .slice(0, 7);
        }
      }
    }
  } catch {
    // fall through to fallback
  }

  // Fallback: hardcoded topics by business keyword
  if (topics.length === 0) {
    topics = fallbackTopics(business, audience, tone);
  }

  // Persist messages so the conversation is resumable
  if (conversationId) {
    try {
      await db.customerMessage.create({
        data: {
          conversationId,
          role: "user",
          content: `Generate talking points for ${business} → ${audience} (tone: ${tone})`,
          meta: JSON.stringify({ kind: "topics-request", business, audience, tone }),
          tokens: 0,
        },
      });
      await db.customerMessage.create({
        data: {
          conversationId,
          role: "assistant",
          content: `Generated ${topics.length} talking points`,
          meta: JSON.stringify({ kind: "topics", topics }),
          tokens: rawTokens,
        },
      });
      await db.customerConversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
    } catch {
      // persistence is best-effort; do not block the response
    }
  }

  return NextResponse.json({ topics, tokens: rawTokens });
}

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

// Hardcoded fallback topics — used if the AI is unreachable or returns junk.
function fallbackTopics(business: string, audience: string, tone: string): Topic[] {
  const b = business.toLowerCase();
  if (b.includes("coffee")) {
    return [
      { title: "Seasonal drink launch", description: `Announce the new seasonal drink and invite ${audience.toLowerCase()} to be the first to try it.` },
      { title: "Loyalty perk reminder", description: `Remind ${audience.toLowerCase()} about the loyalty program and how close they are to a free drink.` },
      { title: "Behind-the-scenes roast", description: `Share a short story about where this week's beans come from and why they're special.` },
      { title: "Limited-time offer", description: `Create urgency with a ${tone} offer available only for the next 48 hours.` },
      { title: "Community event invite", description: `Invite ${audience.toLowerCase()} to an upcoming open-mic or latte-art night at the shop.` },
      { title: "Customer spotlight", description: `Feature a regular customer's favorite order and what makes the shop their home base.` },
    ];
  }
  if (b.includes("restaurant") || b.includes("food") || b.includes("kitchen")) {
    return [
      { title: "Chef's special this week", description: `Highlight a dish the chef is cooking this week and what makes it worth ordering.` },
      { title: "Reservation reminder", description: `Gently nudge ${audience.toLowerCase()} to book a table for the weekend before slots fill up.` },
      { title: "New menu preview", description: `Tease an upcoming menu item and ask ${audience.toLowerCase()} what they'd want to see.` },
      { title: "Customer favourite story", description: `Share why one dish is the most-ordered and the story behind it.` },
      { title: "Limited-time tasting", description: `Offer a small-plates tasting menu for a limited window, framed in a ${tone} tone.` },
      { title: "Private event invite", description: `Let ${audience.toLowerCase()} know the restaurant is bookable for private dinners.` },
    ];
  }
  if (b.includes("salon") || b.includes("spa") || b.includes("beauty")) {
    return [
      { title: "Seasonal service launch", description: `Introduce a new seasonal treatment and what results to expect.` },
      { title: "Rebooking reminder", description: `Remind ${audience.toLowerCase()} it's time to refresh their last service.` },
      { title: "Package offer", description: `Bundle two services at a small discount for a ${tone} push this month.` },
      { title: "Stylist spotlight", description: `Introduce a team member and their specialty so ${audience.toLowerCase()} knows who to book with.` },
      { title: "Self-care tip", description: `Share one at-home tip to extend the life of their last appointment.` },
      { title: "Gift card nudge", description: `Mention gift cards as an easy present for upcoming holidays.` },
    ];
  }
  if (b.includes("fitness") || b.includes("gym") || b.includes("coach") || b.includes("yoga")) {
    return [
      { title: "New class launch", description: `Announce a new class and who it's perfect for.` },
      { title: "30-day challenge", description: `Invite ${audience.toLowerCase()} to a 30-day challenge with a clear start date and prize.` },
      { title: "Progress check-in", description: `Ask ${audience.toLowerCase()} how the last 30 days felt and what's next.` },
      { title: "Trainer spotlight", description: `Introduce a trainer and their coaching philosophy.` },
      { title: "Membership perk", description: `Highlight a perk of membership they may not be using yet.` },
      { title: "Free intro session", description: `Offer a free intro session in a ${tone} tone for new or returning clients.` },
    ];
  }
  if (b.includes("real estate") || b.includes("realty") || b.includes("property")) {
    return [
      { title: "New listing preview", description: `Tease an upcoming listing before it hits the public market.` },
      { title: "Market update", description: `Share a one-paragraph update on local prices and days-on-market.` },
      { title: "Open house invite", description: `Invite ${audience.toLowerCase()} to an open house this weekend.` },
      { title: "Seller checklist", description: `Send a short pre-listing checklist to potential sellers.` },
      { title: "Buyer FAQ", description: `Answer the top question buyers ask before their first viewing.` },
      { title: "Just sold", description: `Share a recent sale to build confidence and show momentum.` },
    ];
  }
  if (b.includes("dentist") || b.includes("dental") || b.includes("ortho")) {
    return [
      { title: "Six-month checkup", description: `Remind ${audience.toLowerCase()} it's time to book their routine cleaning.` },
      { title: "Whitening special", description: `Promote a whitening offer available this month in a ${tone} tone.` },
      { title: "Kid-friendly visit", description: `Reassure parents about the practice's gentle approach with children.` },
      { title: "Insurance reminder", description: `Note end-of-year benefits that expire soon and should be used.` },
      { title: "Oral health tip", description: `Share one practical tip that improves daily oral hygiene.` },
      { title: "New technology", description: `Mention a new tool or scanner that makes visits faster or more comfortable.` },
    ];
  }
  if (b.includes("ecom") || b.includes("e-commerce") || b.includes("store") || b.includes("shop")) {
    return [
      { title: "New arrival drop", description: `Announce the latest products and why ${audience.toLowerCase()} will love them.` },
      { title: "Restock alert", description: `Tell ${audience.toLowerCase()} a best-seller is back in stock before it sells out again.` },
      { title: "Free shipping offer", description: `Run a limited free-shipping promo in a ${tone} tone.` },
      { title: "How-to guide", description: `Share a quick how-to for getting more out of a popular product.` },
      { title: "Customer review spotlight", description: `Highlight a recent 5-star review and the product it praises.` },
      { title: "Bundle deal", description: `Offer a small discount when buying two complementary items together.` },
    ];
  }
  if (b.includes("saas") || b.includes("software") || b.includes("startup") || b.includes("app")) {
    return [
      { title: "Feature release", description: `Announce a new feature and the problem it solves for users.` },
      { title: "Use-case spotlight", description: `Show how one customer uses the product to save hours every week.` },
      { title: "Webinar invite", description: `Invite ${audience.toLowerCase()} to a live walkthrough this week.` },
      { title: "Pricing change heads-up", description: `Give ${audience.toLowerCase()} advance notice about an upcoming pricing change.` },
      { title: "Trial extension", description: `Offer a longer trial in a ${tone} tone to push activation.` },
      { title: "Integration launch", description: `Announce a new integration with a popular tool.` },
    ];
  }
  // Generic fallback for any other business
  return [
    { title: "What's new this week", description: `Share the single biggest update or change from the past week in a ${tone} tone.` },
    { title: "Customer story", description: `Tell a short story about a happy customer and the result they got.` },
    { title: "Helpful tip", description: `Give ${audience.toLowerCase()} one practical tip related to ${business}.` },
    { title: "Behind the scenes", description: `Pull back the curtain on how ${business} works day-to-day.` },
    { title: "Limited-time offer", description: `Run a short, ${tone} offer that creates urgency without being pushy.` },
    { title: "Question for them", description: `Ask ${audience.toLowerCase()} a question that invites a reply and starts a conversation.` },
  ];
}
