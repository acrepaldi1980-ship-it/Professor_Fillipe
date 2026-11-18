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
  { translationId: "spabll", versionId: "spa_biblia_libre_latam", name: "Santa Biblia libre Latinoamericano", abbreviation: "BLL", language: "es", license: "cc0", pubYear: null, authors: [], deathYears: [], credit: "Santa Biblia libre Latinoamericano (domínio público, segundo o eBible.org; tradução em revisão)." },
  { translationId: "spablm", versionId: "spa_biblia_libre_mundo", name: "Santa Biblia libre para el mundo", abbreviation: "BLM", language: "es", license: "cc0", pubYear: null, authors: ["David Williams", "Michael Paul Johnson"], deathYears: [], credit: "Santa Biblia libre para el mundo (domínio público, segundo o eBible.org; tradução em revisão)." },
  { translationId: "spabes", versionId: "spa_sencillo_2026", name: "La Biblia en Español Sencillo 2026", abbreviation: "BES", language: "es", license: "cc0", pubYear: 2026, authors: ["AudioBiblia.org"], deathYears: [], credit: "La Biblia en Español Sencillo 2026 (domínio público, segundo o eBible.org).", audience: "beginner" },
  { translationId: "engwebster", versionId: "eng_webster", name: "Noah Webster Bible", abbreviation: "Webster", language: "en", license: "public_domain", pubYear: 1833, authors: ["Noah Webster"], deathYears: [1843], credit: "Noah Webster Bible, 1833 (domínio público)." },
  { translationId: "engmsb", versionId: "eng_msb", name: "Majority Standard Bible", abbreviation: "MSB", language: "en", license: "cc0", pubYear: null, authors: [], deathYears: [], credit: "Majority Standard Bible (dedicada ao domínio público pelo Berean Bible Translation Committee)." },
  { translationId: "eng-rv", versionId: "eng_rv_1895", name: "Revised Version (1895)", abbreviation: "RV", language: "en", license: "public_domain", pubYear: 1895, authors: [], deathYears: [], credit: "Revised Version, 1895 (domínio público)." },
  { translationId: "engDRA", versionId: "eng_douay_rheims_1899", name: "Douay-Rheims 1899", abbreviation: "DRA", language: "en", license: "public_domain", pubYear: 1899, authors: [], deathYears: [], credit: "Douay-Rheims, edição americana de 1899 (domínio público).", tradition: "catholic" },
  { translationId: "grcbyz", versionId: "grc_patriarchal_1904", name: "Novo Testamento Grego (Patriarcal 1904)", abbreviation: "Pat1904", language: "grc", license: "public_domain", pubYear: 1904, authors: [], deathYears: [], credit: "Patriarchal Greek New Testament, 1904 (domínio público)." },
  { translationId: "grcmt", versionId: "grc_byzantine_rp2018", name: "Novo Testamento Grego (Bizantino, Robinson-Pierpont 2018)", abbreviation: "RP2018", language: "grc", license: "cc0", pubYear: 2018, authors: ["Maurice A. Robinson", "William G. Pierpont"], deathYears: [], credit: "Greek New Testament, Byzantine Text Form, Robinson-Pierpont 2018 (domínio público)." },
  { translationId: "grc-tisch", versionId: "grc_tischendorf", name: "Novo Testamento Grego (Tischendorf, 8ª edição)", abbreviation: "Tisch", language: "grc", license: "public_domain", pubYear: 1872, authors: ["Constantin von Tischendorf"], deathYears: [1874], credit: "Tischendorf 8th edition Greek New Testament (domínio público)." },
  { translationId: "grclxx", versionId: "grc_septuagint", name: "Septuaginta (grego)", abbreviation: "LXX", language: "grc", license: "public_domain", pubYear: null, authors: [], deathYears: [], credit: "Septuaginta, Orthodox Media Network (domínio público, segundo o eBible.org).", notes: "Numeração dos Salmos e alguns livros difere do hebraico; mapeamento no Prompt 1.2 (TVTMS)." },
  { translationId: "latVUC", versionId: "lat_vulgata_clementina", name: "Vulgata Clementina (1598)", abbreviation: "Vulg", language: "la", license: "public_domain", pubYear: 1598, authors: ["Jerônimo"], deathYears: [], credit: "Vulgata Clementina de 1598 (domínio público).", tradition: "catholic" },
  { translationId: "porblt", versionId: "por_blpt_nt", name: "Biblia Livre Para Todos (Novo Testamento)", abbreviation: "BLPT", language: "pt", license: "cc_by_sa", pubYear: 2022, authors: ["Free Bible Ministry, Inc."], deathYears: [], credit: "Biblia Livre Para Todos © 2022 Free Bible Ministry, Inc., licença Creative Commons Atribuição-CompartilhaIgual 4.0 (CC BY-SA 4.0).", audience: "beginner", notes: "CC BY-SA e só Novo Testamento: mantida separada de qualquer texto próprio." },
];

export const sourceUrl = (id: string) => `${EB}/Scriptures/${id}_usfm.zip`;
export const copyrightUrl = (id: string) => `${EB}/${id}/copyright.htm`;
