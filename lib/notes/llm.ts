// Plain text completion for the notes generator (server only). Drafting uses a cheaper model than the teacher (NOTES_MODEL).
import Anthropic from "@anthropic-ai/sdk";

export interface NotesLlm {
  complete(system: string, user: string, maxTokens?: number): Promise<string>;
}

export class AnthropicNotesLlm implements NotesLlm {
  private client: Anthropic;
  constructor(apiKey = process.env.ANTHROPIC_API_KEY, private model = process.env.NOTES_MODEL ?? "claude-haiku-5-5") {
    this.client = new Anthropic({ apiKey });
  }
  async complete(system: string, user: string, maxTokens = 2400): Promise<string> {
    // Hidden reasoning is not needed to draft a note and would eat the token budget (same setting as the teacher's fast tier).
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      thinking: { type: "disabled" } as never,
      system,
      messages: [{ role: "user", content: user }],
    });
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    if (!text.trim()) throw new Error(`empty_output(${res.stop_reason};${res.content.map((b) => b.type).join("+")})`);
    return text;
  }
  get modelName() {
    return this.model;
  }
}

/** Free fallback (Groq) for short text tasks when Claude is unavailable (no credit, overload). */
export class GroqNotesLlm implements NotesLlm {
  async complete(system: string, user: string, maxTokens = 1800): Promise<string> {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(25000),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY ?? "proxy-injected"}` },
      body: JSON.stringify({ model: process.env.NOTES_FALLBACK_MODEL ?? "openai/gpt-oss-20b", temperature: 0.2, max_completion_tokens: maxTokens, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
    });
    if (!res.ok) throw new Error(`groq_${res.status}`);
    return ((await res.json()) as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content ?? "";
  }
}

/** Claude first; on credit, rate-limit or overload errors the free model answers instead. */
export class FallbackNotesLlm implements NotesLlm {
  constructor(private primary: NotesLlm, private secondary: NotesLlm) {}
  async complete(system: string, user: string, maxTokens?: number): Promise<string> {
    try {
      return await this.primary.complete(system, user, maxTokens);
    } catch (e) {
      if (!/credit balance|billing|\b(402|429|500|502|503|529)\b|overloaded|rate.?limit|timeout|ECONN|fetch failed/i.test((e as Error).message ?? "")) throw e;
      return this.secondary.complete(system, user, maxTokens);
    }
  }
}

/** The model for short study tasks (summaries, review cards, grading): Haiku with the free model as fallback. */
export function shortTaskLlm(): NotesLlm {
  const primary = new AnthropicNotesLlm(undefined, process.env.SUMMARY_MODEL ?? "claude-haiku-5-5");
  return process.env.GROQ_API_KEY ? new FallbackNotesLlm(primary, new GroqNotesLlm()) : primary;
}
