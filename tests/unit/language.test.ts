import { describe, expect, it } from "vitest";
import { wrongLanguage } from "@/lib/teacher/language";

describe("language guard", () => {
  it("accepts Portuguese, even with a short foreign quote", () => {
    expect(wrongLanguage("A escatologia estuda as últimas coisas, como a volta de Cristo e o que a Bíblia diz sobre o fim. Em grego, parousia significa vinda. Qual parte você quer ver?")).toBeNull();
  });
  it("catches Italian drift", () => {
    expect(wrongLanguage("L'escatologia è lo studio delle ultime cose, che non sono solo la fine del mondo ma anche il ritorno di Cristo e la risurrezione dei morti per il giudizio.")).toBe("it");
  });
  it("catches English drift", () => {
    expect(wrongLanguage("Eschatology deals with the precursors of the second coming, and the kingdom of God is to be in the world as it was with the church of the apostles.")).toBe("en");
  });
  it("accepts Spanish when Spanish is wanted", () => {
    expect(wrongLanguage("La escatología estudia las últimas cosas, como el regreso de Cristo y lo que la Biblia dice sobre el fin de los tiempos para los creyentes.", "es")).toBeNull();
  });
});

import { foreignChunk } from "@/lib/teacher/language";
describe("foreign passages", () => {
  it("drops Italian passages, keeps English and Portuguese ones", () => {
    expect(foreignChunk("Laudato si, mi Signore, per sora nostra morte corporale, da la quale nullo homo vivente po scampare, che non sono degni di questa gloria e della luce")).toBe(true);
    expect(foreignChunk("Eschatology deals with the precursors of Christ's second coming, as well as with the second coming itself, and the kingdom of God in the world.")).toBe(false);
    expect(foreignChunk("A escatologia trata da segunda vinda de Cristo e do reino de Deus, que não é deste mundo, como a Bíblia ensina.")).toBe(false);
  });
});
