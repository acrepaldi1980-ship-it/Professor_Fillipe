# Checklist para abrir o beta (o que só você pode conferir)

Marque cada item. Os de **bloqueio** impedem abrir para a primeira turma.

## Jurídico e marca
- [ ] **Bloqueio** Revisão jurídica dos Termos de Uso e da Política de Privacidade (hoje em rascunho, versão `2026-11-18-rascunho`).
- [ ] **Bloqueio** D-12: publicar na Política de Privacidade seu nome e e-mail como encarregado de dados (`app/privacidade/page.tsx`).
- [ ] **Bloqueio** D-14: consulta de marca "Professor Filipe" no INPI (ou decidir trocar o nome).
- [ ] Conferir `docs/LICENSES.md`: nenhuma obra NC/ND/sem licença ativa (`/admin/obras`).

## Conteúdo e teologia
- [ ] **Bloqueio** Conselho teológico revisa: resposta pastoral padrão (`lib/teacher/pastoral.ts`), as 60 notas pentecostais (já publicadas por você; confirmar com o conselho), os textos das lentes e o prompt de identidade (`/admin/configuracoes`).
- [ ] Revisar as respostas sinalizadas na primeira semana (`/admin/respostas`).

## Contas e dinheiro (dependem de você)
- [ ] **Bloqueio** Crédito na Anthropic + limite de gasto mensal. Depois: rodar os evals completos (`npx tsx --env-file=.env.local evals/runners/run.ts`) e conferir os limiares da seção 16.2 (veja "Evals" abaixo).
- [ ] Crédito no Google AI Studio (voz masculina Gemini e ilustrações). Sem isso a voz usa as vozes do aparelho (só masculinas).
- [ ] **Bloqueio para cobrar** Conta Asaas: chave de API, `PAYMENT_WEBHOOK_TOKEN`, `PAYMENT_PROVIDER=asaas` na Vercel; testar um Pix e um cartão em sandbox antes da produção.
- [ ] Sentry: criar projeto e colocar `SENTRY_DSN` na Vercel; criar a regra de alerta por e-mail.
- [ ] Backup: criar o segredo `SUPABASE_ACCESS_TOKEN` no GitHub e rodar o workflow `backup` uma vez à mão.
- [ ] Girar as chaves que foram coladas no chat em sessões anteriores.
- [ ] Domínio próprio (se for usar): apontar na Vercel e atualizar o `start_url`/links.

## Evals (seção 16.2)
| Critério | Limiar | Situação em 21/11 |
| --- | --- | --- |
| Busca (top 5) | ≥ 85% | **90%** (45/50), passou |
| Crise pastoral | 100% | 6 lacunas de detecção corrigidas em código e testadas; **reexecutar com crédito** |
| Pegadinhas, injeção, lentes, fidelidade, tamanho, pergunta final | ver 16.2 | **não medidos**: sem crédito na Anthropic |

Regra do prompt 1.14: se algum falhar, parar e revisar antes de abrir. Não abra o beta sem essa rodada.

## Teste no celular (você e mais duas pessoas)
- [ ] Instalar pelo `/instalar` no Android e no iPhone (Safari: Compartilhar → Adicionar à Tela de Início).
- [ ] Percorrer J01 a J07 (`docs/ROTEIRO_TESTE_TURMA.md`): primeiro acesso, estudo por voz, aula, sermão, aprofundar, revisão, assinatura.
- [ ] Conferir voz masculina em todas as falas, avatar sincronizado, modo offline do caderno.
- [ ] Gravar o vídeo de demonstração e colocar no espaço da landing (`data-testid="demo-slot"` em `app/page.tsx`).
- [ ] Criar a primeira turma e dar o papel de revisor a quem for do conselho (`/admin/usuarios`).

## Após abrir
- [ ] Olhar `/admin/metricas` e erros nas últimas 24 horas todo dia na primeira semana.
- [ ] Ler os "Como foi essa aula?" (tabela `feedback`).
- [ ] Rodar `node scripts/cost-report.mjs` para conferir o RNF-08 com dados reais.
