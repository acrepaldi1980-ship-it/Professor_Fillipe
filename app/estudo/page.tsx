"use client";

import { t } from "@/lib/i18n";

// Placeholder: the prototype screen arrives in Prompt 0.1, step 8.
export default function StudyPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center p-6 text-center">
      <h1 className="text-3xl font-semibold">{t("app.name")}</h1>
      <p className="mt-2 text-lg opacity-80">{t("app.tagline")}</p>
    </main>
  );
}
