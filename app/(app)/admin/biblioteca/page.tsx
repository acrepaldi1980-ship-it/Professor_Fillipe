"use client";

// Temporary admin panel (Prompt 1.3, item 9): totals of the knowledge base and the license review queue. Admin only.
import { useEffect, useState } from "react";
import { getLibraryAdminReport, type LibraryAdminReport } from "@/lib/api-client";
import { t } from "@/lib/i18n";

function Table({ title, rows }: { title: string; rows: { name: string; works: number }[] }) {
  return (
    <section className="rounded-control border border-line bg-surface p-3">
      <h2 className="mb-1 text-lg">{title}</h2>
      <ul className="text-sm">
        {rows.map((r) => (
          <li key={r.name} className="flex justify-between"><span>{r.name}</span><span className="text-muted">{r.works}</span></li>
        ))}
      </ul>
    </section>
  );
}

export default function LibraryAdminPage() {
  const [report, setReport] = useState<LibraryAdminReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void getLibraryAdminReport().then(setReport).catch((e: Error) => setError(e.message === "api_error_403" ? t("admin.forbidden") : t("admin.error")));
  }, []);
  if (error) return <main className="p-6"><h1 className="text-2xl">{t("admin.hub.title")}</h1><p role="alert">{error}</p></main>;
  if (!report) return <main className="p-6"><p className="text-muted">{t("common.loading")}</p></main>;
  const chunksTotal = report.libraryChunks.reduce((s, c) => s + c.n, 0);
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 pb-24">
      <h1 className="text-3xl">{t("admin.library.title")}</h1>
      <p>{t("admin.library.summary").replace("{works}", String(report.works.total)).replace("{chunks}", String(chunksTotal)).replace("{review}", String(report.review.total))}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Table title={t("admin.library.kind")} rows={report.works.byKind} />
        <Table title={t("admin.library.tradition")} rows={report.works.byTradition} />
        <Table title={t("admin.library.language")} rows={report.works.byLanguage} />
        <Table title={t("admin.library.license")} rows={report.works.byLicense} />
      </div>
      <section>
        <h2 className="mb-1 text-xl">{t("admin.library.review")}</h2>
        <p className="mb-2 text-sm text-muted">{t("admin.library.reviewHelp")}</p>
        <ul className="flex flex-col gap-2 text-sm">
          {report.review.items.map((r) => (
            <li key={r.id} className="rounded-control border border-line bg-surface p-2">
              <strong>{r.title}</strong> <span className="text-muted">({r.authors})</span>
              <div className="text-muted">{r.reason}</div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
