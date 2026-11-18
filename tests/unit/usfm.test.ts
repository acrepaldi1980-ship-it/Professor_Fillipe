import { describe, expect, it } from "vitest";
import { cleanVerseText, parseUsfm } from "@/lib/knowledge/usfm";

describe("usfm", () => {
  it("strips word markers, notes and cross references", () => {
    const raw = '\\w In|strong="G1722"\\w* the beginning \\f + \\fr 1:1 \\ft note\\f*was the \\add Word\\add*. \\x - \\xo 1:1 \\xt Gn 1:1\\x*';
    expect(cleanVerseText(raw)).toBe("In the beginning was the Word.");
  });

  it("parses books, chapters and verses, joining continuation lines and ignoring headings", () => {
    const usfm = [
      "\\id JHN 43-JHN-web.sfm World English Bible",
      "\\h John",
      "\\c 1",
      "\\s1 The Word",
      "\\p",
      "\\v 1 In the beginning was the Word,",
      "\\q1 and the Word was with God.",
      "\\v 2 He was in the beginning with God.",
      "\\c 2",
      "\\v 1-2 A bridged verse.",
    ].join("\n");
    const v = parseUsfm(usfm);
    expect(v).toEqual([
      { book: "JHN", chapter: 1, verse: 1, text: "In the beginning was the Word, and the Word was with God." },
      { book: "JHN", chapter: 1, verse: 2, text: "He was in the beginning with God." },
      { book: "JHN", chapter: 2, verse: 1, text: "A bridged verse." },
    ]);
  });
});
