// License gate (spec 8.10.9). A work only gets enabled if it passes this check.
export type License = "public_domain" | "cc0" | "cc_by" | "cc_by_sa" | "licensed";

export interface LicenseInput {
  license: License | string;
  pub_year?: number | null;
  author_death_years?: number[];
  /** True only after a human confirmed a signed/contracted license (kind "licensed"). */
  contract_confirmed?: boolean;
}

export interface LicenseResult {
  ok: boolean;
  reason: string;
}

/** Cutoffs move forward on every January 1st: Brazil = year - 71, USA = year - 95. */
export function cutoffs(year = new Date().getFullYear()) {
  return { brazilDeathYear: year - 71, usPubYear: year - 95 };
}

export function checkLicense(w: LicenseInput, year = new Date().getFullYear()): LicenseResult {
  const { brazilDeathYear, usPubYear } = cutoffs(year);
  switch (w.license) {
    case "cc0":
    case "cc_by":
    case "cc_by_sa":
      return { ok: true, reason: `open license ${w.license}` };
    case "public_domain": {
      if (w.pub_year == null) return { ok: false, reason: "public domain without publication year: manual review" };
      if (w.pub_year > usPubYear) return { ok: false, reason: `published ${w.pub_year}, after US cutoff ${usPubYear}` };
      const late = (w.author_death_years ?? []).filter((y) => y > brazilDeathYear);
      if (late.length) return { ok: false, reason: `author/translator died ${late.join(",")}, after Brazil cutoff ${brazilDeathYear}` };
      return { ok: true, reason: `public domain (pub ${w.pub_year} <= ${usPubYear}; deaths <= ${brazilDeathYear})` };
    }
    case "licensed":
      return w.contract_confirmed ? { ok: true, reason: "contracted license" } : { ok: false, reason: "licensed work without confirmed contract" };
    default:
      // NC, ND, unknown or missing: manual review queue, never enters.
      return { ok: false, reason: `license "${w.license}" not allowed (NC/ND/unknown): manual review` };
  }
}
