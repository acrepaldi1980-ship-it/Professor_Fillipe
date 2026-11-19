// Anthropic implementation of TeacherLlm: forces the `teacher_response` tool (spec 11.6).
import Anthropic from "@anthropic-ai/sdk";
import type { TeacherLlm } from "./pipeline";
import { teacherToolJsonSchema } from "./schema";

export function modelFor(tier: "fast" | "deep"): string {
  const fast = process.env.TEACHER_MODEL_FAST ?? "claude-sonnet-5-5";
  const deep = process.env.TEACHER_MODEL_DEEP ?? fast;
  return tier === "deep" ? deep : fast;
}

export class AnthropicTeacherLlm implements TeacherLlm {
  private client: Anthropic;
  constructor(apiKey = process.env.ANTHROPIC_API_KEY) {
    this.client = new Anthropic({ apiKey });
  }

  async generate({ system, messages, tier }: Parameters<TeacherLlm["generate"]>[0]): Promise<unknown> {
    const res = await this.client.messages.create({
      model: modelFor(tier),
      max_tokens: 4000, // room for adaptive thinking plus the answer
      // Forced tool_choice (any/tool) is rejected by the newer models (400); the tool is asked for in the prompt and `auto` is used.
      // Effort `medium` keeps chat answers quick and cheap; thinking is adaptive by default on these models.
      output_config: { effort: "medium" },
      system: `${system}\n\nIMPORTANTE: responda SEMPRE chamando a ferramenta teacher_response, e somente ela.`,
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
    const block = res.content.find((b) => b.type === "tool_use");
    return block && block.type === "tool_use" ? block.input : null;
  }
}
