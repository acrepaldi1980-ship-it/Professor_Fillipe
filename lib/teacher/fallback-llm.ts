// Keeps the teacher answering when the main model is unavailable (no credit, rate limit, overload, outage):
// the turn is retried once on the free fallback model instead of showing "tive um problema".
import type { TeacherLlm } from "./pipeline";

const UNAVAILABLE = /credit balance|billing|\b(402|429|500|502|503|504|529)\b|overloaded|rate.?limit|timeout|ECONN|fetch failed/i;

export class FallbackLlm implements TeacherLlm {
  /** True once the fallback model answered during this turn (for the meta). */
  usedFallback = false;
  constructor(private primary: TeacherLlm, private secondary: TeacherLlm) {}
  stats() {
    return this.primary.stats?.() ?? { calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  }
  async generate(args: Parameters<TeacherLlm["generate"]>[0]): Promise<unknown> {
    if (this.usedFallback) return this.secondary.generate(args);
    try {
      return await this.primary.generate(args);
    } catch (e) {
      if (!UNAVAILABLE.test((e as Error).message ?? "")) throw e;
      console.error(JSON.stringify({ evt: "llm_fallback", reason: (e as Error).message.slice(0, 60) }));
      this.usedFallback = true;
      return this.secondary.generate(args);
    }
  }
}
