const key = process.env.GROQ_API_KEY;
const models = ["openai/gpt-oss-20b", "openai/gpt-oss-120b", "llama-3.1-8b-instant", "llama-3.3-70b-versatile", "qwen/qwen3-32b"];
for (const m of models) {
  for (let i = 0; i < 2; i++) {
    const t = Date.now();
    const body = { model: m, messages: [{ role: "system", content: "Responda SOMENTE JSON {\"en\": string, \"refs\": string[]}: reescreva a pergunta em palavras-chave em inglês e passagens bíblicas." }, { role: "user", content: "O que significa graça na Bíblia?" }], max_tokens: 200, temperature: 0, response_format: { type: "json_object" }, ...(m.includes("gpt-oss") ? { reasoning_effort: "low" } : {}) };
    try {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
      const j = await r.json();
      console.log(m.padEnd(28), r.status, Date.now() - t, "ms", (j.choices?.[0]?.message?.content ?? JSON.stringify(j.error ?? "")).slice(0, 70).replace(/\n/g, " "));
    } catch (e) { console.log(m, "ERR", String(e).slice(0, 60)); }
  }
}
