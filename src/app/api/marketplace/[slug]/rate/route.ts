import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

interface RateBody {
  firebaseUid?: string;
  rating?: number;
}

/**
 * POST /api/marketplace/[slug]/rate
 * Body: { firebaseUid, rating: 1-5 }
 *
 * Updates the template's rating (weighted average) and ratingCount.
 *
 * NOTE: For simplicity this does not enforce one-rating-per-user — that
 * would require a separate join table. Instead each call adds a new vote
 * to the running average. A production system would track per-user
 * ratings in a TemplateRating table and enforce uniqueness there.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const body = (await req.json().catch(() => ({}))) as RateBody;
  const { firebaseUid, rating: rawRating } = body;

  if (!firebaseUid) {
    return NextResponse.json(
      { error: "firebaseUid required" },
      { status: 400 },
    );
  }

  const rating = Math.round(Number(rawRating));
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return NextResponse.json(
      { error: "rating must be an integer 1-5" },
      { status: 400 },
    );
  }

  // Confirm the user exists
  const user = await db.user.findUnique({ where: { firebaseUid } });
  if (!user) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 },
    );
  }

  const tpl = await db.templateShare.findUnique({ where: { slug } });
  if (!tpl || !tpl.published) {
    return NextResponse.json(
      { error: "Template not found" },
      { status: 404 },
    );
  }

  // Incremental weighted average:
  //   newAvg = (oldAvg * oldCount + newRating) / (oldCount + 1)
  const oldCount = tpl.ratingCount;
  const oldAvg = tpl.rating;
  const newCount = oldCount + 1;
  const newAvg = (oldAvg * oldCount + rating) / newCount;

  const updated = await db.templateShare.update({
    where: { id: tpl.id },
    data: {
      rating: Math.round(newAvg * 100) / 100, // 2 decimals
      ratingCount: newCount,
    },
  });

  return NextResponse.json({
    rating: updated.rating,
    ratingCount: updated.ratingCount,
  });
}
