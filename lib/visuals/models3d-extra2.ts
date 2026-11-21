// Five more 3D models (Prompt 2.6: 20 in total). Schematic reconstructions: where the Bible is silent or scholars disagree, the note says so.
// No scene shows the face of Jesus or represents God the Father (RA-20).
import type { Model3D } from "./models3d";

export const MODELS_3D_EXTRA2: Model3D[] = [
  { id: "herod_temple", name: "O Templo de Herodes", camera: [3, 12, 19],
    alt: "Modelo 3D do Templo de Herodes: uma grande esplanada de pedra com colunatas ao sul e a leste, o santuário de pedra clara no centro, o altar diante dele e a fortaleza Antônia no canto noroeste.",
    note: "Reconstrução esquemática a partir de descrições antigas e de achados arqueológicos. A Bíblia não descreve o templo de Herodes; ela o menciona como o templo que os judeus levaram 46 anos para construir. As proporções são aproximadas.",
    hotspots: [
      { id: "sanctuary", label: "O santuário", text: "O edifício do templo, com o Lugar Santo e o Santo dos Santos. Os discípulos admiraram a beleza de suas pedras e Jesus disse que não ficaria pedra sobre pedra.", refs: ["MRK.13.1-MRK.13.2", "JHN.2.20"], at: [-3.6, 3.3, 0] },
      { id: "altar", label: "O altar", text: "Diante do santuário ficava o altar dos sacrifícios.", refs: ["MAT.5.23-MAT.5.24"], at: [0.9, 1.9, 0] },
      { id: "solomon", label: "O Pórtico de Salomão", text: "A colunata do lado leste, onde Jesus caminhava no inverno e onde os primeiros cristãos se reuniam.", refs: ["JHN.10.22-JHN.10.23", "ACT.5.12"], at: [5.7, 1.5, 0] },
      { id: "gentiles", label: "O pátio dos gentios", text: "O pátio externo, onde Jesus expulsou os cambistas e os vendedores, dizendo que a casa de Deus é casa de oração para todas as nações.", refs: ["MRK.11.15-MRK.11.17", "JHN.2.13-JHN.2.16"], at: [0, 1.0, 3.0] },
      { id: "antonia", label: "A fortaleza Antônia", text: "Guarnição romana junto ao templo. Para lá levaram Paulo quando houve o tumulto.", refs: ["ACT.21.31-ACT.21.34"], at: [-5, 2.8, -3.6] },
    ] },
  { id: "burnt_altar", name: "O Altar do Holocausto", camera: [5, 4, 7],
    alt: "Modelo 3D do altar do holocausto: uma caixa quadrada de madeira revestida de bronze, com um chifre em cada canto, uma grelha no alto, fogo aceso e dois varais laterais para o transporte.",
    note: "Êxodo 27:1-8: de acácia, quadrado, de cinco côvados de lado por três de altura, revestido de bronze, oco, com chifres nos quatro cantos. O texto não descreve a grelha nem a base em detalhe; as interpretações variam.",
    hotspots: [
      { id: "horns", label: "Os quatro chifres", text: "Um em cada canto, da mesma peça do altar, revestidos de bronze. O sangue do sacrifício era aplicado a eles.", refs: ["EXO.27.2", "LEV.4.7"], at: [1.2, 2.2, 1.2] },
      { id: "fire", label: "O fogo", text: "O fogo no altar devia ficar sempre aceso; não podia apagar.", refs: ["LEV.6.12-LEV.6.13"], at: [0, 2.6, 0] },
      { id: "grate", label: "A grelha de bronze", text: "Uma grelha em rede de bronze, na metade da altura do altar.", refs: ["EXO.27.4-EXO.27.5"], at: [1.4, 0.7, 0] },
      { id: "poles", label: "Argolas e varais", text: "Quatro argolas e dois varais de acácia revestidos de bronze, para carregar o altar.", refs: ["EXO.27.6-EXO.27.7"], at: [-2.0, 1.2, 0] },
      { id: "meaning", label: "Para que servia", text: "Ali se ofereciam os holocaustos: o ofertante apresentava o animal sem defeito e o sacrifício cobria o pecado, apontando para o sacrifício de Cristo.", refs: ["LEV.1.1-LEV.1.4", "HEB.10.1-HEB.10.10"], at: [0, 0.9, 1.4] },
    ] },
  { id: "bronze_serpent", name: "A Serpente de Bronze", camera: [5, 4.2, 9.5],
    alt: "Modelo 3D da serpente de bronze: um poste de madeira com uma serpente de bronze enrolada no alto, sobre um terreno de deserto com algumas pedras.",
    note: "Números 21:4-9: Moisés fez uma serpente de bronze e a pôs num poste; quem olhava para ela, vivia. O texto não descreve a forma do poste. A serpente foi guardada e, séculos depois, o rei Ezequias a destruiu porque o povo lhe queimava incenso.",
    hotspots: [
      { id: "pole", label: "O poste", text: "Moisés a pôs sobre uma haste. Bastava olhar para ela para viver.", refs: ["NUM.21.8-NUM.21.9"], at: [0, 2.0, 0.3] },
      { id: "serpent", label: "A serpente de bronze", text: "Feita por ordem de Deus como remédio para os que tinham sido mordidos por serpentes venenosas.", refs: ["NUM.21.6-NUM.21.9"], at: [0.4, 3.3, 0.2] },
      { id: "john", label: "Jesus e a serpente", text: "Jesus disse que o Filho do Homem precisava ser levantado como a serpente no deserto, para que todo o que crê nele tenha a vida eterna.", refs: ["JHN.3.14-JHN.3.15"], at: [-1.2, 3.0, 0] },
      { id: "nehushtan", label: "Neustã", text: "Séculos depois, o povo passou a queimar incenso à serpente. O rei Ezequias a quebrou e a chamou de Neustã, um pedaço de bronze.", refs: ["2KI.18.4"], at: [1.6, 0.6, 0.4] },
    ] },
  { id: "upper_room", name: "O Cenáculo (a sala do andar de cima)", camera: [6, 7.5, 10],
    alt: "Modelo 3D de uma sala de cima do primeiro século: uma casa de pedra com escada externa, uma sala no andar superior com uma mesa baixa em forma de U e almofadas no chão, uma lamparina acesa e uma janela.",
    note: "A Bíblia fala de uma sala grande, mobiliada, no andar de cima, preparada para a Páscoa, e de um cenáculo onde os discípulos se reuniam depois da ascensão. O local exato é tradicional e debatido; a mesa em U segue o costume romano de reclinar-se para comer.",
    hotspots: [
      { id: "room", label: "A sala grande", text: "Jesus mandou dois discípulos prepararem a ceia da Páscoa numa sala grande, no andar de cima, já arrumada.", refs: ["MRK.14.12-MRK.14.16", "LUK.22.10-LUK.22.13"], at: [0, 3.2, 0] },
      { id: "table", label: "A mesa baixa", text: "Reclinados à mesa, os doze comeram com Jesus. Ali ele instituiu a Ceia e lavou os pés dos discípulos.", refs: ["LUK.22.14-LUK.22.20", "JHN.13.1-JHN.13.15"], at: [0, 2.8, -0.2] },
      { id: "stair", label: "A escada externa", text: "As casas de dois andares tinham escada de fora, e a sala de cima ficava reservada.", refs: ["ACT.1.13"], at: [3.55, 1.4, 1.0] },
      { id: "after", label: "Depois da ascensão", text: "Os onze e outros discípulos se reuniam no cenáculo, em oração unânime.", refs: ["ACT.1.12-ACT.1.14", "ACT.2.1-ACT.2.4"], at: [-2.2, 2.7, 0.8] },
    ] },
  { id: "jacob_well", name: "O Poço de Jacó", camera: [4, 3, 6],
    alt: "Modelo 3D do poço de Jacó: um poço redondo de pedra com borda larga, uma trave com roldana, um jarro no chão ao lado e algumas árvores ao redor, em terreno seco.",
    note: "João 4:5-14: o poço ficava perto de Sicar, no terreno que Jacó deu a José. O poço é muito fundo (João 4:11). Há um poço venerado em Nablus, perto da antiga Siquém, que a tradição identifica com este; o aspecto aqui é esquemático.",
    hotspots: [
      { id: "well", label: "O poço", text: "Jesus, cansado da viagem, sentou-se junto ao poço, por volta do meio-dia.", refs: ["JHN.4.6"], at: [0, 1.2, 0] },
      { id: "jar", label: "O jarro", text: "A mulher samaritana veio buscar água e deixou o cântaro quando foi anunciar Jesus à cidade.", refs: ["JHN.4.7", "JHN.4.28-JHN.4.29"], at: [1.6, 0.9, 0.9] },
      { id: "deep", label: "Um poço fundo", text: "A mulher disse que o poço era fundo e Jesus ofereceu a água viva, que se torna em quem a bebe uma fonte que jorra para a vida eterna.", refs: ["JHN.4.11-JHN.4.14"], at: [0, 0.4, 0] },
      { id: "land", label: "O terreno de Jacó", text: "Jacó comprou um terreno perto de Siquém, e ali foram enterrados os ossos de José.", refs: ["GEN.33.18-GEN.33.19", "JOS.24.32", "JHN.4.5"], at: [-2.4, 0.9, 1.2] },
    ] },
];
