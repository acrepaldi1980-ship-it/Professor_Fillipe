// Canonical book data (OSIS codes in English, spec 8.10.5 / glossary "Referência canônica").
// Total chapters = 1189.

export interface BookInfo {
  code: string;
  pt: string;
  en: string;
  chapters: number;
}

export const BOOKS: BookInfo[] = [
  { code: "GEN", pt: "Gênesis", en: "Genesis", chapters: 50 },
  { code: "EXO", pt: "Êxodo", en: "Exodus", chapters: 40 },
  { code: "LEV", pt: "Levítico", en: "Leviticus", chapters: 27 },
  { code: "NUM", pt: "Números", en: "Numbers", chapters: 36 },
  { code: "DEU", pt: "Deuteronômio", en: "Deuteronomy", chapters: 34 },
  { code: "JOS", pt: "Josué", en: "Joshua", chapters: 24 },
  { code: "JDG", pt: "Juízes", en: "Judges", chapters: 21 },
  { code: "RUT", pt: "Rute", en: "Ruth", chapters: 4 },
  { code: "1SA", pt: "1 Samuel", en: "1 Samuel", chapters: 31 },
  { code: "2SA", pt: "2 Samuel", en: "2 Samuel", chapters: 24 },
  { code: "1KI", pt: "1 Reis", en: "1 Kings", chapters: 22 },
  { code: "2KI", pt: "2 Reis", en: "2 Kings", chapters: 25 },
  { code: "1CH", pt: "1 Crônicas", en: "1 Chronicles", chapters: 29 },
  { code: "2CH", pt: "2 Crônicas", en: "2 Chronicles", chapters: 36 },
  { code: "EZR", pt: "Esdras", en: "Ezra", chapters: 10 },
  { code: "NEH", pt: "Neemias", en: "Nehemiah", chapters: 13 },
  { code: "EST", pt: "Ester", en: "Esther", chapters: 10 },
  { code: "JOB", pt: "Jó", en: "Job", chapters: 42 },
  { code: "PSA", pt: "Salmos", en: "Psalms", chapters: 150 },
  { code: "PRO", pt: "Provérbios", en: "Proverbs", chapters: 31 },
  { code: "ECC", pt: "Eclesiastes", en: "Ecclesiastes", chapters: 12 },
  { code: "SNG", pt: "Cantares", en: "Song of Solomon", chapters: 8 },
  { code: "ISA", pt: "Isaías", en: "Isaiah", chapters: 66 },
  { code: "JER", pt: "Jeremias", en: "Jeremiah", chapters: 52 },
  { code: "LAM", pt: "Lamentações", en: "Lamentations", chapters: 5 },
  { code: "EZK", pt: "Ezequiel", en: "Ezekiel", chapters: 48 },
  { code: "DAN", pt: "Daniel", en: "Daniel", chapters: 12 },
  { code: "HOS", pt: "Oséias", en: "Hosea", chapters: 14 },
  { code: "JOL", pt: "Joel", en: "Joel", chapters: 3 },
  { code: "AMO", pt: "Amós", en: "Amos", chapters: 9 },
  { code: "OBA", pt: "Obadias", en: "Obadiah", chapters: 1 },
  { code: "JON", pt: "Jonas", en: "Jonah", chapters: 4 },
  { code: "MIC", pt: "Miqueias", en: "Micah", chapters: 7 },
  { code: "NAM", pt: "Naum", en: "Nahum", chapters: 3 },
  { code: "HAB", pt: "Habacuque", en: "Habakkuk", chapters: 3 },
  { code: "ZEP", pt: "Sofonias", en: "Zephaniah", chapters: 3 },
  { code: "HAG", pt: "Ageu", en: "Haggai", chapters: 2 },
  { code: "ZEC", pt: "Zacarias", en: "Zechariah", chapters: 14 },
  { code: "MAL", pt: "Malaquias", en: "Malachi", chapters: 4 },
  { code: "MAT", pt: "Mateus", en: "Matthew", chapters: 28 },
  { code: "MRK", pt: "Marcos", en: "Mark", chapters: 16 },
  { code: "LUK", pt: "Lucas", en: "Luke", chapters: 24 },
  { code: "JHN", pt: "João", en: "John", chapters: 21 },
  { code: "ACT", pt: "Atos", en: "Acts", chapters: 28 },
  { code: "ROM", pt: "Romanos", en: "Romans", chapters: 16 },
  { code: "1CO", pt: "1 Coríntios", en: "1 Corinthians", chapters: 16 },
  { code: "2CO", pt: "2 Coríntios", en: "2 Corinthians", chapters: 13 },
  { code: "GAL", pt: "Gálatas", en: "Galatians", chapters: 6 },
  { code: "EPH", pt: "Efésios", en: "Ephesians", chapters: 6 },
  { code: "PHP", pt: "Filipenses", en: "Philippians", chapters: 4 },
  { code: "COL", pt: "Colossenses", en: "Colossians", chapters: 4 },
  { code: "1TH", pt: "1 Tessalonicenses", en: "1 Thessalonians", chapters: 5 },
  { code: "2TH", pt: "2 Tessalonicenses", en: "2 Thessalonians", chapters: 3 },
  { code: "1TI", pt: "1 Timóteo", en: "1 Timothy", chapters: 6 },
  { code: "2TI", pt: "2 Timóteo", en: "2 Timothy", chapters: 4 },
  { code: "TIT", pt: "Tito", en: "Titus", chapters: 3 },
  { code: "PHM", pt: "Filemom", en: "Philemon", chapters: 1 },
  { code: "HEB", pt: "Hebreus", en: "Hebrews", chapters: 13 },
  { code: "JAS", pt: "Tiago", en: "James", chapters: 5 },
  { code: "1PE", pt: "1 Pedro", en: "1 Peter", chapters: 5 },
  { code: "2PE", pt: "2 Pedro", en: "2 Peter", chapters: 3 },
  { code: "1JN", pt: "1 João", en: "1 John", chapters: 5 },
  { code: "2JN", pt: "2 João", en: "2 John", chapters: 1 },
  { code: "3JN", pt: "3 João", en: "3 John", chapters: 1 },
  { code: "JUD", pt: "Judas", en: "Jude", chapters: 1 },
  { code: "REV", pt: "Apocalipse", en: "Revelation", chapters: 22 },
];

