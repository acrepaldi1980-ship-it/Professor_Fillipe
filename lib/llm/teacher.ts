// The teacher through the router: same contract as the old single-provider adapter (a forced `teacher_response` answer), but every call
// can land on any free endpoint and fails over by itself.
import type { TeacherLlm } from "../teacher/pipeline";
import { teacherToolJsonSchema } from "../teacher/schema";
import { route } from "./router";
import { LlmError } from "./types";

export class RouterTeacherLlm implements TeacherLlm {
  /** Which endpoint answered the last call (for the logs and the admin panel). */
  lastEndpoint = "";
  lastLog: string[] = [];
  lastMs = 0;
  /** Diagnostics for the turn metadata: who answered, how long and what failed on the way. */
  info() { return { endpoint: this.lastEndpoint, ms: this.lastMs, log: this.lastLog }; }
  async generate({ system, messages, onText }: Parameters<TeacherLlm["generate"]>[0]): Promise<unknown> {
    try {
      const r = await route({ task: "teacher", system, messages, tool: { name: "teacher_response", description: "Resposta estruturada do Professor Filipe (contrato da seção 8.5.5).", schema: teacherToolJsonSchema() }, maxTokens: 1200, temperature: 0.4, timeoutMs: 10000, deadlineMs: 30000, hedgeAfterMs: 4500, onText });
      this.lastLog = r.log ?? [];
      this.lastMs = r.ms;
      this.lastEndpoint = r.endpoint;
      return r.out;
    } catch (e) {
      const err = e as LlmError;
      // the pipeline shrinks the context on 413 and treats the other codes as "model unavailable" (shown with a friendly message)
      throw new Error(err.kind === "too_large" ? "llm_failed_413" : `llm_failed_${err.status || "x"}: ${err.kind} ${String(err.message).slice(0, 60)}`);
    }
  }
}
