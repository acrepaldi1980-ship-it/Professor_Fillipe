// Multi-provider LLM gateway (free models in parallel, automatic failover). One call = one `LlmRequest`; the router picks an endpoint
// (provider + model + key), calls it and, if it is rate limited, out of credit, down or answers badly, moves to the next one by itself.
export type Task = "teacher" | "json" | "text" | "query";

export interface LlmRequest {
  task: Task;
  system: string;
  /** Conversation (user/assistant). `json` and `text` tasks may pass a single user message. */
  messages: { role: "user" | "assistant"; content: string }[];
  /** Forced structured answer (JSON Schema). Providers without reliable tool calling get it described in the prompt and answer in JSON mode. */
  tool?: { name: string; description: string; schema: unknown };
  /** Ask for a JSON object (without a tool). */
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  /** Whole budget for this call (all attempts) in ms; the default is 48 s, too long for a spoken conversation. */
  deadlineMs?: number;
  /** Ask a second endpoint too when the first has not answered after this many ms; the first valid answer wins (slow tails of free models). */
  hedgeAfterMs?: number;
  /** Streaming: called with everything the model has written so far (raw JSON text) as it arrives. Only the endpoint that answers first is relayed (see the router). */
  onText?: (written: string) => void;
  /** Accepts or refuses an answer (schema check). A refused answer makes the router try the next endpoint. */
  validate?: (out: unknown) => boolean;
}

export interface LlmResult { out: unknown; text: string; endpoint: string; provider: string; model: string; ms: number; attempts: number; /** One entry per attempt: endpoint:result:ms (diagnostics). */ log?: string[] }

export type Kind = "openai" | "gemini";
export interface Endpoint {
  /** provider/model#keyIndex, unique. */
  id: string;
  provider: string;
  model: string;
  kind: Kind;
  baseUrl: string;
  key: string;
  keyIndex: number;
  /** Reliable forced tool calling (else JSON mode with the schema in the prompt). */
  tools: boolean;
  /** Quality tier: lower is preferred (0 = premium, 1 = strong free, 2 = small/fast free). */
  tier: number;
  /** Share of the traffic inside the same tier. */
  weight: number;
  /** Extra body fields (e.g. reasoning_effort for gpt-oss). */
  extra?: Record<string, unknown>;
  /** Max in-flight calls from one instance, so a burst never hammers a single key. */
  concurrency: number;
}

export type Failure = "rate_limit" | "quota" | "auth" | "gone" | "server" | "timeout" | "too_large" | "bad_output" | "other";
export class LlmError extends Error {
  constructor(public kind: Failure, public status: number, public retryAfter = 0, detail = "") { super(`llm_${kind}_${status}${detail ? ": " + detail : ""}`); }
}
