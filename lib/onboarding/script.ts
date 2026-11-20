// The interview script (RF-M03-01): 7 steps, the teacher reacts to each answer in one varied sentence (never a form).
import type { MinistryRole } from "./level";

export type StepId = "name" | "experience" | "goals" | "ministry" | "age_group" | "minutes" | "formats" | "topic";

export interface Option<T extends string | number = string> {
  value: T;
  label: string;
}

export interface Step {
  id: StepId;
  /** 1 to 7: position in the progress bar (the age-group follow-up shares step 4). */
  n: number;
  question: string;
  kind: "text" | "single" | "multi";
  options?: Option<string | number>[];
  /** Field written to the profile. */
  field: string;
}

export const STEPS: Step[] = [
  { id: "name", n: 1, kind: "text", field: "preferred_name", question: "Olá! Eu sou o Professor Filipe. Antes de começar, quero te conhecer. Como você gosta de ser chamado?" },
  { id: "experience", n: 2, kind: "single", field: "study_experience", question: "Há quanto tempo você estuda a Bíblia?", options: [
    { value: "starting", label: "Estou começando" }, { value: "lt_2y", label: "Menos de 2 anos" }, { value: "2_10y", label: "De 2 a 10 anos" }, { value: "gt_10y", label: "Mais de 10 anos" } ] },
  { id: "goals", n: 3, kind: "multi", field: "goals", question: "O que te trouxe aqui: entender melhor a Palavra, preparar aulas ou mensagens, ou estudar teologia mais a fundo?", options: [
    { value: "understand", label: "Entender melhor a Palavra" }, { value: "teach", label: "Preparar aulas" }, { value: "preach", label: "Preparar mensagens" }, { value: "academic", label: "Estudar teologia a fundo" } ] },
  { id: "ministry", n: 4, kind: "single", field: "ministry_role", question: "Você ensina ou serve em algum ministério?", options: [
    { value: "none", label: "Não" }, { value: "ebd_teacher", label: "Professor de EBD" }, { value: "preacher", label: "Pregador" }, { value: "pastor", label: "Pastor" }, { value: "leader", label: "Líder" }, { value: "student_theology", label: "Estudante de teologia" }, { value: "other", label: "Outro" } ] },
  { id: "age_group", n: 4, kind: "single", field: "teaching_age_group", question: "Para qual faixa etária você ensina?", options: [
    { value: "kids", label: "Crianças" }, { value: "teens", label: "Pré-adolescentes" }, { value: "youth", label: "Jovens" }, { value: "adults", label: "Adultos" }, { value: "mixed", label: "Turma mista" } ] },
  { id: "minutes", n: 5, kind: "single", field: "daily_minutes", question: "Quanto tempo por dia você costuma ter para estudar?", options: [
    { value: 5, label: "5 minutos" }, { value: 10, label: "10 minutos" }, { value: 20, label: "20 minutos" }, { value: 30, label: "30 minutos" }, { value: 60, label: "1 hora" } ] },
  { id: "formats", n: 6, kind: "multi", field: "preferred_formats", question: "Você prefere ouvir, ler ou ver mapas e imagens?", options: [
    { value: "audio", label: "Ouvir" }, { value: "text", label: "Ler" }, { value: "visual", label: "Mapas e imagens" } ] },
  { id: "topic", n: 7, kind: "text", field: "first_topic", question: "Me fala um livro ou tema da Bíblia que você gostaria de entender melhor." },
];

/** Steps the student will see: question 4 only with the religious-data consent (RF-M03-01); 4a only for EBD teachers. */
export function visibleSteps(a: { religiousConsent: boolean; ministry?: MinistryRole | null }): Step[] {
  return STEPS.filter((s) => (s.id === "ministry" ? a.religiousConsent : s.id === "age_group" ? a.religiousConsent && a.ministry === "ebd_teacher" : true));
}

export const TOTAL_STEPS = 7;

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const pick = <T,>(items: T[], seed: string): T => items[hash(seed) % items.length];

/** One-sentence reaction to an answer: varied, deterministic for the same answer (so it is testable). */
export function reaction(step: StepId, answer: string | number | string[], name = ""): string {
  const a = Array.isArray(answer) ? answer.join(",") : String(answer);
  const n = name ? `${name}, ` : "";
  switch (step) {
    case "name": return pick([`Prazer, ${a}! Vou te chamar assim.`, `Que bom ter você aqui, ${a}!`, `${a}, gostei! Vamos juntos.`], a);
    case "experience":
      return a === "starting"
        ? pick([`${n}ótimo começar agora: ninguém precisa saber tudo de antemão.`, `${n}começar é o melhor momento. Vou explicar tudo com calma.`], a)
        : a === "gt_10y"
          ? pick([`${n}bastante caminhada! Vou aprofundar sem repetir o básico.`, `${n}muita estrada. Posso ir mais fundo quando você quiser.`], a)
          : pick([`${n}boa base! Vamos construir em cima dela.`, `${n}ótimo, já dá para conversar com mais detalhe.`], a);
    case "goals": return pick([`${n}anotado! Vou montar o estudo em torno disso.`, `${n}boa meta. Isso me ajuda a escolher o caminho.`], a);
    case "ministry": return a === "none" ? pick([`${n}tudo bem! Estudar é o primeiro serviço.`], a) : pick([`${n}que bênção servir assim! Posso ajudar a preparar o que você ensina.`, `${n}obrigado por servir. Vou te apoiar no preparo.`], a);
    case "age_group": return pick([`${n}isso muda bastante o jeito de explicar. Obrigado!`, `${n}perfeito, vou pensar nessa turma.`], a);
    case "minutes": return Number(a) <= 10 ? pick([`${n}pouco tempo rende bastante quando é todo dia.`], a) : pick([`${n}ótimo, dá para estudar com calma.`, `${n}esse tempo dá para um estudo de verdade.`], a);
    case "formats": return pick([`${n}combinado! Vou usar mais disso nas explicações.`, `${n}vou caprichar nesse formato.`], a);
    case "topic": return pick([`${n}ótimo tema! Vamos começar por ele.`, `${n}boa escolha. Já tenho por onde começar.`, `${n}esse assunto rende muito. Vamos lá!`], a);
  }
}
