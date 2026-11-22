# Relatório de qualidade — 22/11/2026

Como rodar tudo: `node scripts/qa-all.mjs` (lint sem avisos, tipos, unitários, portabilidade, build estático, build de produção e todos os testes de ponta a ponta contra um servidor local com IA simulada). Cobertura: `node scripts/qa-coverage.mjs`.

## Resultado final (após as correções abaixo)
| Camada | Resultado |
| --- | --- |
| ESLint (0 avisos), TypeScript estrito, portabilidade, build estático e de produção | OK |
| Testes unitários | 658 passam |
| E2E locais (31 scripts, IA simulada estável) | todos passam |
| **Produção** (https://professor-filipe.vercel.app): contrato da API, rotas extras, varredura de páginas | **OK** (1.023 chamadas, 252 visitas de página, 0 problemas) |

## Novos testes desta rodada
- `api-contract.mjs`: toda rota da API × 3 papéis (visitante, aluno, admin) × 5 chamadas com entradas ruins: nenhuma responde 5xx, todo erro é JSON com código, rotas privadas recusam visitante (401), rotas de admin recusam aluno.
- `pages-smoke.mjs`: todas as 42 páginas × 3 papéis × celular e computador: sem erro de página, sem 5xx, sem rolagem horizontal, imagens com `alt`, botões/links/campos com nome, título em cada tela, visitante sem login é enviado ao `/login`.
- `endpoints-extra.mjs`: referências cruzadas, palavras originais, grafo, interlinear, transcrição (visitante, vazio, > 8 MB), notas de admin, arqueologia, curiosidades, checkout simulado.
- Testes unitários: seções do documento, busca resiliente, Tabernáculo, tours de fotos, VR.
- `scripts/qa-all.mjs` e `scripts/qa-coverage.mjs`: um comando roda tudo; a auditoria lista rotas e páginas sem teste.

## Defeitos reais encontrados e corrigidos
1. **Segurança/custo:** `/voice/transcribe` não exigia login nem tinha limite: qualquer pessoa podia gastar a cota do reconhecimento de fala. Agora exige login e limita por usuário.
2. **Seções do documento sumindo:** na montagem paralela de aula, sermão e estudo, uma resposta antiga e lenta substituía o documento e apagava uma seção já pronta (a "Aplicação" sumia). A tela agora lê o documento guardado a cada resposta (aula/sermão e Aprofundar).
3. **Telas de onboarding:** sem guarda de sessão; numa recarga ou para visitante disparavam erro 401 não tratado e ficavam presas em "carregando". Agora esperam a sessão e mandam o visitante ao login.
4. **Conversa quebrava com a busca lenta:** quando o banco cancelava uma busca por tempo, o turno inteiro falhava ("Não consegui responder agora"). Agora tenta de novo uma vez e, se falhar, responde sem trechos da biblioteca (o professor diz que não achou nas fontes, RA-09).
5. **Acessibilidade:** telas de acesso negado, de fechamento vazio e de erro sem título (h1).
6. **Lista de Imersão:** tocar num item não abria o ambiente (a página não reagia à mudança de URL).
7. Testes com expectativas velhas (planos, atalhos do painel, auditoria 3D) atualizados.

## O que esta bateria NÃO cobre (precisa de gente, aparelho ou chave real)
- **Qualidade das respostas da IA** (evals com modelo real): rodar `evals/` quando houver cota (Groq/Cerebras/Gemini) ou chave da Anthropic.
- **Aparelhos reais:** Android e iPhone (Safari), instalação do PWA, microfone, voz, notificações push, 30 quadros por segundo na imersão, VR em Quest/Vision Pro.
- **Pagamentos reais** (Asaas), e-mails, Sentry, domínio próprio.
- **Leitores de tela** e navegação por teclado completa (só verificamos nomes e títulos).
- **Carga:** nenhum teste de muitos usuários simultâneos.
- **Texto e licenças:** revisão do consultor, conferência de licenças das fotos, revisão do espanhol por falante nativo.
- A busca na biblioteca teve respostas de 5 a 15 s no ambiente de teste (proxy do sandbox); medir a latência real na produção com tráfego.
