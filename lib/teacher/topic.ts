// Guardrail of the topic (owner's rule, 23/11/2026): the teacher answers ONLY inside the biblical context. Before anything is searched outside the app,
// this decides whether the question belongs to the study of the Bible (text, people, places, history and archaeology of the biblical world, languages of the
// Scriptures, theology, church history, the study materials of the app). What is off topic gets a short, kind invitation back to the study, never a web search.
// Pure and deterministic, so it is cheap (no model call) and testable. Spec: RA-18 and 8.23.
import type { Retrieved } from "../knowledge/search";

export type TopicVerdict = "in" | "off" | "unsure";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Words that, alone, say the question is about the Bible, its world, faith or the study (Portuguese, English and Spanish stems; accent-free). */
const STRONG = new RegExp(
  "\\b(" + [
    "biblia\\w*", "biblic\\w*", "escritura\\w*", "testamento\\w*", "evangelh\\w*", "gospel\\w*", "scripture\\w*", "bible",
    "deus", "jeova", "javeh", "yahweh", "elohim", "jesus", "cristo", "christ", "messias", "messiah", "espirito santo", "holy spirit", "trindade", "trinity",
    "apostol\\w*", "apostle\\w*", "profet\\w*", "prophe\\w*", "discipul\\w*", "disciple\\w*", "patriarc\\w*", "sacerdot\\w*", "priest\\w*", "levit\\w*", "fariseu\\w*", "pharisee\\w*", "saduceu\\w*", "escriba\\w*",
    "igreja\\w*", "church", "templo\\w*", "temple", "sinagoga\\w*", "tabernaculo\\w*", "tabernacle", "altar\\w*", "sacrifici\\w*", "culto\\w*", "worship", "louvor\\w*", "oracao", "orar", "pray\\w*", "jejum",
    "pecad\\w*", "salvacao", "salvation", "perdao", "forgive\\w*", "arrepend\\w*", "repent\\w*", "batism\\w*", "baptis\\w*", "comunhao", "eucarist\\w*", "mandament\\w*", "alianca", "covenant", "kingdom", "ceu", "heaven", "inferno", "anjo\\w*", "angel\\w*", "demonio\\w*", "satan\\w*", "diabo", "milagre\\w*", "miracle\\w*", "parabola\\w*", "parable\\w*", "ressurrei\\w*", "resurrection", "crucifica\\w*", "apocalipse", "profecia\\w*", "escatolog\\w*", "milenio", "arrebatamento",
    "israel\\w*", "judeu\\w*", "judeia", "judea", "jerusalem", "belem", "bethlehem", "galileia", "galilee", "nazare", "samaria\\w*", "babilonia", "babylon", "assiria\\w*", "canaa", "sinai", "carmelo", "carmel", "hermom", "oliveiras", "mar morto", "mar da galileia", "tiberiades",
    "genesis", "exodo", "levitico", "deuteronomio", "josue", "juizes", "rute", "cronicas", "esdras", "neemias", "salmo\\w*", "proverbio\\w*", "eclesiastes", "cantares", "isaias", "jeremias", "lamentacoes", "ezequiel", "oseias", "obadias", "miqueias", "habacuque", "sofonias", "zacarias", "malaquias", "romanos", "corintios", "galatas", "efesios", "filipenses", "colossenses", "tessalonicenses", "hebreus",
    "hebraic\\w*", "hebrew", "grego biblico", "aramaic\\w*", "septuaginta", "vulgata", "qumran", "rolos do mar morto", "exegese", "exeget\\w*", "hermeneutic\\w*", "teologi\\w*", "theolog\\w*", "doutrina\\w*", "doctrine", "dogma\\w*", "credo\\w*", "concilio\\w*", "patristic\\w*", "pais da igreja", "lutero", "luther", "calvin\\w*", "wesley", "agostinho", "augustine", "pentecost\\w*", "batista\\w*", "reformad\\w*", "catolic\\w*", "ortodox\\w*", "luterano\\w*", "metodista\\w*", "presbiterian\\w*", "dispensacional\\w*", "cristao\\w*", "cristianismo", "christian\\w*", "judaismo", "judaism", "pastor\\w*", "sermao", "sermon", "ebd", "escola dominical", "devocional", "versiculo\\w*", "capitulo\\w*",
    "josefo", "josephus", "eusebio", "tacito", "suetonio", "tertuliano", "policarpo", "constantino", "vespasiano", "arqueolog\\w*", "tel dan", "nabucodonosor", "sargao", "senaqueribe", "ezequias",
  ].join("|") + ")\\b",
);

/** Names and short words that are Biblical but also common outside it ("Pedro", "Maria", "monte", "rei"): they count only when nothing says the subject is off topic. */
const NAMES = new RegExp(
  "\\b(" + [
    "abraao", "isaque", "jaco", "jose", "moises", "arao", "davi", "salomao", "elias", "eliseu", "paulo", "maria", "pedro", "joao", "noe", "adao", "eva", "caim", "abel", "sansao", "gideao", "debora", "ana", "saul", "golias", "jonas", "ester", "daniel",
    "barnabe", "silas", "estevao", "filipe", "priscila", "aquila", "apolo", "onesimo", "filemom", "gamaliel", "melquisedeque", "ismael", "esau", "raquel", "lea", "rebeca", "sara", "rute", "boaz", "josias", "ezequias", "nicodemos", "lazaro", "marta", "zaqueu", "barrabas", "pilatos", "herodes", "caifas", "nero", "tito", "ciro", "judas", "tiago", "mateus", "marcos", "lucas", "timoteo", "samuel", "joel", "amos", "naum", "ageu", "tome",
    "fe", "lei", "rei\\w*", "king", "reino", "monte", "senhor", "roma\\w*", "arca\\w*", "cruz", "cross", "graca", "grace", "reis", "numeros", "atos", "oferta\\w*", "ceia", "jordao", "persia", "egito", "egypt", "palestina", "reforma", "passagem", "verse", "plinio",
  ].join("|") + ")\\b",
);

