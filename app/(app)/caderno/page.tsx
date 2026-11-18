import { Avatar } from "@/components/teacher/Avatar";
import { t } from "@/lib/i18n";

export default function SoonPage() {
  return (
    <main className="flex flex-col items-center gap-3 p-8 text-center">
      <Avatar state="thinking" size={96} />
      <h1 className="text-2xl">{t("soon.title")}</h1>
      <p className="text-muted">{t("soon.body")}</p>
    </main>
  );
}
