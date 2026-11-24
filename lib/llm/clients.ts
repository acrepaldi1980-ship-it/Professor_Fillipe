// The two wire formats: OpenAI-compatible chat completions (Groq, Cerebras, OpenRouter, Mistral, SambaNova, NVIDIA, GitHub...) and Google Gemini.
import { LlmError, type Endpoint, type LlmRequest } from "./types";

/** Providers say when the limit lifts ("Please try again in 7m12.5s"): use it instead of guessing, so a short limit does not park a model for an hour. */
export function hintedWait(body: string): number {
  const m = /try again in\s+(?:(\d+)h)?\s*(?:(\d+)m(?!s))?\s*(?:(\d+(?:\.\d+)?)s)?/i.exec(body);
  if (!m || (!m[1] && !m[2] && !m[3])) return 0;
  return Math.ceil(Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0));
}

function classify(status: number, body: string, retryAfter: number): LlmError {
  const b = body.slice(0, 160);
  retryAfter = retryAfter || hintedWait(body);
  if (status === 429) return new LlmError(/per day|daily|quota|insufficient/i.test(body) && !/per minute/i.test(body) ? "quota" : "rate_limit", status, retryAfter, b);
  if (status === 402) return new LlmError("quota", status, retryAfter, b);
  if (status === 401 || status === 403) return new LlmError("auth", status, 0, b);
  if (status === 404) return new LlmError("gone", status, 0, b);
  if (status === 413) return new LlmError("too_large", status, 0, b);
  if (status >= 500) return new LlmError("server", status, retryAfter, b);
  return new LlmError("other", status, 0, b);
}

const parseJson = (text: string): unknown => {
  const m = /\{[\s\S]*\}/.exec(text);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
};

const schemaHint = (req: LlmRequest) => req.tool ? `\n\nResponda SOMENTE com um objeto JSON que siga este esquema (sem texto fora dele):\n${JSON.stringify(req.tool.schema).slice(0, 6000)}` : "";

export interface RawResult { out: unknown; text: string }

export async function callOpenAI(e: Endpoint, req: LlmRequest, fetcher: typeof fetch = fetch): Promise<RawResult> {
  const useTool = !!req.tool && e.tools;
  const wantJson = !!req.json || (!!req.tool && !e.tools);
  const body: Record<string, unknown> = {
    model: e.model,
    temperature: req.temperature ?? (req.task === "query" ? 0 : 0.4),
    max_tokens: req.maxTokens ?? 1200,
    ...e.extra,
    messages: [{ role: "system", content: req.system + (req.tool && !e.tools ? schemaHint(req) : "") }, ...req.messages],
  };
  if (e.provider === "groq") { body.max_completion_tokens = body.max_tokens; delete body.max_tokens; }
  if (useTool) {
    body.tools = [{ type: "function", function: { name: req.tool!.name, description: req.tool!.description, parameters: req.tool!.schema } }];
    body.tool_choice = { type: "function", function: { name: req.tool!.name } };
  } else if (wantJson) body.response_format = { type: "json_object" };
  let res: Response;
  try {
    res = await fetcher(`${e.baseUrl}/chat/completions`, { method: "POST", signal: AbortSignal.timeout(req.timeoutMs ?? 40000), headers: { "Content-Type": "application/json", Authorization: `Bearer ${e.key}` }, body: JSON.stringify(body) });
  } catch (err) {
    throw new LlmError((err as Error).name === "TimeoutError" || (err as Error).name === "AbortError" ? "timeout" : "server", 0, 0, String((err as Error).message).slice(0, 80));
  }
  if (!res.ok) throw classify(res.status, await res.text().catch(() => ""), Number(res.headers.get("retry-after")) || 0);
  const json = (await res.json()) as { choices?: { message?: { content?: string; tool_calls?: { function?: { arguments?: string } }[] } }[] };
  const msg = json.choices?.[0]?.message;
  const args = msg?.tool_calls?.[0]?.function?.arguments;
  const text = msg?.content ?? "";
  if (useTool) { const out = args ? safeParse(args) : parseJson(text); if (!out) throw new LlmError("bad_output", 200); return { out, text }; }
  if (wantJson || req.tool) { const out = parseJson(text); if (!out) throw new LlmError("bad_output", 200); return { out, text }; }
  if (!text.trim()) throw new LlmError("bad_output", 200);
  return { out: text, text };
}

const safeParse = (s: string): unknown => { try { return JSON.parse(s); } catch { return null; } };

export async function callGemini(e: Endpoint, req: LlmRequest, fetcher: typeof fetch = fetch): Promise<RawResult> {
  const wantJson = !!req.json || !!req.tool;
  const body = {
    systemInstruction: { parts: [{ text: req.system + (req.tool ? schemaHint(req) : "") }] },
    contents: req.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    generationConfig: { temperature: req.temperature ?? 0.4, maxOutputTokens: req.maxTokens ?? 1200, ...(wantJson ? { responseMimeType: "application/json" } : {}) },
  };
  let res: Response;
  try {
    res = await fetcher(`${e.baseUrl}/models/${e.model}:generateContent`, { method: "POST", signal: AbortSignal.timeout(req.timeoutMs ?? 40000), headers: { "Content-Type": "application/json", "x-goog-api-key": e.key }, body: JSON.stringify(body) });
  } catch (err) {
    throw new LlmError((err as Error).name === "TimeoutError" || (err as Error).name === "AbortError" ? "timeout" : "server", 0, 0, String((err as Error).message).slice(0, 80));
  }
  if (!res.ok) throw classify(res.status, await res.text().catch(() => ""), Number(res.headers.get("retry-after")) || 0);
  const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
  if (wantJson) { const out = parseJson(text); if (!out) throw new LlmError("bad_output", 200); return { out, text }; }
  if (!text.trim()) throw new LlmError("bad_output", 200);
  return { out: text, text };
}
