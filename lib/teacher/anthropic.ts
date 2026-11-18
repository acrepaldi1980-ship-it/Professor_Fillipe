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
      max_tokens: 1500,
      system,
      messages,
      tools: [
        {
          name: "teacher_response",
          description: "Resposta estruturada do Professor Filipe (contrato da seção 8.5.5).",
          input_schema: teacherToolJsonSchema() as never,
        },
      ],
      tool_choice: { type: "tool", name: "teacher_response" },
    });
    const block = res.content.find((b) => b.type === "tool_use");
    return block && block.type === "tool_use" ? block.input : null;
  }
}
