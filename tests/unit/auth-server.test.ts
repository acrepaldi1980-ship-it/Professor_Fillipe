import { beforeEach, describe, expect, it, vi } from "vitest";

const getClaims = vi.fn();
const getUser = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: { getClaims, getUser } }) }));

import { requireUser, requireUserStrict } from "@/lib/auth/server";

const req = (token?: string) => new Request("https://x.test/api/v1/me", { headers: token ? { Authorization: `Bearer ${token}` } : {} });

describe("requireUser", () => {
  beforeEach(() => { getClaims.mockReset(); getUser.mockReset(); process.env.NEXT_PUBLIC_SUPABASE_URL = "https://p.supabase.co"; process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "k"; });

  it("verifies the token locally and does not call the auth server", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1", email: "a@b.c", role: "authenticated" } }, error: null });
    const ctx = await requireUser(req("tok"));
    expect(ctx.user.id).toBe("u1");
    expect(ctx.user.email).toBe("a@b.c");
    expect(getUser).not.toHaveBeenCalled();
  });
  it("refuses a request with no token", async () => {
    await expect(requireUser(req())).rejects.toMatchObject({ status: 401 });
  });
  it("refuses the project's own anon key (a valid token, but not a person)", async () => {
    getClaims.mockResolvedValue({ data: { claims: { role: "anon" } }, error: null });
    getUser.mockResolvedValue({ data: { user: null }, error: { message: "no" } });
    await expect(requireUser(req("anon-key"))).rejects.toMatchObject({ status: 401 });
  });
  it("falls back to the auth server when the local check cannot decide", async () => {
    getClaims.mockResolvedValue({ data: null, error: { message: "unsupported" } });
    getUser.mockResolvedValue({ data: { user: { id: "u2" } }, error: null });
    expect((await requireUser(req("tok"))).user.id).toBe("u2");
  });
  it("the strict variant always asks the auth server (a deleted user is refused at once)", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1", role: "authenticated" } }, error: null });
    getUser.mockResolvedValue({ data: { user: null }, error: { message: "User from sub claim in JWT does not exist" } });
    await expect(requireUserStrict(req("tok"))).rejects.toMatchObject({ status: 401 });
    expect(getUser).toHaveBeenCalled();
  });
});
