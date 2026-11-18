import { describe, expect, it } from "vitest";
import { BOOKS } from "@/lib/knowledge/books";
import { expandRefs, findReferences, formatRefPt, parseReference } from "@/lib/knowledge/refs-parser";

describe("books data", () => {
  it("has 66 books and 1189 chapters", () => {
    expect(BOOKS).toHaveLength(66);
    expect(BOOKS.reduce((s, b) => s + b.chapters, 0)).toBe(1189);
  });
});

const cases: [string, string[]][] = [
  // verses, pt-BR styles
  ["Jo 3:16", ["JHN.3.16"]],
  ["João 3.16", ["JHN.3.16"]],
  ["João 3:16", ["JHN.3.16"]],
  ["Jo 3,16", ["JHN.3.16"]],
  ["joão 3:16", ["JHN.3.16"]],
  ["JOÃO 3:16", ["JHN.3.16"]],
  ["Jo. 3:16", ["JHN.3.16"]],
  ["John 3:16", ["JHN.3.16"]],
  ["Jn 3:16", ["JON.3.16"]],
  ["Jonas 3:2", ["JON.3.2"]],
  ["Jó 1:21", ["JOB.1.21"]],
  ["Job 1:21", ["JOB.1.21"]],
  // numbered books
  ["1 Coríntios 13:4-7", ["1CO.13.4-1CO.13.7"]],
  ["1Co 13", ["1CO.13"]],
  ["1Co 13:4-7", ["1CO.13.4-1CO.13.7"]],
  ["I Coríntios 13", ["1CO.13"]],
  ["II Coríntios 5:17", ["2CO.5.17"]],
  ["2 Co 5.17", ["2CO.5.17"]],
  ["Primeira de Pedro 2:9", ["1PE.2.9"]],
  ["1ª Pedro 2:9", ["1PE.2.9"]],
  ["Segunda de Timóteo 3:16", ["2TI.3.16"]],
  ["2Tm 3:16", ["2TI.3.16"]],
  ["Terceira João 4", ["3JN.1.4"]],
  ["1 João 4:8", ["1JN.4.8"]],
  ["1Jo 1:9", ["1JN.1.9"]],
  ["1 Jn 1:9", ["1JN.1.9"]],
  ["1 Samuel 17:45", ["1SA.17.45"]],
  ["2Sm 7:12", ["2SA.7.12"]],
  ["1 Reis 18:21", ["1KI.18.21"]],
  ["2 Rs 2:11", ["2KI.2.11"]],
  ["1 Crônicas 16:34", ["1CH.16.34"]],
  ["2Cr 7:14", ["2CH.7.14"]],
  ["1Ts 5:17", ["1TH.5.17"]],
  ["2 Tessalonicenses 3:10", ["2TH.3.10"]],
  ["1 Timóteo 2:5", ["1TI.2.5"]],
  ["2 Pedro 3:9", ["2PE.3.9"]],
  ["First Corinthians 13:13", ["1CO.13.13"]],
  ["1 Corinthians 13:13", ["1CO.13.13"]],
  ["1 John 4:8", ["1JN.4.8"]],
  // chapters and chapter ranges
  ["Salmo 23", ["PSA.23"]],
  ["Sl 23", ["PSA.23"]],
  ["Salmos 119", ["PSA.119"]],
  ["Gn 1-3", ["GEN.1-GEN.3"]],
  ["Gênesis 1–3", ["GEN.1-GEN.3"]],
  ["Gênesis 1", ["GEN.1"]],
  ["Êxodo 20", ["EXO.20"]],
  ["Ap 21", ["REV.21"]],
  // lists
  ["Sl 23:1,4", ["PSA.23.1", "PSA.23.4"]],
  ["Sl 23:1, 4", ["PSA.23.1", "PSA.23.4"]],
  ["Romanos 8:28-30,35", ["ROM.8.28-ROM.8.30", "ROM.8.35"]],
  ["João 3:16 e 18", ["JHN.3.16", "JHN.3.18"]],
  ["João 3:16; 4:1", ["JHN.3.16", "JHN.4.1"]],
  // ranges
  ["Atos 8:26-40", ["ACT.8.26-ACT.8.40"]],
  ["Atos 8:26–40", ["ACT.8.26-ACT.8.40"]],
  ["Mt 5:3-12", ["MAT.5.3-MAT.5.12"]],
  ["João 3:16-4:2", ["JHN.3.16-JHN.4.2"]],
  ["Jo 3 v. 16", ["JHN.3.16"]],
  ["Jo 3 vv. 16", ["JHN.3.16"]],
  // single-chapter books
  ["Judas 3", ["JUD.1.3"]],
  ["Jd 3", ["JUD.1.3"]],
  ["Jd 1:3", ["JUD.1.3"]],
  ["Fm 4-6", ["PHM.1.4-PHM.1.6"]],
  ["Obadias 15", ["OBA.1.15"]],
  ["2 João 5", ["2JN.1.5"]],
  // all books by common abbreviation
  ["Gn 1:1", ["GEN.1.1"]],
  ["Ex 3:14", ["EXO.3.14"]],
  ["Lv 19:18", ["LEV.19.18"]],
  ["Nm 6:24", ["NUM.6.24"]],
  ["Dt 6:4", ["DEU.6.4"]],
  ["Js 1:9", ["JOS.1.9"]],
  ["Jz 6:12", ["JDG.6.12"]],
  ["Rt 1:16", ["RUT.1.16"]],
  ["Ed 7:10", ["EZR.7.10"]],
  ["Ne 8:10", ["NEH.8.10"]],
  ["Et 4:14", ["EST.4.14"]],
  ["Pv 3:5", ["PRO.3.5"]],
  ["Ec 3:1", ["ECC.3.1"]],
  ["Ct 2:4", ["SNG.2.4"]],
  ["Is 53:5", ["ISA.53.5"]],
  ["Jr 29:11", ["JER.29.11"]],
  ["Lm 3:22", ["LAM.3.22"]],
  ["Ez 37:1", ["EZK.37.1"]],
  ["Dn 3:17", ["DAN.3.17"]],
  ["Os 6:6", ["HOS.6.6"]],
  ["Jl 2:28", ["JOL.2.28"]],
  ["Am 5:24", ["AMO.5.24"]],
  ["Mq 6:8", ["MIC.6.8"]],
  ["Na 1:7", ["NAM.1.7"]],
  ["Hc 2:4", ["HAB.2.4"]],
  ["Sf 3:17", ["ZEP.3.17"]],
  ["Ag 2:9", ["HAG.2.9"]],
  ["Zc 4:6", ["ZEC.4.6"]],
  ["Ml 3:10", ["MAL.3.10"]],
  ["Mc 16:15", ["MRK.16.15"]],
  ["Lc 15:11", ["LUK.15.11"]],
  ["At 2:4", ["ACT.2.4"]],
  ["Rm 3:25", ["ROM.3.25"]],
  ["Gl 5:22", ["GAL.5.22"]],
  ["Ef 2:8", ["EPH.2.8"]],
  ["Fp 4:13", ["PHP.4.13"]],
  ["Cl 3:23", ["COL.3.23"]],
  ["Tt 2:11", ["TIT.2.11"]],
  ["Hb 11:1", ["HEB.11.1"]],
  ["Tg 2:17", ["JAS.2.17"]],
  ["Apocalipse 22:21", ["REV.22.21"]],
  // english
  ["Genesis 1:1", ["GEN.1.1"]],
  ["Psalm 23:1", ["PSA.23.1"]],
  ["Song of Solomon 2:4", ["SNG.2.4"]],
  ["Revelation 21:4", ["REV.21.4"]],
  ["Matt 5:3", ["MAT.5.3"]],
];

