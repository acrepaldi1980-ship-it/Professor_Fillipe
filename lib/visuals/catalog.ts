// Catalog of visuals the teacher may open (spec 8.8): ids of maps, places and timelines, the prompt layer that lists them,
// and the validation of the visuals the model returns (unknown ids are dropped: nothing invented reaches the screen).
import { ROUTES } from "./route-data";
import { TIMELINES } from "./timeline-data";

export function visualsCatalogPrompt(): string {
  const maps = ROUTES.map((r) => `${r.id}: ${r.name} [lugares: ${r.steps.map((s) => s.id).join(", ")}]`).join("\n");
  const lines = TIMELINES.map((t) => `${t.id}: ${t.name} [eventos: ${t.events.map((x) => x.id).join(", ")}]`).join("\n");
  return `VISUAIS DISPONÍVEIS (use no máximo 2 por turno, só quando ajudarem, com ids EXATOS desta lista; nunca invente ids):
Mapas (visuals: {"kind":"map","map_id":...,"highlight_place_ids":[os lugares de que você está falando agora]}):
${maps}
Linhas do tempo (visuals: {"kind":"timeline","timeline_id":...,"focus_event_id":...}):
${lines}`;
}

type Visual = { kind: string; map_id?: string; highlight_place_ids?: string[]; timeline_id?: string; focus_event_id?: string; [k: string]: unknown };

export function sanitizeVisuals<T extends Visual>(visuals: T[]): T[] {
  const out: T[] = [];
  for (const v of visuals) {
    if (v.kind === "map") {
      const r = ROUTES.find((x) => x.id === v.map_id);
      if (!r) continue;
      out.push({ ...v, highlight_place_ids: (v.highlight_place_ids ?? []).filter((id) => r.steps.some((s) => s.id === id)) });
    } else if (v.kind === "timeline") {
      const t = TIMELINES.find((x) => x.id === v.timeline_id);
      if (!t) continue;
      out.push({ ...v, focus_event_id: t.events.some((x) => x.id === v.focus_event_id) ? v.focus_event_id : undefined });
    } else {
      out.push(v); // illustrations and 3D: validated by their own modules
    }
  }
  return out.slice(0, 2);
}
