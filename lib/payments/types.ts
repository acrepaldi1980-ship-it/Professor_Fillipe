// Payment provider contract (spec 8.12, 10.5). Asaas is the first real provider; a simulated one runs the whole flow without money.
import type { PlanId } from "../entitlements";

export type BillingCycle = "month" | "year";
export type PayMethod = "pix" | "card" | "boleto";

export interface CheckoutRequest {
  userId: string;
  email: string;
  name: string;
  plan: Exclude<PlanId, "free">;
  cycle: BillingCycle;
  method: PayMethod;
  /** Premium only: 7 days free before the first charge. */
  trial: boolean;
  amountBrl: number;
}
export interface CheckoutResult {
  providerRef: string; // subscription id at the provider
  /** Where the student finishes paying (Pix code page, card form, boleto). */
  checkoutUrl: string;
}

/** What every provider's webhook is translated into. */
export interface NormalizedEvent {
  /** Unique per provider event: makes the webhook idempotent. */
  key: string;
  type: "payment_confirmed" | "payment_overdue" | "subscription_deleted" | "trial_started" | "ignored";
  providerRef: string;
  /** Present when the provider tells it (otherwise the service computes it from the cycle). */
  periodEnd?: Date;
  at: Date;
  raw: unknown;
}

export interface PaymentProvider {
  readonly name: "asaas" | "simulated";
  createCheckout(req: CheckoutRequest): Promise<CheckoutResult>;
  cancelSubscription(providerRef: string): Promise<void>;
  /** Verifies the webhook's token/signature and returns the normalized event, or null when it must be rejected. */
  parseWebhook(headers: Headers, rawBody: string): NormalizedEvent | null;
}
