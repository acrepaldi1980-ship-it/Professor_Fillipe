// Personalised path (Module 2 of the teacher's guide). The plan is composed from passages we already checked against the Bible (the catalog
// in data.ts plus a few clear starters), so no reference is invented; the daily prompts follow the guide: quick wins first, narrative,
// teaching and poetry alternating, Christ in every path, one review day every 7 days, extras by role.
import { z } from "zod";
import { PATHS, type PathDay, type PathDef, type PathWeek } from "./data";

export const PERSONAL_PATH_ID = "meu";

export const GOALS = ["whole_bible", "understand_book", "intimacy", "overcome", "prepare", "theology", "know_jesus"] as const;
export const ROLES = ["student", "ebd_teacher", "theology_student", "pastor", "new_convert", "seeking"] as const;

export const personalRequest = z.object({
  goal: z.enum(GOALS),
  role: z.enum(ROLES).default("student"),
  level: z.number().int().min(1).max(5).default(2),
  minutes: z.number().int().min(5).max(60).default(15),
  days: z.union([z.literal(14), z.literal(30), z.literal(60)]).default(30),
  phase: z.string().max(120).optional(),
  tz: z.string().max(60).optional(),
});
export type PersonalRequest = z.infer<typeof personalRequest>;

type Genre = "narrative" | "teaching" | "poetry";
interface Item { day: PathDay; genre: Genre; easy: boolean; christ: boolean }

const POETRY = new Set(["PSA", "PRO", "JOB", "ECC", "SNG", "LAM"]);
const TEACHING = new Set(["ROM", "1CO", "2CO", "GAL", "EPH", "PHP", "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAS", "1PE", "2PE", "1JN", "2JN", "3JN", "JUD", "DEU", "LEV"]);
const genreOf = (ref: string): Genre => { const b = ref.slice(0, 3); return POETRY.has(b) ? "poetry" : TEACHING.has(b) || ref.startsWith("MAT.5") ? "teaching" : "narrative"; };

const d = (title: string, ref: string, goal: string): PathDay => ({ day: 0, title, ref, goal });
// Clear texts that give a quick win (Gospels, Psalms, short passages) and point to Christ.
const STARTERS: PathDay[] = [
  d("O Verbo se fez carne", "JHN.1.1-JHN.1.18", "Conhecer quem é Jesus desde o princípio."),
  d("O Senhor é o meu pastor", "PSA.23.1-PSA.23.6", "Descansar no cuidado de Deus."),
  d("Nascer de novo", "JHN.3.1-JHN.3.21", "Entender o amor de Deus e o que é crer."),
  d("As bem-aventuranças", "MAT.5.1-MAT.5.12", "Ver o que Jesus chama de bem-aventurado."),
  d("Nada nos separa do amor de Deus", "ROM.8.28-ROM.8.39", "Firmar a confiança no amor de Cristo."),
  d("Não andeis ansiosos", "PHP.4.4-PHP.4.9", "Aprender a entregar a ansiedade em oração."),
  d("Meditar na lei do Senhor", "PSA.1.1-PSA.1.6", "Ver o que é uma vida enraizada na Palavra."),
  d("Pelo arrependimento: Salmo 51", "PSA.51.1-PSA.51.19", "Aprender a voltar a Deus com sinceridade."),
  d("A oração do Pai Nosso", "MAT.6.5-MAT.6.15", "Aprender a orar como Jesus ensinou."),
  d("Eu sou o bom pastor", "JHN.10.1-JHN.10.18", "Ver Jesus cuidando e dando a vida pelas ovelhas."),
  d("Permanecer na videira", "JHN.15.1-JHN.15.17", "Entender o que é viver em Cristo e dar fruto."),
  d("A armadura de Deus", "EPH.6.10-EPH.6.20", "Aprender a resistir firmado em Cristo."),
];
const BOOK_FOCUS: Record<string, string[]> = {
  whole_bible: [],
  understand_book: [],
};
void BOOK_FOCUS;

const christRefs = /^(JHN|MAT|MRK|LUK|ROM|HEB|ISA\.5[23]|PSA\.(22|23|110)|JER\.31|GEN\.(3|12|22))/;

function pool(): Item[] {
  const all = [...STARTERS, ...PATHS.flatMap((p) => p.days)];
  const seen = new Set<string>();
  const out: Item[] = [];
  for (const x of all) {
    if (seen.has(x.ref)) continue;
    seen.add(x.ref);
    const verses = refVerseCount(x.ref);
    out.push({ day: x, genre: genreOf(x.ref), easy: verses <= 24, christ: christRefs.test(x.ref) });
  }
  return out;
}

