import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Reports whether Paystack billing is configured.
// When PAYSTACK_SECRET_KEY is unset, the UI shows a "Coming Soon" state.
export async function GET() {
  return NextResponse.json({
    enabled: !!process.env.PAYSTACK_SECRET_KEY,
    provider: "paystack",
  });
}
