import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const vec = `[${Array.from({ length: 384 }, () => (Math.random() - 0.5) * 0.1).join(",")}]`;
const time = async (name, f) => { const t = Date.now(); const { error, data } = await f(); console.log(name.padEnd(22), Date.now() - t, "ms", error ? "ERR " + error.message.slice(0, 60) : `rows=${Array.isArray(data) ? data.length : "-"}`); };
for (let i = 0; i < 3; i++) {
  await time("verses (tiny rpc)", () => sb.rpc("api_bible_verses", { p_version: "por_blivre_2018", p_refs: ["JHN.3.16"], p_chapters: [] }));
  await time("search semantic+fts", () => sb.rpc("api_search_chunks", { q_embedding: vec, q_text: "graça de Deus", q_refs: [], match_per_signal: 24, allowed_work_ids: null }));
}
