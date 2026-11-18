// Bibles available from eBible.org with a license verified on each copyright page (see docs/LICENSES.md).
// "cc0" is used for texts dedicated to the public domain by their publishers (WEB, BSB, MSB).
export interface BibleSource {
  translationId: string; // eBible.org id
  versionId: string; // our id (spec 9.3)
  name: string;
  abbreviation: string;
  language: "pt" | "en" | "es" | "grc" | "heb" | "la";
  license: "public_domain" | "cc0" | "cc_by" | "cc_by_sa";
  pubYear: number | null;
  authors: string[];
  deathYears: number[];
  credit: string;
  audience?: "general" | "beginner";
  tradition?: string;
  notes?: string;
}

const EB = "https://ebible.org";

export const BIBLES: BibleSource[] = [
  { translationId: "porbr2018", versionId: "por_blivre_2018", name: "Bíblia Livre 2018", abbreviation: "BLivre", language: "pt", license: "cc_by", pubYear: 2018, authors: ["Diego Santos", "Mario Sérgio", "Marco Teles"], deathYears: [], credit: "Bíblia Livre © 2018 Diego Santos, Mario Sérgio e Marco Teles, licença Creative Commons Atribuição 4.0 (CC BY 4.0). Texto atualizado a partir da tradução de João Ferreira de Almeida (1819), edição Textus Receptus." },
  { translationId: "porbrbsl", versionId: "por_mundial", name: "Bíblia Portuguesa Mundial", abbreviation: "BPM", language: "pt", license: "cc0", pubYear: null, authors: [], deathYears: [], credit: "Bíblia Portuguesa Mundial (domínio público, segundo o eBible.org).", notes: "Derivada da World English Bible." },
  { translationId: "poronbv", versionId: "por_nbv_open", name: "Biblica Open Nova Bíblia Viva 2007", abbreviation: "NBV Open", language: "pt", license: "cc_by_sa", pubYear: 2007, authors: ["Biblica, Inc."], deathYears: [], credit: "Biblica® Open Nova Bíblia Viva™ © 2007, 2010 Biblica, Inc. Licença Creative Commons Atribuição-CompartilhaIgual 4.0 (CC BY-SA 4.0). Usado com permissão.", audience: "beginner", notes: "CC BY-SA: mantida separada; não misturar com texto próprio." },
  { translationId: "engwebp", versionId: "eng_web", name: "World English Bible", abbreviation: "WEB", language: "en", license: "cc0", pubYear: null, authors: [], deathYears: [], credit: "World English Bible (domínio público)." },
  { translationId: "eng-asv", versionId: "eng_asv_1901", name: "American Standard Version (1901)", abbreviation: "ASV", language: "en", license: "public_domain", pubYear: 1901, authors: [], deathYears: [], credit: "American Standard Version, 1901 (domínio público)." },
  { translationId: "eng-kjv", versionId: "eng_kjv", name: "King James Version", abbreviation: "KJV", language: "en", license: "public_domain", pubYear: 1611, authors: [], deathYears: [], credit: "King James Version (domínio público)." },
  { translationId: "engbsb", versionId: "eng_bsb", name: "Berean Standard Bible", abbreviation: "BSB", language: "en", license: "cc0", pubYear: null, authors: [], deathYears: [], credit: "Berean Standard Bible (domínio público)." },
  { translationId: "enggnv", versionId: "eng_geneva_1599", name: "Geneva Bible 1599", abbreviation: "GNV", language: "en", license: "public_domain", pubYear: 1599, authors: [], deathYears: [], credit: "Geneva Bible, 1599 (domínio público)." },
  { translationId: "engDBY", versionId: "eng_darby", name: "Darby Translation", abbreviation: "DBY", language: "en", license: "public_domain", pubYear: 1890, authors: ["John Nelson Darby"], deathYears: [1882], credit: "Darby Translation (domínio público)." },
  { translationId: "engylt", versionId: "eng_ylt", name: "Young's Literal Translation", abbreviation: "YLT", language: "en", license: "public_domain", pubYear: 1898, authors: ["Robert Young"], deathYears: [1888], credit: "Young's Literal Translation (domínio público)." },
  { translationId: "spaRV1909", versionId: "spa_rv_1909", name: "Reina-Valera 1909", abbreviation: "RV1909", language: "es", license: "public_domain", pubYear: 1909, authors: [], deathYears: [], credit: "Santa Biblia, Reina-Valera 1909 (domínio público)." },
  { translationId: "grctr", versionId: "grc_tr", name: "Textus Receptus (Novo Testamento grego)", abbreviation: "TR", language: "grc", license: "public_domain", pubYear: 1894, authors: [], deathYears: [], credit: "Textus Receptus (domínio público)." },
  { translationId: "hebwlc", versionId: "heb_wlc", name: "Westminster Leningrad Codex", abbreviation: "WLC", language: "heb", license: "public_domain", pubYear: 1008, authors: [], deathYears: [], credit: "Westminster Leningrad Codex (domínio público)." },
];

export const sourceUrl = (id: string) => `${EB}/Scriptures/${id}_usfm.zip`;
export const copyrightUrl = (id: string) => `${EB}/${id}/copyright.htm`;
