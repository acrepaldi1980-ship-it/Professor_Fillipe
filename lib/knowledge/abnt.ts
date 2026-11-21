// Bibliographic references in ABNT (NBR 6023) for the works of the library. Our records have author, title, year and the online source; publisher
// and place are not recorded, so the standard marks are used: [S.l.] (sine loco) and [s.n.] (sine nomine). Used in the deep study export.
export interface WorkRef { title: string; authors?: string[] | null; pub_year?: number | null; source_url?: string | null; translators?: string[] | null; edition?: string | null }

const MONTHS = ["jan.", "fev.", "mar.", "abr.", "maio", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];

/** "Maclaren, Alexander" -> "MACLAREN, Alexander"; "Alexander Maclaren" -> "MACLAREN, Alexander". Up to three authors, then "et al.". */
export function abntAuthors(authors?: string[] | null): string {
  const list = (authors ?? []).map((a) => a.trim()).filter(Boolean);
  if (!list.length) return "";
  const fmt = (a: string) => {
    if (a.includes(",")) { const [s, ...r] = a.split(","); return `${s.trim().toUpperCase()}, ${r.join(",").trim()}`; }
    const w = a.split(/\s+/);
    return w.length === 1 ? w[0].toUpperCase() : `${w[w.length - 1].toUpperCase()}, ${w.slice(0, -1).join(" ")}`;
  };
  return list.length > 3 ? `${fmt(list[0])} et al.` : list.map(fmt).join("; ");
}

export function abntReference(w: WorkRef, accessed = new Date()): string {
  const a = abntAuthors(w.authors);
  const title = w.title.replace(/\s+/g, " ").trim();
  // with no author the entry begins with the title in capitals (first word)
  const head = a ? `${a}. ${title}` : `${title.split(" ")[0].toUpperCase()}${title.slice(title.split(" ")[0].length)}`;
  const trans = w.translators?.length ? ` Tradução de ${w.translators.join("; ")}.` : "";
  const year = w.pub_year ? `, ${w.pub_year}` : ", [s.d.]";
  const online = w.source_url ? ` Disponível em: ${w.source_url}. Acesso em: ${accessed.getDate()} ${MONTHS[accessed.getMonth()]} ${accessed.getFullYear()}.` : "";
  return `${head.replace(/\.?$/, ".")}${trans} [S.l.]: [s.n.]${year}.${online}`;
}

/** Reference list sorted alphabetically, as the standard asks. */
export function abntBibliography(works: WorkRef[], accessed = new Date()): string[] {
  return works.map((w) => abntReference(w, accessed)).sort((x, y) => x.localeCompare(y, "pt-BR"));
}
