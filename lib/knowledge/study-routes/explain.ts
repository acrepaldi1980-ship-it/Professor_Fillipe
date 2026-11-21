// POST { ref, versions } -> why the versions read differently, explained from the version texts and the original words only (RA-09). Login required (uses AI).
import { z } from "zod";
import { createHash } from "node:crypto";
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { completeJson } from "@/lib/llm/router";
import { getInterlinear } from "@/lib/knowledge/word-study";
import { getVerses } from "@/lib/knowledge/search";
import { enforceRate, LIMITS } from "@/lib/security/rate-limit";

const body = z.object({ ref: z.string().regex(/^[A-Z0-9]{3}\.\d+\.\d+$/), versions: z.array(z.string().regex(/^[a-z]{3}_[a-z0-9_]+$/)).min(2).max(4) });
const cache = new Map<string, unknown>();

export async function POST(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    await enforceRate(db, `u:${user.id}:turn`, LIMITS.turn);
    const p = body.safeParse(await req.json().catch(() => null));
    if (!p.success) throw new HttpError(400, "invalid_request");
    const key = createHash("sha1").update(`${p.data.ref}|${[...p.data.versions].sort().join(",")}`).digest("hex");
    if (cache.has(key)) return Response.json(cache.get(key));
    const [rows, words] = await Promise.all([Promise.all(p.data.versions.map(async (v) => ({ v, rows: await getVerses(v, [p.data.ref]).catch(() => []) }))), getInterlinear(p.data.ref).catch(() => [])]);
    const texts = rows.filter((r) => r.rows[0]).map((r) => `[${r.v}] ${r.rows[0].text}`);
    if (texts.length < 2) throw new HttpError(404, "not_found");
    const original = words.map((w) => `${w.surface} (${w.translit ?? ""}; ${w.strong ?? ""}; "${w.gloss ?? ""}"; ${w.morphPt?.text ?? ""})`).join(" | ");
    const system = 'Você é o Professor Filipe. Explique, em português simples, POR QUE as versões da Bíblia abaixo leem o mesmo versículo de modos diferentes. Use APENAS os textos das versões e as palavras do original fornecidos; não invente nada, não cite autores nem datas. Não declare uma versão "certa". Responda SOMENTE com JSON: {"summary":"2 frases","points":[{"difference":"o que muda, citando as palavras","reason":"a razão ligada ao original (palavra, tempo verbal, ordem) ou ao estilo da tradução"}]} com no máximo 4 pontos.';
    const r = await completeJson(system, `Versículo ${p.data.ref}\n\nVERSÕES:\n${texts.join("\n")}\n\nORIGINAL (forma; transliteração; Strong; sentido; morfologia):\n${original.slice(0, 2500)}`, { task: "json", maxTokens: 1100, temperature: 0.3, timeoutMs: 40000, validate: (o) => !!o && typeof (o as { summary?: unknown }).summary === "string" && Array.isArray((o as { points?: unknown }).points) });
    const out = { ref: p.data.ref, versions: p.data.versions, ...(r.out as object), source: "Versões da Bíblia do acervo e STEPBible (CC BY 4.0). Explicação gerada por IA a partir desses textos." };
    cache.set(key, out);
    if (cache.size > 200) cache.delete(cache.keys().next().value as string);
    return Response.json(out);
  } catch (e) {
    return errorResponse(e);
  }
}
