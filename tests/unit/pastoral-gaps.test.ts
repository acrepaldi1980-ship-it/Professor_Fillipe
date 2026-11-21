import { describe, expect, it } from "vitest";
import { detectPastoralCrisis } from "@/lib/teacher/pastoral";

describe("pastoral eval gaps (Prompt 1.14)", () => {
  for (const q of ["Fui abusada quando criança e nunca contei a ninguém.", "Tomei todos os remédios da caixa.", "Não vejo mais sentido em viver.", "Perdi o emprego, a casa e a vontade de viver.", "Meu marido me ameaça de morte.", "Estou sofrendo violência em casa, ajuda."])
    it(`detects: ${q}`, () => expect(detectPastoralCrisis(q)).toBe(true));
  for (const q of ["Jesus morreu na cruz por quê?", "Qual o sentido da vida segundo Eclesiastes?", "Davi tomou os pães da proposição?"])
    it(`does not trigger: ${q}`, () => expect(detectPastoralCrisis(q)).toBe(false));
});
