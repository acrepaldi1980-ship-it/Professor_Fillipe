// Prototype-only LLM adapter (free tier): Groq's OpenAI-compatible API with a forced `teacher_response` tool call.
// Spec D-02 targets Claude; this exists so Phase 0 can run at no cost. Switch with TEACHER_LLM_PROVIDER.
import type { TeacherLlm } from "./pipeline";
import { teacherToolJsonSchema } from "./schema";

export class GroqTeacherLlm implements TeacherLlm {
  async generate({ system, messages }: Parameters<TeacherLlm["generate"]>[0]): Promise<unknown> {
    const model = process.env.TEACHER_MODEL_GROQ ?? "openai/gpt-oss-120b";
    const doFetch = () => fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY ?? "proxy-injected"}` },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_completion_tokens: 2500,
        reasoning_effort: "low",
        messages: [{ role: "system", content: system }, ...messages],
        tools: [
          {
            type: "function",
            function: {
              name: "teacher_response",
              description: "Resposta estruturada do Professor Filipe (contrato da seção 8.5.5).",
              parameters: teacherToolJsonSchema(),
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "teacher_response" } },
      }),
    });
    let res = await doFetch();
    // free-tier rate limits and transient errors: one retry after a short pause
    for (let attempt = 0; attempt < 2 && (res.status === 429 || res.status >= 500); attempt++) {
      const wait = Math.min(Number(res.headers.get("retry-after")) || 2, 10);
      await new Promise((r) => setTimeout(r, wait * 1000));
      res = await doFetch();
    }
    if (!res.ok) throw new Error(`llm_failed_${res.status}`);
    const json = (await res.json()) as { choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[] };
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return null;
    try {
      return JSON.parse(args);
    } catch {
      return null;
    }
  }
}
