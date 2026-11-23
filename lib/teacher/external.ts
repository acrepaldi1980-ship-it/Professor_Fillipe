// The rules around research OUTSIDE the app (spec 8.23, owner's decision 23/11/2026): when it is needed, what the model may rely on, how the answer must say it,
// and how the numbers it speaks are checked against the pages that were read. Pure functions: the wiring is in pipeline.ts.
import type { Retrieved } from "../knowledge/search";
import type { WebSource } from "../websearch/types";


/** How well the app's own collection covers the question. "none": nothing came back; "weak": nothing was found by words AND meaning together; "ok" otherwise. */
export function assessCoverage(a: { chunks: Retrieved[]; verses: { text: string }[] }): "none" | "weak" | "ok" {
  if (!a.chunks.length && !a.verses.length) return "none";
  const strong = a.chunks.slice(0, 6).some((c) => c.signals?.includes("exact") || (c.signals?.includes("keyword") && c.signals?.includes("semantic")));
  return strong || a.verses.length ? "ok" : "weak";
}

/** The model saying it did not find the answer in what it was given (RA-09's sentence and its variants). */
export const looksUnanswered = (speech: string) => /n[ãa]o (encontrei|achei|consegui encontrar|tenho (essa|essa informa|isso)|h[áa] (essa )?informa|aparece)|n[ãa]o est[áa] (nas|nos) (minhas )?fontes|fora (do que|das fontes)|n[ãa]o sei (te )?dizer/i.test(speech);

/** The answer says it came from outside the app. */
export const mentionsOutside = (speech: string) => /fora do app|pesquis(ei|ando|a)|wikip[ée]dia|wikipedia|na internet|na web|fonte externa/i.test(speech);

const money = /\d[\d.,]*/g;
/** Numbers that carry a measure ("546 metros", "525,4 m", "2 mil anos"): digits only, so "1.791" and "1,791" and "1791" are the same. */
export function measuredNumbers(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/(\d[\d.,]*)\s*(m\b|metros?|metres?|meters?|km\b|quil[oô]metros?|kilometres?|p[ée]s\b|feet|ft\b|anos?\b|years?|habitantes|inhabitants|hectares?|%|c[ôo]vados?|est[áa]dios?|milhas?|miles?)/gi)) {
    const digits = m[1].replace(/[.,]/g, "");
    if (digits.length >= 2) out.push(digits);
  }
  return out;
}

/** Measured numbers the answer speaks that appear in none of the pages that were read (nor in the question): they would be invented. */
export function ungroundedNumbers(speech: string, sources: WebSource[], extraTexts: string[] = []): string[] {
  const haystack = [...sources.flatMap((s) => s.passages), ...extraTexts].join(" ").replace(/(\d)[.,\s](?=\d{3}\b)/g, "$1");
  const known = new Set((haystack.match(money) ?? []).map((n) => n.replace(/[.,]/g, "")));
  return [...new Set(measuredNumbers(speech))].filter((n) => !known.has(n) && !haystack.replace(/[.,]/g, "").includes(n));
}

/** True when the answer relies on the outside pages: it says so, or it speaks a measure that only they carry. */
export function usesOutside(speech: string, sources: WebSource[]): boolean {
  if (!sources.length || looksUnanswered(speech) && !mentionsOutside(speech)) return false;
  if (mentionsOutside(speech)) return true;
  const fromWeb = new Set(sources.flatMap((s) => measuredNumbers(s.passages.join(" "))));
  return measuredNumbers(speech).some((n) => fromWeb.has(n));
}

/** The sentence that must open an answer that used outside pages, when the model did not say it itself. */
export function outsideLabel(sources: WebSource[]): string {
  const first = sources[0];
  return `Isso não está no acervo do app; pesquisei fora do app, em ${first.site}, no artigo "${first.title}".`;
}

/** The block of the prompt with the pages read outside. Only this text, plus the app's passages, may be relied on. */
export function externalPrompt(sources: WebSource[]): string {
  if (!sources.length) return "";
  const pages = sources.map((s, i) => `[fonte externa ${i + 1} | ${s.site} | "${s.title}" | ${s.url} | licença ${s.license}]\n${s.passages.join("\n")}`).join("\n\n");
  return `FONTES EXTERNAS (pesquisa FORA do app; o acervo do app não cobriu esta pergunta). Use SOMENTE estas passagens, mais os trechos do app que ajudarem, e nada de memória:
${pages}

REGRAS DESTA RESPOSTA:
- Comece a fala dizendo, com naturalidade, que isso não está no acervo do app e que você pesquisou fora do app, citando o site e o título (exemplo: "Isso não está no acervo do app; pesquisei fora do app, na Wikipédia, no artigo 'Monte Carmelo'").
- Afirme só o que as passagens dizem. Se as fontes divergirem (valores diferentes), diga o valor de cada uma e de qual fonte vem; não escolha sozinho nem faça média.
- Números, medidas e datas: repita exatamente como estão nas passagens. Não converta, não arredonde e não invente.
- Diga que vale conferir na fonte. Se as passagens também não respondem, diga que nem lá encontrou.
- Fique dentro do contexto bíblico: ligue ao texto bíblico quando fizer sentido, usando os trechos do app. Não use as passagens externas para dar opinião sobre doutrina nem sobre igrejas.
- Defina sources_sufficient como true quando as passagens responderem.`;
}

/** The notice for a question that may be off the biblical context but was not clear enough to refuse (no outside research happens). */
export const UNSURE_NOTICE = "ATENÇÃO: não está claro que esta pergunta seja sobre a Bíblia ou o estudo dela. Responda SOMENTE se conseguir ligá-la ao estudo bíblico usando os trechos acima; caso contrário, diga com gentileza que só ajuda dentro do estudo da Bíblia e convide o aluno a voltar a ele (RA-18). Não invente nada.";

export const toResponseSources = (sources: WebSource[]) => sources.map((s) => ({ title: s.title, url: s.url, site: s.site, lang: s.lang, license: s.license, retrieved_at: s.retrievedAt }));
