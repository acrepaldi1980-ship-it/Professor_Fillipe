import { describe, expect, it } from "vitest";
import { detectEdit } from "@/lib/modes/edit-intent";

describe("detectEdit", () => {
  it("lesson: finds the section and keeps the instruction", () => {
    expect(detectEdit("Mude o quebra-gelo para algo mais divertido", "lesson")).toMatchObject({ section: "icebreaker" });
    expect(detectEdit("deixe as perguntas mais simples", "lesson")?.section).toBe("questions");
    expect(detectEdit("Refaça a aplicação com foco em jovens", "lesson")?.instruction).toMatch(/jovens/);
  });
  it("sermon: divisions by number and by ordinal, only if they exist", () => {
    expect(detectEdit("Refaça a divisão 2 com outra ilustração", "sermon", 3)?.section).toBe("division_replace:1");
    expect(detectEdit("troque a terceira divisão", "sermon", 3)?.section).toBe("division_replace:2");
    expect(detectEdit("mude a divisão 5", "sermon", 3)).toBeNull();
    expect(detectEdit("reescreva a conclusão", "sermon")?.section).toBe("conclusion");
  });
  it("deep: sections by name", () => {
    expect(detectEdit("inclua mais palavras do grego", "deep")?.section).toBe("keywords");
    expect(detectEdit("ajuste a visão reformada", "deep")?.section).toBe("traditions");
  });
  it("questions and chatter are not edits", () => {
    expect(detectEdit("O que significa a palavra graça?", "deep")).toBeNull();
    expect(detectEdit("Quem foi Filipe?", "lesson")).toBeNull();
    expect(detectEdit("mude de assunto", "lesson")).toBeNull();
  });
});

import { appendNote } from "@/lib/modes/edit-intent";
describe("appendNote", () => {
  it("keeps the closing question last", () => {
    const out = appendNote("Fiz do jeito que você pediu. Ficou bom para a turma?", "Já atualizei a introdução no documento.");
    expect(out.endsWith("?")).toBe(true);
    expect(out).toMatch(/atualizei a introdução/);
  });
  it("adds a question when the answer has none", () => {
    expect(appendNote("Feito.", "Já atualizei o apelo.")).toMatch(/\?$/);
  });
});
