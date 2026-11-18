import { describe, expect, it } from "vitest";
import { ageOn, ageStatus } from "@/lib/auth/age";

const today = new Date("2026-11-18T12:00:00");

describe("age rules", () => {
  it("computes age with birthdays not yet reached", () => {
    expect(ageOn("2013-11-18", today)).toBe(13);
    expect(ageOn("2013-11-19", today)).toBe(12);
    expect(ageOn("2008-11-19", today)).toBe(17);
    expect(ageOn("2008-11-18", today)).toBe(18);
  });
  it("blocks under 13, asks guardian awareness for 13-17, lets adults through", () => {
    expect(ageStatus("2014-01-01", today)).toBe("too_young");
    expect(ageStatus("2013-11-18", today)).toBe("minor_needs_guardian");
    expect(ageStatus("2009-05-05", today)).toBe("minor_needs_guardian");
    expect(ageStatus("2008-11-18", today)).toBe("adult");
    expect(ageStatus("1980-03-02", today)).toBe("adult");
  });
  it("rejects invalid dates", () => {
    expect(ageStatus("", today)).toBe("invalid");
    expect(ageStatus("2030-01-01", today)).toBe("invalid");
    expect(ageStatus("1800-01-01", today)).toBe("invalid");
    expect(ageStatus("31/12/1990", today)).toBe("invalid");
  });
});
