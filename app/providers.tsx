"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { currentSession, watchSession } from "@/lib/auth/client";
import { applyPrefs, loadPrefs } from "@/lib/prefs";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    void loadPrefs().then(applyPrefs);
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
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
