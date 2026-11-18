// Real dependencies for the teacher pipeline (server only).
import { getDb, lit, litArray } from "../knowledge/db";
import { getVerses, searchChunks } from "../knowledge/search";
import { AnthropicTeacherLlm } from "./anthropic";
import type { TurnDeps } from "./pipeline";

export function createTurnDeps(): TurnDeps {
  return {
    llm: new AnthropicTeacherLlm(),
    search: (q, opts) => searchChunks(q, opts),
    getVerses: (versionId, refs) => getVerses(versionId, refs),
    async existingVerses(versionId, refs) {
      if (!refs.length) return new Set<string>();
      const rows = await getDb().query<{ ref: string }>(
        `select ref from bible_verses where version_id = ${lit(versionId)} and ref = any (${litArray(refs)})`,
      );
      return new Set(rows.map((r) => r.ref));
    },
  };
}
