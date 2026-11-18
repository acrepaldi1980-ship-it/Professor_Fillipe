"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/teacher/Avatar";
import { Card } from "@/components/ui/Card";
import { getMe } from "@/lib/api-client";
import { t } from "@/lib/i18n";

export default function HomePage() {
  const [name, setName] = useState("");
  useEffect(() => {
    void getMe().then((m) => setName(m.profile?.preferred_name ?? m.profile?.display_name ?? ""));
  }, []);

  return (
    <main className="flex flex-col gap-4 p-4">
      <header className="flex items-center gap-3 pt-2">
        <Avatar state="happy" size={72} />
        <h1 className="text-2xl">{t("home.hello")}{name ? `, ${name}` : ""}!</h1>
      </header>
      <Link href="/estudo" className="inline-flex min-h-14 items-center justify-center rounded-control bg-primary px-6 text-lg font-semibold text-primary-ink">
        {t("home.start")}
      </Link>
      <Card>
        <h2 className="text-lg">{t("home.continue")}</h2>
        <p className="text-muted">{t("home.continue.empty")}</p>
      </Card>
      <Card>
        <h2 className="text-lg">{t("home.review")}</h2>
        <p className="text-muted">{t("home.review.empty")}</p>
      </Card>
    </main>
  );
}
