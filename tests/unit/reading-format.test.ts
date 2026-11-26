import { describe, expect, it } from "vitest";
import { chapterIsRead, labelOf, runsOf, shareText } from "@/lib/reading/format";

describe("selection of verses", () => {
  it("groups consecutive verses and names them", () => {
    expect(runsOf(["JHN.3.17", "JHN.3.16", "JHN.3.20"])).toEqual([["JHN.3.16", "JHN.3.17"], ["JHN.3.20"]]);
    expect(labelOf(["JHN.3.16"])).toBe("João 3:16");
    expect(labelOf(["JHN.3.18", "JHN.3.16", "JHN.3.17"])).toBe("João 3:16-18");
    expect(labelOf(["JHN.3.16", "JHN.3.17", "JHN.3.20"])).toBe("João 3:16-17, 20");
    expect(labelOf([])).toBe("");
  });
  it("shares the text with the reference and the version", () => {
    expect(shareText([{ ref: "JHN.3.16", text: "Porque Deus amou o mundo." }], "Bíblia Livre 2018")).toBe("“Porque Deus amou o mundo.”\n— João 3:16 (Bíblia Livre 2018)");
    expect(shareText([{ ref: "JHN.3.16", text: "A." }, { ref: "JHN.3.17", text: "B." }], "ARA")).toBe("“16 A. 17 B.”\n— João 3:16-17 (ARA)");
  });
  it("a chapter is read when every verse is", () => {
    expect(chapterIsRead(new Set(["A.1.1", "A.1.2"]), ["A.1.1", "A.1.2"])).toBe(true);
    expect(chapterIsRead(new Set(["A.1.1"]), ["A.1.1", "A.1.2"])).toBe(false);
    expect(chapterIsRead(new Set(), [])).toBe(false);
  });
});
