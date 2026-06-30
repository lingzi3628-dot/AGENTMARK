import { NextResponse } from "next/server";
import { getZAI } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function GET() {
  const zai = await getZAI();
  return NextResponse.json({
    version: "161ffb6",
    zaiNull: zai === null,
    hasFreeApi: true,
    timestamp: Date.now(),
  });
}
