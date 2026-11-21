import { describe, expect, it } from "vitest";
import { callGemini, callOpenAI } from "@/lib/llm/clients";
import { buildEndpoints } from "@/lib/llm/registry";
import { cooldownFor, order, route } from "@/lib/llm/router";
import { MemoryStore } from "@/lib/llm/state";
import { LlmError, type Endpoint, type LlmRequest } from "@/lib/llm/types";

const ep = (id: string, over: Partial<Endpoint> = {}): Endpoint => ({ id, provider: id.split("/")[0], model: id, kind: "openai", baseUrl: "http://x", key: "k", keyIndex: 0, tools: true, tier: 1, weight: 1, concurrency: 4, ...over });
const req = (over: Partial<LlmRequest> = {}): LlmRequest => ({ task: "json", system: "s", messages: [{ role: "user", content: "u" }], json: true, ...over });
const fixedRandom = (vals: number[]) => { let i = 0; return () => vals[i++ % vals.length]; };

describe("failover", () => {
  it("moves to the next endpoint on a rate limit and puts the first one on cooldown", async () => {
    const store = new MemoryStore();
    const calls: string[] = [];
    const r = await route(req(), { endpoints: () => [ep("a/m1"), ep("b/m2")], store, random: fixedRandom([0.9, 0.1]), call: async (e) => { calls.push(e.id); if (e.id === "a/m1") throw new LlmError("rate_limit", 429, 20); return { out: { ok: true }, text: "" }; } });
    expect(r.endpoint).toBe("b/m2");
    expect(calls).toEqual(["a/m1", "b/m2"]);
    expect((await store.cooldowns()).has("a/m1")).toBe(true);
  });

  it("skips an endpoint that is cooling down, in later requests too", async () => {
    const store = new MemoryStore();
    await store.setCooldown("a/m1", 60, "rate_limit");
    const calls: string[] = [];
    await route(req(), { endpoints: () => [ep("a/m1"), ep("b/m2")], store, call: async (e) => { calls.push(e.id); return { out: {}, text: "" }; } });
    expect(calls).toEqual(["b/m2"]);
  });

  it("waits for the earliest endpoint when all are cooling (bounded) and then succeeds", async () => {
    let t = 1_000_000;
    const store = new MemoryStore(() => t);
    await store.setCooldown("a/m1", 3, "rate_limit");
    const slept: number[] = [];
    const r = await route(req(), { endpoints: () => [ep("a/m1")], store, now: () => t, sleep: async (ms) => { slept.push(ms); t += ms; }, call: async () => ({ out: { ok: 1 }, text: "" }), maxWaitMs: 8000 });
    expect(r.out).toEqual({ ok: 1 });
    expect(slept).toHaveLength(1);
    expect(slept[0]).toBeGreaterThanOrEqual(3000);
  });

  it("gives up with a retry hint when the wait would be too long", async () => {
    const store = new MemoryStore();
    await store.setCooldown("a/m1", 100, "rate_limit");
    await expect(route(req(), { endpoints: () => [ep("a/m1")], store, call: async () => ({ out: {}, text: "" }), maxWaitMs: 5000 })).rejects.toMatchObject({ kind: "rate_limit", status: 429 });
  });

  it("an unusable answer (validation) goes to the next endpoint; three in a row stop", async () => {
    const store = new MemoryStore();
    let n = 0;
    const ok = await route(req({ validate: (o) => (o as { good?: boolean }).good === true }), { endpoints: () => [ep("a/1"), ep("b/2")], store, call: async () => ({ out: { good: ++n > 1 }, text: "" }) });
    expect(ok.attempts).toBe(2);
    await expect(route(req({ validate: () => false }), { endpoints: () => [ep("a/1"), ep("b/2"), ep("c/3"), ep("d/4")], store: new MemoryStore(), call: async () => ({ out: {}, text: "" }) })).rejects.toMatchObject({ kind: "bad_output" });
  });

  it("no providers configured is a clear error", async () => {
    await expect(route(req(), { endpoints: () => [], store: new MemoryStore() })).rejects.toThrow(/no_providers_configured/);
  });

  it("cooldown lengths by kind of failure", () => {
    expect(cooldownFor("rate_limit", 20)).toBe(20);
    expect(cooldownFor("rate_limit", 0)).toBe(30);
    expect(cooldownFor("quota", 0)).toBe(3600);
    expect(cooldownFor("auth", 0)).toBe(1800);
    expect(cooldownFor("server", 0)).toBe(20);
    expect(cooldownFor("bad_output", 0)).toBe(0);
  });

  it("a burst is spread: an endpoint at its concurrency cap is skipped", async () => {
    const store = new MemoryStore();
    const used: string[] = [];
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => { release = r; });
    const deps = { endpoints: () => [ep("a/1", { concurrency: 1, weight: 100 }), ep("b/2", { weight: 0.01 })], store, call: async (e: Endpoint) => { used.push(e.id); await gate; return { out: {}, text: "" }; } };
    const p1 = route(req(), deps);
    const p2 = route(req(), deps);
    await new Promise((r) => setTimeout(r, 10));
    release();
    await Promise.all([p1, p2]);
    expect(new Set(used)).toEqual(new Set(["a/1", "b/2"]));
  });
});

