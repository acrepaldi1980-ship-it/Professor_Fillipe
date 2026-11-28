"use client";

// Study setup (M04): theological lens (up to 3, with consent), main Bible version. Everything is editable later in Conta.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/teacher/Avatar";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { getLenses, getMe, saveLensesApi, saveVersions, type BibleVersionInfo } from "@/lib/api-client";
import { defaultBibleVersion, getLanguage, LANG_INFO, t } from "@/lib/i18n";

export default function SetupPage() {
  const router = useRouter();
  const [lenses, setLenses] = useState<string[]>([]);
  const [available, setAvailable] = useState<string[]>([]);
  const [versions, setVersions] = useState<BibleVersionInfo[]>([]);
  const [main, setMain] = useState("por_blivre_2018");
  const [suggested, setSuggested] = useState("por_blivre_2018");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    void Promise.all([getMe(), getLenses()]).then(([me, p]) => {
      setConsent(!!me.consents.sensitive_religious?.granted);
      setLenses(p.lenses);
      setAvailable(p.available);
      setVersions(p.versions.filter((v) => (getLanguage() === "pt-BR" ? v.language === "pt" || v.language === "por" : v.language === LANG_INFO[getLanguage()].short)));
      // RF-M04-02: Bíblia Livre for adults; Nova Bíblia Viva Open for beginners and minors.
      const beginner = me.profile?.level === "iniciante" || me.profile?.is_minor;
      const langDefault = defaultBibleVersion();
      const pick = getLanguage() !== "pt-BR" && p.versions.some((v) => v.id === langDefault) ? langDefault : beginner && p.versions.some((v) => v.id === "por_nbv_open") ? "por_nbv_open" : "por_blivre_2018";
      setSuggested(pick);
      setMain(p.main_version_id && p.main_version_id !== "por_blivre_2018" ? p.main_version_id : pick);
    }).catch(() => setError(true));
  }, []);

  async function save() {
    setBusy(true);
    setError(false);
    try {
      if (consent) await saveLensesApi(lenses);
      await saveVersions(main, []);
      router.replace("/onboarding/boas-vindas");
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-4 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center gap-3 pt-2"><Avatar state="happy" size={64} /><div><h1 className="text-2xl">{t("setup.title")}</h1><p className="text-sm text-muted">{t("setup.help")}</p></div></div>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg">{t("setup.lens.title")}</h2>
        {consent ? <p className="text-sm text-muted">{t("setup.lens.help")}</p> : <p className="text-sm text-muted">{t("setup.lens.noconsent")}</p>}
        <div className="flex flex-col gap-2">
          {available.map((l) => {
            const on = lenses.includes(l);
            return (
              <button key={l} type="button" aria-pressed={on} disabled={!consent || (!on && lenses.length >= 3)} className={`rounded-control border p-3 text-left disabled:opacity-60 ${on ? "border-primary bg-primary text-primary-ink" : "border-line bg-surface"}`} onClick={() => setLenses(on ? lenses.filter((x) => x !== l) : [...lenses, l])}>
                <strong>{t(`lens.${l}` as "lens.pentecostal")}</strong>
                <span className="block text-sm opacity-90">{t(`lensx.${l}` as "lensx.pentecostal")}</span>
              </button>
            );
          })}
          <button type="button" aria-pressed={lenses.length === 0} className={`rounded-control border p-3 text-left ${lenses.length === 0 ? "border-primary bg-primary text-primary-ink" : "border-line bg-surface"}`} onClick={() => setLenses([])}>{t("setup.lens.none")}</button>
        </div>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg">{t("setup.version.title")}</h2>
        <select aria-label={t("setup.version.main")} className="h-12 rounded-control border border-line bg-surface px-3" value={main} onChange={(e) => setMain(e.target.value)}>
          {versions.map((v) => <option key={v.id} value={v.id}>{v.name}{v.id === suggested ? ` (${t("setup.version.suggest")})` : ""}</option>)}
        </select>
      </section>
      {error && <Toast>{t("consent.error")}</Toast>}
      <Button type="button" disabled={busy} onClick={() => void save()}>{busy ? t("setup.saving") : t("setup.continue")}</Button>
    </main>
  );
}
