// Josephus for Bible study (module M20): who he was, the 30 books in four works with a short summary and the famous passages, and the parallels with the Bible
// used to link the search chunks to verses. Citations follow Whiston's divisions (Ant. 18.3.3 = book 18, chapter 3, section 3). Summaries are the project's own,
// written from the text; what is only a context parallel is said so. Josephus is presented as a SOURCE (RA-21: the teacher never speaks as him).
import type { WorkKey } from "./structure";

export const BIO = {
  name: "Flávio Josefo",
  hebrew: "Yosef ben Matityahu",
  years: "37/38 – c. 100 d.C.",
  lines: [
    "Nasceu em Jerusalém, no primeiro ano do imperador Calígula, de família sacerdotal e ligada à dinastia dos asmoneus (Vida 1–5).",
    "Aos 16 anos conheceu os três grupos judaicos: fariseus, saduceus e essênios; escolheu viver como fariseu (Vida 10–12).",
    "Aos 26 anos foi a Roma para libertar sacerdotes presos e voltou impressionado com o poder do império (Vida 13–16).",
    "Em 66 d.C., no começo da revolta judaica, foi comandante da Galileia. Cercado em Jotapata, rendeu-se ao general Vespasiano e previu que ele seria imperador (Guerra 3.8.9).",
    "Libertado, adotou o nome da família dos imperadores (Flávio). Acompanhou Tito como intérprete no cerco de Jerusalém, que terminou com a destruição do Templo em 70 d.C.",
    "Viveu em Roma, na casa dos Flávios, e escreveu quatro obras, hoje as principais fontes não bíblicas sobre o judaísmo do século I.",
  ],
  note: "Josefo escreveu como judeu a serviço de Roma, e isso marca o que ele diz e o que cala. Por isso o professor sempre o apresenta como fonte a ser lida com cuidado, nunca como voz do passado em primeira pessoa.",
} as const;

export interface BookInfo { work: WorkKey; book: number; title: string; span: string; summary: string; key: { cite: string; why: string; ref?: string }[] }

