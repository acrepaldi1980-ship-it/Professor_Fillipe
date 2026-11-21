// Study tools under one function (the Vercel Hobby plan allows at most 12 serverless functions per deployment):
//   GET  /api/v1/study/interlinear/:ref   GET /api/v1/study/word/:strong
//   GET  /api/v1/study/compare            POST /api/v1/study/compare/explain
//   GET/POST/DELETE /api/v1/study/rehearsals  (Ensaio do sermão)
import { GET as compare } from "@/lib/knowledge/study-routes/compare";
import { POST as explain } from "@/lib/knowledge/study-routes/explain";
import { GET as interlinear } from "@/lib/knowledge/study-routes/interlinear";
import { GET as word } from "@/lib/knowledge/study-routes/word";
import { analyze, listOrGet, remove } from "@/lib/rehearsal/handler";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ path: string[] }> };
const notFound = () => Response.json({ error: "not_found" }, { status: 404 });

export async function GET(req: Request, ctx: Ctx) {
  const [kind, arg] = (await ctx.params).path;
  if (kind === "compare" && !arg) return compare(req);
  if (kind === "interlinear" && arg) return interlinear(req, { params: Promise.resolve({ ref: arg }) });
  if (kind === "word" && arg) return word(req, { params: Promise.resolve({ strong: arg }) });
  if (kind === "rehearsals" && !arg) return listOrGet(req);
  return notFound();
}

export async function POST(req: Request, ctx: Ctx) {
  const p = (await ctx.params).path;
  if (p[0] === "compare" && p[1] === "explain") return explain(req);
  if (p[0] === "rehearsals" && !p[1]) return analyze(req);
  return notFound();
}

export async function DELETE(req: Request, ctx: Ctx) {
  const p = (await ctx.params).path;
  if (p[0] === "rehearsals" && !p[1]) return remove(req);
  return notFound();
}