describe("parseReference", () => {
  it.each(cases)("%s", (input, expected) => {
    expect(parseReference(input)).toEqual(expected);
  });

  it("rejects nonsense and out-of-range chapters", () => {
    expect(parseReference("João 40")).toBeNull();
    expect(parseReference("Salmo 151")).toBeNull();
    expect(parseReference("Coríntios 13")).toBeNull(); // missing number
    expect(parseReference("bom dia")).toBeNull();
    expect(parseReference("Jo 3:16 e mais")).toBeNull();
  });
});

describe("findReferences (free text)", () => {
  it("finds several references with positions", () => {
    const text = "Leia Jo 3:16 e depois Romanos 8:28-30, mas também Sl 23.";
    const r = findReferences(text, { strictCase: true });
    expect(r.map((x) => x.refs)).toEqual([["JHN.3.16"], ["ROM.8.28-ROM.8.30"], ["PSA.23"]]);
    expect(text.slice(r[0].index, r[0].index + r[0].length)).toBe("Jo 3:16");
  });

  it("does not match short lowercase abbreviations in prose when strictCase is on", () => {
    expect(findReferences("vieram os 3 homens", { strictCase: true })).toHaveLength(0);
    expect(findReferences("eram at 5 pessoas", { strictCase: true })).toHaveLength(0);
  });

  it("flags out-of-range chapters as invalid", () => {
    const r = findReferences("Veja João 40:1");
    expect(r[0].invalid).toBe(true);
    expect(r[0].refs).toEqual([]);
  });

  it("handles the trap from the prototype criteria (versículos inexistentes são tratados pelo banco, não pelo parser)", () => {
    const r = findReferences("Me mostra João 3:17 a 3:40");
    expect(r[0].refs[0]).toBe("JHN.3.17");
  });

  it("ignores a stray numeric prefix before an unnumbered book", () => {
    const r = findReferences("1 Sl 23");
    expect(r[0].refs).toEqual(["PSA.23"]);
  });
});

describe("formatRefPt", () => {
  it("formats references for display", () => {
    expect(formatRefPt("JHN.3.16")).toBe("João 3:16");
    expect(formatRefPt("1CO.13.4-1CO.13.7")).toBe("1 Coríntios 13:4-7");
    expect(formatRefPt("PSA.23")).toBe("Salmos 23");
    expect(formatRefPt("GEN.1-GEN.3")).toBe("Gênesis 1-3");
    expect(formatRefPt("JHN.3.16-JHN.4.2")).toBe("João 3:16-4:2");
  });
});

describe("expandRefs", () => {
  it("expands same-chapter ranges to verses and adds the chapter key", () => {
    expect(expandRefs(["ACT.8.26-ACT.8.28"]).sort()).toEqual(["ACT.8", "ACT.8.26", "ACT.8.27", "ACT.8.28"]);
  });
  it("keeps single verses and adds their chapter", () => {
    expect(expandRefs(["JHN.3.16"]).sort()).toEqual(["JHN.3", "JHN.3.16"]);
  });
  it("expands chapter ranges and keeps cross-chapter endpoints", () => {
    expect(expandRefs(["GEN.1-GEN.3"]).sort()).toEqual(["GEN.1", "GEN.2", "GEN.3"]);
    expect(expandRefs(["JHN.3.16-JHN.4.2"]).sort()).toEqual(["JHN.3", "JHN.3.16", "JHN.4", "JHN.4.2"]);
  });
});
