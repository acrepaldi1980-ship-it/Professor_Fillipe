// Referral endpoints (Prompt 2.7), served by the /api/v1/study/[...path] function:
//   GET  /study/referral          -> my code and status (and, if I came through a code, settles the reward once I have studied on 2 days)
//   POST /study/referral/claim    -> { code }: records that I arrived through someone's code
import { z } from "zod";
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";

export async function referralGet(req: Request) {
  try {
    const { db } = await requireUser(req);
    const settled = await db.rpc("referral_settle");
    const code = await db.rpc("referral_my_code");
    if (code.error) throw new HttpError(500, "referral_failed");
    const status = await db.rpc("referral_status");
    return Response.json({ ...(status.data as object), code: code.data, settled: (settled.data as { settled?: boolean; friend_days?: number } | null) ?? { settled: false } });
  } catch (e) {
    return errorResponse(e);
  }
}

const claimBody = z.object({ code: z.string().trim().min(4).max(12).regex(/^[A-Za-z0-9]+$/) });
export async function referralClaim(req: Request) {
  try {
    const { db } = await requireUser(req);
    const parsed = claimBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "invalid_request");
    const { data, error } = await db.rpc("referral_claim", { p_code: parsed.data.code });
    if (error) throw new HttpError(500, "claim_failed");
    return Response.json({ result: data as string }, { status: data === "ok" ? 201 : 200 });
  } catch (e) {
    return errorResponse(e);
  }
}