const ant: [string, string, string, BookInfo["key"]?][] = [
  ["Da Criação à morte de Isaque", "Cerca de 3.833 anos", "Recontar de Gênesis: a Criação, Adão e Eva, Caim e Abel, o dilúvio e Noé, a torre de Babel, Abraão, o sacrifício de Isaque e a destruição de Sodoma, com acréscimos de tradições judaicas da época.", [{ cite: "Ant. 1.3", why: "O dilúvio e a arca", ref: "GEN.6.9-GEN.9.17" }, { cite: "Ant. 1.13", why: "A oferta de Isaque", ref: "GEN.22.1-GEN.22.19" }]],
  ["Da morte de Isaque ao Êxodo", "220 anos", "Jacó e Esaú, José no Egito, a família no Egito, a opressão, o nascimento e a juventude de Moisés (com lendas judaicas sobre sua carreira no Egito) e a travessia do mar Vermelho.", [{ cite: "Ant. 2.9", why: "O nascimento de Moisés", ref: "EXO.2.1-EXO.2.10" }, { cite: "Ant. 2.16", why: "A travessia do mar", ref: "EXO.14.1-EXO.14.31" }]],
  ["Do Êxodo à rejeição daquela geração", "2 anos", "O Sinai, a Lei, o Tabernáculo, as vestes dos sacerdotes, os sacrifícios, as festas, as espias e a rebeldia do povo no deserto.", [{ cite: "Ant. 3.6", why: "O Tabernáculo", ref: "EXO.35.1-EXO.40.38" }, { cite: "Ant. 3.7", why: "As vestes sacerdotais", ref: "EXO.28.1-EXO.28.43" }]],
  ["Da rejeição à morte de Moisés", "38 anos", "O deserto, a rebelião de Corá, Balaão e Balaque, as leis de Moisés (com a leitura de Josefo) e o fim de Moisés no monte Nebo.", [{ cite: "Ant. 4.8", why: "O último discurso e a morte de Moisés", ref: "DEU.34.1-DEU.34.12" }]],
  ["Da morte de Moisés à morte de Eli", "476 anos", "A conquista de Josué, a divisão da terra, os juízes (Débora, Gideão, Jefté, Sansão), Rute e o nascimento de Samuel.", [{ cite: "Ant. 5.8", why: "Sansão e Dalila", ref: "JDG.13.1-JDG.16.31" }, { cite: "Ant. 5.9", why: "Rute", ref: "RUT.1.1-RUT.4.22" }]],
  ["Da morte de Eli à morte de Saul", "32 anos", "Samuel, a arca entre os filisteus, a escolha de Saul como rei, a unção e a ascensão de Davi, Davi e Golias e a morte de Saul.", [{ cite: "Ant. 6.9", why: "Davi e Golias", ref: "1SA.17.1-1SA.17.58" }]],
  ["Da morte de Saul à morte de Davi", "40 anos", "O reinado de Davi: Jerusalém como capital, as guerras, Bate-Seba, a rebelião de Absalão, o recenseamento e os preparos para o templo.", [{ cite: "Ant. 7.7", why: "Davi, Bate-Seba e Natã", ref: "2SA.11.1-2SA.12.25" }]],
  ["Da morte de Davi à morte de Acabe", "163 anos", "Salomão e seu templo, a divisão do reino, Jeroboão e Roboão, Elias e Acabe.", [{ cite: "Ant. 8.3", why: "A construção do templo de Salomão", ref: "1KI.6.1-1KI.6.38" }, { cite: "Ant. 8.2", why: "A sabedoria de Salomão", ref: "1KI.3.1-1KI.4.34" }]],
  ["Da morte de Acabe ao cativeiro das dez tribos", "157 anos", "Os reis de Judá e de Israel, Eliseu, Jonas, a queda de Samaria e a deportação pelos assírios.", [{ cite: "Ant. 9.10", why: "Jonas", ref: "JON.1.1-JON.4.11" }]],
  ["Do cativeiro das dez tribos ao primeiro ano de Ciro", "182 anos", "Ezequias e Senaqueribe, Manassés, Josias, a queda de Jerusalém em 586 a.C., o exílio e Daniel.", [{ cite: "Ant. 10.11", why: "Daniel e sua profecia", ref: "DAN.9.24-DAN.9.27" }]],
  ["Do primeiro ano de Ciro à morte de Alexandre", "253 anos", "O retorno do exílio, a reconstrução do templo, Esdras, Neemias, Ester e o encontro de Alexandre com os judeus.", [{ cite: "Ant. 11.6", why: "Ester", ref: "EST.1.1-EST.10.3" }]],
  ["Da morte de Alexandre à morte de Judas Macabeu", "170 anos", "A tradução grega da Lei (Septuaginta), Antíoco Epifânio e a profanação do templo, a revolta macabaica e a Festa das Luzes.", [{ cite: "Ant. 12.5", why: "Antíoco profana o templo", ref: "DAN.11.31" }, { cite: "Ant. 12.7", why: "A festa das Luzes (Dedicação)", ref: "JHN.10.22" }]],
  ["Da morte de Judas Macabeu à morte da rainha Alexandra", "82 anos", "Os reis-sacerdotes asmoneus, João Hircano, o conflito entre fariseus e saduceus.", []],
  ["Da morte da rainha Alexandra à morte de Antígono", "32 anos", "A disputa entre os irmãos asmoneus, a intervenção de Pompeu em Jerusalém (63 a.C.), a ascensão de Herodes.", [{ cite: "Ant. 14.4", why: "Pompeu entra no templo", ref: "HEB.9.1-HEB.9.8" }]],
  ["Da morte de Antígono à conclusão do templo por Herodes", "18 anos", "Herodes, o Grande, rei da Judeia, as suas obras e a reforma do templo.", [{ cite: "Ant. 15.11", why: "O templo de Herodes", ref: "JHN.2.20" }]],
  ["Da conclusão do templo à morte dos filhos de Herodes", "12 anos", "As intrigas na família de Herodes, os dramas com Alexandre e Aristóbulo.", []],
  ["Da morte de Alexandre e Aristóbulo ao exílio de Arquelau", "14 anos", "O fim de Herodes, a sucessão, Arquelau e a divisão do reino entre os filhos.", [{ cite: "Ant. 17.8", why: "A morte de Herodes", ref: "MAT.2.19-MAT.2.23" }]],
  ["Do exílio de Arquelau à volta dos judeus da Babilônia", "32 anos", "O recenseamento de Quirino, as quatro “filosofias” (fariseus, saduceus, essênios e zelotes), Pilatos, João Batista, o testemunho sobre Jesus, Herodes Antipas, Calígula.", [{ cite: "Ant. 18.3.3", why: "O famoso testemunho sobre Jesus", ref: "MAT.27.1-MAT.27.2" }, { cite: "Ant. 18.5.2", why: "João Batista e sua morte", ref: "MRK.6.14-MRK.6.29" }, { cite: "Ant. 18.1.1", why: "O recenseamento e Judas, o galileu", ref: "ACT.5.37" }]],
  ["De Calígula ao procurador Fado", "3,5 anos", "O assassinato de Calígula, o reinado de Cláudio e a morte de Herodes Agripa I.", [{ cite: "Ant. 19.8.2", why: "A morte de Herodes Agripa I", ref: "ACT.12.20-ACT.12.23" }]],
  ["De Fado a Floro", "22 anos", "Os procuradores Fado, Félix, Festo, Albino e Floro, os impostores e bandidos, a morte de Tiago e o caminho da revolta.", [{ cite: "Ant. 20.9.1", why: "A morte de Tiago, irmão de Jesus", ref: "MAT.13.55" }, { cite: "Ant. 20.5", why: "Teudas e a fome sob Cláudio", ref: "ACT.5.36" }]],
];
const war: [string, string, string, BookInfo["key"]?][] = [
  ["De Antíoco Epifânio à morte de Herodes, o Grande", "167 anos", "A profanação do templo, os macabeus, os asmoneus, Pompeu e a vida de Herodes.", []],
  ["Da morte de Herodes à missão de Vespasiano", "69 anos", "Arquelau, os procuradores romanos, Pilatos, as seitas (essênios), o início da revolta em 66 d.C.", [{ cite: "Guerra 2.8.2", why: "Os essênios", }, { cite: "Guerra 2.9.2", why: "Pilatos e os estandartes", ref: "LUK.3.1" }]],
  ["De Vespasiano à tomada de Gamala", "1 ano", "A campanha da Galileia, o cerco de Jotapata, a captura de Josefo e a profecia a Vespasiano.", [{ cite: "Guerra 3.8.9", why: "A profecia a Vespasiano" }]],
  ["Do cerco de Gamala à chegada de Tito", "2 anos", "A queda da Galileia, as facções em Jerusalém, a chegada de Tito e Vespasiano proclamado imperador.", []],
  ["Da chegada de Tito ao extremo sofrimento dos judeus", "1 ano", "O cerco de Jerusalém em 70 d.C., a descrição do Templo e a fome.", [{ cite: "Guerra 5.5", why: "A descrição do templo", ref: "1KI.6.1-1KI.6.38" }]],
  ["Da fome à tomada de Jerusalém", "1 ano", "A fome terrível, o incêndio e a destruição do Templo, a queda da cidade.", [{ cite: "Guerra 6.4", why: "O templo é queimado", ref: "MAT.24.1-MAT.24.2" }, { cite: "Guerra 6.5", why: "Os presságios antes da queda", ref: "LUK.21.20-LUK.21.24" }]],
  ["Da tomada de Jerusalém à sedição de Cirene", "3 anos", "O triunfo de Tito em Roma, a queda de Massada e o fim da resistência.", [{ cite: "Guerra 7.8", why: "A queda de Massada" }]],
];
const lifeBook: BookInfo = { work: "life", book: 1, title: "A Vida de Flávio Josefo", span: "Autobiografia", summary: "A defesa que Josefo faz de si mesmo: família sacerdotal, estudos, viagem a Roma, o comando na Galileia e as acusações do rival Justo de Tiberíades.", key: [{ cite: "Vida 1–2", why: "Sua descendência sacerdotal" }, { cite: "Vida 10–12", why: "Fariseus, saduceus e essênios" }] };
const apion: [string, string, string, BookInfo["key"]?][] = [
  ["Contra Apião, livro 1", "Defesa da antiguidade do povo judeu", "Josefo responde aos que desprezavam os judeus e mostra que seu povo é antigo, citando fontes egípcias, fenícias e caldeias. Contém a famosa lista de 22 livros sagrados.", [{ cite: "Ap. 1.8", why: "Os 22 livros sagrados (o cânon)", ref: "LUK.24.44" }]],
  ["Contra Apião, livro 2", "Refutação de Apião e elogio da Lei", "Refuta as calúnias de Apião, o gramático, e de outros, e apresenta a Lei de Moisés como uma “teocracia”: o governo de Deus.", []],
];

