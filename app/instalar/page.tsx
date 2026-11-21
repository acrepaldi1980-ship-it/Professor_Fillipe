import Link from "next/link";
import { InstallGuide } from "@/components/landing/InstallGuide";
import { t } from "@/lib/i18n";

export const metadata = { title: "Instalar o app" };

export default function InstallPage() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <h1 className="text-3xl">{t("install.title")}</h1>
      <p className="text-muted">{t("install.sub")}</p>
      <InstallGuide />
      <Link href="/" className="underline">{t("install.back")}</Link>
    </main>
  );
}
