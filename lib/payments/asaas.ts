// Asaas provider (Pix, card, boleto, recurring subscription). Written from Asaas's public API documentation and NOT yet exercised against
// a real sandbox account (none exists yet): connect it with ASAAS_API_KEY (+ ASAAS_ENV=sandbox) and PAYMENT_PROVIDER=asaas, then run the
// sandbox flow of the Prompt 1.11 checklist. The webhook is authenticated by the token configured in the Asaas panel (header asaas-access-token).
import type { CheckoutRequest, CheckoutResult, NormalizedEvent, PaymentProvider } from "./types";

const base = () => (process.env.ASAAS_ENV === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3");
const key = () => process.env.ASAAS_API_KEY ?? "";
const BILLING = { pix: "PIX", card: "CREDIT_CARD", boleto: "BOLETO" } as const;

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    method: init.method ?? "GET",
    headers: { "Content-Type": "application/json", access_token: key(), "User-Agent": "professor-filipe" },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`asaas_${res.status}`);
  return (await res.json()) as T;
}

export class AsaasProvider implements PaymentProvider {
  readonly name = "asaas" as const;

  async createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    const customer = await call<{ id: string }>("/customers", { method: "POST", body: { name: req.name, email: req.email, externalReference: req.userId } });
    const first = new Date(Date.now() + (req.trial ? 7 : 0) * 86_400_000);
    const sub = await call<{ id: string; invoiceUrl?: string }>("/subscriptions", {
      method: "POST",
      body: {
        customer: customer.id,
        billingType: BILLING[req.method],
        value: req.amountBrl,
        nextDueDate: first.toISOString().slice(0, 10),
        cycle: req.cycle === "year" ? "YEARLY" : "MONTHLY",
        description: `Professor Filipe ${req.plan === "premium" ? "Premium" : "Plus"}`,
        externalReference: `${req.userId}|${req.plan}|${req.cycle}`,
      },
    });
    // the first charge of the subscription carries the payment link (Pix code, card form or boleto)
    const pays = await call<{ data: { invoiceUrl?: string }[] }>(`/subscriptions/${sub.id}/payments`);
    return { providerRef: sub.id, checkoutUrl: pays.data?.[0]?.invoiceUrl ?? sub.invoiceUrl ?? "" };
  }

  async cancelSubscription(providerRef: string) {
    await call(`/subscriptions/${providerRef}`, { method: "DELETE" });
  }

  parseWebhook(headers: Headers, rawBody: string): NormalizedEvent | null {
    const token = process.env.PAYMENT_WEBHOOK_TOKEN;
    if (!token || headers.get("asaas-access-token") !== token) return null;
    try {
      const b = JSON.parse(rawBody) as { id?: string; event: string; payment?: { id: string; subscription?: string; dueDate?: string }; subscription?: { id: string } };
      const ref = b.payment?.subscription ?? b.subscription?.id;
      if (!ref) return null;
      const type = ({ PAYMENT_CONFIRMED: "payment_confirmed", PAYMENT_RECEIVED: "payment_confirmed", PAYMENT_OVERDUE: "payment_overdue", SUBSCRIPTION_DELETED: "subscription_deleted", SUBSCRIPTION_INACTIVATED: "subscription_deleted" } as const)[b.event as "PAYMENT_CONFIRMED"] ?? "ignored";
      return { key: `asaas:${b.id ?? `${b.event}:${b.payment?.id ?? ref}`}`, type, providerRef: ref, at: new Date(), raw: b };
    } catch {
      return null;
    }
  }
}
