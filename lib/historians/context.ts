// What the teacher knows when the student studies the historians: who the author is, the passage in question, the limits and the rules (RA-21, RA-14).
import { byId, HISTORIANS, TESTIMONIES } from "./data";

export interface HistorianState { id: string; passage?: string }

export function historianContext(s: HistorianState): { text: string; refs: string[] } | null {
  const all = s.id === "testemunhos";
  const h = all ? null : byId(s.id);
  if (!all && !h) return null;
  const rules = "REGRAS: você NÃO é o historiador e nunca fala como ele; apresente-o como fonte (“Tácito escreve que…”). Cite sempre a obra e a divisão (Anais 15.44, Ant. 18.3.3). Diga o limite de cada fonte e as controvérsias acadêmicas, sem apresentá-las como consenso. Distinga testemunho independente de referência posterior. Só afirme o que está nos trechos recuperados ou nesta ficha; se não houver o trecho, diga que ele não está na biblioteca em vez de inventar. Fale em português, em falas curtas, e termine com uma pergunta.";
  if (all) {
    return { text: ["ESTUDO DOS HISTORIADORES: o aluno quer comparar os testemunhos fora da Bíblia sobre Jesus e os primeiros cristãos.", rules, ...TESTIMONIES.map((t) => `- ${t.who} (${t.cite}, ${t.date}): ${t.says} Independência: ${t.independent} Discussão: ${t.debate}`)].join("\n"), refs: ["MAT.27.1-MAT.27.2"] };
  }
  const p = h!.passages.find((x) => x.id === s.passage);
  const lines = [
    `ESTUDO DE HISTORIADOR: o aluno estuda ${h!.name} (${h!.years}): ${h!.role}. ${h!.summary}`,
    `Obras: ${h!.works.map((w) => `${w.title} (${w.original})`).join("; ")}.`,
    `Limites desta fonte: ${h!.limits}`,
    p ? `PASSAGEM EM FOCO: ${p.cite}, ${p.topic}. ${p.summary}${p.debate ? ` DISCUSSÃO: ${p.debate}` : ""}` : `Passagens principais: ${h!.passages.map((x) => `${x.cite} (${x.topic})`).join("; ")}.`,
    rules,
  ];
  void HISTORIANS;
  return { text: lines.join("\n"), refs: (p ? p.refs : h!.passages.flatMap((x) => x.refs)).slice(0, 6) };
}
