import Link from "next/link";
import { t } from "@/lib/i18n";

export const metadata = { title: "Política de Privacidade — Professor Filipe" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <p role="note" className="rounded-control bg-warn-bg px-3 py-2 text-sm text-warn-ink">{t("legal.draft")}</p>
      <h1 className="text-3xl">Política de Privacidade</h1>
      <h2 className="text-xl">O que guardamos</h2>
      <p>E-mail, nome, data de nascimento, suas conversas com o professor, seus cartões de revisão e seu caderno. Sua voz <strong>não é guardada</strong>: o áudio é transcrito e descartado, e só o texto fica.</p>
      <h2 className="text-xl">Dado sensível: convicção religiosa</h2>
      <p>Sua linha teológica, denominação e função na igreja revelam convicção religiosa, dado sensível pela LGPD. Só guardamos com o seu consentimento específico, criptografados, e você pode revogar e apagar a qualquer momento em Conta.</p>
      <h2 className="text-xl">Quem vê seus dados</h2>
      <p>Ninguém da igreja nem da equipe lê suas conversas. Para o professor responder, o texto da sua pergunta é enviado a fornecedores de inteligência artificial e de voz, que processam e devolvem a resposta.</p>
      <h2 className="text-xl">Situações de crise</h2>
      <p>Se você escrever sobre sofrimento intenso, o professor orienta você a procurar ajuda. Guardamos apenas que isso aconteceu (a data), sem o texto.</p>
      <h2 className="text-xl">Seus direitos</h2>
      <p>Você pode acessar, corrigir, exportar, revogar consentimentos e excluir seus dados. Contato do encarregado de dados: a definir antes do lançamento.</p>
      <p><Link href="/termos" className="underline">Termos de Uso</Link> · <Link href="/" className="underline">Voltar</Link></p>
    </main>
  );
}
