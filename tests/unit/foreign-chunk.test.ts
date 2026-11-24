import { expect, it } from "vitest";
import { foreignChunk } from "@/lib/teacher/language";

it("drops the Canticle of the Creatures (old Italian and Latin inside an English work), the passage that made the teacher quote Italian", () => {
  const t = "Life of St. Francis of Assisi > TEXT[18]\nINCIPIUNT LAUDES CREATURARUM QUAS FECIT BEATUS FRANCISCUS AD LAUDEM ET HONOREM DEI CUM ESSET INFIRMUS AD SANCTUM DAMIANUM. ALTISSIMU, onnipotente, bon signore, tue so le laude la gloria e l'onore et onne benedictione. Ad te sole, altissimo, se konfano et nullu homo ene dignu te mentovare. Laudato sie, mi signore, cum tucte le tue creature spetialmente messor lo frate sole, lo quale jorna, et illumini per lui; Et ellu e bellu e radiante cum grande splendore; de te, altissimo, porta significatione. Laudato si, mi signore, per sora luna e le stelle, in celu l' ai formate clarite et pretiose et belle. Laudato si, mi signore, per frate vento et per aere et nubilo et sereno et onne tempo, per le quale a le tue creature dai sustentamento.";
  expect(foreignChunk(t)).toBe(true);
});
