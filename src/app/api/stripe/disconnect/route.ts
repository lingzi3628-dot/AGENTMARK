import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// DELETE /api/stripe/disconnect?uid=<firebaseUid>
// Removes the user's Stripe connection (they can reconnect later).
export async function DELETE(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get("uid");
  if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 });

  const user = await db.user.findUnique({ where: { firebaseUid: uid } });
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });

  await db.stripeConnection.deleteMany({ where: { userId: user.id } });

  return NextResponse.json({ ok: true });
}