export const BOOK_BY_CODE: Record<string, BookInfo> = Object.fromEntries(BOOKS.map((b) => [b.code, b]));

/** Alias entry: `single` is the unnumbered book; `fam` lists the numbered books (index = prefix number - 1). */
export interface AliasTarget {
  single?: string;
  fam?: string[];
}

const SAM = ["1SA", "2SA"];
const KGS = ["1KI", "2KI"];
const CHR = ["1CH", "2CH"];
const COR = ["1CO", "2CO"];
const THS = ["1TH", "2TH"];
const TIM = ["1TI", "2TI"];
const PET = ["1PE", "2PE"];
const JNS = ["1JN", "2JN", "3JN"];

// Aliases are lowercase, without accents, without punctuation. "Jó" is rewritten to "jb" before matching.
const SINGLES: Record<string, string[]> = {
  GEN: ["genesis", "gn", "gen", "ge", "gênesis"],
  EXO: ["exodo", "ex", "exo", "exod", "exodus"],
  LEV: ["levitico", "lv", "lev", "leviticus"],
  NUM: ["numeros", "nm", "num", "nu", "numbers"],
  DEU: ["deuteronomio", "dt", "deut", "deu", "deuteronomy"],
  JOS: ["josue", "js", "jos", "josh", "joshua"],
  JDG: ["juizes", "jz", "juiz", "judg", "judges"],
  RUT: ["rute", "rt", "rut", "ruth"],
  EZR: ["esdras", "ed", "esd", "ezr", "ezra"],
  NEH: ["neemias", "ne", "nee", "neh", "nehemiah"],
  EST: ["ester", "et", "est", "esther"],
  JOB: ["jb", "job"],
  PSA: ["salmos", "salmo", "sl", "sal", "ps", "psalm", "psalms"],
  PRO: ["proverbios", "pv", "prov", "pr", "proverbs"],
  ECC: ["eclesiastes", "ec", "ecl", "eccl", "ecclesiastes"],
  SNG: ["cantares de salomao", "cantico dos canticos", "cantares", "ct", "cnt", "song of solomon", "song of songs", "songs"],
  ISA: ["isaias", "is", "isa", "isaiah"],
  JER: ["jeremias", "jr", "jer", "jeremiah"],
  LAM: ["lamentacoes", "lm", "lam", "lamentations"],
  EZK: ["ezequiel", "ez", "eze", "ezek", "ezekiel"],
  DAN: ["daniel", "dn", "dan"],
  HOS: ["oseias", "os", "ose", "hos", "hosea"],
  JOL: ["joel", "jl", "jol"],
  AMO: ["amos", "am", "amo"],
  OBA: ["obadias", "abdias", "ob", "obad", "obadiah"],
  JON: ["jonas", "jn", "jon", "jonah"],
  MIC: ["miqueias", "mq", "miq", "mic", "micah"],
  NAM: ["naum", "na", "nau", "nah", "nahum"],
  HAB: ["habacuque", "hc", "hab", "habakkuk"],
  ZEP: ["sofonias", "sf", "sof", "zeph", "zephaniah"],
  HAG: ["ageu", "ag", "hag", "haggai"],
  ZEC: ["zacarias", "zc", "zac", "zech", "zechariah"],
  MAL: ["malaquias", "ml", "mal", "malachi"],
  MAT: ["mateus", "mt", "mat", "matt", "matthew"],
  MRK: ["marcos", "mc", "mar", "mk", "mrk", "mark"],
  LUK: ["lucas", "lc", "luc", "lk", "luk", "luke"],
  ACT: ["atos dos apostolos", "atos", "at", "act", "acts"],
  ROM: ["romanos", "rm", "rom", "romans"],
  GAL: ["galatas", "gl", "gal", "galatians"],
  EPH: ["efesios", "ef", "efe", "eph", "ephesians"],
  PHP: ["filipenses", "fp", "fil", "phil", "php", "philippians"],
  COL: ["colossenses", "cl", "col", "colossians"],
  TIT: ["tito", "tt", "tit", "titus"],
  PHM: ["filemom", "filemon", "fm", "flm", "philem", "phm", "philemon"],
  HEB: ["hebreus", "hb", "heb", "hebrews"],
  JAS: ["tiago", "tg", "jas", "james"],
  JUD: ["judas", "jd", "jud", "jude"],
  REV: ["apocalipse", "ap", "apo", "rev", "revelation", "revelations"],
};

