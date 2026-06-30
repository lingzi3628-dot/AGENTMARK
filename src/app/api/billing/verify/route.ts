import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyTransaction, paystackEnabled } from "@/lib/paystack";
import { getPlan } from "@/lib/plans";

export const dynamic = "force-dynamic";

// Verify a Paystack transaction after the user is redirected back from checkout.
// Query param: ?reference=<transaction_reference>
export async function GET(req: NextRequest) {
  if (!paystackEnabled()) {
    return NextResponse.redirect(new URL("/billing?error=billing_disabled", req.nextUrl.origin));
  }

  const reference = req.nextUrl.searchParams.get("reference");
  if (!reference) {
    return NextResponse.redirect(new URL("/billing?error=missing_reference", req.nextUrl.origin));
  }

  try {
    const result = await verifyTransaction(reference);
    if (!result.status || result.data.status !== "success") {
      return NextResponse.redirect(new URL("/billing?error=payment_failed", req.nextUrl.origin));
    }

    // Extract plan from metadata (we stored it during checkout)
    const metadata = result.data.metadata as { custom_fields?: { variable_name: string; value: string }[] } | undefined;
    const planId = metadata?.custom_fields?.find((f) => f.variable_name === "plan")?.value as "pro" | "team" | undefined;

    if (!planId) {
      return NextResponse.redirect(new URL("/billing?error=no_plan", req.nextUrl.origin));
    }

    const plan = getPlan(planId);
    const customerEmail = result.data.customer.email;
    const customerCode = result.data.customer.customer_code;

    // Find user by email (Paystack customer email should match the user's email)
    const user = await db.user.findFirst({ where: { email: customerEmail } });
    if (!user) {
      return NextResponse.redirect(new URL("/billing?error=user_not_found", req.nextUrl.origin));
    }

    // Update user to the new plan
    await db.user.update({
      where: { id: user.id },
      data: {
        plan: planId,
        maxAgents: plan.maxAgents,
        dailyTokenLimit: plan.dailyTokenLimit,
        // Store Paystack customer code + subscription reference for future management
        stripeCustomerId: customerCode, // repurposing this field for Paystack customer code
        stripePriceId: plan.id, // repurposing this field for the plan id
        stripeSubscriptionId: reference, // repurposing this field for the transaction reference
      },
    });

    return NextResponse.redirect(new URL("/billing?success=true", req.nextUrl.origin));
  } catch (err) {
    console.error("[billing/verify] error:", err);
    return NextResponse.redirect(new URL("/billing?error=verification_failed", req.nextUrl.origin));
  }
}
