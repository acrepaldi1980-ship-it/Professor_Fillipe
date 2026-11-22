// What the teacher knows when the student studies Josephus: the chapter he is reading (from the database, never from client text) and the rules for presenting him as a source.
import { refQuery } from "@/lib/knowledge/reference-db";
import { PARALLELS } from "./books";
import { cite, WORKS, type WorkKey } from "./structure";

export interface JosephusState { work: WorkKey; book: number; chapter: number }

export async function josephusContext(s: JosephusState): Promise<{ text: string; refs: string[] } | null> {
  try {
    const [chap] = await refQuery<{ title: string; title_pt: string | null }>("select title, title_pt from josephus_chapters where work = $1 and book = $2 and chapter = $3", [s.work, s.book, s.chapter]);
    const secs = await refQuery<{ n: number; text: string; text_pt: string | null }>("select n, text, text_pt from josephus_sections where work = $1 and book = $2 and chapter = $3 order by n limit 40", [s.work, s.book, s.chapter]);
    if (!secs.length) return null;
    let used = 0; const take: string[] = [];
    for (const x of secs) { if (used + (x.text_pt ?? x.text).length > 4500) break; take.push(`[${cite(s.work, s.book, s.chapter, x.n)}] ${x.text_pt ?? x.text}`); used += (x.text_pt ?? x.text).length; }
    const par = PARALLELS.filter((p) => p.work === s.work && p.book === s.book && p.chapter === s.chapter);
    const info = WORKS[s.work];
    const text = [
      `ESTUDO DE FLÁVIO JOSEFO: o aluno está lendo "${info.title}", ${cite(s.work, s.book, s.chapter, 1).replace(/\.1$/, "").replace(/ 1$/, "")}${chap?.title_pt ?? chap?.title ? ` (${chap?.title_pt ?? chap?.title})` : ""}, na tradução inglesa de Whiston (domínio público).`,
      "REGRAS: você NÃO é Josefo e nunca fala como ele; apresente-o como fonte (“Josefo escreve que…”). Cite sempre a divisão (por exemplo Ant. 18.3.3). Lembre, quando útil, que Josefo escreveu como judeu a serviço de Roma, e que a obra de um historiador antigo deve ser lida com cuidado. Só afirme o que está no trecho ou nos outros trechos recuperados; compare com a Bíblia onde o texto permitir e diga quando é só um paralelo de contexto. Fale em português, em falas curtas, e termine com uma pergunta.",
      par.length ? `PARALELOS COM A BÍBLIA neste capítulo: ${par.map((p) => `${cite(s.work, s.book, s.chapter, p.n)} ↔ ${p.refs.join(", ")}`).join("; ")}.` : "",
      `TRECHO LIDO (tradução automática para o português a partir de Whiston; se estiver em inglês, a tradução ainda não chegou a este capítulo):\n${take.join("\n")}`,
    ].filter(Boolean).join("\n");
    return { text, refs: [...new Set(par.flatMap((p) => p.refs))].slice(0, 6) };
  } catch {
    return null;
  }
}