/** Rough size of a passage "BOK.c.v-BOK.c.v" (same chapter: verse span; across chapters: large). */
function refVerseCount(ref: string): number {
  const [a, b] = ref.split("-");
  if (!b) return 1;
  const [, c1, v1] = a.split("."); const [, c2, v2] = b.split(".");
  return c1 === c2 ? Number(v2) - Number(v1) + 1 : (Number(c2) - Number(c1) + 1) * 25;
}

/** Order of the passages by the person's goal: the goal picks which pool leads, the level decides how soon harder texts arrive. */
function rank(i: Item, req: PersonalRequest): number {
  let s = 0;
  if (req.goal === "know_jesus" || req.goal === "intimacy") s += (i.christ ? -3 : 0) + (i.genre === "poetry" ? -2 : 0);
  if (req.goal === "overcome") s += i.genre === "poetry" ? -3 : i.genre === "teaching" ? -1 : 0;
  if (req.goal === "theology") s += i.genre === "teaching" ? -3 : 0;
  if (req.goal === "prepare") s += i.genre === "narrative" ? -1 : 0;
  if (req.goal === "whole_bible") s += i.genre === "narrative" ? -1 : 0;
  if (req.goal === "understand_book") s += i.genre === "narrative" ? -1 : 0;
  s += i.easy ? -req.level * 0 - (req.level <= 2 ? 3 : 0) : req.level >= 4 ? -1 : 0;
  return s;
}

const GENRE_Q: Record<Genre, string[]> = {
  narrative: ["Em qual personagem desta história você mais se vê hoje, e por quê?", "O que esta história revela sobre como Deus age com quem falha?", "Onde você vê Cristo aparecendo, ou sendo apontado, nesta passagem?"],
  teaching: ["O que este ensino expõe no seu coração: confiança em você ou em Deus?", "Qual verdade desta passagem você tem vivido mais por costume do que por convicção?", "Como este texto aponta para o que Cristo fez por você?"],
  poetry: ["Que sentimento deste texto você consegue dizer a Deus com suas próprias palavras?", "Onde você tem confiado mais no seu controle do que em Deus?", "Como Cristo cumpre ou responde a esta oração?"],
};
const GENRE_ACT: Record<Genre, string[]> = {
  narrative: ["Conte esta história em voz alta para alguém de casa, em um minuto.", "Escreva uma frase sobre o que Deus mostrou de si nesta história.", "Faça uma oração agradecendo pela fidelidade de Deus nesta passagem."],
  teaching: ["Escolha um passo pequeno de obediência a este ensino e faça hoje.", "Escreva o versículo central e deixe-o à vista durante o dia.", "Peça perdão ou perdoe alguém, se o texto tocou nisso."],
  poetry: ["Ore este texto em voz alta, trocando as palavras por palavras suas.", "Fique 3 minutos em silêncio diante de Deus depois de ler.", "Escreva um salmo curto de três linhas com o que está no seu coração."],
};

const visualFor = (ref: string): PathDay["visual"] => {
  const b = ref.slice(0, 3);
  if (["ACT", "EXO", "NUM", "JOS", "JON", "EZR", "NEH"].includes(b)) return "map";
  if (["1KI", "2KI", "2SA", "1SA", "DAN", "ISA", "JER", "MAL"].includes(b)) return "timeline";
  if (["LEV"].includes(b) || ref.startsWith("EXO.25")) return "scene3d";
  return "none";
};

const centralVerse = (ref: string) => ref.split("-")[0];

const GOAL_TITLE: Record<PersonalRequest["goal"], { title: string; promise: string }> = {
  whole_bible: { title: "A Bíblia inteira, passo a passo", promise: "Enxergar a grande história da Bíblia e como ela aponta para Cristo." },
  understand_book: { title: "Entendendo a Palavra com calma", promise: "Ler os textos no contexto e entender o que cada um quis dizer." },
  intimacy: { title: "Mais perto de Deus", promise: "Crescer na intimidade com Deus, orando a partir da própria Palavra." },
  overcome: { title: "Firme na luta", promise: "Encontrar na Palavra firmeza, perdão e esperança para a fase que você vive." },
  prepare: { title: "Preparado para ensinar", promise: "Chegar ao fim com textos estudados e esboços prontos para ensinar." },
  theology: { title: "Fundamentos da fé", promise: "Entender as grandes doutrinas a partir do próprio texto bíblico." },
  know_jesus: { title: "Conhecendo Jesus", promise: "Conhecer Jesus pelas Escrituras e responder a Ele." },
};

