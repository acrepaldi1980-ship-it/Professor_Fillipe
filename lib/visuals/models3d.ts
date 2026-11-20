// 3D catalog (RF-M08-05, P0): the Ark of the Covenant, the Tabernacle as a scale model and Solomon's Temple. The models are built in code
// (React Three Fiber, no files to download: license 100% the app's, decision of 21/11/2026) from the dimensions the Bible gives
// (1 cubit = 0.5 unit). They are schematic reconstructions: where the text is silent or scholars disagree, the note says so.
export interface Hotspot {
  id: string;
  label: string;
  text: string;
  refs: string[];
  /** Position in the scene (x, y, z). */
  at: [number, number, number];
}
export interface Model3D {
  id: string;
  name: string;
  /** Text alternative for screen readers (RF-M08-05, accessibility). */
  alt: string;
  note: string;
  camera: [number, number, number];
  hotspots: Hotspot[];
}

export const MODELS_3D: Model3D[] = [
  { id: "ark_covenant", name: "A Arca da Aliança", camera: [3.4, 2.6, 4.6],
    alt: "Modelo 3D da Arca da Aliança: uma caixa de madeira de acácia coberta de ouro, com quatro argolas e dois varais, tampa de ouro (o propiciatório) e dois querubins de asas abertas, frente a frente.",
    note: "Medidas de Êxodo 25:10: 2,5 côvados de comprimento, 1,5 de largura e 1,5 de altura. A forma exata dos querubins não é descrita no texto: aqui são estilizados.",
    hotspots: [
      { id: "box", label: "A caixa de acácia", text: "Madeira de acácia, coberta de ouro puro por dentro e por fora, com uma moldura de ouro em volta.", refs: ["EXO.25.10-EXO.25.11"], at: [0, 0.55, 1.0] },
      { id: "rings", label: "Argolas e varais", text: "Quatro argolas de ouro nos cantos e varais de acácia cobertos de ouro: a Arca era carregada, nunca tocada.", refs: ["EXO.25.12-EXO.25.15", "2SA.6.6-2SA.6.7"], at: [1.6, 0.2, 0.9] },
      { id: "mercy", label: "O propiciatório", text: "A tampa de ouro puro, onde Deus prometeu se encontrar com Moisés. No Dia da Expiação, o sangue era aspergido aqui.", refs: ["EXO.25.17-EXO.25.22", "LEV.16.14-LEV.16.15"], at: [0, 0.95, 0] },
      { id: "cherubim", label: "Os querubins", text: "Dois querubins de ouro batido, frente a frente, de asas abertas cobrindo o propiciatório.", refs: ["EXO.25.18-EXO.25.20"], at: [0, 1.5, -0.2] },
      { id: "inside", label: "O que havia dentro", text: "As tábuas da Lei foram guardadas dentro da Arca. Hebreus 9:4 menciona também a vara de Arão e um vaso de maná (a Arca de Salomão, em 1 Reis 8:9, só tinha as tábuas).", refs: ["EXO.25.16", "HEB.9.4", "1KI.8.9"], at: [0, 0.4, 0] },
    ] },
  { id: "tabernacle", name: "O Tabernáculo (maquete)", camera: [0, 12, 17],
    alt: "Maquete 3D do Tabernáculo visto de cima: um pátio retangular de cortinas com o altar de bronze e a bacia de bronze, e ao fundo a tenda, dividida em Lugar Santo (mesa, candelabro e altar de incenso) e Lugar Santíssimo (a Arca).",
    note: "Pátio de 100 por 50 côvados (Êxodo 27:9-18) e tenda de 30 por 10 côvados (Êxodo 26). Os detalhes da cobertura e das tábuas são debatidos; esta é uma maquete esquemática.",
    hotspots: [
      { id: "court", label: "O pátio", text: "Um cerco de cortinas de linho fino, de 100 por 50 côvados, com uma só entrada, a leste.", refs: ["EXO.27.9-EXO.27.19"], at: [-3, 0.9, 5] },
      { id: "altar", label: "O altar de bronze", text: "Onde se ofereciam os holocaustos: o primeiro passo de quem se aproximava de Deus.", refs: ["EXO.27.1-EXO.27.8"], at: [0, 1.2, 3.2] },
      { id: "laver", label: "A bacia de bronze", text: "Os sacerdotes se lavavam aqui antes de servir.", refs: ["EXO.30.17-EXO.30.21"], at: [0, 0.9, 1.2] },
      { id: "tent", label: "A tenda", text: "Tábuas de acácia cobertas de ouro e quatro camadas de cobertura. Seis dias de trabalho de Bezalel e Aoliabe, cheios do Espírito de Deus.", refs: ["EXO.26.1-EXO.26.37", "EXO.31.1-EXO.31.5"], at: [0, 2.2, -2.2] },
      { id: "table", label: "A mesa dos pães", text: "Doze pães, um por tribo, diante do Senhor.", refs: ["EXO.25.23-EXO.25.30", "LEV.24.5-LEV.24.9"], at: [1.0, 1.0, -1.4] },
      { id: "lampstand", label: "O candelabro", text: "Sete lâmpadas de ouro, de uma só peça batida, acesas diante do Senhor.", refs: ["EXO.25.31-EXO.25.40"], at: [-1.0, 1.0, -1.4] },
      { id: "incense", label: "O altar de incenso", text: "Incenso queimado de manhã e à tarde, diante do véu.", refs: ["EXO.30.1-EXO.30.10"], at: [0, 1.0, -2.6] },
      { id: "veil", label: "O véu", text: "Separava o Lugar Santo do Santíssimo. Rasgou-se de cima a baixo quando Jesus morreu.", refs: ["EXO.26.31-EXO.26.33", "MAT.27.51", "HEB.10.19-HEB.10.20"], at: [0, 1.6, -3.0] },
      { id: "ark_in", label: "A Arca no Santíssimo", text: "O lugar mais sagrado: só o sumo sacerdote entrava, uma vez por ano.", refs: ["EXO.26.33-EXO.26.34", "HEB.9.7"], at: [0, 0.9, -3.8] },
    ] },
  { id: "solomon_temple", name: "O Templo de Salomão", camera: [0, 10, 24],
    alt: "Modelo 3D do Templo de Salomão: um edifício retangular de pedra e cedro, com um pórtico na frente e duas colunas de bronze (Jaquim e Boaz), o Lugar Santo e o Santíssimo ao fundo, câmaras laterais e, no pátio, o grande mar de bronze sobre doze bois.",
    note: "Medidas de 1 Reis 6: 60 côvados de comprimento, 20 de largura e 30 de altura. A arquitetura exata é reconstruída a partir do texto e debatida; isto é uma maquete esquemática.",
    hotspots: [
      { id: "porch", label: "O pórtico", text: "Uma entrada coberta de 20 côvados de largura e 10 de profundidade.", refs: ["1KI.6.3"], at: [0, 2.6, 4.2] },
      { id: "pillars", label: "Jaquim e Boaz", text: "Duas colunas de bronze à entrada, de cerca de 18 côvados de altura, com capitéis de lírios e romãs.", refs: ["1KI.7.15-1KI.7.22"], at: [1.2, 3.4, 4.6] },
      { id: "holy", label: "O Lugar Santo", text: "A nave de 40 côvados, forrada de cedro e ouro, com o candelabro, a mesa e o altar de incenso.", refs: ["1KI.6.15-1KI.6.22", "1KI.7.48-1KI.7.50"], at: [0, 2.2, 0.8] },
      { id: "debir", label: "O Santíssimo (Debir)", text: "Um cubo de 20 côvados, forrado de ouro, onde ficava a Arca com os querubins de oliveira.", refs: ["1KI.6.16-1KI.6.28", "1KI.8.6-1KI.8.9"], at: [0, 2.2, -3.2] },
      { id: "chambers", label: "As câmaras laterais", text: "Três andares de câmaras encostadas nas paredes, sem apoio nas paredes do templo.", refs: ["1KI.6.5-1KI.6.10"], at: [2.6, 1.8, 0] },
      { id: "sea", label: "O mar de bronze", text: "Um grande tanque de bronze, de 10 côvados de lado a lado, sobre doze bois, para a lavagem dos sacerdotes.", refs: ["1KI.7.23-1KI.7.26"], at: [-3.4, 1.4, 4.0] },
      { id: "dedication", label: "A dedicação", text: "A glória do Senhor encheu o templo, e Salomão orou diante de todo o povo.", refs: ["1KI.8.10-1KI.8.13", "2CH.7.1-2CH.7.3"], at: [0, 4.2, 0] },
    ] },
];
