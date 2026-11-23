// "Historiadores" (módulo M21): the ancient historians of the Bible's world, with their works, the passages that matter for Bible study and what scholars debate about
// each. The teacher presents them as SOURCES (RA-21: never speaks as them), cites work and division, says the limits, and compares witnesses without declaring a consensus
// where there is none (RA-14). Only what is well established is stated; the rest is marked as discussed.
export type HistorianId = "josefo" | "eusebio" | "tacito" | "plinio" | "suetonio" | "filon";
export type Status = "reader" | "library" | "planned";
export interface Work { id: string; title: string; original: string; what: string; status: Status; edition: string }
export interface Passage { id: string; cite: string; topic: string; summary: string; refs: string[]; debate?: string }
export interface Historian { id: HistorianId; name: string; years: string; role: string; summary: string; lines: string[]; works: Work[]; passages: Passage[]; limits: string }

export const HISTORIANS: Historian[] = [
  {
    id: "josefo", name: "Flávio Josefo", years: "37/38 – c. 100 d.C.", role: "Historiador judeu, sacerdote de Jerusalém, comandante na Galileia e depois cliente dos imperadores Flávios",
    summary: "A principal fonte não bíblica sobre o judaísmo do século I: o Segundo Templo, Herodes, os fariseus, saduceus e essênios, Pilatos, João Batista, Tiago e a destruição de Jerusalém.",
    lines: ["Nasceu em Jerusalém, de família sacerdotal (Vida 1–5).", "Foi comandante da Galileia na revolta de 66 d.C., rendeu-se em Jotapata e passou a viver em Roma (Guerra 3).", "Escreveu em Roma: Guerra dos Judeus (c. 75–79), Antiguidades Judaicas (c. 93), Vida e Contra Apião."],
    works: [
      { id: "ant", title: "Antiguidades Judaicas", original: "Antiquitates Judaicae", what: "20 livros: do começo do mundo à véspera da revolta; Herodes, Pilatos, João Batista, Jesus, Tiago.", status: "reader", edition: "Whiston, 1737 (domínio público)" },
      { id: "war", title: "A Guerra dos Judeus", original: "Bellum Judaicum", what: "7 livros: a revolta contra Roma, o cerco e a destruição de Jerusalém em 70 d.C.", status: "reader", edition: "Whiston, 1737 (domínio público)" },
      { id: "life", title: "Vida", original: "Vita", what: "Autobiografia: família, estudos, fariseus, saduceus e essênios, a Galileia.", status: "reader", edition: "Whiston, 1737 (domínio público)" },
      { id: "apion", title: "Contra Apião", original: "Contra Apionem", what: "2 livros: defesa da antiguidade e da Lei dos judeus; a lista de 22 livros sagrados.", status: "reader", edition: "Whiston, 1737 (domínio público)" },
    ],
    passages: [
      { id: "ant1833", cite: "Ant. 18.3.3", topic: "O testemunho sobre Jesus (Testimonium Flavianum)", summary: "Fala de Jesus, “um homem sábio”, condenado por Pilatos, cujos seguidores não o abandonaram.", refs: ["MAT.27.1-MAT.27.2"], debate: "Texto discutido: alguns o aceitam, outros veem acréscimos cristãos ou o texto inteiro como acréscimo. A maioria vê um núcleo autêntico com frases acrescentadas." },
      { id: "ant2091", cite: "Ant. 20.9.1", topic: "Tiago, irmão de Jesus", summary: "O sumo sacerdote Ananus faz julgar e apedrejar “Tiago, irmão de Jesus, chamado Cristo”.", refs: ["MAT.13.55", "GAL.1.19"], debate: "Muitos a veem como autêntica; alguns suspeitam de alteração em “chamado Cristo”." },
      { id: "ant1852", cite: "Ant. 18.5.2", topic: "João Batista", summary: "Herodes Antipas manda matar João, “chamado Batista”, e o exército de Herodes é derrotado.", refs: ["MRK.6.14-MRK.6.29"] },
      { id: "war65", cite: "Guerra 6.4–6.5", topic: "A queda de Jerusalém e do Templo (70 d.C.)", summary: "O incêndio do Templo e os presságios antes da queda.", refs: ["MAT.24.1-MAT.24.2", "LUK.21.20-LUK.21.24"] },
    ],
    limits: "Escreveu como judeu a serviço de Roma, com interesse em defender seu povo e agradar seus protetores. Os manuscritos são medievais e foram copiados por cristãos.",
  },
  {
    id: "eusebio", name: "Eusébio de Cesareia", years: "c. 260 – c. 339 d.C.", role: "Bispo de Cesareia Marítima, historiador da Igreja e conselheiro do imperador Constantino",
    summary: "O “pai da história da Igreja”: sua História Eclesiástica guarda trechos de autores perdidos (Papias, Hegésipo) e a memória dos três primeiros séculos.",
    lines: ["Viveu a última grande perseguição (303–311) e a virada de Constantino.", "Estudou na biblioteca de Panfilo em Cesareia e herdou o acervo de Orígenes.", "Foi presente ao Concílio de Niceia (325) e escreveu a Vida de Constantino."],
    works: [
      { id: "he", title: "História Eclesiástica", original: "Historia Ecclesiastica", what: "10 livros, até 324 d.C.: sucessão dos apóstolos, mártires, hereges, cânon.", status: "reader", edition: "McGiffert, 1890 (NPNF II.1, domínio público)" },
      { id: "vc", title: "Vida de Constantino", original: "Vita Constantini", what: "4 livros: elogio do imperador e a Igreja sob Constantino.", status: "reader", edition: "Richardson, 1890 (NPNF II.1, domínio público)" },
      { id: "mp", title: "Mártires da Palestina", original: "De martyribus Palaestinae", what: "Testemunho das perseguições de 303 a 311.", status: "planned", edition: "a obter" },
      { id: "pe", title: "Preparação Evangélica", original: "Praeparatio Evangelica", what: "15 livros: por que um cristão pode estudar os escritos gregos e hebraicos.", status: "planned", edition: "Gifford, 1903 (a verificar)" },
    ],
    passages: [
      { id: "he111", cite: "HE 1.11", topic: "Cita o testemunho de Josefo sobre Jesus", summary: "É a primeira citação do Testimonium Flavianum no texto que conhecemos.", refs: [], debate: "O fato de Eusébio ser a primeira citação conhecida alimenta a discussão sobre acréscimos cristãos." },
      { id: "he339", cite: "HE 3.39", topic: "Papias e a origem dos Evangelhos", summary: "Preserva o que Papias disse de Marcos e Mateus.", refs: ["MRK.1.1", "MAT.1.1"], debate: "Os estudiosos discutem o quanto Papias é confiável e o que ele quis dizer." },
      { id: "he225", cite: "HE 2.25", topic: "Pedro e Paulo em Roma sob Nero", summary: "Fala do martírio de Pedro e Paulo em Roma, apoiado em autores anteriores.", refs: ["2TI.4.6-2TI.4.8"], debate: "A morte dos apóstolos em Roma vem da tradição, não do Novo Testamento." },
    ],
    limits: "Escreve três séculos depois dos fatos de Jesus e dos apóstolos e é parcial: pró-Igreja e admirador de Constantino. Seu valor está sobretudo nas fontes antigas que citou.",
  },
  {
    id: "tacito", name: "Tácito", years: "c. 56 – c. 120 d.C.", role: "Senador romano e o maior historiador latino da época imperial",
    summary: "Sua passagem sobre Nero e os cristãos (Anais 15.44) é o testemunho romano mais antigo e mais citado sobre Cristo e a Igreja de Roma.",
    lines: ["Foi cônsul em 97 e governador da Ásia.", "Escreveu Agrícola e Germânia (98), as Histórias (c. 105–110) e os Anais (c. 116).", "Sua visão é a de um senador romano: severa com a corrupção e com os “superstitiones” estrangeiras."],
    works: [
      { id: "annals", title: "Anais", original: "Annales", what: "Roma de Tibério a Nero (14–68 d.C.), 16 livros, com lacunas.", status: "reader", edition: "Church e Brodribb, 1876 (a obter; a edição de Fyfe, 1912, não pode entrar)" },
      { id: "histories", title: "Histórias", original: "Historiae", what: "O ano dos quatro imperadores (69 d.C.) e a guerra judaica; o livro 5 fala dos judeus.", status: "planned", edition: "Church e Brodribb (a obter)" },
      { id: "agricola", title: "Agrícola", original: "De vita Iulii Agricolae", what: "Biografia do sogro de Tácito, governador da Britânia.", status: "reader", edition: "Gutenberg 7524 (verificar tradutor)" },
      { id: "germania", title: "Germânia", original: "De origine et situ Germanorum", what: "Os povos germânicos.", status: "reader", edition: "Gutenberg 7524 e 2995 (verificar tradutor)" },
    ],
    passages: [
      { id: "ann1544", cite: "Anais 15.44", topic: "Nero culpa os cristãos pelo incêndio de Roma (64 d.C.)", summary: "Diz que Cristo, de quem vem o nome “cristãos”, foi executado no reinado de Tibério pelo procurador Pôncio Pilatos, e que a “superstição” voltou a surgir em Roma.", refs: ["MAT.27.1-MAT.27.2", "1PE.4.16"], debate: "Autenticidade defendida pela grande maioria; discute-se de onde Tácito tirou a informação e a grafia “Chrestianos” no manuscrito mais antigo. Só é testemunho de que, em 116, os romanos sabiam da execução de Cristo por Pilatos." },
      { id: "hist5", cite: "Histórias 5.1–5.13", topic: "Os judeus, sua origem e o cerco de Jerusalém", summary: "Descrição hostil dos costumes judaicos e do cerco de Tito.", refs: [], debate: "Visão romana e preconceituosa; serve para ver como os judeus eram percebidos." },
    ],
    limits: "Escreve cerca de 80 anos depois da morte de Jesus, sem interesse pelos cristãos além de seu papel no incêndio de Roma. Os Anais chegaram por poucos manuscritos medievais.",
  },
  {
    id: "plinio", name: "Plínio, o Jovem", years: "c. 61 – c. 113 d.C.", role: "Advogado, senador e governador da Bitínia-Ponto",
    summary: "Sua carta ao imperador Trajano (c. 112) descreve como os cristãos de uma província romana viviam e eram julgados.",
    lines: ["Sobrinho e filho adotivo de Plínio, o Velho, que morreu na erupção do Vesúvio em 79.", "Governou a Bitínia-Ponto, na atual Turquia, por volta de 110–112.", "Publicou nove livros de cartas; o livro 10, com a correspondência com Trajano, saiu depois de sua morte."],
    works: [
      { id: "letters", title: "Cartas (livros 1–9)", original: "Epistulae", what: "Cartas a amigos: vida romana, o Vesúvio (6.16 e 6.20).", status: "reader", edition: "Bosanquet, 1906 (Gutenberg 2811, verificar)" },
      { id: "trajan", title: "Correspondência com Trajano (livro 10)", original: "Epistulae X", what: "Cartas ao imperador, entre elas a 10.96 sobre os cristãos.", status: "reader", edition: "Bosanquet, 1906 (Gutenberg 2811, verificar)" },
    ],
    passages: [
      { id: "ep1096", cite: "Cartas 10.96–10.97 (na edição de Melmoth, 10.97–10.98)", topic: "Os cristãos da Bitínia e a resposta de Trajano", summary: "Plínio pergunta o que fazer com os cristãos: relata que se reuniam antes do amanhecer, cantavam um hino a Cristo “como a um deus” e se comprometiam a não cometer crimes; Trajano responde que não devem ser procurados, mas punidos se acusados e se não negarem.", refs: ["1PE.4.14-1PE.4.16", "ACT.11.26"], debate: "Datada por volta de 112; a autenticidade é aceita, e o texto mostra a prática dos primeiros cristãos vista por um romano." },
    ],
    limits: "Não fala da vida de Jesus: só da prática dos cristãos no começo do século II.",
  },
  {
    id: "suetonio", name: "Suetônio", years: "c. 69 – depois de 122 d.C.", role: "Biógrafo e secretário do imperador Adriano",
    summary: "Em Vidas dos Doze Césares há duas menções breves a cristãos e a judeus em Roma que ajudam a datar o ambiente de Atos.",
    lines: ["Foi secretário de Adriano até cerca de 122.", "Escreveu a vida de Júlio César e dos onze imperadores seguintes, até Domiciano.", "Seu interesse é pelos imperadores, não pelos judeus nem pelos cristãos."],
    works: [{ id: "caesars", title: "Vidas dos Doze Césares", original: "De vita Caesarum", what: "Biografias de Júlio César a Domiciano.", status: "reader", edition: "Thomson e Forester (Gutenberg 6400, verificar)" }],
    passages: [
      { id: "cl254", cite: "Cláudio 25.4", topic: "Cláudio expulsa os judeus de Roma", summary: "Diz que Cláudio expulsou de Roma os judeus que faziam tumulto “por instigação de Cresto”.", refs: ["ACT.18.2"], debate: "Discute-se se “Cresto” é uma forma de Cristo (e então seria um sinal de conflitos em torno do cristianismo) ou outra pessoa; a data (c. 49) é discutida." },
      { id: "ner162", cite: "Nero 16.2", topic: "Nero castiga os cristãos", summary: "Cita, entre as medidas de Nero, o castigo aos cristãos, “gente de uma superstição nova e perniciosa”.", refs: ["1PE.4.16"] },
    ],
    limits: "Escreve por volta de 120; não é testemunho direto de Jesus, e as duas menções são breves.",
  },
  {
    id: "filon", name: "Fílon de Alexandria", years: "c. 20 a.C. – c. 50 d.C.", role: "Filósofo judeu helenizado de Alexandria, no Egito",
    summary: "Contemporâneo de Jesus, leu a Lei de Moisés com a filosofia grega. Não menciona Jesus, mas mostra o judaísmo helenístico do mundo do Novo Testamento.",
    lines: ["Liderou a embaixada dos judeus de Alexandria ao imperador Calígula (c. 40).", "Interpretava as Escrituras pela alegoria, com a ideia de Logos (a Palavra de Deus).", "Escreveu dezenas de obras em grego sobre a Lei, a criação e a vida de Moisés."],
    works: [
      { id: "opif", title: "Sobre a Criação do Mundo", original: "De opificio mundi", what: "Comentário filosófico a Gênesis 1–3.", status: "planned", edition: "Yonge, 1854–55 (domínio público)" },
      { id: "leg", title: "Alegoria das Leis", original: "Legum allegoriae", what: "Leitura alegórica de Gênesis 2–3.", status: "planned", edition: "Yonge (domínio público)" },
      { id: "flac", title: "Contra Flaco", original: "In Flaccum", what: "A perseguição aos judeus de Alexandria em 38 d.C.", status: "planned", edition: "Yonge (domínio público)" },
      { id: "gaium", title: "Embaixada a Gaio", original: "Legatio ad Gaium", what: "A embaixada a Calígula; fala também de Pilatos.", status: "planned", edition: "Yonge (domínio público)" },
      { id: "mos", title: "Vida de Moisés", original: "De vita Mosis", what: "A vida de Moisés para leitores gregos.", status: "planned", edition: "Yonge (domínio público)" },
    ],
    passages: [
      { id: "gaium299", cite: "Embaixada a Gaio 299–305", topic: "Pilatos e os escudos em Jerusalém", summary: "Carta atribuída a Agripa descreve Pilatos como inflexível e cruel, e o episódio dos escudos dourados em Jerusalém.", refs: ["LUK.3.1"], debate: "É uma descrição interessada, de quem queria atacar Pilatos diante do imperador." },
      { id: "logos", cite: "Sobre a Criação 4–6", topic: "O Logos de Deus", summary: "Fílon fala do Logos como o instrumento de Deus na criação.", refs: ["JHN.1.1-JHN.1.3"], debate: "Mostra o ambiente de ideias de João 1, mas não prova dependência do evangelista." },
    ],
    limits: "Nunca cita Jesus nem os cristãos. Os estudiosos discutem quanto o seu pensamento influenciou o Novo Testamento e os Pais da Igreja.",
  },
];