const mk = (work: WorkKey, rows: [string, string, string, BookInfo["key"]?][], label: string): BookInfo[] =>
  rows.map(([title, span, summary, key], i) => ({ work, book: i + 1, title: `${label} ${i + 1}: ${title}`, span, summary, key: key ?? [] }));
export const BOOKS: BookInfo[] = [
  ...mk("ant", ant, "Antiguidades"), ...mk("war", war, "Guerra"), lifeBook,
  ...apion.map(([title, span, summary, key], i) => ({ work: "apion" as const, book: i + 1, title, span, summary, key: key ?? [] })),
];
export const bookInfo = (work: WorkKey, book: number) => BOOKS.find((b) => b.work === work && b.book === book);

/** Bible passages that sit beside a passage of Josephus: they link the search chunks to the verses. These are context parallels, not claims that the texts are the same event. */
export interface Parallel { work: WorkKey; book: number; chapter: number; n: number; refs: string[]; kw: string }
export const PARALLELS: Parallel[] = [
  { work: "ant", book: 18, chapter: 3, n: 3, refs: ["MAT.27.1-MAT.27.2", "MRK.15.1-MRK.15.15", "JHN.19.1-JHN.19.16"], kw: "Jesus" },
  { work: "ant", book: 18, chapter: 5, n: 2, refs: ["MAT.14.1-MAT.14.12", "MRK.1.4-MRK.1.8", "MRK.6.14-MRK.6.29", "LUK.3.1-LUK.3.20"], kw: "Baptist" },
  { work: "ant", book: 20, chapter: 9, n: 1, refs: ["MAT.13.55", "MRK.6.3", "GAL.1.19", "ACT.15.13", "ACT.21.18", "JAS.1.1"], kw: "James" },
  { work: "ant", book: 18, chapter: 1, n: 1, refs: ["LUK.2.1-LUK.2.3", "ACT.5.37"], kw: "Cyrenius" },
  { work: "ant", book: 19, chapter: 8, n: 2, refs: ["ACT.12.20-ACT.12.23"], kw: "Agrippa" },
  { work: "ant", book: 20, chapter: 5, n: 1, refs: ["ACT.5.36"], kw: "Theudas" },
  { work: "ant", book: 20, chapter: 5, n: 2, refs: ["ACT.11.28"], kw: "famine" },
  { work: "ant", book: 20, chapter: 8, n: 6, refs: ["ACT.21.38"], kw: "Egypt" },
  { work: "ant", book: 20, chapter: 7, n: 2, refs: ["ACT.24.24"], kw: "Drusilla" },
  { work: "ant", book: 20, chapter: 8, n: 9, refs: ["ACT.25.1-ACT.25.12"], kw: "Festus" },
  { work: "ant", book: 18, chapter: 5, n: 1, refs: ["MAT.14.3-MAT.14.4", "LUK.3.19-LUK.3.20"], kw: "Herodias" },
  { work: "ant", book: 18, chapter: 2, n: 2, refs: ["JHN.18.13", "MAT.26.3", "LUK.3.2"], kw: "Caiaphas" },
  { work: "ant", book: 12, chapter: 5, n: 4, refs: ["DAN.8.9-DAN.8.14", "DAN.11.31"], kw: "altar" },
  { work: "ant", book: 10, chapter: 11, n: 7, refs: ["DAN.9.24-DAN.9.27"], kw: "Daniel" },
  { work: "ant", book: 12, chapter: 7, n: 7, refs: ["JHN.10.22"], kw: "Lights" },
  { work: "ant", book: 15, chapter: 11, n: 1, refs: ["JHN.2.20"], kw: "temple" },
  { work: "ant", book: 3, chapter: 6, n: 1, refs: ["EXO.35.1-EXO.40.38"], kw: "tabernacle" },
  { work: "ant", book: 3, chapter: 7, n: 1, refs: ["EXO.28.1-EXO.28.43"], kw: "garment" },
  { work: "ant", book: 8, chapter: 3, n: 1, refs: ["1KI.6.1-1KI.6.38", "2CH.3.1-2CH.3.17"], kw: "temple" },
  { work: "war", book: 6, chapter: 4, n: 5, refs: ["MAT.24.1-MAT.24.2", "MRK.13.1-MRK.13.2", "LUK.21.5-LUK.21.6"], kw: "temple" },
  { work: "war", book: 6, chapter: 5, n: 3, refs: ["LUK.21.11", "LUK.21.20-LUK.21.24", "MAT.24.15-MAT.24.22"], kw: "signs" },
  { work: "war", book: 2, chapter: 9, n: 2, refs: ["LUK.3.1"], kw: "Pilate" },
  { work: "apion", book: 1, chapter: 1, n: 8, refs: ["LUK.24.44"], kw: "books" },
];

/** "Ant. 18.3.3" → { work: "ant", book: 18, chapter: 3, n: 3 }; "Ap. 1.8" → book 1, section 8; "Vida 10–12" → section 10. */
export function parseCite(c: string): { work: WorkKey; book: number; chapter: number; n?: number } | null {
  const m = /^(Ant\.|Guerra|Ap\.|Vida)\s+(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(c);
  if (!m) return null;
  const [, w, a, b, d] = m;
  if (w === "Vida") return { work: "life", book: 1, chapter: 1, n: Number(a) };
  if (w === "Ap.") return { work: "apion", book: Number(a), chapter: 1, n: b ? Number(b) : undefined };
  return { work: w === "Ant." ? "ant" : "war", book: Number(a), chapter: Number(b ?? 1), n: d ? Number(d) : undefined };
}
