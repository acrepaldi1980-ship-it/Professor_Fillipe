import { describe, expect, it } from "vitest";
import { suggestSection } from "@/lib/modes/suggest";

const exists = async () => true;
const base = { mode: "lesson" as const, context: { ref_or_theme: "Atos 8:26-40" }, doc: { title: "Filipe e o eunuco" } as Record<string, unknown>, sources: "Atos 8" };

describe("document sections are written into the document", () => {
  for (const [section, content] of [["application", "Aplicação para a semana."], ["icebreaker", "Quem já explicou algo difícil a alguém?"], ["questions", ["P1?", "P2?", "P3?", "P4?"]], ["objective", ["Entender", "Aplicar"]]] as const) {
    it(`lesson: ${section}`, async () => {
      const r = await suggestSection({ ...base, section } as never, async () => ({ content }), exists);
      expect(r, section).not.toBeNull();
      expect((r!.doc as Record<string, unknown>)[section]).toBeTruthy();
    });
  }
});
