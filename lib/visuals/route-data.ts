// The 11 map routes of the MVP (spec 8.8, RF-M08-02). Each step has approximate coordinates (checked against the OpenBible
// Geocoding / Theographic data by scripts/seed-routes.mts), the verses that tell it and a one-line note. Place names in Portuguese.
export interface RouteStep {
  id: string;
  name: string;
  lat: number;
  lon: number;
  refs: string[]; // canonical refs, e.g. ACT.13.4
  note: string;
}
export interface RouteDef {
  id: string;
  name: string;
  era: "ot" | "nt";
  /** Ref of the text that tells the whole route. */
  text: string;
  steps: RouteStep[];
}

const s = (id: string, name: string, lat: number, lon: number, refs: string[], note: string): RouteStep => ({ id, name, lat, lon, refs, note });

export const ROUTES: RouteDef[] = [
  { id: "exodus", name: "O Êxodo", era: "ot", text: "EXO.12.37-EXO.19.2", steps: [
    s("rameses", "Ramessés", 30.8, 31.8, ["EXO.12.37"], "O povo sai do Egito, cerca de 600 mil homens a pé."),
    s("succoth", "Sucote", 30.55, 32.3, ["EXO.12.37", "EXO.13.20"], "Primeira parada depois da saída."),
    s("red_sea", "Mar Vermelho (travessia)", 29.9, 32.55, ["EXO.14.21-EXO.14.22"], "Deus abre o mar; a localização exata da travessia é debatida."),
    s("sinai", "Monte Sinai (tradicional)", 28.54, 33.97, ["EXO.19.2", "EXO.20.1"], "A aliança e a Lei; o local do monte é tradicional, não certo."),
    s("kadesh", "Cades-Barneia", 30.67, 34.43, ["NUM.13.26", "NUM.20.1"], "Os espias voltam; o povo fica muitos anos na região."),
    s("nebo", "Monte Nebo", 31.77, 35.73, ["DEU.34.1"], "Moisés vê a terra prometida."),
  ] },
  { id: "conquest", name: "A conquista de Canaã", era: "ot", text: "JOS.3.1-JOS.12.24", steps: [
    s("shittim", "Sitim", 31.82, 35.66, ["JOS.3.1"], "O acampamento antes de atravessar o Jordão."),
    s("gilgal", "Gilgal", 31.87, 35.45, ["JOS.4.19"], "Depois de atravessar o Jordão, o primeiro acampamento em Canaã."),
    s("jericho", "Jericó", 31.87, 35.44, ["JOS.6.20"], "As muralhas caem."),
    s("ai", "Ai", 31.92, 35.26, ["JOS.8.1"], "A primeira derrota por causa de Acã e depois a vitória."),
    s("gibeon", "Gibeão", 31.85, 35.18, ["JOS.9.3", "JOS.10.12"], "A aliança com os gibeonitas e o sol que se detém."),
    s("shechem", "Siquém", 32.21, 35.28, ["JOS.8.30-JOS.8.35"], "Renovação da aliança entre os montes Gerizim e Ebal."),
  ] },
  { id: "divided_kingdom", name: "A divisão do reino", era: "ot", text: "1KI.12.1-1KI.12.33", steps: [
    s("shechem_k", "Siquém", 32.21, 35.28, ["1KI.12.1"], "Roboão vai a Siquém ser proclamado rei; as dez tribos se recusam."),
    s("jerusalem_k", "Jerusalém", 31.78, 35.23, ["1KI.12.21"], "Capital de Judá, com Roboão."),
    s("bethel", "Betel", 31.94, 35.22, ["1KI.12.29"], "Jeroboão põe um bezerro de ouro no sul do reino do norte."),
    s("dan", "Dã", 33.25, 35.65, ["1KI.12.29"], "E outro bezerro no norte."),
    s("samaria", "Samaria", 32.28, 35.2, ["1KI.16.24"], "Onri constrói a nova capital de Israel."),
  ] },
  { id: "exile", name: "O exílio babilônico", era: "ot", text: "2KI.25.1-2KI.25.21", steps: [
    s("jerusalem_x", "Jerusalém", 31.78, 35.23, ["2KI.25.1", "2KI.25.8-2KI.25.9"], "Cercada, tomada e queimada por Nabucodonosor."),
    s("riblah", "Ribla", 34.4, 36.5, ["2KI.25.6"], "O rei Zedequias é julgado e levado cego."),
    s("babylon_x", "Babilônia", 32.54, 44.42, ["2KI.25.7", "PSA.137.1"], "Os exilados chegam à Babilônia e à beira dos rios."),
  ] },
  { id: "return", name: "O retorno do exílio", era: "ot", text: "EZR.1.1-EZR.7.10", steps: [
    s("babylon_r", "Babilônia", 32.54, 44.42, ["EZR.1.1-EZR.1.3", "EZR.7.9"], "Ciro autoriza o retorno; Esdras sai de lá mais tarde."),
    s("ahava", "Rio Aava", 33.5, 43.0, ["EZR.8.15"], "Os exilados se reúnem para a viagem (local aproximado)."),
    s("jerusalem_r", "Jerusalém", 31.78, 35.23, ["EZR.3.1-EZR.3.2", "NEH.2.17"], "O altar, o templo e depois as muralhas são reconstruídos."),
  ] },
  { id: "galilee", name: "O ministério de Jesus na Galileia", era: "nt", text: "MAT.4.12-MAT.18.35", steps: [
    s("nazareth", "Nazaré", 32.7, 35.3, ["LUK.4.16"], "Jesus cresce aqui e é rejeitado na sinagoga."),
    s("cana", "Caná", 32.75, 35.34, ["JHN.2.1-JHN.2.11"], "O primeiro sinal: a água em vinho."),
    s("capernaum", "Cafarnaum", 32.88, 35.57, ["MAT.4.13", "MRK.2.1"], "A base do ministério na Galileia."),
    s("sea_galilee", "Mar da Galileia", 32.82, 35.59, ["MAT.4.18", "MRK.4.37-MRK.4.41"], "O chamado dos pescadores e a tempestade acalmada."),
    s("bethsaida", "Betsaida", 32.91, 35.63, ["MRK.6.45", "LUK.9.10"], "Perto daqui, a multiplicação dos pães."),
    s("caesarea_philippi", "Cesareia de Filipe", 33.25, 35.69, ["MAT.16.13-MAT.16.16"], "A confissão de Pedro: \"Tu és o Cristo\"."),
  ] },
  { id: "last_week", name: "A última semana de Jesus em Jerusalém", era: "nt", text: "MAT.21.1-MAT.28.10", steps: [
    s("jericho_l", "Jericó", 31.87, 35.44, ["LUK.19.1-LUK.19.10"], "Jesus passa por Jericó e encontra Zaqueu."),
    s("bethany", "Betânia", 31.77, 35.26, ["JHN.12.1", "MRK.11.1"], "Onde Jesus fica nos dias antes da Páscoa."),
    s("jerusalem_entry", "Jerusalém (entrada)", 31.78, 35.23, ["MAT.21.1-MAT.21.11"], "A entrada triunfal, com ramos."),
    s("gethsemane", "Getsêmani", 31.78, 35.24, ["MAT.26.36-MAT.26.46"], "A oração e a prisão."),
    s("golgotha", "Gólgota", 31.78, 35.23, ["JHN.19.17-JHN.19.18"], "A crucificação."),
    s("tomb", "O túmulo vazio", 31.78, 35.23, ["MAT.28.1-MAT.28.6"], "A ressurreição no primeiro dia da semana."),
  ] },
  { id: "paul1", name: "A 1ª viagem missionária de Paulo", era: "nt", text: "ACT.13.1-ACT.14.28", steps: [
    s("antioch_syria", "Antioquia da Síria", 36.2, 36.16, ["ACT.13.1-ACT.13.3"], "O Espírito separa Barnabé e Saulo; a igreja os envia."),
    s("seleucia", "Selêucia", 36.12, 35.93, ["ACT.13.4"], "O porto de onde navegam."),
    s("salamis", "Salamina (Chipre)", 35.18, 33.9, ["ACT.13.5"], "Pregam nas sinagogas."),
    s("paphos", "Pafos (Chipre)", 34.76, 32.41, ["ACT.13.6-ACT.13.12"], "O procônsul Sérgio Paulo crê."),
    s("perga", "Perge", 36.96, 30.85, ["ACT.13.13"], "João Marcos volta para Jerusalém."),
    s("antioch_pisidia", "Antioquia da Pisídia", 38.3, 31.19, ["ACT.13.14-ACT.13.52"], "O discurso na sinagoga e a virada para os gentios."),
    s("iconium", "Icônio", 37.87, 32.49, ["ACT.14.1-ACT.14.6"], "Muitos creem; a perseguição os faz sair."),
    s("lystra", "Listra", 37.57, 32.45, ["ACT.14.8-ACT.14.20"], "A cura do coxo e o apedrejamento de Paulo."),
    s("derbe", "Derbe", 37.35, 33.37, ["ACT.14.20-ACT.14.21"], "Fazem muitos discípulos e voltam."),
  ] },
  { id: "paul2", name: "A 2ª viagem missionária de Paulo", era: "nt", text: "ACT.15.36-ACT.18.22", steps: [
    s("antioch_2", "Antioquia da Síria", 36.2, 36.16, ["ACT.15.36-ACT.15.41"], "Paulo e Silas partem."),
    s("lystra_2", "Listra", 37.57, 32.45, ["ACT.16.1-ACT.16.3"], "Timóteo se junta à equipe."),
    s("troas", "Trôade", 39.75, 26.17, ["ACT.16.8-ACT.16.10"], "A visão do homem da Macedônia."),
    s("philippi", "Filipos", 41.01, 24.29, ["ACT.16.11-ACT.16.40"], "Lídia, a jovem libertada e o carcereiro."),
    s("thessalonica", "Tessalônica", 40.64, 22.94, ["ACT.17.1-ACT.17.9"], "A sinagoga e o tumulto."),
    s("berea", "Bereia", 40.52, 22.2, ["ACT.17.10-ACT.17.12"], "Examinavam as Escrituras todos os dias."),
    s("athens", "Atenas", 37.97, 23.73, ["ACT.17.16-ACT.17.34"], "O discurso no Areópago."),
    s("corinth", "Corinto", 37.91, 22.88, ["ACT.18.1-ACT.18.11"], "Ficam um ano e meio; Priscila e Áquila."),
    s("ephesus_2", "Éfeso", 37.94, 27.34, ["ACT.18.19-ACT.18.21"], "Uma passagem rápida."),
    s("caesarea_2", "Cesareia", 32.5, 34.89, ["ACT.18.22"], "Desembarcam e sobem a Jerusalém."),
  ] },
  { id: "paul3", name: "A 3ª viagem missionária de Paulo", era: "nt", text: "ACT.18.23-ACT.21.17", steps: [
    s("antioch_3", "Antioquia da Síria", 36.2, 36.16, ["ACT.18.23"], "Paulo parte de novo, fortalecendo as igrejas."),
    s("ephesus_3", "Éfeso", 37.94, 27.34, ["ACT.19.1-ACT.19.41"], "Dois anos de ensino; o Espírito sobre os doze discípulos."),
    s("macedonia", "Macedônia (Filipos)", 41.01, 24.29, ["ACT.20.1"], "Paulo visita as igrejas da Macedônia."),
    s("corinth_3", "Corinto (Grécia)", 37.91, 22.88, ["ACT.20.2-ACT.20.3"], "Três meses na Grécia."),
    s("troas_3", "Trôade", 39.75, 26.17, ["ACT.20.6-ACT.20.12"], "Êutico cai da janela e é restaurado."),
    s("miletus", "Mileto", 37.53, 27.28, ["ACT.20.15-ACT.20.38"], "A despedida dos presbíteros de Éfeso."),
    s("tyre", "Tiro", 33.27, 35.2, ["ACT.21.3-ACT.21.6"], "Os discípulos pedem que não suba a Jerusalém."),
    s("caesarea_3", "Cesareia", 32.5, 34.89, ["ACT.21.8-ACT.21.14"], "A profecia de Ágabo."),
    s("jerusalem_3", "Jerusalém", 31.78, 35.23, ["ACT.21.15-ACT.21.17"], "Chegam e são recebidos pelos irmãos."),
  ] },
  { id: "rome", name: "A viagem de Paulo a Roma", era: "nt", text: "ACT.27.1-ACT.28.16", steps: [
    s("caesarea_r", "Cesareia", 32.5, 34.89, ["ACT.27.1-ACT.27.2"], "Paulo parte preso, com Júlio, o centurião."),
    s("sidon", "Sidom", 33.56, 35.37, ["ACT.27.3"], "Um dia de descanso entre amigos."),
    s("myra", "Mira", 36.26, 29.98, ["ACT.27.5-ACT.27.6"], "Trocam de navio."),
    s("fair_havens", "Bons Portos (Creta)", 34.93, 24.82, ["ACT.27.8-ACT.27.12"], "Paulo avisa do perigo; ninguém o escuta."),
    s("malta", "Malta", 35.95, 14.4, ["ACT.27.41-ACT.27.44", "ACT.28.1-ACT.28.10"], "O naufrágio e o inverno na ilha."),
    s("syracuse", "Siracusa", 37.07, 15.29, ["ACT.28.12"], "Três dias de parada."),
    s("puteoli", "Putéoli", 40.82, 14.12, ["ACT.28.13-ACT.28.14"], "Encontram irmãos e ficam sete dias."),
    s("rome_r", "Roma", 41.9, 12.5, ["ACT.28.14-ACT.28.31"], "Paulo prega com toda a liberdade, sem impedimento."),
  ] },
];

export const MAP_CREDITS = "Mapa-base: Natural Earth (domínio público). Lugares: OpenBible.info Geocoding (CC BY 4.0) e Theographic Bible Metadata (CC BY-SA 4.0). Coordenadas aproximadas; locais antigos como o Monte Sinai são debatidos.";
