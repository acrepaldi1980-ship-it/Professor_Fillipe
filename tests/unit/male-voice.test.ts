import { describe, expect, it } from "vitest";
import { isMaleVoice } from "../../lib/platform/web/speech";

describe("the teacher only speaks with male voices", () => {
  it("accepts the male Portuguese voices of current systems", () => {
    for (const name of ["Microsoft Antonio Online (Natural) - Portuguese (Brazil)", "Microsoft Daniel - Portuguese (Brazil)", "Felipe", "Ricardo", "Portuguese Brazil male"]) expect(isMaleVoice({ name }), name).toBe(true);
    expect(isMaleVoice({ name: "Google português do Brasil", voiceURI: "pt-br-x-ptd-network" })).toBe(true);
  });
  it("rejects female and unknown voices", () => {
    for (const name of ["Microsoft Francisca Online (Natural) - Portuguese (Brazil)", "Luciana", "Fernanda", "Maria", "Google português do Brasil", "Portuguese Brazil female", "Voz desconhecida"]) expect(isMaleVoice({ name }), name).toBe(false);
    expect(isMaleVoice({ name: "Google português do Brasil", voiceURI: "pt-br-x-afs-local" })).toBe(false);
  });
});
