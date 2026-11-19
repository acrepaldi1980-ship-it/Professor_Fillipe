// Anthropic implementation of TeacherLlm: forces the `teacher_response` tool (spec 11.6).
import Anthropic from "@anthropic-ai/sdk";
import type { TeacherLlm } from "./pipeline";
import { teacherToolJsonSchema } from "./schema";

// Economy: Claude Sonnet 5.5 at low effort with a cached prompt costs about one cent per answer; Haiku 5.5 is ~20x cheaper but
// answered worse in tests (said Bible sources were missing when they were there), so it is opt-in via TEACHER_MODEL_FAST.
export function modelFor(tier: "fast" | "deep"): string {
  const fast = process.env.TEACHER_MODEL_FAST ?? "claude-sonnet-5-5";
  const deep = process.env.TEACHER_MODEL_DEEP ?? "claude-sonnet-5-5";
  return tier === "deep" ? deep : fast;
}

export class AnthropicTeacherLlm implements TeacherLlm {
  private client: Anthropic;
  private totals = { calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, blocks: "" };
  /** Token use of this turn (every call), for the cost meta. */
  stats() {
    return { ...this.totals };
  }
  constructor(apiKey = process.env.ANTHROPIC_API_KEY) {
    this.client = new Anthropic({ apiKey });
  }

  async generate({ system, systemParts, messages, tier }: Parameters<TeacherLlm["generate"]>[0]): Promise<unknown> {
    const res = await this.client.messages.create({
      model: modelFor(tier),
      max_tokens: tier === "deep" ? 3500 : 1800, // a spoken answer of up to ~120 words; deep mode also writes the detailed text
      // Forced tool_choice (any/tool) is rejected by the newer models (400); the tool is asked for in the prompt and `auto` is used.
      // Effort `medium` keeps chat answers quick and cheap; thinking is adaptive by default on these models.
      output_config: { effort: tier === "deep" ? "medium" : "low" },
      // Everyday turns do not need hidden reasoning: between_tools keeps thinking off, which cuts seconds and cost.
      ...(tier === "fast" ? { thinking: { type: "between_tools" } as never } : {}),
      // The stable part (rules, student, lens) is cached: later turns of the same conversation read it at a fraction of the price.
      system: systemParts
        ? [
            { type: "text" as const, text: `${systemParts.stable}\n\nIMPORTANTE: responda SEMPRE chamando a ferramenta teacher_response, e somente ela.`, cache_control: { type: "ephemeral" as const } },
            { type: "text" as const, text: systemParts.dynamic },
          ]
        : `${system}\n\nIMPORTANTE: responda SEMPRE chamando a ferramenta teacher_response, e somente ela.`,
      messages,
      tools: [
        {
          name: "teacher_response",
          description: "Resposta estruturada do Professor Filipe (contrato da seção 8.5.5).",
          input_schema: teacherToolJsonSchema() as never,
        },
      ],
      tool_choice: { type: "auto" },
    });
    this.totals.calls++;
    this.totals.blocks += `${res.content.map((b) => b.type).join("+")}/${res.stop_reason};`;
    this.totals.input += res.usage.input_tokens;
    this.totals.output += res.usage.output_tokens;
    this.totals.cacheRead += res.usage.cache_read_input_tokens ?? 0;
    this.totals.cacheWrite += res.usage.cache_creation_input_tokens ?? 0;
    // Cost tracking (no text): tokens and cache use of every call.
    console.log(JSON.stringify({ evt: "llm_usage", model: res.model, tier, input: res.usage.input_tokens, output: res.usage.output_tokens, cache_read: res.usage.cache_read_input_tokens ?? 0, cache_write: res.usage.cache_creation_input_tokens ?? 0 }));
    const block = res.content.find((b) => b.type === "tool_use");
    return block && block.type === "tool_use" ? block.input : null;
  }
}
