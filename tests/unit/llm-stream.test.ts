import { describe, expect, it } from "vitest";
import { callGemini, callOpenAI } from "@/lib/llm/clients";
import { route } from "@/lib/llm/router";
import { MemoryStore } from "@/lib/llm/state";
import { readSse, speechFromPartialJson } from "@/lib/llm/stream";
import { LlmError, type Endpoint, type LlmRequest } from "@/lib/llm/types";
import { runTurn } from "@/lib/teacher/pipeline";

const ep = (id: string, over: Partial<Endpoint> = {}): Endpoint => ({ id, provider: id.split("/")[0], model: id, kind: "openai", baseUrl: "http://x", key: "k", keyIndex: 0, tools: true, tier: 1, weight: 1, concurrency: 4, ...over });
const sseBody = (events: string[], cut = 0) => {
  const text = events.map((e) => `data: ${e}\n\n`).join("");
  const enc = new TextEncoder();
  const chunks = cut ? Array.from({ length: Math.ceil(text.length / cut) }, (_, i) => text.slice(i * cut, (i + 1) * cut)) : [text];
  return new ReadableStream<Uint8Array>({ start(c) { for (const x of chunks) c.enqueue(enc.encode(x)); c.close(); } });
};
const streamFetch = (events: string[], cut = 0): typeof fetch => (async () => new Response(sseBody(events, cut), { status: 200, headers: { "Content-Type": "text/event-stream" } })) as never;

describe("speech of a JSON that is still being written", () => {
  it("shows what has been written, never a half escape", () => {
    expect(speechFromPartialJson('{"citations":[],')).toBe("");
    expect(speechFromPartialJson('{"speech":"Oi, A')).toBe("Oi, A");
    expect(speechFromPartialJson('{"speech":"Linha 1\\nLinha 2 \\"citação\\" fim","visuals":[]}')).toBe('Linha 1\nLinha 2 "citação" fim');
    expect(speechFromPartialJson('{"speech":"fim\\')).toBe("fim");
    expect(speechFromPartialJson('{"speech":"acentu\\u00e7\\u00e3o')).toBe("acentução");
    expect(speechFromPartialJson('{"speech":"meia \\u00e')).toBe("meia ");
    expect(speechFromPartialJson('{ "speech" : "com espaços')).toBe("com espaços");
  });
});

describe("server-sent events", () => {
  it("reads events cut anywhere", async () => {
    const seen: string[] = [];
    await readSse(sseBody(["a", "bb", "[DONE]"], 3), (d) => seen.push(d));
    expect(seen).toEqual(["a", "bb", "[DONE]"]);
  });
});

describe("OpenAI-compatible streaming", () => {
  const req = (over: Partial<LlmRequest> = {}): LlmRequest => ({ task: "teacher", system: "s", messages: [{ role: "user", content: "u" }], tool: { name: "t", description: "d", schema: {} }, ...over });
  it("asks for JSON text (not a forced tool call) and relays it as it arrives", async () => {
    const seen: string[] = [];
    let body: Record<string, unknown> = {};
    const pieces = ['{"speech":"Oi', ', mundo.","visuals":', '[]}'].map((a) => JSON.stringify({ choices: [{ delta: { content: a } }] }));
    const inner = streamFetch([...pieces, "[DONE]"], 7);
    const f = (async (u: string, init: RequestInit) => { body = JSON.parse(String(init.body)); return inner(u, init); }) as never;
    const r = await callOpenAI(ep("g/m"), req({ onText: (w) => seen.push(w) }), f);
    expect(r.out).toEqual({ speech: "Oi, mundo.", visuals: [] });
    expect(seen.at(-1)).toBe('{"speech":"Oi, mundo.","visuals":[]}');
    expect(seen.length).toBeGreaterThan(1);
    expect(body.stream).toBe(true);
    expect(body.tools).toBeUndefined();
    expect(body.response_format).toEqual({ type: "json_object" });
  });
  it("works with JSON text (models without tool calling) and ignores reasoning pieces", async () => {
    const seen: string[] = [];
    const ev = [{ choices: [{ delta: { reasoning: "pensando" } }] }, { choices: [{ delta: { content: '{"speech":"Olá' } }] }, { choices: [{ delta: { content: '"}' } }] }].map((x) => JSON.stringify(x));
    const r = await callOpenAI(ep("g/m", { tools: false }), req({ onText: (w) => seen.push(w) }), streamFetch(ev));
    expect(r.out).toEqual({ speech: "Olá" });
    expect(seen).toEqual(['{"speech":"Olá', '{"speech":"Olá"}']);
  });
  it("does not stream when nobody listens", async () => {
    let body = "";
    const f = (async (_u: string, init: RequestInit) => { body = String(init.body); return new Response(JSON.stringify({ choices: [{ message: { content: '{"a":1}' } }] }), { status: 200 }); }) as never;
    await callOpenAI(ep("g/m", { tools: false }), req(), f);
    expect(JSON.parse(body).stream).toBeUndefined();
  });
});

