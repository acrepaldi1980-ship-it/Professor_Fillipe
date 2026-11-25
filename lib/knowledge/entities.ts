// Recognises the people, places and events of the Bible named in a question ("Me fale tudo sobre Zaqueu" -> Zacchaeus, Luke 19) and strips the filler words
// ("me fale tudo sobre") so the search looks for the SUBJECT, not for the sentence. The index (entity-index.json) is built from the knowledge graph and the Bibles
// by scripts/build-entity-index.mjs; it is bundled, so recognising a name costs no database call.
import raw from "./entity-index.json";

interface Entity { id: string; k: string; en: string; al: string[]; pt: string[]; r: string[] }
export interface EntityMatch { id: string; kind: "person" | "place" | "event"; en: string; matched: string; refs: string[] }

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const ENTITIES = raw as Entity[];

/** Words that are names in the Bibles but mean something else in a question ("monte", "rei", "senhor"), or that name too many things to say what is asked. */
const GENERIC = new Set(["monte", "mar", "rio", "vale", "rei", "reino", "terra", "cidade", "templo", "casa", "senhor", "deus", "filho", "pai", "mae", "homem", "mulher", "povo", "igreja", "santo", "santa", "ilha", "deserto", "campo", "porta", "torre", "lago", "serra", "fonte", "cova", "tribo"]);

/** Filler words of a question that say what the student wants, not what it is about. */
const FILLER = new Set([
  "me", "te", "nos", "fale", "fala", "falar", "diga", "dizer", "conte", "contar", "conta", "explique", "explica", "explicar", "mostre", "mostra", "mostrar", "ensine", "ensina", "ensinar", "resuma", "resumir", "detalhe", "detalhes", "tudo", "todo", "toda", "sobre", "acerca", "respeito", "quem", "qual", "quais", "quando", "onde", "como", "porque", "por", "que", "foi", "era", "eram", "foram", "e", "eh", "sao", "sera", "ser", "o", "a", "os", "as", "um", "uma", "uns", "umas", "de", "do", "da", "dos", "das", "no", "na", "nos", "nas", "em", "ao", "aos", "pra", "para", "com", "sem", "seu", "sua", "pelo", "pela", "isso", "isto", "esse", "essa", "este", "esta", "aquele", "aquela", "quero", "queria", "gostaria", "preciso", "poderia", "pode", "voce", "tem", "ha", "mais", "bem", "bastante", "completo", "completa", "historia", "vida", "estudo", "estudar", "aprofundar", "aprofunda", "saber", "entender", "conhecer", "pergunta", "professor", "filipe", "por favor", "favor", "ola", "oi", "biblia", "biblico", "biblica", "biblicos", "escritura", "escrituras", "texto", "sim", "nao", "continue", "continua", "continuar", "ok", "certo", "talvez", "obrigado", "obrigada", "valeu", "amem", "tudo bem", "bom", "boa", "dia", "tarde", "noite", "so", "apenas", "tambem", "ja", "ai", "la", "aqui", "voces", "eu", "ele", "ela", "mim", "meu", "minha", "sua",
]);

const index = new Map<string, Entity[]>();
function add(name: string, e: Entity) {
  const key = strip(name).replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  if (key.length < 3 || GENERIC.has(key) || FILLER.has(key)) return;
  const list = index.get(key) ?? [];
  if (!list.includes(e)) list.push(e);
  index.set(key, list);
}
for (const e of ENTITIES) {
  if (e.k === "e") continue; // events are reached through the people and places that appear in their name
  for (const n of [...e.pt, e.en, ...e.al]) add(n, e);
}
const MAX_GRAM = 4;

/** The words that carry the subject: the question without its filler ("Me fale tudo sobre Zaqueu" -> "Zaqueu"). Empty when nothing is left, or when the question has no filler to strip. */
export function subjectOf(question: string): string {
  const words = question.replace(/[¿?!.,;:()"“”]/g, " ").split(/\s+/).filter(Boolean);
  const kept = words.filter((w) => !FILLER.has(strip(w)));
  if (!kept.length || kept.length === words.length) return "";
  return kept.join(" ");
}

const KEYS = [...index.keys()].filter((k) => !k.includes(" "));
function distance(a: string, b: string): number {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
/** A misspelt name ("Nicodemo", "Zaquel", "Balaao") finds the nearest name of the index: same first letter, at most one change (two for long names). */
export function fuzzyName(token: string): string | null {
  if (token.length < 5 || FILLER.has(token) || index.has(token)) return null;
  const limit = token.length >= 8 ? 2 : 1;
  let best: string | null = null, bestD = limit + 1;
  for (const k of KEYS) {
    if (k[0] !== token[0] || Math.abs(k.length - token.length) > limit) continue;
    const d = distance(k, token);
    if (d < bestD) { best = k; bestD = d; }
  }
  return best;
}

/** Entities named in the question, most specific first (a longer name wins over the shorter name inside it). */
export function findEntities(question: string, max = 3, fuzzy = true): EntityMatch[] {
  const tokens = strip(question).replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean).map((t) => (!fuzzy || index.has(t) || FILLER.has(t) ? t : fuzzyName(t) ?? t));
  const found: EntityMatch[] = [];
  const used = new Array(tokens.length).fill(false);
  for (let n = MAX_GRAM; n >= 1; n--) {
    for (let i = 0; i + n <= tokens.length; i++) {
      if (used.slice(i, i + n).some(Boolean)) continue;
      const list = index.get(tokens.slice(i, i + n).join(" "));
      if (!list) continue;
      // several entities with the same name (the many Jameses, Marys, Josephs): the one with most verses is the one a student means; places and people are not mixed up
      const ranked = [...list].sort((a, b) => b.r.length - a.r.length)[0];
      const kind = ranked.k === "p" ? "person" : ranked.k === "l" ? "place" : "event";
      found.push({ id: ranked.id, kind, en: ranked.en, matched: tokens.slice(i, i + n).join(" "), refs: ranked.r });
      for (let j = i; j < i + n; j++) used[j] = true;
    }
  }
  return found.slice(0, max);
}

/** Verses of the events that carry the entity's name ("Zacchaeus Converted and Parable of the Pounds"): the whole story, not only the lines that name the person. */
const EVENTS = ENTITIES.filter((e) => e.k === "e");
export function eventRefsFor(en: string): string[] {
  const needle = new RegExp(`\\b${en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  return EVENTS.filter((e) => needle.test(e.en)).flatMap((e) => e.r).slice(0, 30);
}

/** Everything the search needs from the entities of a question: English names (for the English works), Bible references, and the subject phrase. */
export function entityHints(question: string): { names: string[]; refs: string[]; subject: string; matches: EntityMatch[]; aboutEntity: boolean } {
  const matches = findEntities(question);
  // A question that is only ABOUT the entity ("Me fale tudo sobre Zaqueu") gets its verses. A specific question that merely names it ("Noé > Dilúvio: a entrada na arca")
  // keeps the English name but not the verses: the entity's whole story would crowd out the passage actually asked for.
  const named = new Set(matches.flatMap((m) => m.matched.split(" ")));
  const subject = subjectOf(question);
  const extra = strip(subject || question).replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w && !named.has(w) && !FILLER.has(w) && !(w.length < 3));
  const aboutEntity = matches.length > 0 && extra.length <= 1;
  const refs = aboutEntity ? [...new Set(matches.flatMap((m) => [...m.refs.slice(0, 12), ...(m.kind === "person" ? eventRefsFor(m.en) : [])]))].slice(0, 40) : [];
  return { names: [...new Set(matches.map((m) => m.en))], refs, subject, matches, aboutEntity };
}
