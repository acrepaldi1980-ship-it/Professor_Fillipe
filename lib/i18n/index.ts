import ptBR from "./pt-BR.json";

export type MessageKey = keyof typeof ptBR;

/** All UI strings go through here (RNF-10). Spanish is added in Phase 2. */
export function t(key: MessageKey): string {
  return ptBR[key];
}
