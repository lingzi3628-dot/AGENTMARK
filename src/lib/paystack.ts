// Paystack API helpers — replaces Stripe.
// Paystack is the leading African payment gateway (supports NGN, GHS, ZAR, KES, USD).
// Docs: https://paystack.com/docs/api/

import { createHmac, timingSafeEqual, randomBytes } from "crypto";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

export function paystackEnabled(): boolean {
  return !!process.env.PAYSTACK_SECRET_KEY;
}

function getSecretKey(): string {
  return process.env.PAYSTACK_SECRET_KEY || "";
}

export interface PaystackInitParams {
  email: string;
  amount: number; // in USD cents (Paystack converts to local currency at checkout)
  reference: string;
  plan?: string; // Paystack plan code for recurring subscriptions
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}

export interface PaystackInitResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

/** Initialize a Paystack transaction. Returns the hosted checkout URL. */
export async function initializeTransaction(params: PaystackInitParams): Promise<PaystackInitResponse> {
  const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${getSecretKey()}`,
      "content-type": "application/json",
      "cache-control": "no-cache",
    },
    body: JSON.stringify({
      email: params.email,
      // Paystack expects amounts in the smallest currency unit (kobo/cents).
      // For USD, multiply by 100. We pass amount already in cents.
      amount: params.amount,
      reference: params.reference,
      callback_url: params.callbackUrl,
      ...(params.plan ? { plan: params.plan } : {}),
      metadata: params.metadata || {},
      currency: "USD",
    }),
  });
  return (await res.json()) as PaystackInitResponse;
}

export interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    domain: string;
    status: string; // success | failed | abandoned | pending
    reference: string;
    amount: number;
    currency: string;
    customer: {
      id: number;
      first_name: string;
      last_name: string;
      email: string;
      customer_code: string;
    };
    plan: { name: string; plan_code: string } | null;
    createdAt: string;
  };
}

/** Verify a transaction by reference. Required after the user is redirected back. */
export async function verifyTransaction(reference: string): Promise<PaystackVerifyResponse> {
  const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`, {
    method: "GET",
    headers: {
      authorization: `Bearer ${getSecretKey()}`,
      "cache-control": "no-cache",
    },
  });
  return (await res.json()) as PaystackVerifyResponse;
}

/** Verify the Paystack webhook signature (HMAC-SHA512 of the raw body). */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  if (!process.env.PAYSTACK_SECRET_KEY) return false;
  const expected = createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest("hex");
  // Constant-time compare to prevent timing attacks
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
}

export interface PaystackSubscription {
  id: number;
  status: string; // active | cancelled | completed | non-renewing
  plan: { name: string; plan_code: string; amount: number; interval: string };
  customer: { email: string; customer_code: string };
  createdAt: string;
}

/** Disable a subscription (cancel going forward). */
export async function disableSubscription(subscriptionCode: string, emailToken: string): Promise<boolean> {
  const res = await fetch(`${PAYSTACK_BASE_URL}/subscription/disable`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${getSecretKey()}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ code: subscriptionCode, token: emailToken }),
  });
  return res.ok;
}

/** Generate a unique transaction reference. */
export function generateReference(prefix = "am"): string {
  const random = randomBytes(8).toString("hex");
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${random}`;
}
