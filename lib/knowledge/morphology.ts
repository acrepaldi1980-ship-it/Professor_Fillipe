// Morphology of the original-language words in plain Portuguese (spec 8.7.4 P1). Greek uses the Robinson codes of STEPBible TAGNT
// ("V-IAI-3S" = verbo, imperfeito, ativa, indicativo, 3ª pessoa, singular); Hebrew uses the TAHOT codes ("HVqp3ms", prefixes joined by "/").
export interface Morph { pos: string; detail: string; text: string }

const CASE: Record<string, string> = { N: "nominativo", G: "genitivo", D: "dativo", A: "acusativo", V: "vocativo" };
const NUM: Record<string, string> = { S: "singular", P: "plural" };
const GEN: Record<string, string> = { M: "masculino", F: "feminino", N: "neutro" };
const TENSE: Record<string, string> = { P: "presente", I: "imperfeito", F: "futuro", A: "aoristo", R: "perfeito", L: "mais-que-perfeito", X: "tempo não definido" };
const VOICE: Record<string, string> = { A: "ativa", M: "média", P: "passiva", E: "média ou passiva", D: "média (depoente)", O: "passiva (depoente)", N: "média ou passiva (depoente)", Q: "quase-depoente" };
const MOOD: Record<string, string> = { I: "indicativo", S: "subjuntivo", O: "optativo", M: "imperativo", N: "infinitivo", P: "particípio" };
const GPOS: Record<string, string> = { N: "substantivo", A: "adjetivo", V: "verbo", T: "artigo", R: "pronome relativo", C: "pronome recíproco", D: "pronome demonstrativo", K: "pronome correlativo", I: "pronome interrogativo", X: "pronome indefinido", Q: "pronome interrogativo/correlativo", F: "pronome reflexivo", S: "pronome possessivo", P: "pronome pessoal" };
const GWORD: Record<string, string> = { PREP: "preposição", CONJ: "conjunção", ADV: "advérbio", PRT: "partícula", INJ: "interjeição", COND: "condicional", ARAM: "aramaico", HEB: "hebraico" };

const join = (xs: (string | undefined)[]) => xs.filter(Boolean).join(", ");

function greek(code: string): Morph {
  if (GWORD[code]) return { pos: GWORD[code], detail: "", text: GWORD[code] };
  const [head, a, b] = code.split("-");
  const pos = GPOS[head] ?? head;
  if (head === "V") {
    // "IAI-3S" (finite), "PAP-NSM" (participle), "2AAI-3S" (second aorist: the digit is a form marker)
    const m = /^([12]?)([PIFARLX])([AMPEDONQ])([ISOMNP])$/.exec(a ?? "");
    if (!m) return { pos, detail: join([a, b]), text: join([pos, a, b]) };
    const second = m[1] ? ` (${m[1]}ª forma)` : "";
    const finite = m[4] !== "N" && m[4] !== "P";
    const pers = finite && b ? `${b[0]}ª pessoa, ${NUM[b[1]] ?? ""}` : undefined;
    const part = m[4] === "P" && b ? join([CASE[b[0]], NUM[b[1]], GEN[b[2]]]) : undefined;
    const detail = join([TENSE[m[2]] + second, VOICE[m[3]], MOOD[m[4]], pers, part]);
    return { pos, detail, text: join([pos, detail]) };
  }
  if (head === "T" || head === "N" || head === "A" || ["R", "C", "D", "K", "I", "X", "Q", "F", "S"].includes(head)) {
    const detail = a && /^[NGDAV][SP][MFN]?/.test(a) ? join([CASE[a[0]], NUM[a[1]], GEN[a[2]]]) : join([a]);
    return { pos, detail, text: join([pos, detail]) };
  }
  if (head === "P") {
    // personal pronoun: "P-1NS" (1st person, nominative, singular) or "P-GSM"
    const detail = a && /^\d/.test(a) ? join([`${a[0]}ª pessoa`, CASE[a[1]], NUM[a[2]]]) : a ? join([CASE[a[0]], NUM[a[1]], GEN[a[2]]]) : "";
    return { pos, detail, text: join([pos, detail]) };
  }
  return { pos, detail: join([a, b]), text: join([pos, a, b]) };
}

const STEM: Record<string, string> = { q: "qal", N: "nifal", p: "piel", P: "pual", h: "hifil", H: "hofal", t: "hitpael", o: "polel", O: "polal", r: "hitpolel", m: "poel", M: "poal", k: "palel", K: "pulal", Q: "qal passivo", l: "pilpel", L: "polpal", f: "hitpalpel", D: "nitpael", j: "pealal", i: "pilel", u: "hotpaal", c: "aramaico", v: "aramaico (outro tronco)" };
const ASPECT: Record<string, string> = { p: "perfeito", q: "perfeito sequencial", i: "imperfeito", w: "imperfeito sequencial (waw)", h: "coortativo", j: "jussivo", v: "imperativo", r: "particípio ativo", s: "particípio passivo", a: "infinitivo absoluto", c: "infinitivo construto" };
const HGEN: Record<string, string> = { m: "masculino", f: "feminino", c: "comum", b: "ambos" };
const HNUM: Record<string, string> = { s: "singular", p: "plural", d: "dual" };
const STATE: Record<string, string> = { a: "absoluto", c: "construto", d: "determinado" };
const HTYPE: Record<string, string> = { c: "comum", p: "próprio", g: "gentílico" };

function hebrewPart(p: string): string {
  const k = p[0];
  if (k === "V") {
    const stem = STEM[p[1]], asp = ASPECT[p[2]];
    const rest = p.slice(3);
    const pgn = /^([123])([mfcb])([sdp])$/.exec(rest);
    const gn = /^([mfcb])([sdp])$/.exec(rest);
    const who = pgn ? `${pgn[1]}ª pessoa, ${HGEN[pgn[2]]}, ${HNUM[pgn[3]]}` : gn ? `${HGEN[gn[1]]}, ${HNUM[gn[2]]}` : "";
    return join(["verbo", stem, asp, who]);
  }
  if (k === "N") return join(["substantivo", HTYPE[p[1]], HGEN[p[2]], HNUM[p[3]], STATE[p[4]]]);
  if (k === "A") return join(["adjetivo", HGEN[p[2]], HNUM[p[3]], STATE[p[4]]]);
  if (k === "R") return "preposição";
  if (k === "C") return "conjunção";
  if (k === "D") return "demonstrativo";
  if (k === "P") return join(["pronome", p[1] === "p" ? "pessoal" : undefined]);
  if (k === "S") return "sufixo pronominal";
  if (k === "T") return p[1] === "d" ? "artigo definido" : p[1] === "o" ? "marca de objeto direto" : p[1] === "r" ? "partícula relativa" : "partícula";
  return p;
}

function hebrew(code: string): Morph {
  const parts = code.replace(/^H/, "").split("/");
  const texts = parts.map(hebrewPart);
  return { pos: texts[texts.length - 1].split(",")[0], detail: texts.join(" + "), text: texts.join(" + ") };
}

/** Decodes the morphology code of one word. `lang` is "grc" (Greek NT) or "heb" (Hebrew OT). Unknown codes come back as they are. */
export function decodeMorph(code: string | null | undefined, lang: "grc" | "heb"): Morph | null {
  if (!code) return null;
  try { return lang === "heb" ? hebrew(code) : greek(code); } catch { return { pos: code, detail: "", text: code }; }
}

/** The language of a word from its Strong number (G = Greek, H = Hebrew). */
export const langOfStrong = (strong: string | null | undefined): "grc" | "heb" => (strong?.startsWith("H") ? "heb" : "grc");
