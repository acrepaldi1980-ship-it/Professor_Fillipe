// Help for a verse or a short passage in the reader (spec 8.24, RF-M24-05). Two layers:
//  1) buildHelp: what the library knows about the verses, with NO model: people and places of the passage with their dictionary entry, the words in the original
//     language, the related passages. Always available.
//  2) explain: a short explanation by the teacher from those same sources, kept per student. Uses the plan's message quota; may be unavailable (free model quota).
import { entitiesAtRefs, ptNameOf } from "../knowledge/entities";
import { getLibraryStore } from "../knowledge/library-store";
import { getOriginalWords } from "../knowledge/original";
import { refQuery } from "../knowledge/reference-db";
import { expandRefs, formatRefPt } from "../knowledge/refs-parser";
import { getStore } from "../knowledge/db";
import { completeText } from "../llm/router";
import { wrongLanguage } from "../teacher/language";

export interface HelpEntity { id: string; name: string; en: string; kind: "person" | "place"; entry: { title: string; work_id: string; source: string; snippet: string } | null; refs: number }
export interface HelpWord { surface: string; translit: string | null; strong: string | null; gloss: string | null; meaning: string | null; ref: string }
export interface Help { version: string; refs: string[]; verses: { ref: string; text: string }[]; entities: HelpEntity[]; words: HelpWord[]; related: string[]; sources: { work_id: string; label: string }[] }

