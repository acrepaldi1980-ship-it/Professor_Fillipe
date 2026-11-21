"use client";

import { Fragment, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { currentSession, watchSession } from "@/lib/auth/client";
import { applyLanguage, loadLanguage } from "@/lib/i18n/lang";
import type { Lang } from "@/lib/i18n";
import { applyPrefs, loadPrefs } from "@/lib/prefs";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  const [lang, setLang] = useState<Lang>("pt-BR");
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    void loadPrefs().then(applyPrefs);
    void loadLanguage().then((l) => { if (l !== "pt-BR") { applyLanguage(l); setLang(l); } });
    // keeps the API token in sync with the login session
    void currentSession().catch(() => {});
    let off = () => {};
    try {
      off = watchSession(() => {});
    } catch {
      /* auth not configured: public pages still work */
    }
    return off;
  }, []);
  // the tree is rebuilt once when the saved language is not Portuguese, so every screen reads its strings in that language
  return <QueryClientProvider client={client}><Fragment key={lang}>{children}</Fragment></QueryClientProvider>;
}
