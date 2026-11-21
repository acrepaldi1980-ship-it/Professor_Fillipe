// GET /api/v1/plans -> the plans (prices, limits, features) for the comparison screen. Public.
import { anonClient, errorResponse } from "@/lib/auth/server";
import { loadPlans } from "@/lib/entitlements/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const plans = await loadPlans(anonClient());
    return Response.json({ plans, provider: process.env.PAYMENT_PROVIDER ?? "simulated" }, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch (e) {
    return errorResponse(e);
  }
}
