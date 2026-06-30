import Stripe from "stripe";
import { billingEnabled } from "./plans";

// Lazily-instantiated Stripe client. Returns null when STRIPE_SECRET_KEY is
// not configured — callers MUST guard with billingEnabled() before calling.
let _stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!billingEnabled()) return null;
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY as string;
    // NOTE: apiVersion is intentionally omitted — the Stripe SDK pins to its
    // own default version and rejects strings that aren't an exact match for
    // the installed library. Omitting keeps us forward-compat across SDK
    // upgrades (v17 → v22+).
    _stripe = new Stripe(key);
  }
  return _stripe;
}
