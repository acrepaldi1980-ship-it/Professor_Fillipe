// Portuguese → English search terms. The library is mostly in English, and the model that rewrites a question into English keywords can be down or busy
// (free models), so this glossary gives the search a safe English phrasing of the usual Bible-study words and names, without any model call.
const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** [Portuguese phrase or word (no accents, lower case), English keywords]. Longer phrases come first and win. */
const TERMS: [string, string][] = [
  ["irmaos de jesus", "brethren of the Lord brothers of Jesus James Joses Simon Judas"], ["irmaos do senhor", "brethren of the Lord brothers of Jesus"], ["irmao de jesus", "brother of Jesus James brethren of the Lord"],
  ["mae de jesus", "Mary mother of Jesus virgin"], ["virgem maria", "Virgin Mary mother of Jesus"], ["nascimento virginal", "virgin birth"], ["filho de deus", "Son of God"], ["filho do homem", "Son of man"],
  ["espirito santo", "Holy Spirit Holy Ghost"], ["ultima ceia", "Last Supper Lord's Supper"], ["santa ceia", "Lord's Supper communion Eucharist"], ["segunda vinda", "second coming of Christ parousia"],
  ["fim dos tempos", "end times eschatology last days"], ["mar morto", "Dead Sea Scrolls Qumran"], ["manuscritos do mar morto", "Dead Sea Scrolls Qumran"], ["novo testamento", "New Testament"], ["antigo testamento", "Old Testament"],
  ["mil anos", "millennium thousand years"], ["arrebatamento", "rapture"], ["grande tribulacao", "great tribulation"], ["batismo no espirito", "baptism of the Holy Spirit"], ["falar em linguas", "speaking in tongues glossolalia"],
  ["flavio josefo", "Josephus"], ["tacito", "Tacitus Annals Histories"], ["suetonio", "Suetonius Twelve Caesars"], ["plinio", "Pliny the Younger letters Trajan"], ["eusebio", "Eusebius Church History"], ["filon", "Philo of Alexandria"], ["historiadores", "historians ancient sources"], ["josefo", "Josephus Antiquities of the Jews Wars of the Jews"], ["filon", "Philo of Alexandria"], ["pais da igreja", "church fathers patristic"], ["pais apostolicos", "apostolic fathers"],
  ["trindade", "Trinity trinitarian"], ["encarnacao", "incarnation"], ["expiacao", "atonement propitiation"], ["justificacao", "justification"], ["santificacao", "sanctification"], ["predestinacao", "predestination election"],
  ["eleicao", "election predestination"], ["batismo", "baptism baptize"], ["batizar", "baptize baptism"], ["eucaristia", "Eucharist Lord's Supper communion"], ["igreja", "church ecclesia"], ["apostolo", "apostle"], ["apostolos", "apostles"],
  ["profeta", "prophet"], ["profecia", "prophecy"], ["ressurreicao", "resurrection"], ["ceu", "heaven"], ["inferno", "hell Gehenna Hades"], ["pecado", "sin"], ["graca", "grace"], ["fe", "faith"], ["lei", "law Torah"],
  ["evangelho", "gospel"], ["aliança", "covenant"], ["alianca", "covenant"], ["sabado", "Sabbath"], ["dizimo", "tithe"], ["milagre", "miracle"], ["milagres", "miracles"], ["anjo", "angel"], ["anjos", "angels"],
  ["demonio", "demon devil Satan"], ["demonios", "demons"], ["satanas", "Satan devil"], ["escatologia", "eschatology"], ["anticristo", "antichrist"], ["milenio", "millennium"], ["templo", "temple"], ["tabernaculo", "tabernacle"],
  ["sacerdote", "priest priesthood"], ["sacrificio", "sacrifice offering"], ["pascoa", "Passover"], ["pentecostes", "Pentecost"], ["canon", "canon of Scripture"], ["apocrifos", "apocrypha"], ["septuaginta", "Septuagint"],
  ["fariseus", "Pharisees"], ["fariseu", "Pharisee"], ["saduceus", "Sadducees"], ["essenios", "Essenes"], ["zelotes", "Zealots"], ["sinedrio", "Sanhedrin"], ["romanos", "Romans Rome"], ["herodes", "Herod"], ["pilatos", "Pilate"],
  ["cesar", "Caesar"], ["tiago", "James"], ["joao batista", "John the Baptist"], ["maria madalena", "Mary Magdalene"], ["pedro", "Peter"], ["paulo", "Paul"], ["jesus", "Jesus Christ"], ["cristo", "Christ Messiah"], ["messias", "Messiah Christ"],
  ["deus", "God"], ["cruz", "cross crucifixion"], ["crucificacao", "crucifixion"], ["salvacao", "salvation"], ["perdao", "forgiveness"], ["arrependimento", "repentance"], ["oracao", "prayer"], ["jejum", "fasting"],
  ["casamento", "marriage"], ["divorcio", "divorce"], ["escravidao", "slavery slave"], ["riqueza", "riches wealth"], ["cura", "healing"], ["morte", "death"], ["alma", "soul"], ["espirito", "spirit"], ["gloria", "glory"],
  ["reino de deus", "kingdom of God"], ["reino dos ceus", "kingdom of heaven"], ["parabola", "parable"], ["parabolas", "parables"], ["circuncisao", "circumcision"], ["gentios", "Gentiles"], ["judeus", "Jews Jewish"],
  ["samaritanos", "Samaritans"], ["levitas", "Levites"], ["escribas", "scribes"], ["publicanos", "publicans tax collectors"], ["maldicao", "curse"], ["bencao", "blessing"], ["adoracao", "worship"], ["louvor", "praise"],
  ["dilúvio", "flood Noah"], ["diluvio", "flood Noah"], ["exodo", "Exodus"], ["exilio", "exile captivity Babylon"], ["cativeiro", "captivity"], ["babilonia", "Babylon"], ["egito", "Egypt"], ["jerusalem", "Jerusalem"],
  ["genealogia", "genealogy"], ["nascimento de jesus", "birth of Jesus nativity"], ["morte de jesus", "death of Jesus crucifixion"], ["ressurreicao de jesus", "resurrection of Jesus"], ["ascensao", "ascension"],
  ["biblia", "Bible Scripture"], ["escritura", "Scripture"], ["inspiracao", "inspiration of Scripture"], ["inerrancia", "inerrancy"], ["traducao", "translation"], ["original", "original Greek Hebrew"],
];
const SORTED = [...TERMS].map(([p, e]) => [strip(p), e] as const).sort((a, b) => b[0].length - a[0].length);

/** English keywords for the Portuguese words and names of a question; null when the question has none (or is already English). */
export function englishQuery(question: string): string | null {
  let rest = ` ${strip(question).replace(/[^a-z0-9 ]+/g, " ")} `;
  const out: string[] = [];
  for (const [p, e] of SORTED) {
    const needle = ` ${p} `;
    if (rest.includes(needle)) { out.push(e); rest = rest.split(needle).join(" "); }
  }
  if (!out.length) return null;
  const words = [...new Set(out.join(" ").split(/\s+/))].slice(0, 28);
  return words.join(" ");
}
