// The test environment package (Prompt 3.1). It exists to prove the engine: walk, collide, open hotspots, hear a fire, follow a guided tour.
import { EnvironmentPackage } from "../package";

export const TEST_PACKAGE: EnvironmentPackage = EnvironmentPackage.parse({
  id: "campo_de_teste",
  title: "Pátio de teste",
  era: "Ambiente de teste do motor (não é uma reconstrução bíblica)",
  refs: ["EXO.27.1"],
  spawn: [0, 9], spawnYaw: 0,
  bounds: { min: [-18, -48], max: [18, 18] },
  zones: [
    { id: "patio", name: "Pátio", scene: "test_yard", center: [0, 0], load: 26, unload: 34,
      colliders: [...[[-6, -6], [6, -6], [-6, 6], [6, 6], [-6, 0], [6, 0]].map(([x, z]) => ({ type: "circle", c: [x, z], r: 0.55 })), { type: "box", min: [-8, 11.7], max: [8, 12.3] }] },
    { id: "altar", name: "Altar", scene: "test_altar", center: [0, -30], load: 26, unload: 34,
      colliders: [{ type: "box", min: [-1.5, -31.5], max: [1.5, -28.5] }] },
  ],
  hotspots: [
    { id: "coluna", zone: "patio", label: "Uma coluna de pedra", text: "As colunas marcam o pátio. Em um ambiente real, cada peça teria a sua medida e a sua fonte.", refs: ["EXO.27.9-EXO.27.10"], at: [-6, 2, -6], radius: 3 },
    { id: "altar", zone: "altar", label: "O altar", text: "Um bloco de pedra com fogo: no ambiente real, o altar de bronze de Êxodo 27 (cinco côvados de lado).", refs: ["EXO.27.1-EXO.27.2"], at: [0, 1.6, -30], radius: 4 },
  ],
  sounds: [
    { id: "vento", kind: "ambient", layer: "wind", volume: 0.18 },
    { id: "fogo", kind: "spatial", layer: "fire", at: [0, 1.6, -30], volume: 0.7, radius: 16 },
  ],
  stations: [
    { id: "entrada", title: "A entrada do pátio", at: [0, 9], look: [0, -30], script: "Estamos na entrada do pátio. Veja como o espaço é aberto e como as colunas marcam o caminho. O que você acha que vem primeiro: o altar ou o santuário?", refs: ["EXO.27.9"] },
    { id: "altar", title: "Diante do altar", at: [0, -23], look: [0, -30], script: "Aqui está o altar. Antes de entrar no santuário era preciso passar por ele. Por que você acha que a ordem é essa?", refs: ["EXO.27.1", "LEV.1.3"] },
  ],
  sheet: {
    summary: "Ambiente de teste do motor de imersão: um pátio com colunas e um altar. Serve para medir o desempenho e testar movimento, colisão, pontos de interesse, som e passeio guiado.",
    sources: ["Êxodo 27:1-2 e 27:9-10 (medidas do altar e do átrio), citado como exemplo de uso"],
    uncertainty: "Não é uma reconstrução histórica.",
  },
});
