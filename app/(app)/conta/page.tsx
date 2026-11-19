"use client";

// Account: appearance (theme, text size up to 200%), privacy (revoke religious-data consent, RF-M02-02),
// sign out and delete account with double confirmation (RF-M01-03).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { deleteAccount, getLenses, getMe, saveConsent, saveLensesApi, type MeResponse } from "@/lib/api-client";
import { signOut } from "@/lib/auth/client";
import { t } from "@/lib/i18n";
import { getPlatform } from "@/lib/platform";
import { applyPrefs, DEFAULT_PREFS, loadPrefs, savePrefs, type Prefs, type Theme } from "@/lib/prefs";

export default function AccountPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [lenses, setLenses] = useState<{ chosen: string[]; available: string[] }>({ chosen: [], available: [] });
  const [voices, setVoices] = useState<{ name: string; lang: string }[]>([]);

  useEffect(() => {
    void getMe().then(setMe);
    void getLenses().then((r) => setLenses({ chosen: r.lenses, available: r.available })).catch(() => undefined);
    void loadPrefs().then(setPrefs);
    void getPlatform().speech.voices().then(setVoices);
  }, []);

  const update = (p: Prefs) => {
    setPrefs(p);
    applyPrefs(p);
    void savePrefs(p);
  };

  const religious = !!me?.consents.sensitive_religious?.granted;

  async function toggleReligious() {
    await saveConsent("sensitive_religious", !religious);
    setMe(await getMe());
  }

  async function logout() {
    await signOut();
    router.replace("/");
  }

  async function remove() {
    setBusy(true);
    setError(false);
    try {
      await deleteAccount();
      await signOut();
      router.replace("/");
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-2xl">{t("account.title")}</h1>

      <Card className="flex flex-col gap-1">
        <span className="text-sm text-muted">{t("account.email")}</span>
        <span>{me?.user.email}</span>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg">{t("account.appearance")}</h2>
        <div role="radiogroup" aria-label={t("account.theme")} className="flex gap-2">
          {(["auto", "light", "dark"] as Theme[]).map((th) => (
            <button key={th} type="button" role="radio" aria-checked={prefs.theme === th} onClick={() => update({ ...prefs, theme: th })} className={`min-h-11 flex-1 rounded-control border border-line ${prefs.theme === th ? "bg-primary text-primary-ink" : "bg-surface"}`}>
              {t(`account.theme.${th}` as "account.theme.auto")}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">{t("account.font")}: {Math.round(prefs.fontScale * 100)}%</span>
          <input type="range" min={1} max={2} step={0.1} value={prefs.fontScale} onChange={(e) => update({ ...prefs, fontScale: Number(e.target.value) })} />
        </label>
      </Card>

      {lenses.available.length > 0 && (
        <Card className="flex flex-col gap-3">
          <h2 className="text-lg">{t("account.lenses")}</h2>
          <p className="text-sm text-muted">{me?.consents.sensitive_religious?.granted ? t("account.lenses.help") : t("account.lenses.consent")}</p>
          <div className="flex flex-wrap gap-2">
            {lenses.available.map((l) => {
              const on = lenses.chosen.includes(l);
              return (
                <button
                  key={l}
                  type="button"
                  aria-pressed={on}
                  disabled={!me?.consents.sensitive_religious?.granted || (!on && lenses.chosen.length >= 3)}
                  className={`min-h-11 rounded-control border px-3 text-sm ${on ? "border-primary bg-primary text-primary-ink" : "border-line"}`}
                  onClick={() => {
                    const next = on ? lenses.chosen.filter((x) => x !== l) : [...lenses.chosen, l];
                    setLenses({ ...lenses, chosen: next });
                    void saveLensesApi(next);
                  }}
                >
                  {t(`lens.${l}` as "lens.pentecostal")}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {voices.length > 0 && (
        <Card className="flex flex-col gap-3">
          <h2 className="text-lg">{t("account.voice")}</h2>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">{t("account.voice.help")}</span>
            <select className="h-12 rounded-control border border-line bg-surface px-3" value={prefs.voiceName ?? ""} onChange={(e) => update({ ...prefs, voiceName: e.target.value || null })}>
              <option value="">{t("account.voice.auto")}</option>
              {voices.map((v) => (
                <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
              ))}
            </select>
          </label>
          <Button type="button" variant="ghost" onClick={() => { getPlatform().speech.unlock(); getPlatform().speech.cancel(); void getPlatform().speech.speak(t("account.voice.sample"), { voiceName: prefs.voiceName }); }}>{t("account.voice.test")}</Button>
        </Card>
      )}

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg">{t("account.privacy")}</h2>
        <Button type="button" variant="ghost" onClick={() => void toggleReligious()}>
          {religious ? t("account.religious.on") : t("account.religious.off")}
        </Button>
      </Card>

      <Button type="button" variant="ghost" onClick={() => void logout()}>{t("account.logout")}</Button>
      <Button type="button" variant="danger" onClick={() => setConfirming(true)}>{t("account.delete")}</Button>

      {confirming && (
        <Modal title={t("account.delete.title")} onClose={() => setConfirming(false)}>
          <p className="mb-3">{t("account.delete.body")}</p>
          <Field id="confirm" label="EXCLUIR" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          {error && <div className="mt-2"><Toast>{t("consent.error")}</Toast></div>}
          <div className="mt-3 flex gap-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={() => setConfirming(false)}>{t("account.cancel")}</Button>
            <Button type="button" variant="danger" className="flex-1" disabled={typed !== "EXCLUIR" || busy} onClick={() => void remove()}>{t("account.delete.confirm")}</Button>
          </div>
        </Modal>
      )}
    </main>
  );
}
