// Embedding provider (spec 8.10.4, D-09). Default: open multilingual model running locally,
// so Portuguese questions find English passages with no paid API. Swappable via EMBEDDING_PROVIDER.
export interface EmbeddingProvider {
  readonly name: string;
  readonly dimensions: number;
  embedQuery(text: string): Promise<number[]>;
  embedPassages(texts: string[]): Promise<number[][]>;
}

type Extractor = (
  input: string[],
  opts: { pooling: "mean"; normalize: boolean },
) => Promise<{ tolist(): number[][] }>;

/** multilingual-e5-small (384 dims, MIT license) via transformers.js / ONNX. Needs "query: " / "passage: " prefixes. */
export class LocalE5Provider implements EmbeddingProvider {
  readonly name: string;
  private extractor: Promise<Extractor> | null = null;

  constructor(
    private readonly model = "Xenova/multilingual-e5-small",
    readonly dimensions = 384,
  ) {
    this.name = `local-${model.split("/")[1]}`;
  }

  private load(): Promise<Extractor> {
    this.extractor ??= (async () => {
      const { pipeline } = await import("@huggingface/transformers");
      return (await pipeline("feature-extraction", this.model, {
        dtype: "q8",
      })) as unknown as Extractor;
    })();
    return this.extractor;
  }

  private async run(texts: string[], prefix: string): Promise<number[][]> {
    const ex = await this.load();
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += 16) {
      const batch = texts.slice(i, i + 16).map((t) => `${prefix}${t}`);
      const res = await ex(batch, { pooling: "mean", normalize: true });
      out.push(...res.tolist());
    }
    return out;
  }

  async embedQuery(text: string) {
    return (await this.run([text], "query: "))[0];
  }

  embedPassages(texts: string[]) {
    return this.run(texts, "passage: ");
  }
}

let provider: EmbeddingProvider | null = null;
export function getEmbeddingProvider(): EmbeddingProvider {
  provider ??= new LocalE5Provider();
  return provider;
}

export function cosine(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s; // vectors are normalized
}
