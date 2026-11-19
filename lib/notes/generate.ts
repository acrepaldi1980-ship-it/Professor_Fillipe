// Own-notes generator (spec 8.11): writes a note in the app's own words from the Bible text and the released works only,
// then runs the originality report with automatic rewriting. Never copies or follows a protected study Bible.
import { expandRefs, findReferences, formatRefPt } from "../knowledge/refs-parser";
import type { Retrieved } from "../knowledge/search";
import type { NotesLlm } from "./llm";
import { checkAndRewrite, type Deps as OriginalityDeps, type OriginalityReport } from "./originality";
import { DraftOutput, type GenerateRequest, type SourceRef } from "./schema";

export const WORD_LIMITS = { intro: 380, pericope: 300, article: 450 } as const;

export interface GenerateDeps {
  llm: NotesLlm;
  versionId: string;
  getVerses(versionId: string, refs: string[]): Promise<{ ref: string; text: string }[]>;
  search(query: string, opts: { lenses: string[]; maxTokens: number; maxChunks: number; extraRefs: string[] }): Promise<{ chunks: Retrieved[] }>;
  /** Passages to compare against, for originality (without Bible text and without own notes). */
  sourcesFor: OriginalityDeps["sourcesFor"];
  embed: OriginalityDeps["embed"];
}

export interface GeneratedNote {
  tradition: "pentecostal";
  kind: GenerateRequest["kind"];
  book_code: string;
  ref_range: string;
  title: string;
  body: string;
  sources: SourceRef[];
  originality_report: OriginalityReport;
  originality_score: number;
  rewrite_count: number;
}

const SYSTEM = `Você escreve Notas de Estudo Pentecostais para o aplicativo do Professor Filipe, em português do Brasil.
REGRAS:
- Redação 100% própria, a partir SOMENTE do texto bíblico e dos trechos de obras fornecidos. Nada de memória de livros.
- É PROIBIDO copiar, parafrasear ou seguir a estrutura da Bíblia de Estudo Pentecostal (CPAD) ou de qualquer obra protegida. Não imite o formato "nota de rodapé".
- Não invente versículos, autores, datas, números de Strong nem citações. Cite apenas referências que estejam no texto bíblico fornecido ou nas fontes numeradas.
- Escreva a partir da leitura pentecostal clássica (batismo no Espírito como experiência distinta, línguas como sinal inicial, dons ativos, cura divina, santificação, volta de Cristo, missões), dizendo "Na leitura pentecostal..." quando for interpretação da tradição. Quando houver divergência real entre tradições, diga em uma frase quais são as outras leituras, sem declarar vencedora.
- Em doutrinas comuns a todos os cristãos, ensine com clareza, sem rotular como "só pentecostal".
- Cura divina: nunca desencoraje tratamento médico nem culpe o doente.
- Linguagem simples, tom acolhedor e didático, sem jargão sem explicação. Parágrafos curtos separados por linha em branco. Sem títulos nem listas.
- Responda SOMENTE com um JSON: {"title": "...", "body": "...", "used_sources": ["F1","F2"]} onde used_sources lista os códigos das fontes numeradas que realmente sustentam o texto.`;

function brief(req: GenerateRequest): string {
  if (req.kind === "intro") return `Introdução ao livro (${req.passage}): autor e data tradicionais, contexto, propósito, estrutura em linhas gerais e por que importa hoje.`;
  if (req.kind === "pericope") return `Nota sobre a perícope: o contexto, o que o texto diz, o ponto central e uma aplicação prática. Inclua a leitura pentecostal quando houver.`;
  return `Artigo temático sobre "${req.theme ?? req.title}": o que a Bíblia ensina, como a tradição pentecostal entende, as outras leituras em uma frase e uma aplicação prática.`;
}

const countWords = (s: string) => s.split(/\s+/).filter(Boolean).length;

function parseJson(raw: string): unknown {
  const t = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  return JSON.parse(a >= 0 ? t.slice(a, b + 1) : t);
}

export async function generateNote(req: GenerateRequest, deps: GenerateDeps): Promise<GeneratedNote> {
  const refs = [...new Set(findReferences(req.passage).flatMap((r) => r.refs))];
  const verses = refs.length ? (await deps.getVerses(deps.versionId, refs)).slice(0, 60) : [];
  const { chunks } = await deps.search(`${req.title} ${req.passage}`, { lenses: ["pentecostal"], maxTokens: 3600, maxChunks: 6, extraRefs: refs });
  const works = chunks.filter((c) => c.kind !== "bible_text" && c.kind !== "own_notes");
  const sources: Record<string, SourceRef> = {};
  const lines: string[] = [];
  works.forEach((c, i) => {
    const code = `F${i + 1}`;
    sources[code] = { type: "work", id: c.id, label: `${c.title_path ?? c.work_id} (${c.work_id})` };
    lines.push(`[${code}] ${c.title_path ?? c.work_id} (${c.work_id}, ${c.tradition}):\n${c.text.slice(0, 1800)}`);
  });
  const bible = verses.map((v) => `${formatRefPt(v.ref)}: ${v.text}`).join("\n");
  const limit = WORD_LIMITS[req.kind];
  const user = `${brief(req)}\n\nTítulo sugerido: ${req.title}\nPassagem: ${req.passage}\nLimite: ${limit} palavras.\n\nTEXTO BÍBLICO (${deps.versionId}):\n${bible || "(sem texto fornecido; use apenas as fontes)"}\n\nFONTES:\n${lines.join("\n\n") || "(nenhuma obra recuperada; escreva só com o texto bíblico e diga isso)"}`;

  let out: DraftOutput | null = null;
  for (let attempt = 0; attempt < 2 && !out; attempt++) {
    try {
      const raw = await deps.llm.complete(SYSTEM, attempt ? `${user}\n\nLembrete: responda somente com o JSON pedido, corpo com 120 a ${limit} palavras.` : user, 1800);
      const parsed = DraftOutput.safeParse(parseJson(raw));
      if (parsed.success && countWords(parsed.data.body) <= Math.round(limit * 1.4)) out = parsed.data;
    } catch {
      /* retry once */
    }
  }
  if (!out) throw new Error("draft_invalid");

  const { body, report } = await checkAndRewrite(out.body, {
    sourcesFor: deps.sourcesFor,
    embed: deps.embed,
    rewrite: async (paragraph, sourceId) =>
      (await deps.llm.complete(
        "Você reescreve um parágrafo em português do Brasil com outras palavras e outra estrutura de frases, mantendo as mesmas ideias, as referências bíblicas e o tom. Responda só com o parágrafo reescrito.",
        `Esse parágrafo ficou parecido demais com a fonte ${sourceId ?? "da base"}. Reescreva sem seguir a ordem nem as expressões originais:\n\n${paragraph}`,
        600,
      )).trim(),
  });

  const used = out.used_sources.map((c) => sources[c]).filter((s): s is SourceRef => !!s);
  const bibleSource: SourceRef[] = verses.length ? [{ type: "bible", id: deps.versionId, label: `${req.passage} (${deps.versionId})` }] : [];
  return {
    tradition: "pentecostal",
    kind: req.kind,
    book_code: req.book,
    ref_range: expandRefs(refs).join(","),
    title: out.title,
    body,
    sources: [...bibleSource, ...used],
    originality_report: report,
    originality_score: +Math.min(1, Math.max(0, 1 - report.maxSimilarity)).toFixed(3),
    rewrite_count: report.rewrites,
  };
}
