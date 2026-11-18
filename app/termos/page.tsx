import Link from "next/link";
import { t } from "@/lib/i18n";

export const metadata = { title: "Termos de Uso — Professor Filipe" };

export default function TermsPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <p role="note" className="rounded-control bg-warn-bg px-3 py-2 text-sm text-warn-ink">{t("legal.draft")}</p>
      <h1 className="text-3xl">Termos de Uso</h1>
      <h2 className="text-xl">1. O que é o Professor Filipe</h2>
      <p>É um aplicativo de estudo bíblico com um professor virtual que usa inteligência artificial. Ele não é uma pessoa, não é pastor e não tem diploma. Ele pode errar: confira sempre os versículos citados e converse com o seu pastor ou líder.</p>
      <h2 className="text-xl">2. Quem pode usar</h2>
      <p>A partir de 13 anos. De 13 a 17 anos, é preciso que um responsável saiba que você usa o aplicativo, e a assinatura de planos pagos exige o responsável.</p>
      <h2 className="text-xl">3. O que o professor não faz</h2>
      <p>Ele não faz aconselhamento pastoral, psicológico ou médico. Em momentos de sofrimento, procure seu pastor, um profissional de saúde, o CVV (telefone 188) ou, em risco imediato, o SAMU (telefone 192).</p>
      <h2 className="text-xl">4. Conteúdo</h2>
      <p>Os textos bíblicos e as obras de apoio vêm de fontes de domínio público ou com licença aberta, listadas na página de fontes com seus créditos. Os trechos de pesquisa podem estar em inglês e são explicados em português.</p>
      <h2 className="text-xl">5. Sua conta</h2>
      <p>Você pode excluir sua conta a qualquer momento na tela Conta; seus dados pessoais são apagados.</p>
      <p><Link href="/privacidade" className="underline">Política de Privacidade</Link> · <Link href="/" className="underline">Voltar</Link></p>
    </main>
  );
}
