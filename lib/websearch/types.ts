// Research OUTSIDE the app (owner's decision, 23/11/2026, spec 8.23). The teacher answers from the app's own collection first; only when it cannot, and only inside the
// biblical context (lib/teacher/topic.ts), it reads pages outside and says so, citing the source. Providers are adapters, like the voice providers.
export interface WebSource {
  provider: "wikipedia" | "tavily";
  title: string;
  url: string;
  /** Name shown to the student: "Wikipédia (pt)". */
  site: string;
  lang: string;
  /** Licence of the text, shown with the credit. */
  license: string;
  /** The passages of the page that bear on the question, the only text the teacher may rely on. */
  passages: string[];
  retrievedAt: string;
}

export interface WebRequest {
  question: string;
  /** English keywords for the question (subject first), when the model produced them. */
  english?: string | null;
}

export interface WebSearchProvider {
  readonly name: string;
  /** `notes` receives short remarks about what happened (candidates, pages discarded): diagnostics only, never the student's text. */
  search(req: WebRequest, signal?: AbortSignal, notes?: string[]): Promise<WebSource[]>;
}
