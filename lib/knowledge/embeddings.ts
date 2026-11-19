import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
/** Path of the bundled model folder (and joins the two ONNX parts into /tmp on first use), or null when it is not bundled. */
function bundledModelDir(model: string): string | null {
  const root = join(process.cwd(), "models");
  const dir = join(root, model);
  if (!existsSync(join(dir, "config.json"))) return null;
  const onnx = join(dir, "onnx", "model_quantized.onnx");
  if (existsSync(onnx)) return root;
  const p1 = `${onnx}.part1`;
  if (!existsSync(p1)) return null;
  // The deployment is read-only: rebuild the folder in /tmp (config, tokenizer and the joined model).
  const tmpRoot = join(tmpdir(), "e5-models");
  const tmpDir = join(tmpRoot, model);
  const target = join(tmpDir, "onnx", "model_quantized.onnx");
  if (!existsSync(target)) {
    mkdirSync(join(tmpDir, "onnx"), { recursive: true });
    for (const f of ["config.json", "tokenizer.json", "tokenizer_config.json"]) copyFileSync(join(dir, f), join(tmpDir, f));
    writeFileSync(target, Buffer.concat([readFileSync(p1), readFileSync(`${onnx}.part2`)]));
  }
  return tmpRoot;
}

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
      const { pipeline, env } = await import("@huggingface/transformers");
      // Production bundles the model with the function (models/, split in two parts because of the upload size limit):
      // loading it from disk takes seconds, downloading it on every cold start took ~30 s.
      const bundled = bundledModelDir(this.model);
      if (bundled) {
        env.localModelPath = bundled;
        env.allowRemoteModels = false;
      }
      // Serverless file systems are read-only except /tmp: cache the downloaded model there.
      if (process.env.VERCEL || process.env.TRANSFORMERS_CACHE_DIR) env.cacheDir = process.env.TRANSFORMERS_CACHE_DIR ?? "/tmp/hf-cache";
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
