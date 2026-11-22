import { describe, expect, it } from "vitest";
import { BOOKS, PARALLELS, parseCite } from "@/lib/josephus/books";
import { cite, fromRoman, parseWork, WORKS } from "@/lib/josephus/structure";
import { englishQuery } from "@/lib/knowledge/glossary";

describe("Josephus: the 30 books", () => {
  it("has 30 books in four works, each with a summary", () => {
    expect(BOOKS.length).toBe(30);
    expect(Object.values(WORKS).reduce((t, w) => t + w.books, 0)).toBe(30);
    for (const b of BOOKS) { expect(b.summary.length, b.title).toBeGreaterThan(40); expect(b.span.length).toBeGreaterThan(2); }
  });
  it("cites the way scholars do", () => {
    expect(cite("ant", 18, 3, 3)).toBe("Ant. 18.3.3"); expect(cite("war", 6, 5, 3)).toBe("Guerra 6.5.3"); expect(cite("apion", 1, 1, 8)).toBe("Ap. 1.8"); expect(cite("life", 1, 1, 65)).toBe("Vida 65");
    expect(parseCite("Ant. 20.9.1")).toEqual({ work: "ant", book: 20, chapter: 9, n: 1 }); expect(parseCite("Guerra 6.4")).toEqual({ work: "war", book: 6, chapter: 4, n: undefined }); expect(parseCite("Ap. 1.8")).toEqual({ work: "apion", book: 1, chapter: 1, n: 8 });
    expect(fromRoman("XVIII")).toBe(18);
  });
  it("every parallel names Bible passages", () => { for (const p of PARALLELS) expect(p.refs.length, `${p.work} ${p.book}.${p.chapter}.${p.n}`).toBeGreaterThan(0); });
  it("parses books, chapters and numbered sections, leaving Whiston's footnotes out", () => {
    const text = ["PREFACE", "", "1. Those who write histories.", "", "2 (return) [ A footnote that must not appear. ]", "", "BOOK I.", "", "     Containing The Interval.", "", "CHAPTER 1.", "", "     The Beginning.", "", "1. In the beginning God created", "the heaven.", "", "2. And the earth was void.", "", "CHAPTER 2. The Second.", "", "A chapter without numbered paragraphs.", "", "BOOK II.", "", "CHAPTER 1. Again.", "", "1. Book two starts."].join("\n");
    const p = parseWork("war", text);
    expect(p.sections.find((s) => s.book === 0 && s.n === 1)?.text).toBe("Those who write histories.");
    expect(p.sections.find((s) => s.book === 1 && s.chapter === 1 && s.n === 1)?.text).toBe("In the beginning God created the heaven.");
    expect(p.sections.find((s) => s.book === 1 && s.chapter === 2 && s.n === 1)?.text).toBe("A chapter without numbered paragraphs.");
    expect(p.sections.find((s) => s.book === 2 && s.chapter === 1)?.text).toBe("Book two starts.");
    expect(p.sections.some((s) => /footnote/.test(s.text))).toBe(false);
    expect(p.chapters.find((c) => c.book === 1 && c.chapter === 1)?.title).toBe("The Beginning.");
  });
});

describe("Portuguese → English search terms", () => {
  it("finds the brethren of the Lord and Josephus", () => {
    expect(englishQuery("Quais eram os irmãos de Jesus?")).toMatch(/brethren of the Lord/);
    expect(englishQuery("Josefo fala de Jesus?")).toMatch(/Josephus/);
    expect(englishQuery("O que é a graça de Deus?")).toMatch(/grace/);
  });
  it("returns nothing for English or empty questions", () => { expect(englishQuery("What is grace?")).toBeNull(); expect(englishQuery("")).toBeNull(); });
});

import { mergeShards } from "@/lib/knowledge/library-store";
import { shardUrls } from "@/lib/knowledge/reference-db";
import type { ChunkRow } from "@/lib/knowledge/db";
describe("library shards", () => {
  const row = (id: string, rrf: number) => ({ id, rrf }) as ChunkRow;
  it("merges the answers of several databases: best first, each chunk once, limited", () => {
    const m = mergeShards([[row("a", 0.03), row("b", 0.01)], [row("b", 0.05), row("c", 0.02)]], 3);
    expect(m.map((r) => r.id)).toEqual(["b", "a", "c"]);
    expect(mergeShards([[row("a", 1), row("b", 0.5)]], 1).length).toBe(1);
  });
  it("lists the shards from the environment", () => {
    expect(shardUrls({ REFERENCE_DATABASE_URL: "u1", REFERENCE_DATABASE_URL_3: "u3" })).toEqual(["u1", "u3"]);
    expect(shardUrls({})).toEqual([]);
  });
});

import { entryBoost } from "@/lib/knowledge/search";
describe("entry boost", () => {
  it("recognizes the entry name after the work title (Smith, the Catholic Encyclopedia...)", () => {
    expect(entryBoost({ kind: "dictionary", title_path: "Smith's Bible Dictionary (1884) > Barnabas" }, ["barnabas"])).toBeGreaterThan(1);
    expect(entryBoost({ kind: "dictionary", title_path: "Barnabas" }, ["barnabas"])).toBeGreaterThan(1);
    expect(entryBoost({ kind: "dictionary", title_path: "Smith's Bible Dictionary (1884) > Paul" }, ["barnabas"])).toBe(1);
  });
});
