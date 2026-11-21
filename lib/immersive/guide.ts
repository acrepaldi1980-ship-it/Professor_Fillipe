// The teacher as guide inside the scene (spec 8.16, Prompt 3.3): what the teacher is told about WHERE the student is and WHAT they are looking at.
// Everything comes from the environment package on the server (never from the text the client sends), so the teacher can only talk about
// places, hotspots and verses that exist in the package, and the historical fact sheet with its sources travels with it (RA-09).
import { detailRefs } from "./refs";
import type { EnvironmentPackage, Hotspot, Station } from "./package";

export interface SceneState {
  env: string;
  x: number;
  z: number;
  /** Yaw in radians (0 looks toward -z). */
  yaw: number;
  /** Hotspot id the visitor is next to, if any. */
  hotspot?: string | null;
  /** Index of the guided-tour station the visitor is on, if any. */
  station?: number | null;
}

const COMPASS = ["norte", "nordeste", "leste", "sudeste", "sul", "sudoeste", "oeste", "noroeste"];
/** Compass direction the visitor faces. In the packages -z is north and +x is east, like the map. */
export function facing(yaw: number): string {
  const dx = -Math.sin(yaw), dz = -Math.cos(yaw); // forward vector
  const deg = (Math.atan2(dx, -dz) * 180) / Math.PI; // 0 = north (-z), 90 = east (+x)
  return COMPASS[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
}

const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Hotspots in front of the visitor within 12 m (about 60 degrees to each side), nearest first: "what they are looking at". */
export function lookingAt(pkg: EnvironmentPackage, s: SceneState, max = 3): Hotspot[] {
  const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw);
  return pkg.hotspots
    .map((h) => { const dx = h.at[0] - s.x, dz = h.at[2] - s.z, d = Math.hypot(dx, dz); const cos = d < 0.001 ? 1 : (dx * fx + dz * fz) / d; return { h, d, cos }; })
    .filter((x) => x.d <= 12 && x.cos >= 0.5)
    .sort((a, b) => a.d - b.d)
    .slice(0, max)
    .map((x) => x.h);
}

export function currentZone(pkg: EnvironmentPackage, s: SceneState) {
  return [...pkg.zones].sort((a, b) => dist([s.x, s.z], a.center as [number, number]) - dist([s.x, s.z], b.center as [number, number]))[0];
}

/** The text added to the teacher's instructions for this turn, and the Bible references to fetch. */
export function sceneContext(pkg: EnvironmentPackage, s: SceneState): { text: string; refs: string[] } {
  const zone = currentZone(pkg, s);
  const near = s.hotspot ? pkg.hotspots.find((h) => h.id === s.hotspot) : undefined;
  const seen = lookingAt(pkg, s).filter((h) => h.id !== near?.id);
  const st: Station | undefined = s.station != null ? pkg.stations[s.station] : undefined;
  const lines = [
    `AMBIENTE IMERSIVO: o aluno está DENTRO de "${pkg.title}" (${pkg.era}), caminhando em primeira pessoa. Você é o guia dele neste lugar.`,
    `Onde ele está: zona "${zone.name}"; olhando para o ${facing(s.yaw)}.`,
    near ? `Está ao lado de: "${near.label}": ${near.text} (${near.refs.join(", ") || "sem versículo"}).` : "",
    seen.length ? `À frente dele: ${seen.map((h) => `"${h.label}"`).join(", ")}.` : "",
    st ? `Estação do passeio guiado (${(s.station ?? 0) + 1} de ${pkg.stations.length}): "${st.title}". Roteiro desta estação: ${st.script}` : "",
    `FICHA HISTÓRICA (fonte do que você pode afirmar sobre o lugar): ${pkg.sheet.summary} Fontes: ${pkg.sheet.sources.join("; ")}.${pkg.sheet.uncertainty ? ` Incerteza: ${pkg.sheet.uncertainty}` : ""}`,
    "REGRAS DO GUIA: responda no contexto do lugar, em falas curtas, e termine com uma pergunta ou convite para olhar algo. Só descreva o que está na ficha, nos pontos de interesse ou nas fontes recuperadas; se perguntarem algo que o ambiente não mostra, diga isso com naturalidade e responda pelas fontes, sem inventar detalhes da reconstrução. Lembre que a cena é uma reconstrução esquemática. Nunca descreva rosto de Jesus nem represente Deus Pai (RA-20).",
  ].filter(Boolean);
  const refs = [...(near?.refs ?? []), ...seen.flatMap((h) => h.refs), ...(st?.refs ?? [])];
  return { text: lines.join("\n"), refs: [...new Set(refs)].slice(0, 8).flatMap(detailRefs) };
}
