"use client";

// "Pesquisa profunda" (spec 8.18): when a lesson, sermon or deep-study session opens with an empty document, the app researches (Bible text,
// original words, library, other traditions) and writes the whole document, section by section, showing the progress. When it is done the
// person changes anything by talking ("refaça a introdução") or with "Pedir mudança" here.
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { getSessionDocument, suggestDocumentSection, type SuggestResult } from "@/lib/api-client";
import { t } from "@/lib/i18n";

type Mode = "lesson" | "sermon" | "deep";
const FULL: Record<Mode, number> = { lesson: 8, sermon: 5, deep: 8 };
const CHANGEABLE: Record<Mode, { key: string; label: string }[]> = {
  lesson: [["objective", "Objetivo"], ["icebreaker", "Quebra-gelo"], ["context", "Contexto"], ["points", "Pontos principais"], ["dynamic", "Dinâmica"], ["questions", "Perguntas"], ["application", "Aplicação"], ["memory_verse", "Versículo para memorizar"]].map(([key, label]) => ({ key, label })),
  sermon: [["central_idea", "Ideia central"], ["introduction", "Introdução"], ["division_replace:0", "Divisão 1"], ["division_replace:1", "Divisão 2"], ["division_replace:2", "Divisão 3"], ["conclusion", "Conclusão"], ["appeal", "Apelo"]].map(([key, label]) => ({ key, label })),
  deep: [["overview", "Resumo"], ["context", "Contexto"], ["structure", "Estrutura"], ["keywords", "Palavras do original"], ["traditions", "Visões das tradições"], ["application", "Aplicação"]].map(([key, label]) => ({ key, label })),
};
const STEP_LABEL: Record<string, string> = { objective: "objetivo", icebreaker: "quebra-gelo", context: "contexto", points: "pontos principais", dynamic: "dinâmica", questions: "perguntas", application: "aplicação", memory_verse: "versículo", central_idea: "ideia central", introduction: "introdução", division: "divisões do texto", conclusion: "conclusão", appeal: "apelo", overview: "resumo", structure: "estrutura", keywords: "palavras no original", traditions: "visões das tradições", crossrefs: "referências cruzadas", bibliography: "bibliografia" };
const stepName = (k: string) => STEP_LABEL[k.split(":")[0]] ?? k;

export function ResearchBar({ sessionId, mode, onUpdate }: { sessionId: string; mode: Mode; onUpdate: (r: SuggestResult) => void }) {
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState("");
  const [failed, setFailed] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState(CHANGEABLE[mode][0].key);
  const [instruction, setInstruction] = useState("");
  const [changing, setChanging] = useState(false);
  const [changeError, setChangeError] = useState(false);
  const started = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const run = useCallback(async () => {
    setRunning(true); setDone(false); setFailed([]); setBusy(false);
    const bad: string[] = [];
    try {
      let keys = (await getSessionDocument(sessionId)).gapKeys ?? [];
      const tried = new Set<string>();
      let n = 0;
      let streak = 0; // consecutive failures: the AI service is overloaded or out of quota, stop instead of waiting for every step
      setTotal(keys.length + (mode === "sermon" ? 2 : 0));
      for (let guard = 0; guard < 24; guard++) {
        const next = keys.find((k) => !tried.has(k));
        if (!next) break;
        tried.add(next);
        if (!alive.current) return;
        setCurrent(next); setStep(n);
        try {
          const out = await suggestDocumentSection(sessionId, next);
          keys = out.gapKeys; onUpdate(out); streak = 0;
        } catch {
          bad.push(next);
          if (++streak >= 2) { setBusy(true); break; }
        }
        n++;
      }
      // a sermon outline has three divisions
      if (mode === "sermon") {
        for (let i = 0; i < 3; i++) {
          const d = (await getSessionDocument(sessionId)).doc as { divisions?: unknown[] } | null;
          if ((d?.divisions?.length ?? 0) >= 3) break;
          setCurrent("division"); setStep(n++);
          try { onUpdate(await suggestDocumentSection(sessionId, "division")); } catch { bad.push("division"); break; }
        }
      }
    } finally {
      if (alive.current) { setFailed(bad); setRunning(false); setDone(true); }
    }
  }, [sessionId, mode, onUpdate]);

  // a fresh document starts the research by itself
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    try { if (localStorage.getItem("pf-no-research") === "1") return; } catch { /* storage unavailable: carry on */ }
    void getSessionDocument(sessionId).then((r) => { if ((r.gapKeys?.length ?? 0) >= FULL[mode]) void run(); }).catch(() => undefined);
  }, [sessionId, mode, run]);

  async function change() {
    if (!instruction.trim()) return;
    setChanging(true); setChangeError(false);
    try { onUpdate(await suggestDocumentSection(sessionId, section, instruction.trim())); setInstruction(""); } catch { setChangeError(true); }
    setChanging(false);
  }

  return (
    <div className="flex flex-col gap-2" data-testid="research-bar">
      {running && (
        <div role="status" aria-live="polite" className="rounded-control border border-line bg-bg p-2 text-sm">
          <p>{t("research.working").replace("{n}", String(Math.min(step + 1, Math.max(total, step + 1)))).replace("{total}", String(Math.max(total, step + 1))).replace("{what}", stepName(current))}</p>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={Math.max(total, 1)} aria-valuenow={step}><div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, (step / Math.max(total, 1)) * 100)}%` }} /></div>
        </div>
      )}
      {!running && done && failed.length === 0 && <p role="status" className="rounded-control border border-line bg-bg p-2 text-sm">{t("research.done")}</p>}
      {!running && failed.length > 0 && (
        <div role="alert" className="rounded-control border border-line bg-bg p-2 text-sm">
          <p>{busy ? t("research.busy") : t("research.failed").replace("{what}", [...new Set(failed.map(stepName))].join(", "))}</p>
          <Button type="button" variant="ghost" className="mt-1 text-sm" onClick={() => void run()}>{t("research.retry")}</Button>
        </div>
      )}
      {!running && !done && <Button type="button" onClick={() => void run()}>{t("research.start")}</Button>}
      {!running && (
        <details className="text-sm">
          <summary className="cursor-pointer underline">{t("research.change")}</summary>
          <div className="mt-2 flex flex-col gap-2">
            <label className="flex flex-col gap-1"><span className="text-xs text-muted">{t("research.change.section")}</span>
              <select value={section} onChange={(e) => setSection(e.target.value)} className="h-10 rounded-control border border-line bg-bg px-2">{CHANGEABLE[mode].map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></label>
            <label className="flex flex-col gap-1"><span className="text-xs text-muted">{t("research.change.what")}</span>
              <textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} maxLength={400} placeholder={t("research.change.ph")} className="min-h-16 rounded-control border border-line bg-bg p-2" /></label>
            {changeError && <p role="alert" className="text-xs text-muted">{t("doc.gap.error")}</p>}
            <Button type="button" variant="ghost" disabled={changing || !instruction.trim()} onClick={() => void change()}>{changing ? t("doc.gap.working") : t("research.change.apply")}</Button>
          </div>
        </details>
      )}
    </div>
  );
}
