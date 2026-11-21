# Revisão de segurança, LGPD e custos (Prompt 1.13)

Data: 2026-11-21. Escopo: banco, API `/api/v1`, professor (injeção), dados pessoais, custos, observabilidade e backup.

## 1. Banco e permissões

- Auditoria automática: `node scripts/rls-audit.mjs` (sai com erro se alguma tabela ficar sem RLS).
- Resultado: **49 tabelas, 49 com RLS**. Cinco são só do servidor (RLS sem política): `chunks`, `feedback`, `payment_events`, `rate_limits`, `schema_migrations`.
- Achado e correção (migração `0025_hardening.sql`): o visitante anônimo tinha permissão de escrita em todas as tabelas (padrão do Supabase). O RLS bloqueava, mas foi removida a permissão (`anon` agora com 0 tabelas graváveis) e retirados `truncate/references/trigger` dos usuários logados.
- 26 funções internas e de administração deixaram de ser chamáveis pelo visitante. Restam 15 funções públicas para `anon`, todas `SECURITY DEFINER` com validação interna: busca da biblioteca, versículos, prompts ativos, feedback, contador de erros, limite de uso e as funções de cobrança protegidas por segredo (`BILLING_SERVER_SECRET`).
- Papéis: `is_admin()`/`is_reviewer()` dentro do banco e `requireAdmin/requireReviewer` no servidor; o papel não se autoatribui (testado: aluno atualizando o próprio papel falha).

## 2. Rotas

- Toda rota do app exige `Authorization: Bearer`; rotas públicas são só catálogo, saúde, config, planos, feedback e o webhook (protegido por token).
- Testes e2e: `tests/e2e/security.mjs` (15 verificações) e `tests/e2e/admin.mjs` (56: anônimo 401, aluno 403, revisor só revisão).
- **Limite de requisições** (`api_rate_check`, janelas fixas no banco, vale entre instâncias): professor 20/min por usuário e 60/min por IP; voz 40/min; ilustrações 6/min; eventos 120/min; exportação 3/hora; feedback público 5 por 10 min por IP. O IP é guardado só como hash. Se o contador falhar, a requisição passa (falha aberta, para não derrubar o estudo). Resposta 429 com `Retry-After`.

## 3. Injeção de comandos (RA-21)

- Camada 1, antes do modelo (`lib/security/injection.ts`): padrões para revelar o prompt, trocar o papel, anular regras (inventar versículo, tirar limite) e pedir segredos. Resposta fixa, gentil, válida pelo esquema, que se diz IA e volta ao estudo. Não chama o modelo, então também não gera custo.
- Camada 2, depois do modelo: se a resposta copia 6 palavras seguidas da identidade interna, é trocada pela resposta fixa.
- Conjunto `evals/datasets/injection.json` (30 casos): 15 são barrados pela camada 1 (testados um a um) e 7 frases legítimas de estudo não são bloqueadas (testes de unidade). Os outros 15 (fora do tema, rosto de Jesus, política, sermão pronto, ironia, diagnóstico etc.) dependem das regras do prompt e do modelo.
- **Pendência honesta:** a rodada completa com o modelo (meta 100%) precisa de crédito na Anthropic. Rodar `npm run eval -- injection` quando houver crédito e corrigir qualquer caso que falhe.

## 4. LGPD

| Direito | Como |
| --- | --- |
| Exportar (RF-M02-04) | `GET /api/v1/account/export` e botão "Baixar meus dados" em Conta: JSON com perfil, consentimentos, preferências (lentes decifradas), sessões, mensagens, caderno, cartões, planos, assinatura e uso |
| Revogar consentimento | já existia em Conta (religioso) e no onboarding; revogar impede o uso do dado religioso no prompt |
| Excluir conta | `DELETE /api/v1/account` com confirmação "EXCLUIR": apaga tudo em cascata (testado) |
| Áudio | não é guardado (a voz do aluno vai para transcrição e não é gravada; ensaio com áudio só com consentimento próprio) |
| Campos sensíveis | lentes e função ministerial cifradas com AES-256-GCM (`FIELD_ENCRYPTION_KEY`) |
| Logs | logs estruturados com rota, código e latência, nunca texto de conversa; eventos de análise aceitam só números, booleanos e textos curtos (o banco descarta texto livre); alertas de crise guardam só o `pastoral_flag` |

