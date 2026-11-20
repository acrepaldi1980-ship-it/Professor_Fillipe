// Timelines (spec 8.8, RF-M08-03). Dates are approximate and carry their uncertainty ("c.", a range) on purpose.
// Old Testament chronology: D-07 (21/11/2026) = conservative modern (Exodus c. 1446 BC from 1 Kings 6:1; kings of Israel and Judah after Thiele).
// Every date is approximate: other chronologies (late Exodus c. 1260 BC, Ussher) exist and the teacher says so.
export interface TimelineEvent {
  id: string;
  name: string;
  /** Year (negative = BC). `from`..`to` is the range when scholars disagree. */
  year: number;
  from?: number;
  to?: number;
  refs: string[];
  note: string;
}
export interface TimelineDef {
  id: string;
  name: string;
  era: "ot" | "nt";
  events: TimelineEvent[];
}
const e = (id: string, name: string, year: number, refs: string[], note: string, from?: number, to?: number): TimelineEvent => ({ id, name, year, from, to, refs, note });

export const TIMELINES: TimelineDef[] = [
  { id: "jesus_life", name: "A vida de Jesus", era: "nt", events: [
    e("birth", "Nascimento de Jesus", -5, ["MAT.2.1", "LUK.2.1-LUK.2.7"], "Antes da morte de Herodes, o Grande (4 a.C.).", -7, -4),
    e("temple12", "Jesus aos 12 anos no templo", 8, ["LUK.2.41-LUK.2.52"], "Única cena da infância depois do nascimento.", 7, 9),
    e("baptism", "Batismo de Jesus", 27, ["MAT.3.13-MAT.3.17", "LUK.3.1", "LUK.3.21-LUK.3.23"], "No 15º ano de Tibério; Jesus tinha cerca de 30 anos.", 26, 29),
    e("galilee", "Ministério na Galileia", 28, ["MAT.4.12-MAT.4.17"], "O ensino, os milagres e os discípulos.", 27, 30),
    e("transfig", "A transfiguração", 29, ["MAT.17.1-MAT.17.8"], "Pedro, Tiago e João veem a glória de Jesus.", 28, 32),
    e("crucifixion", "Crucificação", 30, ["MAT.27.35", "JHN.19.17-JHN.19.30"], "Sexta-feira da Páscoa; 30 ou 33 d.C. são as datas mais defendidas.", 30, 33),
    e("resurrection", "Ressurreição", 30, ["MAT.28.1-MAT.28.6", "1CO.15.3-1CO.15.8"], "No primeiro dia da semana.", 30, 33),
    e("ascension", "Ascensão", 30, ["ACT.1.9-ACT.1.11"], "Quarenta dias depois da ressurreição.", 30, 33),
  ] },
  { id: "early_church", name: "A igreja primitiva", era: "nt", events: [
    e("pentecost", "Pentecostes", 30, ["ACT.2.1-ACT.2.4"], "O Espírito Santo desce sobre os discípulos.", 30, 33),
    e("seven", "Os sete e a escolha de Estêvão", 33, ["ACT.6.1-ACT.6.7"], "A igreja se organiza para servir.", 31, 35),
    e("stephen", "Martírio de Estêvão", 34, ["ACT.7.54-ACT.7.60"], "Dispersão da igreja de Jerusalém.", 31, 36),
    e("saul", "Conversão de Saulo", 34, ["ACT.9.1-ACT.9.19", "GAL.1.15-GAL.1.18"], "No caminho de Damasco.", 31, 37),
    e("cornelius", "Cornélio: o evangelho chega aos gentios", 40, ["ACT.10.1-ACT.10.48"], "Pedro, em Cesareia.", 37, 42),
    e("antioch", "A igreja de Antioquia", 43, ["ACT.11.19-ACT.11.26"], "Ali os discípulos foram chamados cristãos pela primeira vez.", 40, 46),
    e("herod_agrippa", "Tiago morto e Pedro preso", 44, ["ACT.12.1-ACT.12.19"], "Herodes Agripa I morre em 44 d.C.", 41, 44),
    e("journey1", "1ª viagem missionária", 47, ["ACT.13.1-ACT.14.28"], "Chipre e a Ásia Menor.", 45, 49),
    e("council", "O concílio de Jerusalém", 49, ["ACT.15.1-ACT.15.35", "GAL.2.1-GAL.2.10"], "Os gentios não precisam ser circuncidados.", 48, 50),
    e("journey2", "2ª viagem missionária", 50, ["ACT.15.36-ACT.18.22"], "Macedônia, Atenas e Corinto.", 49, 52),
    e("journey3", "3ª viagem missionária", 54, ["ACT.18.23-ACT.21.17"], "Éfeso por cerca de 3 anos.", 53, 58),
    e("arrest", "Prisão de Paulo em Jerusalém", 57, ["ACT.21.27-ACT.21.36"], "Dois anos em Cesareia.", 56, 58),
    e("rome", "Paulo em Roma", 60, ["ACT.28.16-ACT.28.31"], "Prisão domiciliar por dois anos.", 59, 62),
    e("fall", "Destruição de Jerusalém", 70, ["MAT.24.1-MAT.24.2"], "O templo é queimado pelos romanos.", 70, 70),
  ] },

  { id: "patriarchs", name: "Os patriarcas e o Êxodo", era: "ot", events: [
    e("abraham_call", "O chamado de Abraão", -2090, ["GEN.12.1-GEN.12.4"], "Sai de Harã para Canaã aos 75 anos.", -2100, -1950),
    e("isaac", "Nascimento de Isaque", -2066, ["GEN.21.1-GEN.21.5"], "Abraão tinha 100 anos.", -2080, -1940),
    e("jacob", "Nascimento de Jacó e Esaú", -2006, ["GEN.25.24-GEN.25.26"], "Isaque tinha 60 anos.", -2020, -1880),
    e("joseph_sold", "José vendido ao Egito", -1898, ["GEN.37.28"], "Tinha 17 anos.", -1910, -1700),
    e("jacob_egypt", "Jacó desce ao Egito", -1876, ["GEN.46.1-GEN.46.7"], "A família de Jacó se instala em Gósen.", -1890, -1690),
    e("exodus", "O Êxodo", -1446, ["EXO.12.40-EXO.12.41", "1KI.6.1"], "Pela leitura de 1 Reis 6:1 (480 anos antes do templo). O êxodo tardio propõe c. 1260 a.C.", -1446, -1260),
    e("sinai", "A aliança no Sinai", -1445, ["EXO.19.1-EXO.20.17"], "Cerca de três meses depois da saída.", -1445, -1259),
    e("conquest", "Travessia do Jordão e conquista de Canaã", -1406, ["JOS.3.14-JOS.3.17", "JOS.6.20"], "Quarenta anos depois do Êxodo.", -1406, -1220),
  ] },
  { id: "judges", name: "Os juízes", era: "ot", events: [
    e("othniel", "Otniel", -1375, ["JDG.3.7-JDG.3.11"], "O primeiro juiz.", -1390, -1330),
    e("ehud", "Eúde", -1315, ["JDG.3.12-JDG.3.30"], "Livra Israel de Eglom, rei de Moabe.", -1330, -1250),
    e("deborah", "Débora e Baraque", -1209, ["JDG.4.1-JDG.5.31"], "A vitória sobre Sísera.", -1240, -1130),
    e("gideon", "Gideão", -1169, ["JDG.6.11-JDG.8.28"], "Trezentos homens vencem Midiã.", -1200, -1100),
    e("jephthah", "Jefté", -1100, ["JDG.11.1-JDG.12.7"], "Juiz em Gileade.", -1120, -1070),
    e("samson", "Sansão", -1065, ["JDG.13.1-JDG.16.31"], "A luta contra os filisteus.", -1090, -1040),
    e("samuel", "Samuel, o último juiz", -1050, ["1SA.3.19-1SA.3.21", "1SA.7.15"], "Faz a ponte para a monarquia.", -1070, -1020),
  ] },
  { id: "kings", name: "Os reis de Israel e Judá", era: "ot", events: [
    e("saul", "Saul, primeiro rei", -1050, ["1SA.10.1", "1SA.11.15"], "Reinado de cerca de 40 anos.", -1050, -1010),
    e("david", "Davi", -1010, ["2SA.5.4-2SA.5.5"], "Rei em Hebrom e depois em Jerusalém.", -1010, -970),
    e("solomon", "Salomão e o templo", -966, ["1KI.6.1", "1KI.6.37-1KI.6.38"], "O templo começa a ser construído no 4º ano de Salomão.", -970, -931),
    e("division", "A divisão do reino", -931, ["1KI.12.1-1KI.12.20"], "Roboão em Judá e Jeroboão em Israel.", -931, -931),
    e("ahab", "Acabe e Elias", -874, ["1KI.16.29-1KI.16.33", "1KI.18.20-1KI.18.40"], "Reinado de Acabe, c. 874 a 853 a.C.", -874, -853),
    e("jehu", "Jeú extingue a casa de Acabe", -841, ["2KI.9.1-2KI.10.31"], "O golpe de Jeú em Israel.", -841, -841),
    e("samaria_fall", "Queda de Samaria", -722, ["2KI.17.5-2KI.17.6"], "A Assíria leva o reino do norte.", -722, -722),
    e("hezekiah", "Ezequias", -715, ["2KI.18.1-2KI.19.37"], "A reforma e o livramento de Senaqueribe.", -715, -686),
    e("josiah", "Josias", -640, ["2KI.22.1-2KI.23.30"], "A reforma e a redescoberta do livro da Lei.", -640, -609),
    e("jerusalem_fall", "Queda de Jerusalém", -586, ["2KI.25.8-2KI.25.10"], "Nabucodonosor destrói o templo; início do exílio completo.", -587, -586),
    e("cyrus", "Decreto de Ciro", -538, ["EZR.1.1-EZR.1.4"], "Autoriza o retorno dos exilados.", -538, -538),
    e("temple2", "Segundo templo concluído", -516, ["EZR.6.14-EZR.6.15"], "Sob Zorobabel, Ageu e Zacarias.", -516, -516),
    e("nehemiah", "Neemias reconstrói as muralhas", -445, ["NEH.2.1-NEH.2.8", "NEH.6.15"], "No 20º ano de Artaxerxes.", -445, -444),
  ] },
  { id: "prophets", name: "Os profetas", era: "ot", events: [
    e("elijah", "Elias", -860, ["1KI.17.1", "2KI.2.11"], "No reino do norte, no tempo de Acabe.", -874, -850),
    e("elisha", "Eliseu", -840, ["2KI.2.9-2KI.2.15", "2KI.13.20"], "Sucessor de Elias.", -850, -795),
    e("jonah", "Jonas", -780, ["JON.1.1-JON.1.3", "2KI.14.25"], "Enviado a Nínive.", -790, -760),
    e("amos", "Amós", -760, ["AMO.1.1"], "Profeta de Judá no reino do norte.", -765, -750),
    e("hosea", "Oseias", -750, ["HOS.1.1"], "Amor fiel de Deus ao povo infiel.", -755, -715),
    e("isaiah", "Isaías", -740, ["ISA.1.1", "ISA.6.1-ISA.6.8"], "Ministério de cerca de 60 anos em Jerusalém.", -740, -680),
    e("micah", "Miqueias", -730, ["MIC.1.1"], "Contemporâneo de Isaías.", -735, -700),
    e("jeremiah", "Jeremias", -627, ["JER.1.1-JER.1.10"], "Chamado no 13º ano de Josias; profeta até o exílio.", -627, -586),
    e("daniel", "Daniel na Babilônia", -605, ["DAN.1.1-DAN.1.6"], "Levado cativo no 3º ano de Jeoaquim.", -605, -535),
    e("ezekiel", "Ezequiel", -593, ["EZK.1.1-EZK.1.3"], "Profeta entre os exilados.", -593, -571),
    e("haggai_zech", "Ageu e Zacarias", -520, ["HAG.1.1", "ZEC.1.1"], "Incentivam a reconstrução do templo.", -520, -518),
    e("malachi", "Malaquias", -430, ["MAL.1.1"], "O último profeta do Antigo Testamento.", -450, -420),
  ] },
];
