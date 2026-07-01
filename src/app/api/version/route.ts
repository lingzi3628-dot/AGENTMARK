import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    version: "1.0.0",
    hasFreeApi: true,
    timestamp: Date.now(),
  });
}
