// Simulated provider: the complete subscription flow (checkout, confirmed, overdue, canceled) without money or an account.
// The checkout page /checkout/simulado confirms the payment by sending the same webhook a real provider would send, signed with
// the shared token. Used until the Asaas account exists; with PAYMENT_PROVIDER=asaas it is not reachable.
import { randomUUID } from "node:crypto";
import type { CheckoutRequest, CheckoutResult, NormalizedEvent, PaymentProvider } from "./types";

export const SIM_TOKEN_HEADER = "x-sim-token";
export const simToken = () => process.env.PAYMENT_WEBHOOK_TOKEN ?? process.env.BILLING_SERVER_SECRET ?? "";

export class SimulatedProvider implements PaymentProvider {
  readonly name = "simulated" as const;
  async createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    const providerRef = `sim_${randomUUID()}`;
    const qs = new URLSearchParams({ ref: providerRef, plan: req.plan, cycle: req.cycle, method: req.method, amount: String(req.amountBrl), trial: req.trial ? "1" : "0" });
    return { providerRef, checkoutUrl: `/checkout/simulado?${qs}` };
  }
  async cancelSubscription() {
    /* nothing to cancel remotely */
  }
  parseWebhook(headers: Headers, rawBody: string): NormalizedEvent | null {
    const token = headers.get(SIM_TOKEN_HEADER);
    if (!token || token !== simToken()) return null;
    try {
      const b = JSON.parse(rawBody) as { id: string; event: string; ref: string; periodEnd?: string; at?: string };
      const type = ({ PAYMENT_CONFIRMED: "payment_confirmed", PAYMENT_OVERDUE: "payment_overdue", SUBSCRIPTION_DELETED: "subscription_deleted", TRIAL_STARTED: "trial_started" } as const)[b.event as "PAYMENT_CONFIRMED"] ?? "ignored";
      return { key: `simulated:${b.id}`, type, providerRef: b.ref, periodEnd: b.periodEnd ? new Date(b.periodEnd) : undefined, at: b.at ? new Date(b.at) : new Date(), raw: b };
    } catch {
      return null;
    }
  }
}
