// Keeps the teacher answering when the main model is unavailable (no credit, rate limit, overload, outage):
// the turn is retried once on the free fallback model instead of showing "tive um problema".
import type { TeacherLlm } from "./pipeline";

const UNAVAILABLE = /credit balance|billing|\b(402|429|500|502|503|504|529)\b|overloaded|rate.?limit|timeout|ECONN|fetch failed/i;

/** When the main model says "no credit" the whole turn should not pay for a failing call first: skip it for a while (and use free-model sized prompts). */
let primaryDownUntil = 0;
export const primaryIsDown = () => Date.now() < primaryDownUntil;
/** Tests only. */
export const resetPrimaryDown = () => { primaryDownUntil = 0; };
export function markPrimaryDown(message: string) {
  const noCredit = /credit balance|billing|insufficient|payment/i.test(message);
  primaryDownUntil = Date.now() + (noCredit ? 10 * 60_000 : /429|rate.?limit|overloaded|529/i.test(message) ? 45_000 : 20_000);
}

export class FallbackLlm implements TeacherLlm {
  /** True once the fallback model answered during this turn (for the meta). */
  usedFallback = false;
  private notes: string[] = [];
  /** Diagnostics: why the main model was skipped, and what the fallback pool did. */
  info() {
    const sec = this.secondary.info?.();
    return { endpoint: this.usedFallback ? sec?.endpoint ?? "fallback" : "anthropic", ms: sec?.ms ?? 0, log: [...this.notes, ...(sec?.log ?? [])] };
  }
  constructor(private primary: TeacherLlm, private secondary: TeacherLlm) {}
  stats() {
    return this.primary.stats?.() ?? { calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  }
  async generate(args: Parameters<TeacherLlm["generate"]>[0]): Promise<unknown> {
    if (this.usedFallback) return this.secondary.generate(args);
    if (primaryIsDown()) { this.usedFallback = true; this.notes.push("anthropic:skipped (unavailable a moment ago)"); return this.secondary.generate(args); }
    try {
      return await this.primary.generate(args);
    } catch (e) {
      if (!UNAVAILABLE.test((e as Error).message ?? "")) throw e;
      console.error(JSON.stringify({ evt: "llm_fallback", reason: (e as Error).message.slice(0, 60) }));
      this.notes.push(`anthropic:${String((e as Error).message).slice(0, 220)}`);
      markPrimaryDown(String((e as Error).message ?? ""));
      this.usedFallback = true;
      return this.secondary.generate(args);
    }
  }
}