const FAMILIES: [string[], string[]][] = [
  [SAM, ["samuel", "sm", "sam", "sa"]],
  [KGS, ["reis", "rs", "kings", "ki", "kgs"]],
  [CHR, ["cronicas", "cr", "cron", "chronicles", "chr", "ch"]],
  [COR, ["corintios", "co", "cor", "corinthians"]],
  [THS, ["tessalonicenses", "ts", "tes", "tess", "thessalonians", "thess", "th"]],
  [TIM, ["timoteo", "tm", "tim", "timothy", "ti"]],
  [PET, ["pedro", "pe", "pd", "ped", "pet", "peter"]],
  [JNS, ["joao", "jo", "jn", "jhn", "john", "joa"]],
];

export const ALIASES: Map<string, AliasTarget> = (() => {
  const map = new Map<string, AliasTarget>();
  const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  for (const [code, list] of Object.entries(SINGLES)) {
    for (const a of list) map.set(strip(a), { ...(map.get(strip(a)) ?? {}), single: code });
  }
  for (const [fam, list] of FAMILIES) {
    for (const a of list) map.set(strip(a), { ...(map.get(strip(a)) ?? {}), fam });
  }
  // The unnumbered John (JHN) shares aliases with the numbered Johns.
  for (const a of ["joao", "jo", "jhn", "john", "joa"]) map.set(a, { ...(map.get(a) ?? {}), single: "JHN" });
  return map;
})();
