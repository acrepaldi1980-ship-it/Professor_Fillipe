"use client";

// Plano Igreja (spec 8.13, J08): the church administrator registers the church and its classes (invite by link and QR Code), the EBD teacher
// publishes the lesson of the week and sees AGGREGATE numbers only, the student joins with a code and sees the privacy notice.
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { createChurch, createClass, deleteLesson, getClassLessons, getClassStats, getMyChurches, joinChurch, leaveChurch, publishLesson, saveChurchSettings, startChurchCheckout, type ChurchClass, type ClassStats, type MyChurch } from "@/lib/api-client";
import { t } from "@/lib/i18n";
import { getPlatform } from "@/lib/platform";

const PLANS = ["church_30", "church_100", "church_300"] as const;
const LENSES = ["pentecostal", "baptist", "reformed", "catholic", "orthodox", "general"] as const;
const origin = () => (typeof window === "undefined" ? "" : window.location.origin);
const inviteUrl = (code: string) => `${origin()}/entrar?c=${code}`;

function Qr({ url, name }: { url: string; name: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => { void import("qrcode").then((q) => q.toDataURL(url, { margin: 1, width: 180 })).then(setSrc).catch(() => undefined); }, [url]);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt={t("church.qr").replace("{name}", name)} width={180} height={180} className="rounded-control border border-line bg-white p-1" /> : null;
}

function CopyLink({ url }: { url: string }) {
  const [done, setDone] = useState(false);
  return <Button type="button" variant="ghost" className="text-sm" onClick={() => void getPlatform().share.share({ url, title: "Convite" }).then((r) => { if (r !== "unavailable") { setDone(true); setTimeout(() => setDone(false), 2500); } })}>{done ? t("church.copied") : t("church.copy")}</Button>;
}