describe("ordering", () => {
  const pool = [ep("a/strong", { tier: 1 }), ep("b/small", { tier: 2 }), ep("c/premium", { tier: 0 })];
  it("answers prefer the strongest tier first; tiny tasks the cheapest", () => {
    expect(order(pool, req({ task: "teacher" }), Math.random).map((e) => e.id)).toEqual(["c/premium", "a/strong", "b/small"]);
    expect(order(pool, req({ task: "query" }), Math.random).map((e) => e.id)).toEqual(["b/small", "a/strong", "c/premium"]);
  });
  it("traffic is spread across equal endpoints of a tier", () => {
    const same = [ep("a/1"), ep("b/2"), ep("c/3")];
    const firsts: Record<string, number> = {};
    for (let i = 0; i < 3000; i++) { const f = order(same, req(), Math.random)[0].id; firsts[f] = (firsts[f] ?? 0) + 1; }
    for (const id of ["a/1", "b/2", "c/3"]) expect(firsts[id]).toBeGreaterThan(800);
  });
  it("structured answers prefer endpoints with reliable tool calling inside a tier", () => {
    const mixed = [ep("a/notools", { tools: false }), ep("b/tools", { tools: true })];
    for (let i = 0; i < 50; i++) expect(order(mixed, req({ tool: { name: "t", description: "d", schema: {} } }), Math.random)[0].id).toBe("b/tools");
  });
});

describe("registry", () => {
  it("a provider joins the pool just by having a key; several keys multiply the endpoints", () => {
    const one = buildEndpoints({ GROQ_API_KEY: "a" });
    expect(one.every((e) => e.provider === "groq")).toBe(true);
    const many = buildEndpoints({ GROQ_API_KEYS: "a,b", CEREBRAS_API_KEY: "c" });
    expect(many.filter((e) => e.provider === "groq").length).toBe(2 * one.length);
    expect(new Set(many.map((e) => e.id)).size).toBe(many.length);
    expect(many.some((e) => e.provider === "cerebras")).toBe(true);
    expect(buildEndpoints({})).toEqual([]);
  });
  it("any OpenAI-compatible provider can be added by LLM_EXTRA, and a broken value is ignored", () => {
    const e = buildEndpoints({ X_KEY: "k", LLM_EXTRA: JSON.stringify([{ id: "x", baseUrl: "https://x.example/v1", keyEnv: "X_KEY", models: [{ name: "m1", tier: 1 }] }]) });
    expect(e.map((x) => x.id)).toEqual(["x/m1#0"]);
    expect(buildEndpoints({ GROQ_API_KEY: "a", LLM_EXTRA: "{not json" }).length).toBeGreaterThan(0);
  });
  it("<ID>_MODELS overrides the model list and LLM_ONLY restricts the providers", () => {
    expect(buildEndpoints({ CEREBRAS_API_KEY: "c", CEREBRAS_MODELS: "foo-1,foo-2" }).map((e) => e.model)).toEqual(["foo-1", "foo-2"]);
    expect(buildEndpoints({ GROQ_API_KEY: "a", CEREBRAS_API_KEY: "c", LLM_ONLY: "cerebras" }).every((e) => e.provider === "cerebras")).toBe(true);
  });
});

const mockFetch = (status: number, body: unknown, headers: Record<string, string> = {}) => (async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers })) as unknown as typeof fetch;

