import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// AGENTMARK is free and open source — no billing required.
export async function GET() {
  return NextResponse.json({
    enabled: false,
    provider: "none",
    plan: "free",
    message: "AGENTMARK is free and open source. No paid plans.",
  });
}
