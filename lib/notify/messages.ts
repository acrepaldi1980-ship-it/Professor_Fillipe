// Text of the notifications, by language (spec 8.15: short, never alarming). The same keys exist for Portuguese and Spanish.
import type { Decision } from "./plan";

type Msg = { title: string; body: string };
const MESSAGES: Record<string, Record<Decision["kind"], (p: Record<string, string>) => Msg>> = {
  "pt-BR": {
    lesson: (p) => ({ title: "Lição da semana", body: `Que tal se preparar para "${p.title}" com o Professor Filipe?` }),
    trial: () => ({ title: "Seu teste está acabando", body: "Veja como continuar com o Premium, se quiser." }),
    path: (p) => ({ title: p.path, body: `Dia ${p.day}: ${p.title}. Vamos com calma, só um passo hoje.` }),
    review: (p) => ({ title: "Revisão do dia", body: Number(p.n) === 1 ? "Você tem 1 cartão para rever. Leva um minuto." : `Você tem ${p.n} cartões para rever. Leva poucos minutos.` }),
  },
  es: {
    lesson: (p) => ({ title: "Lección de la semana", body: `¿Te preparas para "${p.title}" con el Profesor Filipe?` }),
    trial: () => ({ title: "Tu prueba está por terminar", body: "Mira cómo continuar con Premium, si quieres." }),
    path: (p) => ({ title: p.path, body: `Día ${p.day}: ${p.title}. Con calma, solo un paso hoy.` }),
    review: (p) => ({ title: "Repaso del día", body: Number(p.n) === 1 ? "Tienes 1 tarjeta para repasar. Toma un minuto." : `Tienes ${p.n} tarjetas para repasar. Toman pocos minutos.` }),
  },
};

export const notificationText = (d: Decision, lang: string): Msg => (MESSAGES[lang] ?? MESSAGES["pt-BR"])[d.kind](d.params);
