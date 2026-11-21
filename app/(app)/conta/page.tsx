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
import { deleteAccount, exportMyData, getLenses, getMe, getNotificationPrefs, getRecentSessions, getReferral, registerPushDevice, saveConsent, saveLensesApi, saveNotificationPrefs, type MeResponse, type NotificationPrefs, type ReferralStatus } from "@/lib/api-client";
import Link from "next/link";
import { signOut } from "@/lib/auth/client";
import { t } from "@/lib/i18n";
import { getPlatform } from "@/lib/platform";
import { applyPrefs, DEFAULT_PREFS, loadPrefs, savePrefs, type Prefs, type Theme } from "@/lib/prefs";

function RemindersCard() {
  const [p, setP] = useState<NotificationPrefs | null>(null);
  const [eligible, setEligible] = useState(false); // spec 8.15: the permission is asked only after the first completed session
  const [msg, setMsg] = useState<string | null>(null);
  const push = getPlatform().push;
  useEffect(() => {
    void getNotificationPrefs().then(setP).catch(() => undefined);
    void getRecentSessions(20).then((r) => setEligible(r.sessions.some((x) => !!x.ended_at))).catch(() => undefined);
  }, []);
  if (!p || !push.isSupported()) return null;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";
  async function toggle(on: boolean) {
    setMsg(null);
    if (!on) { await saveNotificationPrefs({ enabled: false }); setP({ ...p!, enabled: false }); return; }
    const perm = await push.requestPermission();
    if (perm !== "granted") { setMsg(t("notify.denied")); return; }
    const key = p!.vapid_public_key;
    const sub = key ? await push.subscribe?.(key) : null;
    if (!sub) { setMsg(t("notify.unavailable")); return; }
    try { await registerPushDevice(JSON.parse(sub)); await saveNotificationPrefs({ enabled: true, tz }); setP({ ...p!, enabled: true, tz, devices: Math.max(1, p!.devices) }); setMsg(t("notify.on")); } catch { setMsg(t("notify.unavailable")); }
  }
  async function change(patch: Partial<NotificationPrefs>) { setP({ ...p!, ...patch }); await saveNotificationPrefs({ ...patch, tz }).catch(() => undefined); }
  const kinds = ["review", "path", "lesson", "trial"] as const;
  return (
    <Card className="flex flex-col gap-2" data-testid="reminders-card">
      <h2 className="text-lg">{t("notify.title")}</h2>
      <p className="text-sm text-muted">{t("notify.help")}</p>
      {!eligible && !p.enabled ? <p className="text-sm">{t("notify.after")}</p> : (
        <>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.enabled} onChange={(e) => void toggle(e.target.checked)} />{t("notify.enable")}</label>
          {p.enabled && (
            <>
              <label className="flex items-center gap-2 text-sm">{t("notify.hour")}
                <select value={p.hour} onChange={(e) => void change({ hour: Number(e.target.value) })} className="min-h-9 rounded-control border border-line bg-bg px-2">{Array.from({ length: 15 }, (_, i) => 7 + i).map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}</select></label>
              <div role="group" aria-label={t("notify.kinds")} className="flex flex-col gap-1 text-sm">{kinds.map((k) => <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={p.kinds[k]} onChange={(e) => void change({ kinds: { ...p.kinds, [k]: e.target.checked } })} />{t(`notify.kind.${k}` as "notify.kind.review")}</label>)}</div>
              <p className="text-xs text-muted">{t("notify.rules")}</p>
            </>
          )}
        </>
      )}
      {msg && <p role="status" className="text-sm">{msg}</p>}
    </Card>
  );
}

