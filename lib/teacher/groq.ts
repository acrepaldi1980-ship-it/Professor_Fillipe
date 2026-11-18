// Prototype-only LLM adapter (free tier): Groq's OpenAI-compatible API with a forced `teacher_response` tool call.
// Spec D-02 targets Claude; this exists so Phase 0 can run at no cost. Switch with TEACHER_LLM_PROVIDER.
import type { TeacherLlm } from "./pipeline";
import { teacherToolJsonSchema } from "./schema";

const DEFAULT_MODELS = "openai/gpt-oss-120b,qwen/qwen3.8-27b,openai/gpt-oss-20b";

/** Each Groq model has its own free-tier limits, so on 429 we move down the chain. */
export function groqModels(): string[] {
  return (process.env.TEACHER_MODELS_GROQ ?? process.env.TEACHER_MODEL_GROQ ?? DEFAULT_MODELS).split(",").map((m) => m.trim()).filter(Boolean);
}

export class GroqTeacherLlm implements TeacherLlm {
  async generate({ system, messages }: Parameters<TeacherLlm["generate"]>[0]): Promise<unknown> {
    let lastStatus = 0;
    for (const model of groqModels()) {
      const doFetch = () =>
        fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY ?? "proxy-injected"}` },
          body: JSON.stringify({
            model,
            temperature: 0.4,
            max_completion_tokens: 2500,
            ...(model.includes("gpt-oss") ? { reasoning_effort: "low" } : {}),
            messages: [{ role: "system", content: system }, ...messages],
            tools: [
              {
                type: "function",
                function: { name: "teacher_response", description: "Resposta estruturada do Professor Filipe (contrato da seção 8.5.5).", parameters: teacherToolJsonSchema() },
              },
            ],
            tool_choice: { type: "function", function: { name: "teacher_response" } },
          }),
        });
      let res = await doFetch();
      if (res.status >= 500) {
        await new Promise((r) => setTimeout(r, 1500));
        res = await doFetch();
      }
      lastStatus = res.status;
      if (res.status === 429 || res.status === 400 || res.status === 404) continue; // limit, tool-call failure or model gone: next model
      if (!res.ok) break;
      const json = (await res.json()) as { choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[] };
      const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!args) continue;
      try {
        return JSON.parse(args);
      } catch {
        continue;
      }
    }
    throw new Error(`llm_failed_${lastStatus || "empty"}`);
  }
}

/** Cheap query rewrite for retrieval: English keywords and names for a Portuguese question. Best-effort (returns null on any failure). */
export async function rewriteQueryToEnglish(question: string): Promise<string | null> {
  const model = process.env.QUERY_REWRITE_MODEL ?? "openai/gpt-oss-20b";
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(5000),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY ?? "proxy-injected"}` },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_completion_tokens: 200,
        reasoning_effort: "low",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'Você ajuda uma busca em dicionários e comentários bíblicos em inglês (Easton, KJV, WEB). Dada uma pergunta em português, responda SOMENTE um JSON {"en":"..."} com 3 a 8 palavras-chave em inglês: nomes bíblicos na grafia inglesa (Barnabé=Barnabas, Elias=Elijah, Arca da Aliança=Ark of the Covenant, Páscoa=Passover) e os termos do assunto. Sem frases.',
          },
          { role: "user", content: question },
        ],
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const en = (JSON.parse(json.choices?.[0]?.message?.content ?? "{}") as { en?: string }).en;
    return en && en.length < 200 ? en : null;
  } catch {
    return null;
  }
}
