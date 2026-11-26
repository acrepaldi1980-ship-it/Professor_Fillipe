"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { t, type MessageKey } from "@/lib/i18n";

const ITEMS: { href: string; key: MessageKey; icon: string }[] = [
  { href: "/inicio", key: "nav.home", icon: "🏠" },
  { href: "/biblia", key: "nav.bible", icon: "📖" },
  { href: "/estudo", key: "nav.study", icon: "💬" },
  { href: "/revisao", key: "nav.review", icon: "🔁" },
  { href: "/caderno", key: "nav.notebook", icon: "📓" },
  { href: "/conta", key: "nav.account", icon: "👤" },
];

/** App-style navigation (spec 17.3): always reachable with the thumb, safe-area aware. */
export function BottomNav() {
  const path = usePathname();
  return (
    <nav aria-label={t("nav.label")} className="sticky bottom-0 z-40 flex justify-around border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
      {ITEMS.map((i) => {
        const on = path === i.href || path.startsWith(i.href + "/");
        return (
          <Link key={i.href} href={i.href} aria-current={on ? "page" : undefined} className={`flex min-h-14 min-w-14 flex-col items-center justify-center gap-0.5 px-2 text-xs ${on ? "font-bold text-primary" : "text-muted"}`}>
            <span aria-hidden="true" className="text-xl">{i.icon}</span>
            {t(i.key)}
          </Link>
        );
      })}
    </nav>
  );
}
