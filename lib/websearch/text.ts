// Text helpers of the web research: what the question is about (the entity), what it asks about it (the attribute), HTML to plain text, and which passages to keep.
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const STOP = new Set("de do da dos das o a os as um uma uns umas que em no na nos nas para por com e ou se ao aos pelo pela pelos pelas sobre entre ate sua seu suas seus qual quais quem quando onde como porque porquê quanto quantos quantas foi era sao eram fica ficava existe existem tem teve ter mais menos muito pouco me diga fale falar dizer pode voce sabe saber the of is was in and to for".split(" "));

/** Attribute words of a question and the English words that name the same thing on an English page. */
export const ATTRIBUTES: Record<string, string[]> = {
  altura: ["altitude", "elevacao", "metros", "height", "elevation", "high", "tall", "metres", "meters"],
  altitude: ["altura", "elevacao", "metros", "elevation", "height", "metres"],
  tamanho: ["extensao", "dimensao", "size", "dimensions", "large"],
  extensao: ["tamanho", "comprimento", "length", "extent"],
  comprimento: ["extensao", "length", "long"],
  largura: ["width", "wide"],
  profundidade: ["depth", "deep"],
  area: ["superficie", "km", "square", "hectares"],
  populacao: ["habitantes", "population", "inhabitants"],
  habitantes: ["populacao", "population"],
  distancia: ["quilometros", "km", "distance", "miles"],
  idade: ["anos", "age", "years", "nasceu", "morreu"],
  data: ["ano", "seculo", "date", "year", "century"],
  quando: ["ano", "seculo", "date", "year", "century", "periodo"],
  fundacao: ["fundado", "construido", "founded", "built"],
  significado: ["significa", "nome", "meaning", "means", "name"],
  localizacao: ["fica", "situado", "localizado", "located", "situated"],
  clima: ["temperatura", "chuva", "climate", "temperature", "rainfall"],
  nome: ["chamado", "chamada", "name", "called"],
};

/** The subject of the question: leading interrogatives, attribute words and function words removed ("qual é a altura do Monte Carmelo?" → "monte carmelo"). */
export function entityPhrase(question: string): string {
  const words = norm(question).replace(/[?!.,;:()"“”]/g, " ").split(/\s+/).filter(Boolean);
  const keep = words.filter((w) => !STOP.has(w) && !(w in ATTRIBUTES) && w.length > 1);
  return keep.slice(0, 5).join(" ");
}

/** What the question asks about the subject, with the English equivalents (to recognise the passage that answers it). */
export function attributeTerms(question: string): { asked: string[]; terms: string[] } {
  const words = new Set(norm(question).replace(/[?!.,;:()"“”]/g, " ").split(/\s+/));
  const asked = Object.keys(ATTRIBUTES).filter((a) => words.has(a));
  return { asked, terms: [...new Set(asked.flatMap((a) => [a, ...ATTRIBUTES[a]]))] };
}

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&nbsp;": " ", "&ndash;": "–", "&mdash;": "—" };

/** The HTML of an article to plain text: no scripts, styles, citation marks or edit links; table cells separated by "|". */
export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script|figure|sup|noscript)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<span class="mw-editsection"[\s\S]*?<\/span>\s*<\/span>/gi, " ")
    .replace(/<\/(td|th)>/gi, " | ")
    .replace(/<\/(p|li|tr|h[1-6]|div|dd|dt|caption)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&[a-z]+;|&#39;/gi, (m) => ENTITIES[m.toLowerCase()] ?? " ")
    .replace(/\[\s*\d+\s*\]|\[\s*nota \d+\s*\]/gi, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

/**
 * The passages of a page that bear on the question: the lead paragraph for context, then the lines with most of the question's words, favouring lines with
 * a number and a unit when the question asks a measure. Within `maxChars`, in page order.
 */
export function pickPassages(text: string, query: string, opts: { terms?: string[]; max?: number; maxChars?: number } = {}): string[] {
  const max = opts.max ?? 5, maxChars = opts.maxChars ?? 1800;
  // short lines are noise, except a short infobox row with a number ("Altitude | 545 metros |"), which is often the answer
  const lines = text.split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter((l) => l.length >= 25 || (l.length >= 12 && l.includes("|") && /\d/.test(l)));
  if (!lines.length) return [];
  const words = [...new Set(norm(query).split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !STOP.has(w)))];
  const terms = (opts.terms ?? []).map(norm);
  const measure = terms.length > 0;
  const scored = lines.map((l, i) => {
    const n = norm(l);
    let s = words.filter((w) => n.includes(w)).length * 2 + terms.filter((t) => n.includes(t)).length * 3;
    if (measure && /\d/.test(l) && /\b(m|km|metros|metres|meters|ft|pes|anos|years|habitantes|inhabitants|a\.c\.|d\.c\.|bc|ad)\b/i.test(l)) s += 3;
    if (/^[|\s]*[\p{L} ]{2,30}\s*\|\s*\d/u.test(l)) s += 2; // an infobox row: "Altitude | 545 metros"
    return { l, i, s };
  });
  const picked = new Set<number>([0]);
  for (const x of [...scored].sort((a, b) => b.s - a.s || a.i - b.i)) { if (x.s > 0 && picked.size < max) picked.add(x.i); }
  const out: string[] = [];
  let total = 0;
  for (const i of [...picked].sort((a, b) => a - b)) {
    const l = lines[i].length > 420 ? `${lines[i].slice(0, 417)}…` : lines[i];
    if (total + l.length > maxChars) break;
    out.push(l); total += l.length;
  }
  return out;
}

/** Words that say a page belongs to the biblical world (so a page about a football club called "Monte Carmelo" is discarded). */
const BIBLICAL_PAGE = /\b(b[ií]blia|b[ií]blic[oa]s?|testamento|israel|jerusal[eé]m|jesus|crist[ãa]o|cristianismo|judeu|juda[ií]smo|profeta|ap[oó]stolo|evangelho|tor[áa]|templo|hebraic[oa]|elias|davi|mois[eé]s|bible|biblical|testament|jerusalem|christian|judaism|prophet|apostle|gospel|torah|temple|hebrew|elijah|moses|david)\b/gi;
export function isBiblicalPage(text: string, minDistinct = 2): boolean {
  const hits = new Set((text.slice(0, 12000).match(BIBLICAL_PAGE) ?? []).map((w) => w.toLowerCase()));
  return hits.size >= minDistinct;
}
