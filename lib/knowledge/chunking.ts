// Chunking rules (spec 8.10.3): dictionary/encyclopedia entries become one chunk each; long entries are split
// into blocks of ~400-700 tokens with 60 tokens of overlap, keeping the entry title at the start of every block.
// Tokens are approximated as words * 1.3 (good enough for Portuguese and English prose).

export const TOKENS_PER_WORD = 1.3;
export const approxTokens = (text: string) => Math.ceil(text.split(/\s+/).filter(Boolean).length * TOKENS_PER_WORD);

export interface ChunkOptions {
  maxTokens?: number;
  overlapTokens?: number;
}

export function splitEntry(title: string, body: string, opts: ChunkOptions = {}): string[] {
  const max = opts.maxTokens ?? 700;
  const overlap = opts.overlapTokens ?? 60;
  const words = body.split(/\s+/).filter(Boolean);
  const maxWords = Math.floor(max / TOKENS_PER_WORD);
  const overlapWords = Math.floor(overlap / TOKENS_PER_WORD);
  if (words.length <= maxWords) return [`${title}\n${words.join(" ")}`];

  const out: string[] = [];
  let start = 0;
  while (start < words.length) {
    let end = Math.min(start + maxWords, words.length);
    // prefer to end at a sentence boundary within the last 20% of the block
    if (end < words.length) {
      for (let i = end; i > start + Math.floor(maxWords * 0.8); i--) {
        if (/[.!?;:]["”')\]]?$/.test(words[i - 1])) {
          end = i;
          break;
        }
      }
    }
    out.push(`${title}\n${words.slice(start, end).join(" ")}`);
    if (end >= words.length) break;
    start = Math.max(end - overlapWords, start + 1);
  }
  return out;
}
