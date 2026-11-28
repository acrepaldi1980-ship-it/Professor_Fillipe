// Catalog of visuals the teacher may open (spec 8.8): ids of maps, places and timelines, the prompt layer that lists them,
// and the validation of the visuals the model returns (unknown ids are dropped: nothing invented reaches the screen).
import { MODELS_3D } from "./models3d";
import { ROUTES } from "./route-data";
import { TIMELINES } from "./timeline-data";

export function visualsCatalogPrompt(): string {
  const maps = ROUTES.map((r) => `${r.id}: ${r.name} [lugares: ${r.steps.map((s) => s.id).join(", ")}]`).join("\n");
  const lines = TIMELINES.map((t) => `${t.id}: ${t.name} [eventos: ${t.events.map((x) => x.id).join(", ")}]`).join("\n");
  return `VISUAIS DISPONÍVEIS (use no máximo 2 por turno, só quando ajudarem, com ids EXATOS desta lista; nunca invente ids):
Mapas (visuals: {"kind":"map","map_id":...,"highlight_place_ids":[os lugares de que você está falando agora]}):
${maps}
Ilustrações (visuals: {"kind":"illustration","prompt":"descrição curta da cena em inglês","alt":"descrição em português"}): só para cenas, objetos e lugares; NUNCA peça o rosto de Jesus nem uma imagem de Deus Pai.
Modelos 3D (visuals: {"kind":"model3d","model_id":...}): só quando o aluno perguntar sobre esses objetos ou lugares:
${MODELS_3D.map((m) => `${m.id}: ${m.name}`).join("\n")}
Linhas do tempo (visuals: {"kind":"timeline","timeline_id":...,"focus_event_id":...}):
${lines}`;
}

/** One line instead of the whole catalog when the question has nothing to show: the catalog is ~1,900 tokens, a third of the prompt, and the free models allow only ~8,000 tokens per minute. */
export const VISUALS_OFF_NOTE = "VISUAIS: nenhum neste turno (responda com visuals: []).";

const VISUAL_WORDS = /\b(mapa|mapas|rota|rotas|viagem|viagens|viajou|viajar|percurso|caminho|trajeto|onde (fica|foi|era|ficava|estava|nasceu|morreu)|lugar|lugares|cidade|cidades|monte|rio|mar|deserto|vale|regiao|terra prometida|linha do tempo|cronolog\w*|quando (foi|aconteceu|viveu|nasceu)|epoca|seculo|sequencia|ordem dos eventos|3d|modelo|tabernaculo|templo|arca|ilustr\w*|imagem|imagens|desenh\w*|figura|visual|visuais|mostre|mostra|como era|aparencia|geografia)\b/;
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Does this turn need the visuals catalog in the prompt? Guided modes always do; free study only when the question is about places, journeys, time, objects or images. */
export function needsVisuals(text: string, opts: { mode?: string; placeNamed?: boolean } = {}): boolean {
  if (opts.mode && opts.mode !== "free") return true;
  if (opts.placeNamed) return true;
  return VISUAL_WORDS.test(norm(text));
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
    } else if (v.kind === "model3d") {
      if (MODELS_3D.some((m) => m.id === (v as { model_id?: string }).model_id)) out.push(v);
    } else {
      out.push(v); // illustrations: validated by their own module
    }
  }
  return out.slice(0, 2);
}