/** Things that are clearly not about the study of the Bible: sports, entertainment, politics of parties, markets, programming, recipes, shopping and the like. */
const OFF_TOPIC = new RegExp(
  "\\b(" + [
    "futebol", "campeonato", "brasileirao", "libertadores", "copa do mundo", "flamengo", "corinthians", "palmeiras", "sao paulo fc", "gremio", "cruzeiro", "neymar", "messi", "cristiano ronaldo", "nba", "formula 1", "gol de", "placar",
    "filme", "serie", "netflix", "novela", "bbb", "big brother", "ator", "atriz", "cantor", "cantora", "show do", "spotify", "tiktok", "instagram", "youtube", "influencer", "celebridade",
    "eleicao", "eleicoes", "candidato", "presidente lula", "bolsonaro", "partido", "pt ou pl", "voto em", "esquerda ou direita", "politica partidaria",
    "bitcoin", "cripto\\w*", "acoes da", "bolsa de valores", "dolar", "investimento", "investir", "cotacao", "forex",
    "receita de", "como fazer bolo", "como cozinhar", "ingredientes", "restaurante", "dieta", "emagrecer", "treino de", "academia", "musculacao",
    "codigo em", "programacao", "python", "javascript", "html", "excel", "planilha", "escreva um codigo", "corrigir meu codigo", "sql",
    "horoscopo", "signo", "mapa astral", "tarot", "numerologia",
    "iphone", "android", "celular", "notebook", "playstation", "xbox", "videogame", "fortnite", "minecraft", "free fire",
    "previsao do tempo", "clima amanha", "tradutor", "traduza", "capital do", "quem inventou", "quanto custa", "preco do", "onde comprar", "melhor marca",
    "lição de casa", "licao de casa", "redacao", "enem", "vestibular", "matematica", "equacao", "derivada", "fisica", "quimica",
  ].join("|") + ")\\b",
);

const SHORT_FOLLOWUP = /^(sim|nao|ok|certo|beleza|continue|continua|pode|vamos|quero|aprofunda|explica|mais|e agora|e depois|obrigad[oa]|valeu|amem|isso|tudo bem|entendi)\b/;

export interface TopicInput {
  text: string;
  /** Bible references the student TYPED in this message (references carried over from the previous turn do not count: they are not what this question is about). */
  refs: string[];
  /** The retrieved passages (their signals say how well the library knows this subject). */
  chunks: Retrieved[];
  /** The question borrows its subject from the previous turn ("e o irmão mais velho?"). */
  followUp?: boolean;
  /** A guided mode, a study screen (scene, Josephus, historian, trail) or extra sources already define the subject. */
  inStudyContext?: boolean;
}

/** An entry or app-content block whose title carries a word of the question, found by BOTH keyword and meaning: the library knows this subject. */
function libraryKnows(chunks: Retrieved[], text: string): boolean {
  const words = new Set(norm(text).split(/[^a-z]+/).filter((w) => w.length >= 4));
  return chunks.slice(0, 6).some((c) => {
    if (!c.signals?.includes("keyword") || !c.signals?.includes("semantic")) return false;
    const title = norm(c.title_path ?? "");
    return (c.kind !== "bible_text" || /bible|biblia/.test(title)) && [...words].some((w) => title.includes(w));
  });
}

/**
 * Order matters. What the student typed decides first (a typed reference, a clearly biblical word); then a clearly off-topic word wins over everything that is only
 * context (the conversation, the study screen, the references of the last answer): asking about football in the middle of a study is still off topic.
 */
export function topicGate(i: TopicInput): { verdict: TopicVerdict; why: string } {
  const t = norm(i.text);
  if (i.refs.length) return { verdict: "in", why: "reference" };
  if (STRONG.test(t)) return { verdict: "in", why: "biblical_words" };
  if (OFF_TOPIC.test(t)) return { verdict: "off", why: "off_topic_words" };
  if (libraryKnows(i.chunks, i.text)) return { verdict: "in", why: "library_knows" };
  if (i.inStudyContext) return { verdict: "in", why: "study_context" };
  if (i.followUp && SHORT_FOLLOWUP.test(t)) return { verdict: "in", why: "follow_up" };
  if (NAMES.test(t)) return { verdict: "in", why: "biblical_names" };
  return { verdict: "unsure", why: "no_biblical_signal" };
}

/** The fixed, kind reply for what is off topic (RA-18): short, no search, an invitation back to the study. Never calls the model. */
export function offTopicResponse(name: string) {
  return {
    speech: `${name}, essa pergunta parece fugir do que eu posso ajudar: sou o professor de Bíblia e só respondo dentro do estudo das Escrituras. Se ela era sobre a Bíblia, me diga o texto ou o tema. Ou prefere que eu sugira um texto, uma personagem ou um tema bíblico?`,
    display_markdown: "",
    citations: [],
    visuals: [],
    next_options: [
      { label: "Estudar um texto", intent: "ask" as const },
      { label: "Conhecer uma personagem", intent: "ask" as const },
      { label: "Sugerir um tema", intent: "ask" as const },
    ],
    lens_divergence: { present: false, summary: null },
    pastoral_flag: false,
    level_signal: "same" as const,
    mode_payload: null,
    external_sources: [],
  };
}
