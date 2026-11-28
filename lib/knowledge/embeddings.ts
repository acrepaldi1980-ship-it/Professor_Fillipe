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
  /** Starts loading the model in the background (no-op when it is already loaded or loading). */
  preload?(): void;
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

  /** How long each part of the first load took (ms), for the warm-up diagnostics: where does a cold start go? */
  loadTimings: Record<string, number> = {};
  private load(): Promise<Extractor> {
    this.extractor ??= (async () => {
      const t0 = Date.now();
      const { pipeline, env } = await import("@huggingface/transformers");
      this.loadTimings.import = Date.now() - t0;
      // Production bundles the model with the function (models/, split in two parts because of the upload size limit):
      // loading it from disk takes seconds, downloading it on every cold start took ~30 s.
      const t1 = Date.now();
      const bundled = bundledModelDir(this.model);
      this.loadTimings.model_files = Date.now() - t1;
      if (bundled) {
        env.localModelPath = bundled;
        env.allowRemoteModels = false;
      }
      // Serverless file systems are read-only except /tmp: cache the downloaded model there.
      if (process.env.VERCEL || process.env.TRANSFORMERS_CACHE_DIR) env.cacheDir = process.env.TRANSFORMERS_CACHE_DIR ?? "/tmp/hf-cache";
      const t2 = Date.now();
      const ex = (await pipeline("feature-extraction", this.model, {
        dtype: "q8",
      })) as unknown as Extractor;
      this.loadTimings.pipeline = Date.now() - t2;
      const t3 = Date.now();
      await ex(["query: aquecimento"], { pooling: "mean", normalize: true });
      this.loadTimings.first_run = Date.now() - t3;
      this.loadTimings.total = Date.now() - t0;
      return ex;
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

  /** A server instance that has just started loads the model while the request does its other work (login, session, database reads): the ~2 s overlap instead of adding up. */
  preload() {
    void this.load().catch(() => { this.extractor = null; });
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