function ClassPanel({ church, klass }: { church: MyChurch; klass: ChurchClass }) {
  const [lessons, setLessons] = useState<{ id: string; title: string; ref: string | null; date: string; notes: string | null }[]>([]);
  const [stats, setStats] = useState<ClassStats | null>(null);
  const [form, setForm] = useState({ title: "", ref: "", date: new Date().toISOString().slice(0, 10), notes: "" });
  const [error, setError] = useState(false);
  const reload = useCallback(() => { void getClassLessons(klass.id).then((r) => setLessons(r.lessons)).catch(() => undefined); void getClassStats(klass.id).then(setStats).catch(() => undefined); }, [klass.id]);
  useEffect(() => { reload(); }, [reload]);
  const canTeach = church.role === "admin" || klass.teacher_id !== "";
  async function publish(e: React.FormEvent) {
    e.preventDefault();
    setError(false);
    try { await publishLesson(klass.id, form.title, form.ref || undefined, form.date, form.notes || undefined); setForm({ ...form, title: "", ref: "", notes: "" }); reload(); } catch { setError(true); }
  }
  return (
    <section className="flex flex-col gap-3 rounded-control border border-line p-3" aria-label={klass.name}>
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg">{klass.name}</h3><span className="text-sm text-muted">{t("church.class.students").replace("{n}", String(klass.students))}</span></div>
      {klass.invite_code && (
        <div className="flex flex-wrap items-center gap-3">
          <Qr url={inviteUrl(klass.invite_code)} name={klass.name} />
          <div className="flex min-w-0 flex-col gap-1"><strong className="text-sm">{t("church.class.invite")}</strong><code className="break-all text-xs">{inviteUrl(klass.invite_code)}</code><CopyLink url={inviteUrl(klass.invite_code)} /></div>
        </div>
      )}
      {canTeach && (
        <>
          <form onSubmit={publish} className="flex flex-col gap-2">
            <h4 className="text-sm font-semibold">{t("church.lesson.new")}</h4>
            <Field id={`lt-${klass.id}`} label={t("church.lesson.title")} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={160} />
            <Field id={`lr-${klass.id}`} label={t("church.lesson.ref")} value={form.ref} onChange={(e) => setForm({ ...form, ref: e.target.value })} maxLength={80} />
            <Field id={`ld-${klass.id}`} type="date" label={t("church.lesson.date")} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            <label className="flex flex-col gap-1"><span className="text-sm">{t("church.lesson.notes")}</span><textarea className="min-h-16 rounded-control border border-line bg-surface p-2" value={form.notes} maxLength={2000} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
            {error && <Toast>{t("church.error")}</Toast>}
            <div><Button type="submit" disabled={form.title.trim().length < 2}>{t("church.lesson.publish")}</Button></div>
          </form>
          {lessons.length > 0 && (
            <div><h4 className="text-sm font-semibold">{t("church.lesson.list")}</h4>
              <ul className="text-sm">{lessons.map((l) => <li key={l.id} className="flex items-center justify-between gap-2 border-b border-line py-1"><span><strong>{l.title}</strong>{l.ref ? ` · ${l.ref}` : ""} <span className="text-muted">({l.date})</span></span><button type="button" className="underline" onClick={() => void deleteLesson(l.id).then(reload)}>{t("church.lesson.delete")}</button></li>)}</ul></div>
          )}
          <div aria-label={t("church.stats.title")}>
            <h4 className="text-sm font-semibold">{t("church.stats.title")}</h4>
            {!stats ? null : !stats.enough ? (
              <p role="note" className="rounded-control border border-line p-2 text-sm text-muted">{t("church.stats.hidden").replace("{min}", String(stats.min)).replace("{n}", String(stats.members))}</p>
            ) : (
              <div className="text-sm"><p>{t("church.stats.studied").replace("{n}", String(stats.studied ?? 0)).replace("{total}", String(stats.members))}</p>
                <p className="mt-1 font-semibold">{t("church.stats.topics")}</p>
                {stats.topics.length ? <ul className="list-disc pl-5">{stats.topics.map((x) => <li key={x.topic}>{x.topic} ({x.students})</li>)}</ul> : <p className="text-muted">{t("church.stats.none")}</p>}</div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function ChurchCard({ church, onChange }: { church: MyChurch; onChange: () => void }) {
  const router = useRouter();
  const [newClass, setNewClass] = useState({ name: "", age: "adults" });
  const [lenses, setLenses] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const admin = church.role === "admin";

  async function pay() {
    setError(false);
    try { const r = await startChurchCheckout(church.id, "month", "pix"); if (r.checkoutUrl.startsWith("/")) router.push(r.checkoutUrl); else await getPlatform().purchases.openCheckout(r.checkoutUrl); } catch { setError(true); }
  }
  async function addClass(e: React.FormEvent) {
    e.preventDefault();
    setError(false);
    try { await createClass(church.id, newClass.name, newClass.age); setNewClass({ name: "", age: "adults" }); onChange(); } catch { setError(true); }
  }
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><h2 className="text-xl">{church.name}</h2><span className="text-sm text-muted">{t(`church.role.${church.role}` as "church.role.admin")} · {t(`church.status.${church.status}` as "church.status.active")}</span></div>
        {admin && <span className="text-sm">{t("church.students").replace("{n}", String(church.students)).replace("{max}", String(church.student_limit))}</span>}
      </div>
      {admin && church.status !== "active" && <div className="flex flex-col gap-2"><p className="text-sm">{t("church.status.pending")}. {t(`church.plan.${church.plan_id}` as "church.plan.church_30")}.</p><div><Button type="button" onClick={() => void pay()}>{t("church.pay")}</Button></div></div>}
      {admin && church.teacher_code && (
        <div className="flex flex-col gap-1"><strong className="text-sm">{t("church.teacher.code")}</strong><p className="text-xs text-muted">{t("church.teacher.code.help")}</p><code className="break-all text-xs">{inviteUrl(church.teacher_code)}</code><div><CopyLink url={inviteUrl(church.teacher_code)} /></div></div>
      )}
      {church.classes.map((k) => <ClassPanel key={k.id} church={church} klass={k} />)}
      {admin && (
        <form onSubmit={addClass} className="flex flex-col gap-2 border-t border-line pt-3">
          <h3 className="text-sm font-semibold">{t("church.class.new")}</h3>
          <Field id={`cn-${church.id}`} label={t("church.class.name")} value={newClass.name} onChange={(e) => setNewClass({ ...newClass, name: e.target.value })} required minLength={2} maxLength={80} />
          <label className="flex flex-col gap-1"><span className="text-sm">{t("church.class.age")}</span>
            <select className="h-12 rounded-control border border-line bg-surface px-3" value={newClass.age} onChange={(e) => setNewClass({ ...newClass, age: e.target.value })}>{["kids", "teens", "youth", "adults", "mixed"].map((a) => <option key={a} value={a}>{t(`age.${a}` as "age.kids")}</option>)}</select></label>
          <div><Button type="submit" disabled={newClass.name.trim().length < 2}>{t("church.class.create")}</Button></div>
        </form>
      )}
      {admin && (
        <div className="flex flex-col gap-2 border-t border-line pt-3"><h3 className="text-sm font-semibold">{t("church.settings.title")}</h3><p className="text-xs text-muted">{t("church.settings.help")}</p>
          <div className="flex flex-wrap gap-2">{LENSES.map((l) => <button key={l} type="button" aria-pressed={lenses.includes(l)} onClick={() => setLenses((v) => (v.includes(l) ? v.filter((x) => x !== l) : v.length < 3 ? [...v, l] : v))} className={`min-h-9 rounded-control border px-3 text-sm ${lenses.includes(l) ? "border-primary bg-primary text-primary-ink" : "border-line"}`}>{t(`lens.${l}` as "lens.pentecostal")}</button>)}</div>
          <div><Button type="button" variant="ghost" onClick={() => void saveChurchSettings(church.id, lenses, null).then(() => { setSaved(true); setTimeout(() => setSaved(false), 2000); })}>{saved ? t("church.copied") : t("church.settings.save")}</Button></div></div>
      )}
      {error && <Toast>{t("church.error")}</Toast>}
      {!admin && <div><Button type="button" variant="ghost" onClick={() => setLeaving(true)}>{t("church.leave")}</Button></div>}
      {leaving && (
        <Modal title={t("church.leave")} onClose={() => setLeaving(false)}>
          <p className="mb-3">{t("church.leave.confirm")}</p>
          <div className="flex gap-2"><Button type="button" variant="ghost" className="flex-1" onClick={() => setLeaving(false)}>{t("account.cancel")}</Button><Button type="button" variant="danger" className="flex-1" onClick={() => void leaveChurch(church.id).then(() => { setLeaving(false); onChange(); })}>{t("church.leave")}</Button></div>
        </Modal>
      )}
    </Card>
  );
}

export default function ChurchPage() {
  const [churches, setChurches] = useState<MyChurch[] | null>(null);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [joinMsg, setJoinMsg] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", cnpj: "", plan: "church_30" as (typeof PLANS)[number] });
  const [error, setError] = useState(false);

  const load = useCallback(() => { void getMyChurches().then((r) => setChurches(r.churches)).catch(() => setChurches([])); }, []);
  useEffect(() => {
    load();
    void getPlatform().store.get<string>("pf-join-code").then((c) => { if (c) setPending(c); });
  }, [load]);

  async function join(c: string) {
    setJoinError(null);
    try {
      const r = await joinChurch(c);
      await getPlatform().store.remove("pf-join-code");
      setPending(null); setCode("");
      setJoinMsg(t("church.join.done") + " " + (r.class ? `${r.church}, ${r.class}.` : `${r.church}.`));
      load();
    } catch (e) {
      const m = String((e as Error).message);
      setJoinError(m.includes("409") ? t("church.join.errors.church_full") : t("church.join.errors.invalid_code"));
    }
  }
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(false);
    try { await createChurch(form.name, form.plan, form.cnpj || undefined); setForm({ name: "", cnpj: "", plan: "church_30" }); load(); } catch { setError(true); }
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4 pb-24">
      <h1 className="text-3xl">{t("church.title")}</h1>
      <p className="text-muted">{t("church.help")}</p>
      <p role="note" className="rounded-control border border-line bg-surface p-3 text-sm">{t("church.privacy")}</p>
      {joinMsg && <Toast tone="ok">{joinMsg}</Toast>}
      {pending && (
        <Modal title={t("church.join.title")} onClose={() => { setPending(null); void getPlatform().store.remove("pf-join-code"); }}>
          <p className="mb-2">{t("church.privacy")}</p>
          {joinError && <Toast>{joinError}</Toast>}
          <div className="mt-3 flex gap-2"><Button type="button" className="flex-1" onClick={() => void join(pending)}>{t("church.join.button")}</Button></div>
        </Modal>
      )}
      {churches?.map((c) => <ChurchCard key={c.id} church={c} onChange={load} />)}
      {churches && churches.length === 0 && <p className="text-muted">{t("church.none")}</p>}

      <Card className="flex flex-col gap-2">
        <h2 className="text-lg">{t("church.join.title")}</h2>
        <form onSubmit={(e) => { e.preventDefault(); void join(code); }} className="flex flex-col gap-2">
          <Field id="join-code" label={t("church.join.code")} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoComplete="off" maxLength={20} />
          {joinError && !pending && <Toast>{joinError}</Toast>}
          <div><Button type="submit" disabled={code.trim().length < 6}>{t("church.join.button")}</Button></div>
        </form>
      </Card>

      <Card className="flex flex-col gap-2">
        <h2 className="text-lg">{t("church.create.title")}</h2>
        <form onSubmit={create} className="flex flex-col gap-2">
          <Field id="church-name" label={t("church.create.name")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} maxLength={120} />
          <Field id="church-cnpj" label={t("church.create.cnpj")} value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} maxLength={24} />
          <label className="flex flex-col gap-1"><span className="text-sm">{t("church.create.plan")}</span>
            <select className="h-12 rounded-control border border-line bg-surface px-3" value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value as (typeof PLANS)[number] })}>{PLANS.map((p) => <option key={p} value={p}>{t(`church.plan.${p}` as "church.plan.church_30")}</option>)}</select></label>
          {error && <Toast>{t("church.error")}</Toast>}
          <div><Button type="submit" disabled={form.name.trim().length < 2}>{t("church.create.button")}</Button></div>
        </form>
      </Card>
    </main>
  );
}
