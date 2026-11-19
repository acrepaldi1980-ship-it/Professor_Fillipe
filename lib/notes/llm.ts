// Plain text completion for the notes generator (server only). Drafting uses a cheaper model than the teacher (NOTES_MODEL).
import Anthropic from "@anthropic-ai/sdk";

export interface NotesLlm {
  complete(system: string, user: string, maxTokens?: number): Promise<string>;
}

export class AnthropicNotesLlm implements NotesLlm {
  private client: Anthropic;
  constructor(apiKey = process.env.ANTHROPIC_API_KEY, private model = process.env.NOTES_MODEL ?? "claude-haiku-5-5") {
    this.client = new Anthropic({ apiKey });
  }
  async complete(system: string, user: string, maxTokens = 2400): Promise<string> {
    // Hidden reasoning is not needed to draft a note and would eat the token budget (same setting as the teacher's fast tier).
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      thinking: { type: "between_tools" } as never,
      system,
      messages: [{ role: "user", content: user }],
    });
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    if (!text.trim()) throw new Error(`empty_output(${res.stop_reason};${res.content.map((b) => b.type).join("+")})`);
    return text;
  }
  get modelName() {
    return this.model;
  }
}
