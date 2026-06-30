import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { getPlan, resolvePlanFromPriceId } from "@/lib/plans";

export const dynamic = "force-dynamic";

// POST /api/billing/webhook
// Stripe webhook receiver — verifies signature with STRIPE_WEBHOOK_SECRET.
// Handles:
//   - checkout.session.completed → upgrade user.plan + limits based on priceId
//   - customer.subscription.updated → re-sync plan + limits
//   - customer.subscription.deleted → downgrade to free
// Returns 200 on success (Stripe retries on non-2xx).

type StripeSubscription = {
  id: string;
  customer: string;
  status: string;
  items?: {
    data?: Array<{
      price?: { id?: string };
    }>;
  };
  current_period_start?: number;
  current_period_end?: number;
};

type StripeCheckoutSession = {
  id: string;
  client_reference_id?: string | null;
  customer?: string | null;
  subscription?: string | null;
  metadata?: Record<string, string> | null;
};

function priceIdFromSubscription(sub: StripeSubscription): string | null {
  const items = sub.items?.data;
  if (!items || items.length === 0) return null;
  const price = items[0]?.price;
  return price?.id || null;
}

// Apply a plan upgrade to the user record. Looks the user up by either
// firebaseUid (preferred — from metadata) or stripeCustomerId (fallback).
async function applyUpgrade(opts: {
  firebaseUid?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  priceId: string;
}) {
  const { firebaseUid, stripeCustomerId, stripeSubscriptionId, priceId } = opts;
  const plan = resolvePlanFromPriceId(priceId);
  if (!plan) {
    console.warn("[billing/webhook] priceId did not match a configured plan:", priceId);
    return null;
  }

  // Find the user — prefer firebaseUid, fall back to stripeCustomerId.
  // stripeCustomerId isn't @unique in the schema (defaults to "" — many users
  // share the empty value), so the fallback uses findFirst with a non-empty
  // guard.
  let user = null as Awaited<ReturnType<typeof db.user.findFirst>> | null;
  if (firebaseUid) {
    user = await db.user.findUnique({ where: { firebaseUid } });
  }
  if (!user && stripeCustomerId) {
    user = await db.user.findFirst({ where: { stripeCustomerId } });
  }
  if (!user) {
    console.warn("[billing/webhook] no user found for upgrade", { firebaseUid, stripeCustomerId });
    return null;
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      plan: plan.id,
      maxAgents: plan.maxAgents,
      dailyTokenLimit: plan.dailyTokenLimit,
      stripePriceId: priceId,
      ...(stripeCustomerId ? { stripeCustomerId } : {}),
      ...(stripeSubscriptionId ? { stripeSubscriptionId } : {}),
    },
  });
  return updated;
}

// Downgrade the user to free — used when a subscription is canceled.
async function applyDowngrade(stripeCustomerId: string) {
  const user = await db.user.findFirst({ where: { stripeCustomerId } });
  if (!user) {
    console.warn("[billing/webhook] no user for stripeCustomerId", stripeCustomerId);
    return null;
  }
  const free = getPlan("free");
  return db.user.update({
    where: { id: user.id },
    data: {
      plan: "free",
      maxAgents: free.maxAgents,
      dailyTokenLimit: free.dailyTokenLimit,
      stripePriceId: "",
      stripeSubscriptionId: "",
    },
  });
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "webhook_secret_not_set" }, { status: 500 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "billing_disabled" }, { status: 503 });
  }

  // Stripe signs the *raw* body, so we need the raw bytes — Next.js parses
  // JSON by default, so we re-fetch via req.text().
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("[billing/webhook] signature verification failed:", err);
    return NextResponse.json(
      { error: "signature_verification_failed", message: err instanceof Error ? err.message : "unknown" },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as unknown as StripeCheckoutSession;
        const firebaseUid =
          session.client_reference_id || session.metadata?.firebaseUid || null;
        const priceId = session.metadata?.priceId || null;
        const stripeCustomerId =
          typeof session.customer === "string" ? session.customer : null;
        const stripeSubscriptionId =
          typeof session.subscription === "string" ? session.subscription : null;
        if (!priceId) {
          console.warn("[billing/webhook] checkout.session.completed has no priceId metadata");
          break;
        }
        await applyUpgrade({
          firebaseUid,
          stripeCustomerId,
          stripeSubscriptionId,
          priceId,
        });
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as unknown as StripeSubscription;
        const priceId = priceIdFromSubscription(sub);
        if (!priceId) {
          console.warn("[billing/webhook] subscription.updated has no price");
          break;
        }
        // If the sub is canceled/expired, downgrade instead of upgrading.
        if (sub.status === "canceled" || sub.status === "unpaid" || sub.status === "incomplete_expired") {
          if (typeof sub.customer === "string") {
            await applyDowngrade(sub.customer);
          }
          break;
        }
        await applyUpgrade({
          firebaseUid: null,
          stripeCustomerId: typeof sub.customer === "string" ? sub.customer : null,
          stripeSubscriptionId: sub.id,
          priceId,
        });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as unknown as StripeSubscription;
        if (typeof sub.customer === "string") {
          await applyDowngrade(sub.customer);
        }
        break;
      }

      default:
        // Ignore other event types — we don't need them for billing.
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[billing/webhook] handler error:", err);
    return NextResponse.json(
      { error: "handler_error", message: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
