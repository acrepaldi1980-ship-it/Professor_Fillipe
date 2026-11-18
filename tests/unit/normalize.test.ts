import { describe, expect, it } from "vitest";
import { normalizeRaw } from "@/lib/teacher/normalize";
import { teacherResponseSchema } from "@/lib/teacher/schema";

const base = { speech: "Barnabé foi um levita. Quer saber mais?", next_options: [{ label: "Sim", intent: "next" }, { label: "Não", intent: "stop" }] };
const parse = (citations: unknown) => teacherResponseSchema.safeParse(normalizeRaw({ ...base, citations }, "por_blivre_2018"));

describe("normalizeRaw (real outputs seen from the free model)", () => {
  it("turns a Bible window cited as 'bible' with only a chunk_id into a work citation", () => {
    const r = parse([{ chunk_id: "bible_por_blivre_2018:w:ACT.13.1", label: "Atos 13:1-5", type: "bible", version_id: "bible_por_blivre_2018" }]);
    expect(r.success).toBe(true);
    expect(r.data?.citations[0]).toMatchObject({ type: "work", work_id: "bible_por_blivre_2018", chunk_id: "bible_por_blivre_2018:w:ACT.13.1" });
  });

  it("derives work_id from the chunk id", () => {
    const r = parse([{ chunk_id: "easton_1897:463", label: "Barnabas", ref: "Barnabas", type: "work" }]);
    expect(r.success).toBe(true);
    expect(r.data?.citations[0]).toMatchObject({ type: "work", work_id: "easton_1897" });
  });

  it("parses a human-readable reference and fills the version", () => {
    const r = parse([{ type: "bible", ref: "Atos 13:1-5" }]);
    expect(r.success).toBe(true);
    expect(r.data?.citations[0]).toEqual({ type: "bible", ref: "ACT.13.1-ACT.13.5", version_id: "por_blivre_2018" });
  });

  it("trims field names with stray spaces (seen from the model)", () => {
    const r = parse([{ "chunk_id ": "bible_por_blivre_2018:w:ACT.11.21", "ref ": "Atos 11:21-25", type: "bible" }]);
    expect(r.success).toBe(true);
    expect(r.data?.citations[0]).toEqual({ type: "bible", ref: "ACT.11.21-ACT.11.25", version_id: "por_blivre_2018" });
  });

  it("drops citations that cannot be understood instead of rejecting the whole answer", () => {
    const r = parse([{ type: "bible", ref: "algo sem sentido" }, { label: "x" }, "texto", null]);
    expect(r.success).toBe(true);
    expect(r.data?.citations).toEqual([]);
  });

  it("tolerates null optional fields and missing visuals", () => {
    const r = teacherResponseSchema.safeParse(normalizeRaw({ ...base, visuals: null, avatar_cue: null, citations: null }, "por_blivre_2018"));
    expect(r.success).toBe(true);
  });
});
