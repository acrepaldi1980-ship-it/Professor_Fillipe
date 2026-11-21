"use client";

// Settings (spec 8.14): plans and limits, sermon types, and the teacher's prompts with history and reversion. Every save is audited in the database.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { adminSaveSetting, adminSettings, type AdminSettings } from "@/lib/api-client";
import { t } from "@/lib/i18n";

const LIMIT_KEYS = ["voice_minutes_day", "text_messages_day", "illustrations_day", "lessons_month", "deepen_month"] as const;
const input = "h-10 rounded-control border border-line bg-surface px-2 text-sm";

export default function SettingsAdmin() {
  const [s, setS] = useState<AdminSettings | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const load = () => adminSettings().then(setS).catch(() => setErr(true));
  useEffect(() => { void load(); }, []);
  const save = async (body: Record<string, unknown>) => { try { await adminSaveSetting(body); setMsg(t("admin.settings.saved")); await load(); } catch { setMsg(t("consent.error")); } };
  if (err) return <main className="p-6"><p role="alert">{t("admin.forbidden")}</p></main>;
  if (!s) return <main className="p-6"><p className="text-muted">{t("common.loading")}</p></main>;
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 pb-24">
      <h1 className="text-3xl">{t("admin.settings.title")}</h1>
      {msg && <p role="status" className="rounded-control bg-surface p-2 text-sm">{msg}</p>}

      <section className="flex flex-col gap-2"><h2 className="text-xl">{t("admin.settings.plans")}</h2>
        {s.plans.map((p) => (
          <PlanEditor key={p.id} plan={p} onSave={(b) => save({ kind: "plan", id: p.id, ...b })} />
        ))}
      </section>

      <section className="flex flex-col gap-2"><h2 className="text-xl">{t("admin.settings.types")}</h2>
        {s.sermonTypes.map((x) => (
          <Card key={x.id} className="flex flex-col gap-2">
            <input className={input} aria-label="Nome" defaultValue={x.name} onChange={(e) => setDraft({ ...draft, [`n${x.id}`]: e.target.value })} />
            <textarea className="min-h-20 rounded-control border border-line bg-surface p-2 text-sm" aria-label="Definição" defaultValue={x.definition} onChange={(e) => setDraft({ ...draft, [`d${x.id}`]: e.target.value })} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" defaultChecked={x.enabled} onChange={(e) => setDraft({ ...draft, [`e${x.id}`]: e.target.checked ? "1" : "0" })} />{t("admin.works.enabled")}</label>
            <Button type="button" className="self-start text-sm" onClick={() => void save({ kind: "sermon_type", id: x.id, name: draft[`n${x.id}`] ?? x.name, definition: draft[`d${x.id}`] ?? x.definition, enabled: (draft[`e${x.id}`] ?? (x.enabled ? "1" : "0")) === "1" })}>{t("admin.settings.save")}</Button>
          </Card>
        ))}
      </section>

      <section className="flex flex-col gap-2"><h2 className="text-xl">{t("admin.settings.prompts")}</h2>
        {(["identity", "mode_free"] as const).map((layer) => {
          const versions = s.prompts.filter((p) => p.layer === layer);
          const active = versions.find((v) => v.active);
          return (
            <Card key={layer} className="flex flex-col gap-2">
              <h3 className="font-semibold">{layer}</h3>
              <textarea className="min-h-40 rounded-control border border-line bg-surface p-2 text-sm" aria-label={layer} defaultValue={active?.content ?? ""} onChange={(e) => setDraft({ ...draft, [`p${layer}`]: e.target.value })} />
              <Button type="button" className="self-start text-sm" onClick={() => void save({ kind: "prompt_new", layer, content: draft[`p${layer}`] ?? active?.content ?? "" })}>{t("admin.settings.newversion")}</Button>
              <ul className="text-sm">
                {versions.map((v) => (
                  <li key={v.version} className="flex items-center justify-between gap-2 border-t border-line py-1">
                    <span>v{v.version} · {new Date(v.created_at).toLocaleDateString("pt-BR")} {v.active && <strong className="text-primary">· {t("admin.settings.active")}</strong>}</span>
                    {!v.active && <Button type="button" variant="ghost" className="text-sm" onClick={() => void save({ kind: "prompt_activate", layer, version: v.version })}>{t("admin.settings.revert")}</Button>}
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </section>
    </main>
  );
}

function PlanEditor({ plan, onSave }: { plan: AdminSettings["plans"][number]; onSave(b: Record<string, unknown>): void }) {
  const [pm, setPm] = useState(String(plan.price_month));
  const [py, setPy] = useState(plan.price_year == null ? "" : String(plan.price_year));
  const [lim, setLim] = useState<Record<string, string>>(Object.fromEntries(LIMIT_KEYS.map((k) => [k, plan.limits[k] == null ? "" : String(plan.limits[k])])));
  const [active, setActive] = useState(plan.active);
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  return (
    <Card className="flex flex-col gap-2">
      <h3 className="font-semibold">{plan.name}</h3>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <label className="flex flex-col">Preço mensal (R$)<input className={input} value={pm} onChange={(e) => setPm(e.target.value)} inputMode="decimal" /></label>
        <label className="flex flex-col">Preço anual (R$)<input className={input} value={py} onChange={(e) => setPy(e.target.value)} inputMode="decimal" /></label>
        {LIMIT_KEYS.map((k) => <label key={k} className="flex flex-col">{k} (vazio = sem limite)<input className={input} value={lim[k]} onChange={(e) => setLim({ ...lim, [k]: e.target.value })} inputMode="numeric" /></label>)}
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />{t("admin.works.enabled")}</label>
      <Button type="button" className="self-start text-sm" onClick={() => onSave({ price_month: Number(pm), price_year: num(py), active, limits: Object.fromEntries(LIMIT_KEYS.map((k) => [k, num(lim[k])])), features: plan.features })}>{t("admin.settings.save")}</Button>
    </Card>
  );
}
