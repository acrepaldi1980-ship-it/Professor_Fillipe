// Plain-text book helpers for the library ingestion: Project Gutenberg boilerplate removal and chapter/section detection.

export function stripGutenberg(raw: string): string {
  const m = /\*\*\* ?START OF (THE|THIS) PROJECT GUTENBERG[^\n]*\n/.exec(raw);
  const start = m ? m.index + m[0].length : 0;
  const end = raw.search(/\*\*\* ?END OF (THE|THIS) PROJECT GUTENBERG/);
  return raw.slice(start, end > start ? end : undefined);
}

const HEADING = /^\s*((CHAPTER|BOOK|PART|SECTION|LECTURE|SERMON|ARTICLE|QUESTION|TREATISE|DISCOURSE|HOMILY|LETTER|EPISTLE|CANTO|APPENDIX|PREFACE|INTRODUCTION|PROLOGUE|EPILOGUE|ESSAY|CONFESSION|DIALOGUE)\b[^\n]{0,90})\s*$/i;
const SKIP_SECTION = /^(contents?|table of contents|index|illustrations?|list of (illustrations|plates)|errata|transcriber|footnotes?|bibliography|advertisement)\b/i;

export function sectionsOf(text: string): { heading: string; body: string }[] {
  const paras = text.replace(/\r/g, "").split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);
  const out: { heading: string; body: string[] }[] = [];
  let parent = "";
  let cur = { heading: "", body: [] as string[] };
  const flush = () => { if (cur.body.join(" ").split(/\s+/).length >= 40) out.push(cur); };
  for (const p of paras) {
    const caps = p.length >= 4 && p.length <= 80 && p === p.toUpperCase() && /[A-Z]{3}/.test(p) && !/[.]{2}/.test(p);
    const h = HEADING.exec(p);
    if (h || caps) {
      flush();
      const title = (h ? h[1] : p).replace(/\s+/g, " ").trim();
      if (/^(BOOK|PART|VOLUME)\b/i.test(title)) parent = title;
      cur = { heading: parent && !/^(BOOK|PART|VOLUME)\b/i.test(title) ? `${parent} > ${title}` : title, body: [] };
    } else cur.body.push(p);
  }
  flush();
  return out.filter((s) => !SKIP_SECTION.test(s.heading.split(" > ").pop() ?? "")).map((s) => ({ heading: s.heading, body: s.body.join("\n") }));
}

