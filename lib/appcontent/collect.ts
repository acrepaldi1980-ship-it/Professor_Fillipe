// The app's own content, flattened into records the search can index (so the teacher can answer from ALL of it, not only from the screen the student is on).
// One function per section; each record carries the address of the screen to cite ("Conteúdo do app > Personagens > Davi"). Pure: no network, no database.
import archaeology from "../archaeology/items.json";
import curiosities from "../curiosities/catalog.json";
import { CURATED } from "../characters";
import { HISTORIANS, TESTIMONIES } from "../historians/data";
import { PUBLIC_PACKAGES, PUBLIC_TOURS } from "../immersive/registry";
import { BIO, BOOKS, CONTROVERSIES } from "../josephus/books";
import { PATHS } from "../paths/data";
import { ROUTES } from "../visuals/route-data";
import { TIMELINES } from "../visuals/timeline-data";
import { MODELS_3D } from "../visuals/models3d";

export const SECTIONS = {
  personagens: { workId: "app_personagens", title: "Conteúdo do app: Vida dos Personagens" },
  curiosidades: { workId: "app_curiosidades", title: "Conteúdo do app: Curiosidades bíblicas" },
  arqueologia: { workId: "app_arqueologia", title: "Conteúdo do app: Arqueologia" },
  ambientes: { workId: "app_ambientes", title: "Conteúdo do app: Ambientes em 3D e tours 360°" },
  modelos3d: { workId: "app_modelos3d", title: "Conteúdo do app: Modelos em 3D" },
  linhas: { workId: "app_linhas", title: "Conteúdo do app: Linhas do tempo" },
  rotas: { workId: "app_rotas", title: "Conteúdo do app: Rotas e mapas" },
  trilhas: { workId: "app_trilhas", title: "Conteúdo do app: Trilhas de estudo" },
  historiadores: { workId: "app_historiadores", title: "Conteúdo do app: Historiadores" },
  josefo: { workId: "app_josefo", title: "Conteúdo do app: Flávio Josefo, guia" },
} as const;
export type SectionKey = keyof typeof SECTIONS;

