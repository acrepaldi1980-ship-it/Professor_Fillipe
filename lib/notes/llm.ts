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
  async complete(system: string, user: string, maxTokens = 1800): Promise<string> {
    const res = await this.client.messages.create({ model: this.model, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] });
    return res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  }
  get modelName() {
    return this.model;
  }
}
