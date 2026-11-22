// A fake OpenAI-compatible AI server for tests: answers the document sections and the teacher with plausible JSON, and fails some calls on
// purpose (429 / 500) so the router's failover and the parallel document building are exercised without any real quota.
// Usage: node tests/e2e/mock-llm.mjs [port]   (MOCK_FAIL=0.3 makes 30% of the calls fail)
import { createServer } from "node:http";

// A richer answer when the student asks about Filipe (the user-functions test checks a real-looking answer: a name, a verse button and a closing question).
function teacherFor(messages) {
  const text = (messages ?? []).filter((m) => m.role === "user").map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content))).join("\n");
  if (!/Filipe/.test(text)) return baseTeacher;
  const speech = "Filipe foi um dos sete escolhidos para servir em Jerusalém e depois levou o evangelho a Samaria, como conta Atos 8. Em Atos 8:26-40 ele explica o profeta Isaías a um oficial etíope no caminho. O que você já sabia sobre esse encontro?";
  const more = " O texto mostra que Filipe obedeceu ao chamado de Deus, foi ao encontro do etíope e perguntou se ele entendia o que lia, a pergunta do nosso slogan.";
  return { ...baseTeacher, speech, display_markdown: speech + more, citations: [{ type: "bible", ref: "ACT.8.26", version_id: "por_blivre_2018" }], next_options: [{ label: "Ler Atos 8:26-40", intent: "read" }, { label: "Continuar", intent: "next" }] };
}
const port = Number(process.argv[2] ?? 4010);
const failRate = Number(process.env.MOCK_FAIL ?? 0.25);
const stats = { calls: 0, failed: 0, models: {}, lastSystem: "" };

function sectionContent(prompt) {
  const changed = prompt.includes("A PESSOA PEDIU ESTA MUDANÇA") ? " (versão ajustada)" : "";
  // the request is the last line of the user message: take the LAST "seção X" (the rules mention the word earlier)
  const sec = [...prompt.matchAll(/(?:Proponha|Escreva|Reescreva) (?:a )?(?:seção|divisão) "?(\w+)"?/g)].pop()?.[1] ?? "";
  const ids = (re) => [...prompt.matchAll(re)].map((m) => m[1]);
  if (/Proponha a divisão número|Reescreva a divisão/.test(prompt) || sec === "division") return { title: "Divisão do texto" + changed, texts: ["ACT.8.26"], explanation: "Explicação baseada no texto." + changed, illustration: "Uma ilustração simples.", application: "Aplicação prática." };
  switch (sec) {
    case "objective": return ["Reconhecer a iniciativa de Deus" + changed, "Aplicar o exemplo de Filipe"];
    case "icebreaker": return "Quem já explicou algo difícil a alguém?" + changed;
    case "context": return "Contexto histórico e literário do texto." + changed;
    case "points": return [1, 2, 3].map((n) => ({ title: `Ponto ${n}`, verses: ["ACT.8.26"], explanation: "Explicação." + changed, illustration: "Ilustração." }));
    case "dynamic": return "Dinâmica em duplas." + changed;
    case "questions": return ["Pergunta 1?", "Pergunta 2?", "Pergunta 3?", "Pergunta 4?"];
    case "application": return "Aplicação para a semana." + changed;
    case "memory_verse": return "ACT.8.30";
    case "central_idea": return "Deus envia a mensagem a quem a busca." + changed;
    case "introduction": return "Introdução com gancho." + changed;
    case "conclusion": return "Conclusão do esboço." + changed;
    case "appeal": return "Apelo final." + changed;
    case "overview": return "Resumo do texto." + changed;
    case "structure": return [{ title: "A ordem", refs: ["ACT.8.26-ACT.8.29"], summary: "Resumo." }, { title: "O encontro", refs: ["ACT.8.30-ACT.8.35"], summary: "Resumo." }, { title: "O batismo", refs: ["ACT.8.36-ACT.8.40"], summary: "Resumo." }];
    case "keywords": return ids(/\[(w\d+)\]/g).slice(0, 4).map((id) => ({ id, note: "O que a palavra acrescenta." }));
    case "history": return ids(/\[(h\d+)\]/g).slice(0, 2).map((id) => ({ era: "Época", summary: "Como esta obra lê o texto.", excerpt: id }));
    case "traditions": return ids(/\[(e\d+)\]/g).slice(0, 2).map((id) => ({ tradition: "geral", reading: "Como esta obra lê o texto.", excerpt: id }));
    default: return "texto";
  }
}

const baseTeacher = { speech: "Entendi o seu pedido, vamos seguir juntos. O que você quer ver agora?", display_markdown: "", citations: [], visuals: [], next_options: [{ label: "Continuar", intent: "next" }], lens_divergence: { present: false, summary: null }, pastoral_flag: false, level_signal: "same", mode_payload: null };

createServer((req, res) => {
  if (req.url === "/stats") { res.end(JSON.stringify(stats)); return; }
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    stats.calls++;
    let j = {};
    try { j = JSON.parse(body); } catch { /* ignore */ }
    stats.models[j.model] = (stats.models[j.model] ?? 0) + 1;
    if (Math.random() < failRate) {
      stats.failed++;
      const rate = Math.random() < 0.7;
      res.writeHead(rate ? 429 : 500, { "retry-after": "2", "content-type": "application/json" });
      res.end(JSON.stringify({ error: { message: rate ? "Rate limit reached per minute" : "mock server error" } }));
      return;
    }
    const prompt = (j.messages ?? []).map((m) => m.content).join("\n");
    stats.lastSystem = (j.messages ?? []).filter((m) => m.role === "system").map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content))).join("\n").slice(0, 60000);
    const delay = 150 + Math.random() * 350;
    setTimeout(() => {
      res.writeHead(200, { "content-type": "application/json" });
      if (prompt.includes("analisa o ensaio de um sermão")) {
        // rehearsal analysis: place the outline parts one after another over the transcript segments
        const n = (prompt.match(/^\[\d+\|/gm) ?? []).length;
        const keys = [...prompt.matchAll(/"((?:introduction|division-\d+|conclusion|appeal))" =/g)].map((m) => m[1]);
        const per = Math.max(1, Math.floor(n / Math.max(1, keys.length)));
        const parts = keys.map((part, i) => ({ part, from: Math.min(n - 1, i * per), to: Math.min(n - 1, i === keys.length - 1 ? n - 1 : (i + 1) * per - 1) }));
        res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ feedback: { central_idea: { stated_early: true, clarity: 4, comment: "A ideia central aparece logo no começo e volta na conclusão." }, transitions: { score: 3, comment: "Você avisa a passagem entre os pontos, mas pode usar uma frase-ponte." }, illustrations: { used: ["O guia que espera no caminho"], comment: "A ilustração ajuda o primeiro ponto; falta uma para o segundo." }, fidelity: { score: 5, comment: "O que você disse confere com o texto de Atos 8.", issues: [] }, strengths: ["Ideia central clara.", "Boa fidelidade ao texto.", "Conclusão com aplicação."], improvements: [{ what: "Menos hesitações.", how: "Troque o 'né' por uma pausa curta." }, { what: "Mais uma ilustração.", how: "Dê um exemplo do dia a dia no segundo ponto." }] }, parts }) } }] }));
        return;
      }
      if (j.tools) res.end(JSON.stringify({ choices: [{ message: { tool_calls: [{ function: { arguments: JSON.stringify(teacherFor(j.messages)) } }] } }] }));
      else res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ content: sectionContent(prompt) }) } }] }));
    }, delay);
  });
}).listen(port, () => console.log("mock llm on", port));
