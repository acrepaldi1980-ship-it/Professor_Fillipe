// Long-term memory (spec 8.5.4): a short summary of each session, written when the student ends it and read by the next sessions.
import { z } from "zod";
import type { NotesLlm } from "../notes/llm";

export const SummarySchema = z.object({
  summary: z.string().min(10).max(600),
  topics: z.array(z.string().max(60)).max(6).default([]),
  level_signal: z.enum(["lower", "same", "higher"]).default("same"),
});
export type Summary = z.infer<typeof SummarySchema>;

const SYSTEM = `Você resume uma sessão de estudo bíblico entre o Professor Filipe (IA) e um aluno, em português do Brasil.
Responda SOMENTE com JSON: {"summary": "...", "topics": ["..."], "level_signal": "lower|same|higher"}.
- summary: até 60 palavras, o que foi estudado, o que o aluno já sabe ou quis saber e onde parou. Sem dados pessoais sensíveis.
- topics: até 5 temas ou passagens.
- level_signal: "higher" se o aluno mostrou mais conhecimento que o nível informado, "lower" se teve dificuldade, senão "same".`;

export async function summarizeSession(turns: { role: "user" | "teacher"; text: string }[], level: string, llm: NotesLlm): Promise<Summary | null> {
  const convo = turns.slice(-16).map((t) => `${t.role === "user" ? "Aluno" : "Professor"}: ${t.text.slice(0, 700)}`).join("\n");
  const raw = await llm.complete(SYSTEM, `Nível informado do aluno: ${level}\n\nCONVERSA:\n${convo}`, 500);
  const a = raw.indexOf("{"), b = raw.lastIndexOf("}");
  if (a < 0) return null;
  const parsed = SummarySchema.safeParse(JSON.parse(raw.slice(a, b + 1)));
  return parsed.success ? parsed.data : null;
}
