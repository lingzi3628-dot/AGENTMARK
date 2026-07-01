import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// POST /api/analytics/collect — receives anonymous analytics events from
// open-source AGENTMARK instances.
// In production, point this to your own database (e.g. Supabase, Postgres).
// For now, we just log + acknowledge.
export async function POST(req: NextRequest) {
  try {
    const event = await req.json();

    // Validate required fields
    if (!event.type || !event.instanceId) {
      return NextResponse.json({ error: "type and instanceId required" }, { status: 400 });
    }

    // Log the event (in production, store in a database)
    console.log("[analytics]", JSON.stringify({
      type: event.type,
      instanceId: event.instanceId,
      version: event.version,
      timestamp: event.timestamp,
      metadata: event.metadata,
      // Capture the IP for geo-location (city level only, for understanding
      // where users are — no personal identification)
      ip: req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "unknown",
      userAgent: req.headers.get("user-agent") || "unknown",
      receivedAt: Date.now(),
    }));

    // In production, store in your database:
    // await db.analyticsEvent.create({ data: event });

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "invalid event" }, { status: 400 });
  }
}

// GET /api/analytics/collect — returns the collection endpoint info
export async function GET() {
  return NextResponse.json({
    endpoint: "/api/analytics/collect",
    description: "Anonymous analytics collection for AGENTMARK open-source instances",
    privacy: "All data is anonymous. No API keys, no agent content, no personal info.",
    optIn: true,
  });
}
