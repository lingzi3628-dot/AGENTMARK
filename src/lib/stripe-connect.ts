// Stripe Connect helpers — lets users connect their own Stripe account
// to sell templates on the marketplace.
// Uses Stripe OAuth flow (account-based, not payment-based).

import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!_stripe) {
    _stripe = new Stripe(key);
  }
  return _stripe;
}

export function stripeEnabled(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

// Platform fee percentage (default 20% — goes to the platform owner, rest to creator)
export const PLATFORM_FEE_PERCENT = 20;

/**
 * Build the Stripe Connect OAuth URL.
 * The user is redirected here to authorize their Stripe account.
 */
export function buildConnectUrl(state: string, redirectUri: string): string {
  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
  if (!clientId) throw new Error("STRIPE_CONNECT_CLIENT_ID not set");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: "read_write",
    redirect_uri: redirectUri,
    state,
  });

  return `https://connect.stripe.com/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange the OAuth code for a Stripe account ID (connected account).
 */
export async function exchangeConnectCode(
  code: string,
): Promise<{
  stripe_user_id: string;
  stripe_publishable_key: string;
  scope: string;
}> {
  const res = await fetch("https://connect.stripe.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_secret: process.env.STRIPE_SECRET_KEY!,
    }),
  });

  const data = await res.json();
  if (data.error) {
    throw new Error(data.error_description || data.error);
  }

  return {
    stripe_user_id: data.stripe_user_id,
    stripe_publishable_key: data.stripe_publishable_key,
    scope: data.scope,
  };
}

/**
 * Fetch account details from Stripe (email, name, country, charges_enabled).
 */
export async function getAccountDetails(
  accountId: string,
): Promise<{
  email: string;
  displayName: string;
  country: string;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
}> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe not configured");

  const account = await stripe.accounts.retrieve(accountId);
  return {
    email: account.email || "",
    displayName:
      (account.business_profile?.name as string) ||
      account.settings?.dashboard?.display_name ||
      account.email ||
      "",
    country: account.country || "",
    chargesEnabled: account.charges_enabled ?? false,
    detailsSubmitted: account.details_submitted ?? false,
  };
}

/**
 * Create a Payment Intent for a marketplace purchase.
 * The platform fee is taken automatically and routed to the platform's Stripe account.
 * The remainder goes to the creator's connected Stripe account.
 */
export async function createMarketplacePayment(params: {
  amountCents: number;
  creatorStripeAccountId: string;
  description: string;
  metadata: Record<string, string>;
}): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe not configured");

  const platformFee = Math.round(
    (params.amountCents * PLATFORM_FEE_PERCENT) / 100,
  );

  const intent = await stripe.paymentIntents.create({
    amount: params.amountCents,
    currency: "usd",
    description: params.description,
    metadata: params.metadata,
    application_fee_amount: platformFee,
    transfer_data: {
      destination: params.creatorStripeAccountId,
    },
  });

  return {
    clientSecret: intent.client_secret!,
    paymentIntentId: intent.id,
  };
}

/**
 * Generate a login link for the creator to manage their Stripe account.
 */
export async function createLoginLink(accountId: string): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe not configured");
  const link = await stripe.accounts.createLoginLink(accountId);
  return link.url;
}