function ReferralCard() {
  const [r, setR] = useState<ReferralStatus | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { void getReferral().then(setR).catch(() => undefined); }, []);
  if (!r) return null;
  const link = `${window.location.origin}/?ind=${r.code}`;
  async function share() {
    const out = await getPlatform().share.share({ title: t("app.name"), text: t("referral.message"), url: link });
    setMsg(out === "copied" ? t("referral.copied") : null);
  }
  return (
    <Card className="flex flex-col gap-2" data-testid="referral-card">
      <h2 className="text-lg">{t("referral.title")}</h2>
      <p className="text-sm text-muted">{t("referral.help")}</p>
      <p className="text-sm">{t("referral.code")}: <strong data-testid="referral-code">{r.code}</strong></p>
      <div><Button type="button" onClick={() => void share()}>{t("referral.share")}</Button></div>
      <p className="text-xs text-muted">{t("referral.status").replace("{rewarded}", String(r.rewarded)).replace("{pending}", String(r.pending)).replace("{days}", String(r.days_earned))}</p>
      {msg && <p role="status" className="text-sm">{msg}</p>}
    </Card>
  );
}

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
  const [voicesLoaded, setVoicesLoaded] = useState(false);

  useEffect(() => {
    void getMe().then(setMe);
    void getLenses().then((r) => setLenses({ chosen: r.lenses, available: r.available })).catch(() => undefined);
    void loadPrefs().then(setPrefs);
    void getPlatform().speech.voices().then((v) => { setVoices(v); setVoicesLoaded(true); });
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

  async function download() {
    setBusy(true);
    setError(false);
    try {
      const blob = await exportMyData();
      await getPlatform().files.save("meus-dados-professor-filipe.json", blob);
    } catch {
      setError(true);
    }
    setBusy(false);
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

      {voices.length === 0 && voicesLoaded && (
        <Card className="flex flex-col gap-2" role="status">
          <h2 className="text-lg">{t("account.voice.nomale")}</h2>
          <p className="text-sm text-muted">{t("account.voice.nomale.help")}</p>
        </Card>
      )}

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg">{t("account.privacy")}</h2>
        <Button type="button" variant="ghost" onClick={() => void toggleReligious()}>
          {religious ? t("account.religious.on") : t("account.religious.off")}
        </Button>
      </Card>

      <RemindersCard />
      <ReferralCard />
      <Card className="flex flex-col gap-2">
        <h2 className="text-lg">{t("church.title")}</h2>
        <Link href="/igreja" className="rounded-control border border-line p-3"><strong>{t("church.title")}</strong><span className="block text-sm text-muted">{t("church.help")}</span></Link>
      </Card>

      <Card className="flex flex-col gap-2">
        <h2 className="text-lg">{t("account.sub")}</h2>
        <Link href="/assinatura" className="rounded-control border border-line p-3"><strong>{t("account.sub")}</strong><span className="block text-sm text-muted">{t("account.sub.help")}</span></Link>
        <Link href="/planos" className="rounded-control border border-line p-3"><strong>{t("account.plans")}</strong></Link>
      </Card>

      {(me?.profile?.role === "admin" || me?.profile?.role === "reviewer") && (
        <Card className="flex flex-col gap-2">
          <h2 className="text-lg">{t("account.admin")}</h2>
          <Link href="/admin" className="rounded-control border border-line p-3"><strong>{t("admin.hub.title")}</strong><span className="block text-sm text-muted">{t("admin.hub.help")}</span></Link>
          <Link href="/admin/notas" className="rounded-control border border-line p-3"><strong>{t("account.admin.notes")}</strong><span className="block text-sm text-muted">{t("account.admin.notes.help")}</span></Link>
          {me.profile.role === "admin" && <Link href="/admin/assinaturas" className="rounded-control border border-line p-3"><strong>{t("admin.billing.title")}</strong></Link>}
          {me.profile.role === "admin" && <Link href="/admin/biblioteca" className="rounded-control border border-line p-3"><strong>{t("account.admin.library")}</strong><span className="block text-sm text-muted">{t("account.admin.library.help")}</span></Link>}
        </Card>
      )}

      <Card className="flex flex-col gap-2">
        <h2 className="text-lg">{t("account.export")}</h2>
        <p className="text-sm text-muted">{t("account.export.help")}</p>
        <Button type="button" variant="ghost" disabled={busy} onClick={() => void download()}>{t("account.export")}</Button>
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
