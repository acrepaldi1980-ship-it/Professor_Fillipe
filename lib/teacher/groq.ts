// Cheap query rewrite for retrieval (English keywords for a Portuguese question), now through the LLM router: any free endpoint can answer.
import { completeJson } from "../llm/router";

const REWRITE_SYSTEM = 'Você ajuda uma busca em dicionários e comentários bíblicos em inglês (Easton, KJV, WEB). Dada uma pergunta em português, responda SOMENTE um JSON {"en":"...","refs":["Luke 15:11-32"]}. "en": 3 a 8 palavras-chave em inglês, o assunto principal primeiro: nomes bíblicos na grafia inglesa (Barnabé=Barnabas, Elias=Elijah, Arca da Aliança=Ark of the Covenant, Páscoa=Passover) e os termos do assunto, sem frases. "refs": até 3 passagens bíblicas onde o assunto aparece (livro capítulo:versículos, em inglês); use [] se não tiver certeza.';

/** English keywords and names for a Portuguese question. Best-effort (returns null on any failure, the search then uses the original text). */
export async function rewriteQueryToEnglish(question: string): Promise<string | null> {
  try {
    const r = await completeJson(REWRITE_SYSTEM, question, { task: "query", maxTokens: 260, temperature: 0, timeoutMs: 2500, deadlineMs: 3200, validate: (o) => !!o && typeof o === "object" });
    const out = r.out as { en?: string; refs?: string[] };
    const en = out.en && out.en.length < 200 ? out.en : null;
    const refs = (out.refs ?? []).filter((x) => typeof x === "string" && x.length < 40).slice(0, 3);
    // The suggested passages travel with the keywords; the search turns them into exact references and verifies them in the database.
    return en ? [en, ...refs].join(", ") : refs.length ? refs.join(", ") : null;
  } catch {
    return null;
  }
}
