// GET /api/v1/config: remote configuration (feature flags, minimum supported app version) read on app open (spec 10.6.6).
import { anonClient } from "@/lib/auth/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { data, error } = await anonClient().from("app_config").select("key, value, min_app_version");
  if (error) return Response.json({ error: "config_unavailable" }, { status: 502 });
  const platform = req.headers.get("x-platform") ?? "web";
  const min = (data ?? []).find((r) => r.key === "min_version")?.value as Record<string, string> | undefined;
  return Response.json({
    minVersion: min?.[platform] ?? "0.0.0",
    flags: (data ?? []).find((r) => r.key === "feature_flags")?.value ?? {},
  });
}
