// Name grounding (RA-09): the model must not talk about people, books or chapters that the sources do not contain.
// Before generating, we look for names in the student's question that appear nowhere in the retrieved sources
// (nor in the English keywords of the query) and, if any, add a warning to the prompt so the teacher says
// "não encontrei isso nas minhas fontes" instead of inventing.
import { ALIASES, BOOKS } from "../knowledge/books";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Capitalized words that are not names.
const STOP = new Set(
  ("quem qual quais quando onde como porque por que o a os as um uma me mim minha meu seu sua segundo segunda terceiro terceira primeiro primeira " +
    "explique explica leia mostra mostre diga fale conte cite escreva descreva ignore esqueca imprima responda voce vc ola oi deus jesus cristo senhor biblia " +
    "evangelho evangelhos antigo novo testamento sao nos ele ela isso essa esse esta este eu em de do da dos das no na nos nas ao aos para com sem sobre " +
    "versiculo capitulo livro carta epistola profeta apostolo rei rainha").split(" "),
);

/** Known biblical book names and aliases (normalized), for "livro de X" checks. */
const BOOK_WORDS = new Set<string>([...ALIASES.keys()].filter((k) => k.length > 3).concat(BOOKS.flatMap((b) => [norm(b.pt), norm(b.en)])));

// Spelling bridge between Portuguese and English renderings of biblical names (Mefibosete/Mephibosheth, Tadeu/Thaddaeus).
const phon = (s: string) =>
  norm(s)
    .replace(/ph/g, "f").replace(/th/g, "t").replace(/k/g, "c").replace(/y/g, "i").replace(/w/g, "v").replace(/ae/g, "e")
    .replace(/(.)\1+/g, "$1");

// Common biblical names whose English form differs a lot from the Portuguese one.
export const NAME_EN: Record<string, string> = {
  elias: "elijah", eliseu: "elisha", joao: "john", tiago: "james", pedro: "peter", davi: "david", isaias: "isaiah", jeremias: "jeremiah",
  moises: "moses", salomao: "solomon", abraao: "abraham", isaque: "isaac", jaco: "jacob", jose: "joseph", paulo: "paul", estevao: "stephen",
  mateus: "matthew", marcos: "mark", lucas: "luke", ezequiel: "ezekiel", jonas: "jonah", josue: "joshua", noe: "noah", ester: "esther",
  rute: "ruth", maria: "mary", marta: "martha", lazaro: "lazarus", nicodemos: "nicodemus", zaqueu: "zacchaeus", herodes: "herod",
  pilatos: "pilate", caifas: "caiaphas", barnabe: "barnabas", timoteo: "timothy", filipe: "philip", andre: "andrew", tome: "thomas",
  bartolomeu: "bartholomew", tadeu: "thaddaeus", simao: "simon", gideao: "gideon", sansao: "samson", golias: "goliath",
  nabucodonosor: "nebuchadnezzar", melquisedeque: "melchizedek", mefibosete: "mephibosheth", jezabel: "jezebel", acabe: "ahab",
  jeroboao: "jeroboam", roboao: "rehoboam", ezequias: "hezekiah", josias: "josiah", neemias: "nehemiah", esdras: "ezra", gamaliel: "gamaliel",
};

const fuzzyIncludes = (haystack: string, name: string): boolean => {
  const h = phon(haystack);
  const variants = [name, NAME_EN[norm(name)]].filter(Boolean) as string[];
  return variants.some((v) => {
    const n = phon(v);
    return h.includes(n) || (n.length >= 5 && h.includes(n.slice(0, 5)));
  });
};

export interface GroundingInput {
  question: string;
  chunkTexts: string[];
  /** English keywords generated for retrieval, if any. */
  rewritten?: string | null;
}

const CAP = "[\\p{Lu}][\\p{L}]{2,}";

export function findUngroundedNames(i: GroundingInput): string[] {
  const q = i.question;
  const found = new Set<string>();

  // (a) "livro de X", "carta de/aos X": X must be a real book.
  for (const m of q.matchAll(new RegExp(`\\b(?:livro|carta|ep[ií]stola)\\s+(?:de|do|da|aos?|às?)\\s+(${CAP})`, "gu"))) {
    const name = norm(m[1]);
    if (!BOOK_WORDS.has(name) && !STOP.has(name)) found.add(m[1]);
  }
  // numbered letters that do not exist ("Terceira Carta aos Coríntios")
  if (/\b(terceira|3ª|3a|iii)\s+(?:carta|ep[ií]stola)\s+aos?\s+corintios/i.test(norm(q))) found.add("Terceira Carta aos Coríntios");

  // (b) a name introduced by a role word ("o profeta X", "o apóstolo X", "o rei X") must appear in the sources.
  const hay = i.chunkTexts.join(" ") + " " + (i.rewritten ?? "");
  for (const m of q.matchAll(new RegExp(`\\b(?:profeta|ap[oó]stolo|rei|rainha|sacerdote|autor|escritor|disc[ií]pulo|personagem|patriarca)\\s+(?:o\\s+|a\\s+)?(${CAP})`, "gu"))) {
    const name = norm(m[1]);
    if (STOP.has(name) || BOOK_WORDS.has(name)) continue;
    if (!fuzzyIncludes(hay, m[1])) found.add(m[1]);
  }
  // (c) a name followed by an ordinal ("Tadeu Segundo") is not a biblical name.
  for (const m of q.matchAll(new RegExp(`\\b(${CAP})\\s+(Segundo|Terceiro|Quarto)\\b`, "gu"))) {
    if (!STOP.has(norm(m[1]))) found.add(`${m[1]} ${m[2]}`);
  }
  return [...found].slice(0, 4);
}

export function groundingNotice(names: string[]): string | undefined {
  if (!names.length) return undefined;
  return `AVISO DE FONTE: o(s) nome(s) a seguir, citado(s) pelo aluno, NÃO aparece(m) nos trechos recuperados: ${names.join(", ")}. Provavelmente não existem nas fontes. Diga com gentileza que não encontrou isso nas suas fontes, NÃO descreva, NÃO deduza e NÃO invente nada sobre ele(s), e ofereça uma alternativa que esteja nos trechos. Termine com uma pergunta.`;
}
