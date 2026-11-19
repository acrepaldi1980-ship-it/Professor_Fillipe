// Real dependencies of the notes generator (server only).
import { getEmbeddingProvider } from "../knowledge/embeddings";
import { getVerses, searchChunks } from "../knowledge/search";
import { type GenerateDeps } from "./generate";
import { AnthropicNotesLlm } from "./llm";

export const NOTES_BIBLE_VERSION = "por_blivre_2018";

export function createNotesDeps(): GenerateDeps & { llm: AnthropicNotesLlm } {
  const emb = getEmbeddingProvider();
  return {
    llm: new AnthropicNotesLlm(),
    versionId: NOTES_BIBLE_VERSION,
    getVerses: (v, refs) => getVerses(v, refs),
    search: (q, opts) => searchChunks(q, opts),
    async sourcesFor(paragraph) {
      const { chunks } = await searchChunks(paragraph, { maxTokens: 4500, maxChunks: 6 });
      return chunks.filter((c) => c.kind !== "bible_text" && c.kind !== "own_notes").map((c) => ({ id: c.id, text: c.text }));
    },
    embed: (texts) => emb.embedPassages(texts),
  };
}
