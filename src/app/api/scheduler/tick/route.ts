import { NextRequest, NextResponse } from "next/server";
import { tick } from "@/lib/scheduler";

export const dynamic = "force-dynamic";
// Vercel Cron can take a few seconds when there's work to do
export const maxDuration = 30;

/**
 * Cron-tick endpoint.
 *
 * Hits `/api/scheduler/tick` every minute (configured in vercel.json).
 * Auth via `SCHEDULER_API_KEY` env var — Vercel Cron automatically sends
 * it as `Authorization: Bearer <key>` and `x-vercel-cron-auth: <key>`.
 *
 * In the sandbox (no Vercel Cron), an internal scheduler can also call this
 * endpoint with `?key=<SCHEDULER_API_KEY>` or `Authorization: Bearer <key>`.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const processed = await tick();
    return NextResponse.json({ ok: true, processed });
  } catch (err) {
    console.error("[scheduler/tick] error:", err);
    return NextResponse.json(
      { error: "tick failed", message: err instanceof Error ? err.message : "" },
      { status: 500 },
    );
  }
}

// Allow GET so Vercel Cron's default GET probe also works.
export async function GET(req: NextRequest) {
  return POST(req);
}

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.SCHEDULER_API_KEY;
  if (!expected) {
    // No key configured → deny. Set SCHEDULER_API_KEY to enable.
    return false;
  }
  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const xCron = req.headers.get("x-vercel-cron-auth") || "";
  const queryKey = req.nextUrl.searchParams.get("key") || "";
  // Constant-time compare to avoid timing attacks
  return (
    safeEqual(bearer, expected) ||
    safeEqual(xCron, expected) ||
    safeEqual(queryKey, expected)
  );
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
