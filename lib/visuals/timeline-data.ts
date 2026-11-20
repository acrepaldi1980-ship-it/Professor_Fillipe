// Timelines (spec 8.8, RF-M08-03). Dates are approximate and carry their uncertainty ("c.", a range) on purpose.
// The Old Testament timelines (patriarchs, judges, kings, prophets) wait for decision D-07 (reference chronology).
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
];