export const byId = (id: string) => HISTORIANS.find((h) => h.id === id);
export interface Testimony { who: string; cite: string; date: string; says: string; independent: string; debate: string }
/** External sources about Jesus and the first Christians, side by side. */
export const TESTIMONIES: Testimony[] = [
  { who: "Flávio Josefo", cite: "Ant. 18.3.3; 20.9.1", date: "c. 93", says: "Jesus, mestre e “sábio”, condenado por Pilatos; Tiago, “irmão de Jesus, chamado Cristo”.", independent: "Judeu, não cristão; fontes próprias.", debate: "O 18.3.3 foi alterado por copistas cristãos, em extensão discutida; o 20.9.1 é aceito por muitos." },
  { who: "Tácito", cite: "Anais 15.44", date: "c. 116", says: "Cristo, executado sob Tibério por Pilatos; cristãos castigados por Nero em 64.", independent: "Romano, não cristão; a fonte é desconhecida.", debate: "Aceito como autêntico; discute-se a fonte e o grau de independência." },
  { who: "Suetônio", cite: "Cláudio 25.4; Nero 16.2", date: "c. 121", says: "Judeus expulsos de Roma por tumultos “por instigação de Cresto”; cristãos castigados por Nero.", independent: "Romano; só sobre cristãos, não sobre a vida de Jesus.", debate: "Se “Cresto” é Cristo, e a data da expulsão (c. 49), são discutidos." },
  { who: "Plínio, o Jovem", cite: "Cartas 10.96–97", date: "c. 112", says: "Cristãos cantam a Cristo “como a um deus” e se recusam a adorar o imperador.", independent: "Romano; só sobre a prática dos cristãos.", debate: "Pouca discussão sobre a autenticidade." },
  { who: "Eusébio", cite: "HE 1.11; 2.23; 3.39", date: "c. 325", says: "Cita Josefo e autores perdidos (Papias, Hegésipo).", independent: "Posterior e cristão: não é testemunho independente.", debate: "Seu valor está nas fontes antigas que preserva." },
  { who: "Fílon de Alexandria", cite: "—", date: "c. 20 a.C.–50 d.C.", says: "Não menciona Jesus, mas descreve Pilatos e o judaísmo helenístico.", independent: "Contemporâneo, mas silencioso sobre Jesus.", debate: "O silêncio é explicado de modos diferentes: pouca notoriedade de Jesus na Alexandria, interesses de Fílon." },
];
