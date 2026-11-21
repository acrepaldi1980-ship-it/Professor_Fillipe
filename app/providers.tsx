"use client";

import { Fragment, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { currentSession, watchSession } from "@/lib/auth/client";
import { applyLanguage, loadLanguage } from "@/lib/i18n/lang";
import type { Lang } from "@/lib/i18n";
import { getPlatform } from "@/lib/platform";
import { applyPrefs, loadPrefs } from "@/lib/prefs";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  const [lang, setLang] = useState<Lang>("pt-BR");
  // After a deploy a page opened earlier can ask for script files that no longer exist: drop the saved copies and reload once (not in a loop).
  useEffect(() => {
    const recover = async (e: ErrorEvent | PromiseRejectionEvent) => {
      const msg = String(("reason" in e ? (e.reason as Error | undefined)?.message : e.message) ?? "");
      if (!/ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(msg)) return;
      const store = getPlatform().store;
      const last = (await store.get<number>("pf-reload-at")) ?? 0;
      if (Date.now() - last < 60_000) return;
      await store.set("pf-reload-at", Date.now());
      try { for (const k of await caches.keys()) await caches.delete(k); } catch { /* no cache API */ }
      window.location.reload();
    };
    window.addEventListener("error", recover);
    window.addEventListener("unhandledrejection", recover);
    return () => { window.removeEventListener("error", recover); window.removeEventListener("unhandledrejection", recover); };
  }, []);
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
