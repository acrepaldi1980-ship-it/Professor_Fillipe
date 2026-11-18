import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { t } from "@/lib/i18n";

export const metadata: Metadata = {
  title: t("app.name"),
  description: t("app.tagline"),
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#2f4a6b",
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
