// Builds the pool of endpoints from environment variables. Adding a free provider needs NO code: set its key (or several, comma
// separated, to multiply the free quota) and it joins the pool. Anything OpenAI-compatible can also be added through LLM_EXTRA (JSON).
import type { Endpoint, Kind } from "./types";

export interface ModelDef { name: string; tier: number; tools?: boolean; weight?: number; extra?: Record<string, unknown> }

/** Models found at run time (see discovery.ts); they replace the defaults of that provider. */
const discovered = new Map<string, ModelDef[]>();
export function setDiscovered(provider: string, models: ModelDef[]) { discovered.set(provider, models); }

interface ProviderDef {
  id: string;
  kind: Kind;
  baseUrl: string;
  keyEnv: string;
  /** Default models (override with <ID>_MODELS = comma separated list). */
  models: ModelDef[];
  concurrency?: number;
}

export const PROVIDERS: ProviderDef[] = [
  // Groq: each model has its own free limits, so each one is an endpoint.
  { id: "groq", kind: "openai", baseUrl: "https://api.groq.com/openai/v1", keyEnv: "GROQ_API_KEY", models: [
    { name: "openai/gpt-oss-120b", tier: 1, tools: true, extra: { reasoning_effort: "low" } },
    { name: "qwen/qwen3.8-27b", tier: 1, tools: true },
    { name: "openai/gpt-oss-20b", tier: 2, tools: true, extra: { reasoning_effort: "low" } },
  ] },
  { id: "cerebras", kind: "openai", baseUrl: "https://api.cerebras.ai/v1", keyEnv: "CEREBRAS_API_KEY", models: [
    { name: "gpt-oss-120b", tier: 1, tools: true, extra: { reasoning_effort: "low" } },
    { name: "llama-3.3-70b", tier: 1, tools: true },
    { name: "qwen-3-32b", tier: 2, tools: false },
  ] },
  // OpenRouter's free list changes constantly: its models are discovered at run time (discovery.ts); only OPENROUTER_MODELS overrides that.
  { id: "openrouter", kind: "openai", baseUrl: "https://openrouter.ai/api/v1", keyEnv: "OPENROUTER_API_KEY", models: [] },
  { id: "mistral", kind: "openai", baseUrl: "https://api.mistral.ai/v1", keyEnv: "MISTRAL_API_KEY", models: [
    { name: "mistral-small-latest", tier: 1, tools: true },
    { name: "open-mistral-nemo", tier: 2, tools: true },
  ] },
  { id: "sambanova", kind: "openai", baseUrl: "https://api.sambanova.ai/v1", keyEnv: "SAMBANOVA_API_KEY", models: [
    { name: "Meta-Llama-3.3-70B-Instruct", tier: 1, tools: false },
  ] },
  { id: "nvidia", kind: "openai", baseUrl: "https://integrate.api.nvidia.com/v1", keyEnv: "NVIDIA_API_KEY", models: [
    { name: "meta/llama-3.3-70b-instruct", tier: 1, tools: false },
  ] },
  { id: "github", kind: "openai", baseUrl: "https://models.inference.ai.azure.com", keyEnv: "GITHUB_MODELS_TOKEN", models: [
    { name: "gpt-4o-mini", tier: 2, tools: true },
  ] },
  // Google AI Studio free tier (create the key in a project WITHOUT prepaid billing).
  { id: "gemini", kind: "gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta", keyEnv: "GEMINI_LLM_API_KEY", models: [
    { name: "gemini-2.5-flash", tier: 1, tools: false },
    { name: "gemini-2.5-flash-lite", tier: 2, tools: false },
  ] },
];

const split = (v?: string) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

/** Reads the environment each time it is asked (cheap) so tests and hot config changes work. */
export function buildEndpoints(env: Record<string, string | undefined> = process.env): Endpoint[] {
  const out: Endpoint[] = [];
  const defs = [...PROVIDERS];
  // Any other OpenAI-compatible provider: LLM_EXTRA='[{"id":"x","baseUrl":"https://...","keyEnv":"X_API_KEY","models":[{"name":"m","tier":1}]}]'
  try {
    const extra = env.LLM_EXTRA ? (JSON.parse(env.LLM_EXTRA) as ProviderDef[]) : [];
    for (const d of extra) if (d?.id && d.baseUrl && d.keyEnv && Array.isArray(d.models)) defs.push({ ...d, kind: d.kind ?? "openai" });
  } catch { /* a broken LLM_EXTRA must never take the app down */ }
  for (const d of defs) {
    // keys: GROQ_API_KEY=a  or  GROQ_API_KEYS=a,b,c  (each key has its own free quota)
    const keys = [...split(env[d.keyEnv]), ...split(env[d.keyEnv.replace(/_KEY$/, "_KEYS").replace(/_TOKEN$/, "_TOKENS")])];
    const uniqueKeys = [...new Set(keys)];
    if (!uniqueKeys.length) continue;
    const idKey = d.id.toUpperCase();
    const override = split(env[`${idKey}_MODELS`]);
    const models = override.length ? override.map((name) => d.models.find((m) => m.name === name) ?? { name, tier: 1, tools: false }) : discovered.get(d.id) ?? d.models;
    uniqueKeys.forEach((key, keyIndex) => {
      for (const m of models) {
        out.push({ id: `${d.id}/${m.name}#${keyIndex}`, provider: d.id, model: m.name, kind: d.kind, baseUrl: d.baseUrl, key, keyIndex, tools: m.tools ?? false, tier: m.tier, weight: m.weight ?? 1, extra: m.extra, concurrency: d.concurrency ?? 4 });
      }
    });
  }
  // the legacy single-model setting of the old Groq adapter still works
  const only = split(env.LLM_ONLY);
  return only.length ? out.filter((e) => only.includes(e.provider)) : out;
}
