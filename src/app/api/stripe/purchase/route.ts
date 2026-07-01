import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createMarketplacePayment, stripeEnabled, PLATFORM_FEE_PERCENT } from "@/lib/stripe-connect";

export const dynamic = "force-dynamic";

// POST /api/stripe/purchase — buy a paid template from the marketplace.
// Body: { templateSlug, uid }
// Creates a Payment Intent that routes the payment to the creator's Stripe account
// (minus the platform fee).
export async function POST(req: NextRequest) {
  if (!stripeEnabled()) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const templateSlug = body.templateSlug as string;
  const uid = body.uid as string;

  if (!templateSlug || !uid) {
    return NextResponse.json({ error: "templateSlug and uid required" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { firebaseUid: uid } });
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Find the template
  const template = await db.templateShare.findUnique({
    where: { slug: templateSlug },
  });
  if (!template) {
    return NextResponse.json({ error: "template not found" }, { status: 404 });
  }
  if (template.priceCents <= 0) {
    return NextResponse.json({ error: "this template is free" }, { status: 400 });
  }

  // Find the creator's Stripe connection
  if (!template.authorId) {
    return NextResponse.json({ error: "template has no author" }, { status: 400 });
  }
  const creatorConnection = await db.stripeConnection.findUnique({
    where: { userId: template.authorId },
  });
  if (!creatorConnection || !creatorConnection.chargesEnabled) {
    return NextResponse.json(
      { error: "Creator has not set up Stripe payments yet" },
      { status: 400 },
    );
  }

  try {
    const { clientSecret, paymentIntentId } = await createMarketplacePayment({
      amountCents: template.priceCents,
      creatorStripeAccountId: creatorConnection.stripeAccountId,
      description: `AGENTMARK Template: ${template.name}`,
      metadata: {
        templateSlug: template.slug,
        templateId: template.id,
        buyerUserId: user.id,
        creatorUserId: template.authorId,
        platformFee: String(PLATFORM_FEE_PERCENT),
      },
    });

    return NextResponse.json({
      clientSecret,
      paymentIntentId,
      amountCents: template.priceCents,
      platformFeePercent: PLATFORM_FEE_PERCENT,
      creatorReceivesCents: template.priceCents - Math.round((template.priceCents * PLATFORM_FEE_PERCENT) / 100),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "payment creation failed" },
      { status: 500 },
    );
  }
}