describe("Gemini streaming", () => {
  it("accumulates the text pieces", async () => {
    const seen: string[] = [];
    const ev = ['{"speech":"A', 'bc"}'].map((t) => JSON.stringify({ candidates: [{ content: { parts: [{ text: t }] } }] }));
    const r = await callGemini(ep("gemini/m", { kind: "gemini" }), { task: "teacher", system: "s", messages: [{ role: "user", content: "u" }], tool: { name: "t", description: "d", schema: {} }, onText: (w) => seen.push(w) }, streamFetch(ev));
    expect(r.out).toEqual({ speech: "Abc" });
    expect(seen).toEqual(['{"speech":"A', '{"speech":"Abc"}']);
  });
});

describe("router: only the first endpoint that writes is relayed", () => {
  const base: LlmRequest = { task: "teacher", system: "s", messages: [{ role: "user", content: "u" }], json: true };
  it("clears the text when the endpoint fails and lets the next one take over", async () => {
    const seen: string[] = [];
    const r = await route({ ...base, onText: (w) => seen.push(w) }, {
      endpoints: () => [ep("a/m1"), ep("b/m2")], store: new MemoryStore(), random: () => 0.5,
      call: async (e, rq) => {
        if (e.id === "a/m1") { rq.onText?.('{"speech":"parte'); throw new LlmError("server", 500); }
        rq.onText?.('{"speech":"resposta boa"}');
        return { out: { speech: "resposta boa" }, text: "" };
      },
    });
    expect(r.endpoint).toBe("b/m2");
    expect(seen).toEqual(['{"speech":"parte', "", '{"speech":"resposta boa"}']);
  });
  it("without a listener nothing is passed down", async () => {
    let got: unknown = "unset";
    await route(base, { endpoints: () => [ep("a/m1")], store: new MemoryStore(), call: async (_e, rq) => { got = rq.onText; return { out: {}, text: "" }; } });
    expect(got).toBeUndefined();
  });
});

describe("pipeline: the speech is streamed, and the checked answer is still the one returned", () => {
  it("calls onSpeech with the text so far", async () => {
    const good = { speech: "Davi foi o segundo rei de Israel. Quer ver a história dele?", display_markdown: "", citations: [], visuals: [], next_options: [{ label: "Sim", intent: "ask" }], lens_divergence: { present: false, summary: null }, pastoral_flag: false, level_signal: "same", mode_payload: null };
    const heard: string[] = [];
    const llm = { generate: async (a: { onText?: (w: string) => void }) => { a.onText?.('{"speech":"Davi foi'); a.onText?.(JSON.stringify(good)); return good; } };
    const deps = { llm, search: async () => ({ chunks: [], refs: [] }), getVerses: async () => [], existingVerses: async () => new Set<string>(), onSpeech: (s: string) => heard.push(s) } as never;
    const out = await runTurn({ sessionId: "s", text: "Quem foi Davi?", student: { preferred_name: "Ana", level: "iniciante", goals: [], preferred_formats: [], is_minor: false, last_summaries: [] }, bible: { lenses: [], main_version_id: "por_blivre_2018", main_version_name: "BL", compare_versions: [] }, history: [] } as never, deps);
    expect(heard[0]).toBe("Davi foi");
    expect(heard.at(-1)).toContain("segundo rei");
    expect(out.response.speech).toContain("Davi foi o segundo rei");
  });
});