describe("wire formats", () => {
  it("OpenAI-compatible: a forced tool call returns the arguments", async () => {
    const r = await callOpenAI(ep("g/1", { provider: "groq" }), req({ json: false, tool: { name: "t", description: "d", schema: {} } }), mockFetch(200, { choices: [{ message: { tool_calls: [{ function: { arguments: '{"speech":"oi"}' } }] } }] }));
    expect(r.out).toEqual({ speech: "oi" });
  });
  it("OpenAI-compatible without tools: JSON mode with the schema in the prompt", async () => {
    let sent: { response_format?: unknown; messages?: { content: string }[] } = {};
    const f = (async (_u: string, init: RequestInit) => { sent = JSON.parse(String(init.body)); return new Response(JSON.stringify({ choices: [{ message: { content: 'texto {"a":1} fim' } }] })); }) as unknown as typeof fetch;
    const r = await callOpenAI(ep("o/1", { provider: "openrouter", tools: false }), req({ json: false, tool: { name: "t", description: "d", schema: { type: "object" } } }), f);
    expect(r.out).toEqual({ a: 1 });
    expect(sent.response_format).toEqual({ type: "json_object" });
    expect(sent.messages?.[0].content).toMatch(/esquema/);
  });
  it("classifies rate limits with Retry-After, daily quota, bad key and outages", async () => {
    await expect(callOpenAI(ep("g/1"), req(), mockFetch(429, "Rate limit reached per minute", { "retry-after": "17" }))).rejects.toMatchObject({ kind: "rate_limit", retryAfter: 17 });
    await expect(callOpenAI(ep("g/1"), req(), mockFetch(429, "tokens per day (TPD) limit"))).rejects.toMatchObject({ kind: "quota" });
    await expect(callOpenAI(ep("g/1"), req(), mockFetch(402, "credits depleted"))).rejects.toMatchObject({ kind: "quota" });
    await expect(callOpenAI(ep("g/1"), req(), mockFetch(401, "bad key"))).rejects.toMatchObject({ kind: "auth" });
    await expect(callOpenAI(ep("g/1"), req(), mockFetch(503, "down"))).rejects.toMatchObject({ kind: "server" });
    await expect(callOpenAI(ep("g/1"), req(), mockFetch(413, "too big"))).rejects.toMatchObject({ kind: "too_large" });
  });
  it("Gemini: JSON answer parsed from the candidate text", async () => {
    const r = await callGemini(ep("gemini/m", { kind: "gemini", provider: "gemini", tools: false }), req(), mockFetch(200, { candidates: [{ content: { parts: [{ text: '{"content":"ok"}' }] } }] }));
    expect(r.out).toEqual({ content: "ok" });
  });
});

import { pickOpenRouterFree } from "@/lib/llm/discovery";
describe("free model discovery", () => {
  const m = (id: string, ctx: number, params: string[], free = true, out: string[] = ["text"]) => ({ id, context_length: ctx, pricing: { prompt: free ? "0" : "0.000001", completion: free ? "0" : "0.000002" }, supported_parameters: params, architecture: { output_modalities: out } });
  it("keeps only free text models that can answer structured output, biggest context first", () => {
    const out = pickOpenRouterFree([m("a/big:free", 128000, ["tools", "response_format"]), m("b/paid", 200000, ["tools"], false), m("c/small:free", 32000, ["response_format"]), m("d/vision-vl:free", 100000, ["tools"]), m("e/notools:free", 64000, []), m("f/image:free", 90000, ["tools"], true, ["image"])]);
    expect(out.map((x) => x.name)).toEqual(["a/big:free", "c/small:free"]);
    expect(out[0].tools).toBe(true);
    expect(out[1].tools).toBe(false);
  });
});

describe("budget and parking", () => {
  it("stops at the deadline instead of using the whole function time", async () => {
    let t = 0;
    const store = new MemoryStore(() => t);
    const e = [ep("a/1"), ep("b/2"), ep("c/3")];
    await expect(route(req(), { endpoints: () => e, store, now: () => t, deadlineMs: 10000, call: async () => { t += 6000; throw new LlmError("timeout", 0); } })).rejects.toMatchObject({ kind: "timeout" });
  });
  it("an endpoint that fails three times in a row is parked for 5 minutes", async () => {
    const store = new MemoryStore();
    const e = [ep("bad/1", { tier: 0 }), ep("good/2", { tier: 1 })]; // the bad one is always tried first
    const deps = { endpoints: () => e, store, random: () => 0.5, call: async (x: Endpoint) => { if (x.id === "bad/1") throw new LlmError("other", 400, 0, "unsupported"); return { out: {}, text: "" }; } };
    for (let i = 0; i < 3; i++) await route(req(), deps);
    expect((await store.cooldowns()).has("bad/1")).toBe(true);
  });
});
