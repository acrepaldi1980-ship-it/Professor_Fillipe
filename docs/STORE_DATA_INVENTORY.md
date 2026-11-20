# Inventário de dados coletados (base das fichas de privacidade da Apple e do Google)

Atualizar a cada módulo novo (regra de portabilidade f). Situação: **protótipo e fundação (Prompt 1.1, em andamento)**.

| Dado | Onde fica | Finalidade | Ligado ao usuário? | Sensível? |
| --- | --- | --- | --- | --- |
| E-mail | Supabase Auth | Login e contato | Sim | Não |
| Nome de exibição e de tratamento | `profiles` | Personalizar a conversa | Sim | Não |
| Data de nascimento / menor de idade | `profiles` | Regras para menores (RN-09) | Sim | Não |
| Denominação, função ministerial | `profiles.ministry_role_enc` (criptografado) | Adaptar o ensino | Sim | **Sim: convicção religiosa (LGPD art. 5º, II)** |
| Lente teológica | `preferences.lenses_enc` (criptografado) | Orientar as explicações | Sim | **Sim** |
| Objetivos, experiência, formatos, tema inicial, nível | `profiles` | Entrevista e adaptação do nível | Sim | Não |
| Conversas (texto das perguntas e respostas) | `messages` | Histórico, resumos, revisão | Sim | Pode conter dado religioso |
| Áudio da voz do aluno | **Não é guardado**: é transcrito e descartado (RF-M02-03) | Reconhecimento de fala | — | — |
| Resumos de sessão, cartões, caderno, marcadores | tabelas do usuário | Revisão e estudo | Sim | Não |
| Eventos de crise pastoral | `pastoral_events` | Métrica de segurança; **sem texto** | Sim (apenas data) | Tratado como sensível |
| Consentimentos (termos, privacidade, dado religioso) | `consent_records` | Prova de consentimento (LGPD) | Sim | Não |
| Assinatura, direitos de acesso, pagamentos | `subscriptions`, `entitlements`, `payment_events` | Cobrança e liberação de recursos | Sim | Não (cartão não passa pelo app: fica no meio de pagamento) |
| Contadores de uso e custo | `usage_counters` | Limites de plano | Sim | Não |
| Token de notificações, plataforma, versão | `devices` | Notificações | Sim | Não |
| Avaliações do protótipo (nota e comentário) | `feedback` | Melhorar o produto | **Não** (anônimo) | Não |
| Erros e latência | logs estruturados / Sentry (a configurar) | Estabilidade | Não (sem texto de conversa) | Não |

**Fornecedores que recebem dados:** modelo de linguagem (texto das perguntas; hoje Groq, no futuro Anthropic), reconhecimento de fala (áudio enviado e descartado), síntese de voz (texto da resposta). Preferência por quem não usa os dados para treino (a confirmar em contrato antes do lançamento).

**Direitos do titular:** exportar, corrigir, revogar consentimento e excluir conta (RF-M01-03 e RF-M02-04), a implementar neste prompt e no 1.13.

## Fala no dispositivo (`lib/platform` → `speech`)
- Usa a síntese de voz do sistema (Web Speech API / equivalente nativo). O texto falado não sai do aparelho para essa etapa e nada é armazenado.

## Banco de referência (Neon)
- Só conteúdo público (palavras dos originais, léxicos, referências cruzadas, versificação). Não guarda dado de usuário, então não entra no formulário de privacidade das lojas.

## Voz escolhida
- A voz do professor escolhida na tela Conta fica só no aparelho (armazenamento local, chave `prefs.v1`); não vai para o servidor.

## Notas de Estudo Pentecostais (Prompt 1.4)
- Tabelas `own_notes` e `own_note_comments`: conteúdo editorial e comentários de revisores (usuário com papel `reviewer` ou `admin`). Nenhum dado de aluno. Os comentários guardam apenas o `user_id` do revisor e o texto. Não entra no formulário de privacidade das lojas além do que já consta para contas de revisor.

## Entrevista guiada e configuração (Prompt 1.7)
- Em `profiles`: tempo de estudo bíblico, objetivos, minutos por dia, formatos preferidos, primeiro tema e nível estimado. A **função no ministério** e a **faixa etária que ensina** são dado religioso: só são gravadas com o consentimento de dado sensível, a função criptografada (AES-256-GCM). Em `preferences`: lentes (criptografadas, só com consentimento) e versões da Bíblia. Entram no formulário de privacidade das lojas como "preferências e dados de uso do app, ligados à conta".

## Modos guiados (Prompt 1.8)
- `sessions.context` guarda a configuração do modo (tema, texto-base, faixa etária, minutos, tipo de sermão). `lesson_plans` e `sermon_outlines` guardam os planos de aula e esboços de sermão do usuário (conteúdo criado por ele, ligado à conta). O PDF é gerado na hora e não é guardado.

## Visuais (Prompt 1.9)
- Mapas, linhas do tempo e modelos 3D são conteúdo público, sem dado do aluno. Ilustrações: o texto da cena (em inglês, sem dado pessoal) vai ao fornecedor de imagem (Google); a imagem fica em cache compartilhado (`illustrations`). `usage_counters.illustrations` conta o uso diário por aluno.
