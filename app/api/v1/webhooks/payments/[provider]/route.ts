// POST /api/v1/webhooks/payments/:provider -> payment webhooks. The token/signature of the provider is verified first; the event is logged
// once (idempotency key) and only then moves the subscription and writes the access right. Always answers 200 for duplicates.
import { getProvider, applyEvent } from "@/lib/payments/service";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (provider !== "asaas" && provider !== "simulated") return Response.json({ error: "unknown_provider" }, { status: 404 });
  const raw = await req.text();
  const ev = getProvider(provider).parseWebhook(req.headers, raw);
  if (!ev) return Response.json({ error: "invalid_token" }, { status: 401 });
  try {
    const result = await applyEvent(ev, provider);
    return Response.json({ ok: true, result });
  } catch (e) {
    console.error(JSON.stringify({ evt: "webhook_error", provider, code: (e as Error).message.slice(0, 80) }));
    return Response.json({ error: "processing_failed" }, { status: 500 }); // the provider retries
  }
}
