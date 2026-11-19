import { describe, expect, it } from "vitest";
import { parseReference } from "@/lib/knowledge/refs-parser";

// One case per book in Portuguese (full name) and in English, so every one of the 66 books is recognized (spec 8.10.5, 16.1).
const PT: [string, string][] = [
  ["Gênesis", "GEN"], ["Êxodo", "EXO"], ["Levítico", "LEV"], ["Números", "NUM"], ["Deuteronômio", "DEU"], ["Josué", "JOS"], ["Juízes", "JDG"],
  ["Rute", "RUT"], ["1 Samuel", "1SA"], ["2 Samuel", "2SA"], ["1 Reis", "1KI"], ["2 Reis", "2KI"], ["1 Crônicas", "1CH"], ["2 Crônicas", "2CH"],
  ["Esdras", "EZR"], ["Neemias", "NEH"], ["Ester", "EST"], ["Jó", "JOB"], ["Salmos", "PSA"], ["Provérbios", "PRO"], ["Eclesiastes", "ECC"],
  ["Cantares", "SNG"], ["Isaías", "ISA"], ["Jeremias", "JER"], ["Lamentações", "LAM"], ["Ezequiel", "EZK"], ["Daniel", "DAN"], ["Oseias", "HOS"],
  ["Joel", "JOL"], ["Amós", "AMO"], ["Obadias", "OBA"], ["Jonas", "JON"], ["Miqueias", "MIC"], ["Naum", "NAM"], ["Habacuque", "HAB"],
  ["Sofonias", "ZEP"], ["Ageu", "HAG"], ["Zacarias", "ZEC"], ["Malaquias", "MAL"], ["Mateus", "MAT"], ["Marcos", "MRK"], ["Lucas", "LUK"],
  ["João", "JHN"], ["Atos", "ACT"], ["Romanos", "ROM"], ["1 Coríntios", "1CO"], ["2 Coríntios", "2CO"], ["Gálatas", "GAL"], ["Efésios", "EPH"],
  ["Filipenses", "PHP"], ["Colossenses", "COL"], ["1 Tessalonicenses", "1TH"], ["2 Tessalonicenses", "2TH"], ["1 Timóteo", "1TI"],
  ["2 Timóteo", "2TI"], ["Tito", "TIT"], ["Filemom", "PHM"], ["Hebreus", "HEB"], ["Tiago", "JAS"], ["1 Pedro", "1PE"], ["2 Pedro", "2PE"],
  ["1 João", "1JN"], ["2 João", "2JN"], ["3 João", "3JN"], ["Judas", "JUD"], ["Apocalipse", "REV"],
];
const EN: [string, string][] = [
  ["Genesis", "GEN"], ["Exodus", "EXO"], ["Leviticus", "LEV"], ["Numbers", "NUM"], ["Deuteronomy", "DEU"], ["Joshua", "JOS"], ["Judges", "JDG"],
  ["Ruth", "RUT"], ["1 Samuel", "1SA"], ["2 Kings", "2KI"], ["1 Chronicles", "1CH"], ["Ezra", "EZR"], ["Nehemiah", "NEH"], ["Esther", "EST"],
  ["Psalms", "PSA"], ["Proverbs", "PRO"], ["Ecclesiastes", "ECC"], ["Song of Solomon", "SNG"], ["Isaiah", "ISA"], ["Jeremiah", "JER"],
  ["Lamentations", "LAM"], ["Ezekiel", "EZK"], ["Daniel", "DAN"], ["Hosea", "HOS"], ["Amos", "AMO"], ["Obadiah", "OBA"], ["Micah", "MIC"],
  ["Habakkuk", "HAB"], ["Zephaniah", "ZEP"], ["Haggai", "HAG"], ["Zechariah", "ZEC"], ["Malachi", "MAL"], ["Matthew", "MAT"], ["Mark", "MRK"],
  ["Luke", "LUK"], ["Acts", "ACT"], ["Romans", "ROM"], ["Galatians", "GAL"], ["Ephesians", "EPH"], ["Philippians", "PHP"], ["Colossians", "COL"],
  ["Hebrews", "HEB"], ["James", "JAS"], ["Revelation", "REV"],
];

describe("every book is recognized by name", () => {
  it.each(PT)("pt: %s 1:1 -> %s", (name, code) => {
    expect(parseReference(`${name} 1:1`)).toEqual([`${code}.1.1`]);
  });
  it.each(EN)("en: %s 1:1 -> %s", (name, code) => {
    expect(parseReference(`${name} 1:1`)).toEqual([`${code}.1.1`]);
  });
});