const SOURCE_NAMES: Record<string, string> = { easton_1897: "Easton, Bible Dictionary (1897)", ccel_smith: "Smith, Bible Dictionary (1884)", ccel_nave: "Nave, Topical Bible", ccel_torrey: "Torrey, New Topical Textbook" };
const PREFERENCE = ["easton_1897", "ccel_smith", "ccel_nave", "ccel_torrey"];
const clip = (s: string, n: number) => { const t = s.replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n).replace(/\s+\S*$/, "")}…` : t; };
const body = (text: string, title: string | null) => (title && text.startsWith(title) ? text.slice(title.length) : text.replace(/^[^\n]*\n/, ""));

async function entryFor(en: string): Promise<HelpEntity["entry"]> {
  const key = [en.toLowerCase()];
  const lib = getLibraryStore();
  const [a, b] = await Promise.all([getStore().titleChunks?.(key).catch(() => []) ?? [], lib?.titleChunks?.(key).catch(() => []) ?? []]);
  const rows = [...a, ...b].filter((r) => PREFERENCE.includes(r.work_id));
  rows.sort((x, y) => PREFERENCE.indexOf(x.work_id) - PREFERENCE.indexOf(y.work_id));
  const r = rows[0];
  return r ? { title: (r.title_path ?? en).split(" > ").pop()!, work_id: r.work_id, source: SOURCE_NAMES[r.work_id] ?? r.work_id, snippet: clip(body(r.text, r.title_path), 420) } : null;
}

export async function buildHelp(versionId: string, refs: string[]): Promise<Help> {
  // exact verses by reference (indexed lookup); this module avoids the search engine (and its embedding model) so the route stays light
  const verseRefs = expandRefs(refs).filter((r) => r.split(".").length === 3);
  const verses = (await getStore().bibleVerses(versionId, verseRefs, []).catch(() => [])).map((v) => ({ ref: v.ref, text: v.text }));
  const ents = entitiesAtRefs(refs, 6);
  const [entities, words, related] = await Promise.all([
    Promise.all(ents.map(async (e): Promise<HelpEntity> => ({ id: e.id, name: ptNameOf(e.id) ?? e.en, en: e.en, kind: e.kind as "person" | "place", entry: await entryFor(e.en).catch(() => null), refs: e.refs.length }))),
    Promise.all(refs.slice(0, 3).map((r) => getOriginalWords(r).catch(() => []))).then((all) => {
      const seen = new Set<string>(); const out: HelpWord[] = [];
      for (const w of all.flat()) {
        if (!w.strong || seen.has(w.strong) || !w.gloss) continue;
        seen.add(w.strong);
        out.push({ surface: w.surface, translit: w.translit, strong: w.strong, gloss: w.gloss, meaning: w.lexicon ? clip(w.lexicon, 220) : null, ref: w.ref });
        if (out.length >= 10) break;
      }
      return out;
    }),
    refQuery<{ to_ref: string }>("select distinct to_ref from cross_refs where from_ref = any($1) order by to_ref limit 12", [refs.slice(0, 5)]).then((r) => r.map((x) => x.to_ref).filter((r) => !refs.includes(r))).catch(() => [] as string[]),
  ]);
  const sources = [...new Map(entities.filter((e) => e.entry).map((e) => [e.entry!.work_id, { work_id: e.entry!.work_id, label: e.entry!.source }])).values()];
  return { version: versionId, refs, verses, entities, words, related, sources };
}

const SYSTEM = (locale: "pt-BR" | "es", lens: string[]) => `Você é o Professor Filipe, professor de Bíblia, uma IA acolhedora e didática. Explique o trecho bíblico para quem está LENDO a Bíblia, em ${locale === "es" ? "espanhol" : "português do Brasil"}, em linguagem simples.
Regras:
- Use SOMENTE as FONTES abaixo (o texto bíblico, os verbetes, as palavras no original, os textos relacionados). Nunca invente versículo, citação, autor, data ou número de Strong.
- No máximo 110 palavras. Diga o que o trecho significa, o contexto (quem fala, a quem, onde) quando as fontes mostram, e um ponto de aplicação. Explique termos difíceis.
- Cite a fonte pelo nome da obra entre parênteses quando usar um verbete ("segundo o dicionário de Easton").
- ${lens.length ? `Ensine na lente do aluno (${lens.join(", ")}); se as tradições divergem neste trecho, diga em uma frase que há leituras diferentes.` : "Se as tradições divergem neste trecho, diga em uma frase que há leituras diferentes, sem declarar vencedora."}
- Termine com UMA pergunta curta que ajude o aluno a pensar no texto.
- Responda só com o texto da explicação, sem títulos nem listas.`;

/** The teacher's short explanation of the passage; null when no model answered or the answer came out in the wrong language. */
export async function explainPassage(help: Help, opts: { locale: "pt-BR" | "es"; lens: string[] }): Promise<{ text: string; citations: { work_id: string; label: string }[] } | null> {
  if (!help.verses.length) return null;
  const parts = [
    `PASSAGEM (${help.refs.map(formatRefPt).join(", ")}):\n${help.verses.map((v) => `${v.ref.split(".").slice(1).join(":")} ${v.text}`).join("\n")}`,
    help.entities.length ? `PESSOAS E LUGARES:\n${help.entities.map((e) => `- ${e.name} (${e.kind === "person" ? "pessoa" : "lugar"})${e.entry ? `: ${e.entry.snippet} [${e.entry.source}]` : ""}`).join("\n")}` : "",
    help.words.length ? `PALAVRAS NO ORIGINAL:\n${help.words.slice(0, 6).map((w) => `- ${w.surface} (${w.translit ?? ""}, Strong ${w.strong}): ${w.gloss}`).join("\n")}` : "",
    help.related.length ? `TEXTOS RELACIONADOS: ${help.related.slice(0, 6).map(formatRefPt).join("; ")}` : "",
  ].filter(Boolean).join("\n\n");
  let text: string;
  try {
    const r = await completeText(SYSTEM(opts.locale, opts.lens), parts, { maxTokens: 450, temperature: 0.3 });
    text = (r.text ?? "").trim();
  } catch {
    return null;
  }
  if (text.length < 40 || wrongLanguage(text, opts.locale === "es" ? "es" : "pt")) return null;
  const citations = [...help.sources];
  return { text, citations: [...new Map(citations.map((c) => [c.work_id, c])).values()] };
}
