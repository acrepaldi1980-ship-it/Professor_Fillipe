import { describe, expect, it } from "vitest";
import { checkLicense, cutoffs } from "@/lib/knowledge/licenses";

describe("license gate", () => {
  it("computes cutoffs from the current year", () => {
    expect(cutoffs(2026)).toEqual({ brazilDeathYear: 1955, usPubYear: 1931 });
    expect(cutoffs(2027)).toEqual({ brazilDeathYear: 1956, usPubYear: 1932 });
  });
  it("accepts open licenses", () => {
    for (const l of ["cc0", "cc_by", "cc_by_sa"]) expect(checkLicense({ license: l }, 2026).ok).toBe(true);
  });
  it("accepts old public domain works and rejects recent ones", () => {
    expect(checkLicense({ license: "public_domain", pub_year: 1611, author_death_years: [] }, 2026).ok).toBe(true);
    expect(checkLicense({ license: "public_domain", pub_year: 1931, author_death_years: [1955] }, 2026).ok).toBe(true);
    expect(checkLicense({ license: "public_domain", pub_year: 1932 }, 2026).ok).toBe(false);
    expect(checkLicense({ license: "public_domain", pub_year: 1900, author_death_years: [1960] }, 2026).ok).toBe(false);
    expect(checkLicense({ license: "public_domain" }, 2026).ok).toBe(false);
  });
  it("moves the cutoff forward with the year", () => {
    expect(checkLicense({ license: "public_domain", pub_year: 1932 }, 2026).ok).toBe(false);
    expect(checkLicense({ license: "public_domain", pub_year: 1932 }, 2027).ok).toBe(true);
  });
  it("rejects NC, ND, unknown and uncontracted licensed works", () => {
    for (const l of ["cc_by_nc", "cc_by_nd", "cc_by_nc_sa", "unknown", ""]) expect(checkLicense({ license: l }, 2026).ok).toBe(false);
    expect(checkLicense({ license: "licensed" }, 2026).ok).toBe(false);
    expect(checkLicense({ license: "licensed", contract_confirmed: true }, 2026).ok).toBe(true);
  });
});