export interface AppRecord {
  /** Stable id: `app:<section>:<slug>` (re-running the ingestion updates, never duplicates). */
  id: string;
  section: SectionKey;
  title: string;
  /** What the teacher reads. */
  text: string;
  /** Canonical Bible references mentioned (for the exact-reference signal). */
  refs: string[];
  /** The screen of the app where this is shown. */
  url: string;
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const rec = (section: SectionKey, slug: string, title: string, text: string, refs: string[], url: string): AppRecord => ({
  id: `app:${section}:${slug}`, section, title: clean(title), text: clean(text), refs: [...new Set(refs)].slice(0, 30), url,
});
const REF = /^[0-9A-Z]{3}\.\d+(\.\d+)?(-[0-9A-Z]{3}\.\d+(\.\d+)?)?$/;
const refsOf = (list: (string | undefined | null)[]) => list.filter((r): r is string => !!r && REF.test(r));

export function characterRecords(): AppRecord[] {
  const out: AppRecord[] = [];
  for (const c of CURATED) {
    const url = `/personagens?id=${c.id}`;
    const family = c.family.map((k) => `${k.rel}: ${k.name}`).join("; ");
    const places = c.places.map((p) => p.name).join(", ");
    out.push(rec("personagens", c.id, `${c.name}, ${c.title}`, `${c.name} (${c.title}). ${c.summary} Nasceu: ${c.born.label}. Morreu: ${c.died.label}.${family ? ` Família: ${family}.` : ""}${places ? ` Lugares: ${places}.` : ""}`, refsOf([c.born.ref, c.died.ref, ...c.family.map((k) => k.ref)]), url));
    for (const ch of c.chapters) {
      const basis = ch.basis === "escritura" ? "o que a Bíblia diz" : ch.basis === "tradicao" ? "tradição fora do texto bíblico" : "reconstrução artística";
      out.push(rec("personagens", `${c.id}:${ch.id}`, `${c.name} > ${ch.stage}: ${ch.title}`, `${c.name}, ${ch.stage}: ${ch.title}.${ch.when ? ` Quando: ${ch.when}.` : ""}${ch.place ? ` Onde: ${ch.place}.` : ""} ${ch.text} (Base: ${basis}.)`, refsOf([ch.ref]), `${url}`));
    }
    if (c.lessons.length) out.push(rec("personagens", `${c.id}:licoes`, `${c.name} > Lições`, c.lessons.map((l) => l.text).join(" "), refsOf(c.lessons.map((l) => l.ref)), url));
  }
  return out;
}

interface CuriosityItem { id: string; title: string; refs: string[]; sources: string[]; sentences: { text: string }[] }
export function curiosityRecords(): AppRecord[] {
  return (curiosities as CuriosityItem[]).map((c) => rec("curiosidades", c.id, c.title, `${c.title}. ${c.sentences.map((s) => s.text).join(" ")} Fontes: ${c.sources.join("; ")}.`, refsOf(c.refs), `/curiosidades?c=${c.id}`));
}

interface ArchItem { id: string; name: string; period: string; place: string; refs: string[]; text: string; wiki?: string }
export function archaeologyRecords(): AppRecord[] {
  return (archaeology as ArchItem[]).map((a) => rec("arqueologia", a.id, a.name, `${a.name} (${a.period}, ${a.place}). ${a.text}`, refsOf(a.refs), `/arqueologia?p=${a.id}`));
}

export function environmentRecords(): AppRecord[] {
  const out: AppRecord[] = [];
  for (const p of PUBLIC_PACKAGES) {
    const url = `/imersao?e=${p.id}`;
    out.push(rec("ambientes", p.id, `${p.title} (${p.era})`, `${p.title}, ${p.era}. ${p.sheet.summary} Fontes: ${p.sheet.sources.join("; ")}.${p.sheet.uncertainty ? ` O que não se sabe: ${p.sheet.uncertainty}` : ""}`, refsOf(p.refs), url));
    for (const h of p.hotspots) out.push(rec("ambientes", `${p.id}:${h.id}`, `${p.title} > ${h.label}`, `${p.title}, ${h.label}. ${h.text}`, refsOf(h.refs), url));
    p.stations.forEach((s, i) => out.push(rec("ambientes", `${p.id}:parada${i + 1}`, `${p.title} > ${s.title}`, `${p.title}, visita guiada, ${s.title}. ${s.script}`, refsOf(s.refs), url)));
  }
  for (const t of PUBLIC_TOURS) {
    const url = `/imersao?t=${t.id}`;
    out.push(rec("ambientes", t.id, `${t.title} (${t.era})`, `${t.title}, ${t.era}. ${t.sheet.summary} Fontes: ${t.sheet.sources.join("; ")}.${t.sheet.uncertainty ? ` O que não se sabe: ${t.sheet.uncertainty}` : ""}`, refsOf(t.refs), url));
    for (const s of t.scenes) {
      const spots = s.hotspots.map((h) => `${h.label}: ${h.text}`).join(" ");
      const body = [s.script, spots].filter(Boolean).join(" ");
      if (body) out.push(rec("ambientes", `${t.id}:${s.id}`, `${t.title} > ${s.title}`, `${t.title}, ${s.title}. ${body}`, refsOf(s.hotspots.flatMap((h) => h.refs ?? [])), url));
    }
  }
  return out;
}

export function model3dRecords(): AppRecord[] {
  const out: AppRecord[] = [];
  for (const m of MODELS_3D) {
    out.push(rec("modelos3d", m.id, m.name, `${m.name}. ${m.alt} ${m.note}`, refsOf(m.hotspots.flatMap((h) => h.refs)), `/visuais`));
    if (m.hotspots.length) out.push(rec("modelos3d", `${m.id}:partes`, `${m.name} > partes`, m.hotspots.map((h) => `${h.label}: ${h.text}`).join(" "), refsOf(m.hotspots.flatMap((h) => h.refs)), `/visuais`));
  }
  return out;
}

const yearLabel = (y: number, from?: number, to?: number) => {
  const f = (n: number) => (n < 0 ? `${-n} a.C.` : `${n} d.C.`);
  return from !== undefined && to !== undefined && from !== to ? `entre ${f(from)} e ${f(to)} (data mais provável: ${f(y)})` : f(y);
};
export function timelineRecords(): AppRecord[] {
  const out: AppRecord[] = [];
  for (const t of TIMELINES) {
    for (let i = 0; i < t.events.length; i += 8) {
      const part = t.events.slice(i, i + 8);
      out.push(rec("linhas", `${t.id}:${i / 8 + 1}`, `Linha do tempo: ${t.name}`, `Linha do tempo "${t.name}". ${part.map((e) => `${e.name}, ${yearLabel(e.year, e.from, e.to)}. ${e.note}`).join(" ")}`, refsOf(part.flatMap((e) => e.refs)), `/visuais`));
    }
  }
  return out;
}

export function routeRecords(): AppRecord[] {
  return ROUTES.flatMap((r) => {
    const out: AppRecord[] = [];
    for (let i = 0; i < r.steps.length; i += 8) {
      const part = r.steps.slice(i, i + 8);
      out.push(rec("rotas", `${r.id}:${i / 8 + 1}`, `Rota: ${r.name}`, `Rota "${r.name}" (texto: ${r.text}). ${part.map((s, k) => `Parada ${i + k + 1}, ${s.name}: ${s.note}`).join(" ")}`, refsOf([r.text, ...part.flatMap((s) => s.refs)]), `/visuais`));
    }
    return out;
  });
}

export function pathRecords(): AppRecord[] {
  return PATHS.flatMap((p) => {
    const out: AppRecord[] = [rec("trilhas", p.id, p.title, `${p.title} (${p.level}, ${p.days.length} dias). ${p.description}`, [], `/trilhas?id=${p.id}`)];
    for (let i = 0; i < p.days.length; i += 6) {
      const part = p.days.slice(i, i + 6);
      out.push(rec("trilhas", `${p.id}:${i / 6 + 1}`, `${p.title} > dias ${part[0].day} a ${part[part.length - 1].day}`, `${p.title}. ${part.map((d) => `Dia ${d.day}, ${d.title} (${d.ref}): ${d.goal}`).join(" ")}`, refsOf(part.flatMap((d) => d.ref.split("-"))), `/trilhas?id=${p.id}`));
    }
    return out;
  });
}

export function historianRecords(): AppRecord[] {
  const out: AppRecord[] = [];
  for (const h of HISTORIANS) {
    const url = `/historiadores?a=${h.id}`;
    out.push(rec("historiadores", h.id, `${h.name} (${h.years})`, `${h.name} (${h.years}), ${h.role}. ${h.summary} ${h.lines.join(" ")} Obras: ${h.works.map((w) => `${w.title} (${w.what}; edição: ${w.edition})`).join("; ")}. Limites: ${h.limits}`, [], url));
    for (const p of h.passages) out.push(rec("historiadores", `${h.id}:${p.id}`, `${h.name} > ${p.cite}: ${p.topic}`, `${h.name}, ${p.cite}: ${p.topic}. ${p.summary}${p.debate ? ` Debate: ${p.debate}` : ""}`, refsOf(p.refs), url));
  }
  out.push(...TESTIMONIES.map((t, i) => rec("historiadores", `testemunho:${i + 1}`, `Testemunho: ${t.who} (${t.cite})`, `${t.who}, ${t.cite}, ${t.date}. Diz: ${t.says} Independente? ${t.independent} Debate: ${t.debate}`, [], `/historiadores`)));
  return out;
}

export function josephusGuideRecords(): AppRecord[] {
  const out: AppRecord[] = [rec("josefo", "bio", "Flávio Josefo: quem foi", Object.values(BIO as Record<string, unknown>).filter((v) => typeof v === "string").join(" "), [], "/josefo")];
  for (const b of BOOKS) out.push(rec("josefo", `${b.work}:${b.book}`, `Josefo, ${b.title}`, `${b.title} (${b.span}). ${b.summary} Passagens-chave: ${b.key.map((k) => `${k.cite}: ${k.why}`).join(" ")}`, refsOf(b.key.map((k) => k.ref)), `/josefo?w=${b.work}&b=${b.book}`));
  for (const c of CONTROVERSIES) out.push(rec("josefo", `controversia:${c.work}.${c.book}.${c.chapter}.${c.n}`, `Josefo, debate: ${c.title}`, `${c.title}. ${c.text}`, [], `/josefo?w=${c.work}&b=${c.book}&c=${c.chapter}`));
  return out;
}

export function collectAppContent(): AppRecord[] {
  return [
    ...characterRecords(), ...curiosityRecords(), ...archaeologyRecords(), ...environmentRecords(), ...model3dRecords(), ...timelineRecords(),
    ...routeRecords(), ...pathRecords(), ...historianRecords(), ...josephusGuideRecords(),
  ];
}