const EXTRA: Partial<Record<PersonalRequest["role"], PathWeek["extra"]>> = { ebd_teacher: "lesson_outline", pastor: "sermon_outline" };

/** Composes the plan. Pure and deterministic (same request, same plan). */
export function composePersonalPath(req: PersonalRequest, kept: PathDay[] = []): PathDef & { doneNumbers: number[] } {
  const items = pool().sort((a, b) => rank(a, req) - rank(b, req) || 0);
  // 6 reading days then 1 review day, repeating; on short minutes prefer the shorter passages first within each block.
  const reading = req.days - Math.floor(req.days / 7);
  // Regeneration (weekly review): the readings already done stay first, in order; only the rest is recomposed.
  const keptItems: Item[] = kept.filter((x) => x.kind !== "review").map((x) => ({ day: x, genre: genreOf(x.ref), easy: true, christ: christRefs.test(x.ref) }));
  const chosen: Item[] = [...keptItems];
  const used = new Set<string>(keptItems.map((i) => i.day.ref));
  let lastGenre: Genre | null = chosen.length ? chosen[chosen.length - 1].genre : null;
  while (chosen.length < reading) {
    // Alternate genres so the person does not tire; pick the best-ranked unused item whose genre differs from the last.
    const pick = items.find((i) => !used.has(i.day.ref) && i.genre !== lastGenre) ?? items.find((i) => !used.has(i.day.ref));
    if (!pick) break; // pool exhausted: the plan is as long as the pool allows
    // Short time budget: do not put a very long passage in the first week.
    const idx = chosen.length;
    const tooLong = req.minutes <= 10 && idx < 7 && !pick.easy;
    const alt = tooLong ? items.find((i) => !used.has(i.day.ref) && i.easy && i.genre !== lastGenre) : undefined;
    const it = alt ?? pick;
    used.add(it.day.ref); chosen.push(it); lastGenre = it.genre;
  }
  const days: PathDay[] = [];
  const weeks: PathWeek[] = [];
  const doneNumbers: number[] = [];
  let n = 0, w = 1, inWeek: Item[] = [];
  const closeWeek = () => {
    const first = inWeek[0]?.day.title ?? "";
    const theme = inWeek.length ? `${first}${inWeek.length > 1 ? " e os passos seguintes" : ""}` : `Semana ${w}`;
    const extra = EXTRA[req.role] ?? "none";
    weeks.push({ week: w, theme, review: "O que tocou você nesta semana? O que ficou difícil? Algo mudou na sua vida?", extra });
  };
  chosen.forEach((it, k) => {
    n++;
    const g = it.genre;
    days.push({
      ...it.day, day: n, week: w, kind: "reading",
      key_verse: centralVerse(it.day.ref),
      question: GENRE_Q[g][k % 3], action: GENRE_ACT[g][k % 3],
      prayer: `Agradecer e responder a Deus a partir de "${it.day.title}".`,
      visual: visualFor(it.day.ref),
    });
    if (k < keptItems.length) doneNumbers.push(n);
    inWeek.push(it);
    const last = k === chosen.length - 1;
    if (inWeek.length === 6 || last) {
      if (inWeek.length === 6 && req.days >= 14) {
        n++;
        if (k < keptItems.length) doneNumbers.push(n); // the review that closes a finished week counts as done
        days.push({ day: n, title: `Revisão da semana ${w}`, ref: inWeek[0].day.ref, goal: "Conversar sobre o que tocou, o que ficou difícil e se a vida mudou; ajustar o ritmo e o foco sem culpa.", week: w, kind: "review", question: "O que tocou você nesta semana, o que ficou difícil e o que mudou?", action: "Escolha o texto da semana que mais falou ao seu coração e leia de novo.", prayer: "Agradecer pela semana e pedir direção para a próxima.", visual: "none" });
      }
      closeWeek(); inWeek = []; w++;
    }
  });
  const meta = GOAL_TITLE[req.goal];
  return {
    id: PERSONAL_PATH_ID, personal: true, level: req.level >= 4 ? "intermediário" : "iniciante",
    title: meta.title, description: `Trilha feita para você: ${days.length} dias de ${req.minutes} minutos, com uma revisão a cada 7 dias.`,
    promise: meta.promise, days, weeks, doneNumbers,
    adjust: "Se você faltar dias, não tem problema: o plano se reorganiza sem culpa. Se estiver fácil demais, peça passagens mais longas; se estiver pesado, peça ritmo mais leve. Observe se o tempo diário cabe na sua rotina e se a pergunta do dia tem mexido com você.",
  };
}
