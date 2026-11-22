// The Tabernacle environment (Prompt 3.2), built from docs/ambientes/tabernaculo.md. Texts cite verses of Êxodo, Levítico and Hebreus and mark what is
// reconstruction (`basis`). Measures come from lib/immersive/tabernaculo.ts. God's presence is only light and cloud (RA-20).
import { EnvironmentPackage } from "../package";
import { ALTAR, ARK, COURT, LAMPSTAND, LAVER, TENT, VEIL_Z, courtColliders, tentCenterZ, tentColliders, tentWest, zOf } from "../tabernaculo";

const holyZ = (TENT.door + VEIL_Z()) / 2;
export const TABERNACLE_PACKAGE: EnvironmentPackage = EnvironmentPackage.parse({
  id: "tabernaculo",
  title: "O Tabernáculo",
  era: "Êxodo 25–40: a tenda do encontro no deserto",
  refs: ["EXO.25.9", "EXO.27.9-EXO.27.18", "EXO.26.1-EXO.26.37", "EXO.40.34-EXO.40.38", "LEV.16.2", "HEB.9.7"],
  spawn: [0, zOf(0) + 8], spawnYaw: 0,
  bounds: { min: [-COURT.halfW - 1.5, -COURT.halfL - 1.5], max: [COURT.halfW + 1.5, zOf(0) + 16] },
  zones: [
    { id: "atrio", name: "O átrio", scene: "tabernacle_court", center: [0, 0], load: 60, unload: 75, colliders: courtColliders() },
    { id: "tenda", name: "A tenda", scene: "tabernacle_tent", center: [0, tentCenterZ()], load: 40, unload: 55, colliders: tentColliders() },
  ],
  hotspots: [
    { id: "porta", zone: "atrio", label: "A porta do átrio", basis: "escritura", refs: ["EXO.27.16"], at: [0, 2, zOf(0)], radius: 5,
      text: "Uma só entrada, voltada para o leste. A cortina da porta tem 20 côvados e é de azul, púrpura, carmesim e linho torcido, obra de bordador (Êxodo 27:16)." },
    { id: "altar", zone: "atrio", label: "O altar do holocausto", basis: "escritura", refs: ["EXO.27.1-EXO.27.8"], at: [ALTAR.at[0], 1.5, ALTAR.at[1]], radius: 4.5,
      text: "Cinco côvados de lado e três de altura, de madeira de acácia revestida de bronze, com pontas nos quatro cantos (Êxodo 27:1-2). Não há degraus (Êxodo 20:26). A forma de dentro não é descrita." },
    { id: "pia", zone: "atrio", label: "A pia de bronze", basis: "reconstrucao", refs: ["EXO.30.17-EXO.30.21", "EXO.38.8"], at: [LAVER.at[0], 1.2, LAVER.at[1]], radius: 3.5,
      text: "De bronze, com base de bronze, entre a tenda e o altar, com água para lavar as mãos e os pés (Êxodo 30:18-19). Foi feita dos espelhos das mulheres que serviam à porta (Êxodo 38:8). O tamanho e a forma não são dados: esta é uma reconstrução." },
    { id: "tenda_fora", zone: "tenda", label: "A tenda por fora", basis: "reconstrucao", refs: ["EXO.26.1-EXO.26.14"], at: [TENT.halfW + 1, 2, tentCenterZ()], radius: 6,
      text: "Quatro coberturas, de dentro para fora: cortinas de linho com querubins, onze cortinas de pelo de cabra, couros de carneiro tingidos de vermelho e couros finos (Êxodo 26:1-14). Como elas cobrem a armação não está dito: aqui, um teto plano." },
    { id: "lugar_santo", zone: "tenda", label: "O Lugar Santo", basis: "escritura", refs: ["EXO.26.35", "EXO.25.23-EXO.25.30", "EXO.30.1-EXO.30.10"], at: [0, 1.4, holyZ], radius: 4,
      text: "Ao norte, a mesa dos pães; ao sul, o candelabro; diante do véu, o altar de incenso (Êxodo 26:35; 30:1-10). A mesa e o altar de incenso são de acácia revestida de ouro puro." },
    { id: "candelabro", zone: "tenda", label: "O candelabro", basis: "reconstrucao", refs: ["EXO.25.31-EXO.25.40"], at: [LAMPSTAND.at[0], 1.2, LAMPSTAND.at[1]], radius: 3,
      text: "Ouro puro batido a martelo, de uma só peça, com seis braços e sete lâmpadas (Êxodo 25:31-37). A altura não é dada: aqui ele tem cerca de 1,5 m, uma escolha artística." },
    { id: "veu", zone: "tenda", label: "O véu", basis: "escritura", refs: ["EXO.26.31-EXO.26.33", "HEB.9.8", "HEB.10.19-HEB.10.20"], at: [0, 2, VEIL_Z()], radius: 4,
      text: "Separa o Lugar Santo do Santo dos Santos (Êxodo 26:31-33). Hebreus 9:8 e 10:19-20 leem o véu como figura do acesso a Deus por Cristo." },
    { id: "arca", zone: "tenda", label: "A Arca da Aliança (vista)", basis: "escritura", refs: ["EXO.25.10-EXO.25.22", "LEV.16.2", "HEB.9.7"], at: [ARK.at[0], 1.2, ARK.at[1]], radius: 7,
      text: "Madeira de acácia revestida de ouro, com 2,5 × 1,5 × 1,5 côvados, com o propiciatório e dois querubins de ouro (Êxodo 25:10-22). Só o sumo sacerdote entrava ali, uma vez por ano, com sangue (Levítico 16:2; Hebreus 9:7). Por isso você vê a Arca de longe, sem entrar. Os querubins aqui são figuras abstratas, sem rosto." },
    { id: "nuvem", zone: "tenda", label: "A nuvem", basis: "escritura", refs: ["EXO.40.34-EXO.40.38"], at: [0, 3, tentWest() - 1.2], radius: 5,
      text: "A nuvem cobriu a tenda e a glória do Senhor encheu o tabernáculo (Êxodo 40:34-38). Aqui aparece só como luz e nuvem, nunca como uma figura." },
  ],
  sounds: [
    { id: "vento", kind: "ambient", layer: "wind", volume: 0.18 },
    { id: "acampamento", kind: "ambient", layer: "camp", volume: 0.08 },
    { id: "fogo", kind: "spatial", layer: "fire", at: [ALTAR.at[0], 1.5, ALTAR.at[1]], volume: 0.7, radius: 14 },
  ],
  stations: [
    { id: "porta", title: "A porta do átrio", at: [0, zOf(0) + 5], look: [0, zOf(0) - 10], refs: ["EXO.27.16"],
      script: "Estamos diante da única entrada do átrio, voltada para o leste. A cortina é de azul, púrpura e carmesim, em Êxodo 27:16. Por que você acha que há uma só porta?" },
    { id: "altar", title: "O altar do holocausto", at: [0, ALTAR.at[1] + 3.5], look: [ALTAR.at[0], ALTAR.at[1]], refs: ["EXO.27.1-EXO.27.2", "EXO.20.26"],
      script: "Aqui está o altar de bronze, com cinco côvados de lado. Não há degraus, como diz Êxodo 20:26. Antes de chegar ao santuário, é preciso passar por ele. O que isso lhe diz?" },
    { id: "pia", title: "A pia de bronze", at: [0, LAVER.at[1] + 3], look: [LAVER.at[0], LAVER.at[1]], refs: ["EXO.30.18-EXO.30.19"],
      script: "Entre o altar e a tenda fica a pia, onde os sacerdotes lavavam as mãos e os pés, em Êxodo 30:18-19. O texto não dá o tamanho dela. Por que lavar-se antes de servir?" },
    { id: "tenda", title: "A tenda por fora", at: [TENT.halfW + 5, tentCenterZ()], look: [0, tentCenterZ()], refs: ["EXO.26.1-EXO.26.14"],
      script: "Esta é a tenda, com quatro coberturas, de dentro para fora, em Êxodo 26:1-14. Por fora ela parece simples. O que você esperava encontrar?" },
    { id: "santo", title: "O Lugar Santo", at: [0, holyZ + 1.5], look: [0, VEIL_Z()], refs: ["EXO.26.35", "EXO.30.1-EXO.30.10"],
      script: "No Lugar Santo, a mesa fica ao norte, o candelabro ao sul e o altar de incenso diante do véu, em Êxodo 26:35. Qual peça chama mais a sua atenção?" },
    { id: "arca", title: "O véu e a Arca", at: [0, VEIL_Z() + 2.4], look: [0, ARK.at[1]], refs: ["EXO.26.33", "LEV.16.2", "HEB.9.7"],
      script: "Atrás do véu fica a Arca. Só o sumo sacerdote entrava, uma vez por ano, com sangue, em Levítico 16:2 e Hebreus 9:7. Por isso você a vê de longe. O que significa não poder entrar?" },
  ],
  sheet: {
    summary: "Reconstrução do Tabernáculo de Êxodo 25–40: o átrio de 100 × 50 côvados, o altar do holocausto, a pia e a tenda de 30 × 10 côvados com o Lugar Santo e o Santo dos Santos. As medidas vêm do texto bíblico; o côvado está em 0,45 m (proposta). O que o texto não descreve é reconstrução artística e vem marcado em cada ponto.",
    sources: ["Bíblia Livre 2018 (CC BY): Êxodo 25–40, Levítico 16, Números 2–4, Hebreus 8–10", "Easton's Bible Dictionary (1897, domínio público): verbetes Tabernacle e Cubit", "docs/ambientes/tabernaculo.md (especificação do projeto)"],
    uncertainty: "O valor do côvado (0,45 m ou 0,52 m), a geometria do teto, o tamanho da pia, a altura do candelabro, os querubins e os tons exatos dos tecidos não estão no texto: são reconstrução. Medidas em metros são cálculos nossos.",
  },
});
