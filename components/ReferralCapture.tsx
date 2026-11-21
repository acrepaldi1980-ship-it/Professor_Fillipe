"use client";

// Remembers the referral code of a link like https://app/?ind=ABC1234 until the new student has an account (Prompt 2.7). Stored with lib/platform.
import { useEffect } from "react";
import { getPlatform } from "@/lib/platform";

export const REFERRAL_KEY = "pf-ref";

export function ReferralCapture() {
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("ind");
    if (code && /^[A-Za-z0-9]{4,12}$/.test(code)) void getPlatform().store.set(REFERRAL_KEY, code.toUpperCase());
  }, []);
  return null;
}
