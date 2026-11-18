// Short-term memory (spec 8.5.4): last 12 exchanges of the session. In-memory on the server for the prototype;
// persisted to `messages` and summarized into `session_summaries` from Prompt 1.1/1.5 on.
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const MAX_MESSAGES = 24; // 12 exchanges
const store = new Map<string, ChatMessage[]>();

export const memory = {
  get(sessionId: string): ChatMessage[] {
    return [...(store.get(sessionId) ?? [])];
  },
  append(sessionId: string, ...msgs: ChatMessage[]) {
    const all = [...(store.get(sessionId) ?? []), ...msgs];
    store.set(sessionId, all.slice(-MAX_MESSAGES));
  },
  clear(sessionId: string) {
    store.delete(sessionId);
  },
};
