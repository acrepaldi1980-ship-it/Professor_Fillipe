// Advanced Bible study endpoints under one function (the Vercel Hobby plan allows at most 12 serverless functions per deployment):
//   GET  /api/v1/bible/study/interlinear/:ref   GET /api/v1/bible/study/word/:strong
//   GET  /api/v1/bible/study/compare            POST /api/v1/bible/study/compare/explain
import { GET as compare } from "@/lib/knowledge/study-routes/compare";
import { POST as explain } from "@/lib/knowledge/study-routes/explain";
import { GET as interlinear } from "@/lib/knowledge/study-routes/interlinear";
import { GET as word } from "@/lib/knowledge/study-routes/word";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ path: string[] }> };
const notFound = () => Response.json({ error: "not_found" }, { status: 404 });

export async function GET(req: Request, ctx: Ctx) {
  const [kind, arg] = (await ctx.params).path;
  if (kind === "compare" && !arg) return compare(req);
  if (kind === "interlinear" && arg) return interlinear(req, { params: Promise.resolve({ ref: arg }) });
  if (kind === "word" && arg) return word(req, { params: Promise.resolve({ strong: arg }) });
  return notFound();
}

export async function POST(req: Request, ctx: Ctx) {
  const p = (await ctx.params).path;
  if (p[0] === "compare" && p[1] === "explain") return explain(req);
  return notFound();
}