## 5. Custos (RNF-08: custo de IA ≤ 35% do que o pagante paga)

Medidas em vigor: prompt estável em cache da Anthropic; modelo rápido como padrão (o profundo só em Aprofundar, aula, sermão, outras tradições ou 3+ lentes); histórico curto (8 mensagens); contexto de 3200 tokens; busca com cache de 5 min; filtro de injeção sem modelo; limite diário por plano e uso justo (`forceFast`). Cache de respostas inteiras **não foi feito de propósito**: a fala usa o nome, o nível e a lente do aluno, então reaproveitar causaria respostas erradas para a pessoa.

`node scripts/cost-report.mjs` mostra o uso real (hoje 0 por falta de crédito) e a projeção:

| Cenário (por resposta) | Antes | Depois |
| --- | --- | --- |
| Só modelo profundo, histórico de 24, sem cache | R$ 0,190 | |
| Cache do prompt + histórico de 8 | | R$ 0,076 (-60%) |
| Modelo rápido por padrão (80% rápido, 20% profundo) | | R$ 0,035 (-81%) |

Orçamento Plus: R$ 10,46/mês (35% de R$ 29,90); Premium: R$ 17,46. Com a mistura rápida: 5 respostas/dia = R$ 5,32/mês (dentro); 12/dia todo dia = R$ 12,78 (acima); 30/dia = R$ 31,95. O uso típico de um estudante ativo é de poucos dias por semana, o que fica dentro, mas **o RNF-08 só se confirma com dados reais**. Os preços do modelo rápido usados na projeção (US$ 1/5 por milhão) são suposição; confira na tabela da Anthropic. Se o custo real passar, as alavancas são: reduzir o limite diário do Plus, mandar mais intenções ao modelo rápido e cortar o contexto.

## 6. Observabilidade

- `lib/telemetry/log.ts`: uma linha JSON por evento; erros 5xx entram em `app_errors` (rota, código, contagem por hora, sem texto de usuário) e aparecem em **Admin > Métricas > Erros nas últimas 24 horas**.
- Sentry: com `SENTRY_DSN` definido, cada erro de servidor também vai ao Sentry por envelope HTTP (sem SDK, sem texto de usuário). Sem DSN, nada é enviado. **Pendência do dono:** criar a conta Sentry e colocar o DSN na Vercel.
- Alertas de latência e erro: a latência mediana/p95 e os erros já estão no painel; o aviso automático por e-mail depende do Sentry (regra de alerta no painel dele).

## 7. Backup e restauração (RNF-12)

- `scripts/backup.mjs backup`: exporta as 45 tabelas de dados do usuário (exclui `chunks` e `bible_verses`, que se reconstroem pela ingestão) em `.json.gz`.
- Agendado em `.github/workflows/backup.yml` todo dia às 05:17 UTC, guardado como artefato privado com **retenção de 30 dias**. **Pendência do dono:** criar o segredo `SUPABASE_ACCESS_TOKEN` no GitHub.
- Teste de restauração executado em 2026-11-21: backup de 882 linhas em 45 tabelas, restaurado em um esquema de teste, contagens iguais, esquema removido. O mesmo teste roda depois de cada backup no workflow.
- O Supabase também mantém seus próprios backups da plataforma (conferir o plano).

## 8. Riscos abertos

1. Injeção: rodada completa com o modelo depende de crédito.
2. Custo real do RNF-08 depende de tráfego real.
3. Sentry e segredo de backup dependem do dono.
4. Chaves coladas no chat em sessões anteriores devem ser giradas.
5. Definir limite de gasto na conta Anthropic.
