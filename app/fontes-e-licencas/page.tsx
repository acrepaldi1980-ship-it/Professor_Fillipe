"use client";

// Public page "Fontes e licenças" (spec 8.10.9): generated from the `works` table through the public API.
import Link from "next/link";
import { useEffect, useState } from "react";
import { getSources, type SourceWork } from "@/lib/api-client";
import { t } from "@/lib/i18n";

export default function SourcesPage() {
  const [works, setWorks] = useState<SourceWork[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    void getSources().then(setWorks).catch(() => setFailed(true));
  }, []);
  const groups = new Map<string, SourceWork[]>();
  for (const w of works ?? []) groups.set(w.kind, [...(groups.get(w.kind) ?? []), w]);
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-3xl">{t("sources.title")}</h1>
      <p>{t("sources.intro")}</p>
      {failed && <p role="alert" className="text-danger-ink">{t("sources.error")}</p>}
      {!works && !failed && <p className="text-muted">{t("common.loading")}</p>}
      {[...groups].map(([kind, list]) => (
        <section key={kind} className="flex flex-col gap-3">
          <h2 className="text-xl">{t(`sources.kind.${kind}` as never)}</h2>
          {list.map((w) => (
            <article key={w.id} className="rounded-control border border-line bg-surface p-3">
              <h3 className="font-semibold">{w.title}</h3>
              <p className="text-sm text-muted">
                {t("sources.license")}: {t(`license.${w.license}` as never)}
                {w.pub_year ? ` · ${w.pub_year}` : ""}
              </p>
              {w.credit_text && <p className="mt-1 text-sm">{w.credit_text}</p>}
              {w.source_url && (
                <p className="mt-1 break-all text-sm">
                  {t("sources.original")}: <a href={w.source_url} className="underline" rel="noreferrer">{w.source_url}</a>
                </p>
              )}
            </article>
          ))}
        </section>
      ))}
      <p><Link href="/" className="underline">{t("common.back")}</Link></p>
    </main>
  );
}
