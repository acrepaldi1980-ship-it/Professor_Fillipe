# Progresso

## Estado atual

Prompt 0.1 em andamento. Etapa 1 (projeto base) concluída. Aguardando as decisões da Etapa 2 (D-02, D-03, D-04, D-09, D-15) e o preenchimento do `.env.local` antes das Etapas 3 a 9.

## Prompts concluídos

| Prompt | Data | Resumo |
| --- | --- | --- |
| 00 | 2026-11-18 | CLAUDE.md, PROGRESS.md, LICENSES.md, .gitignore e Git inicializado |
| 0.1 (Etapa 1) | 2026-11-18 | Next.js 15 + TypeScript estrito + Tailwind 4 + PWA básico; pastas da seção 10.3; `/api/v1/health`; `lib/platform` (Microphone e AudioPlayer, web) com `getPlatform()`; `lib/api-client` com Bearer, X-App-Version e X-Platform; i18n pt-BR; `.env.example`; Vitest |

## Decisões tomadas

| ID | Escolha | Data |
| --- | --- | --- |
| Ajuste de especificação | Especificação v1.2 e guia v1.2 aprovados pelo Anderson ("pode corrigir o que precisar"): (1) criado o Prompt 1.6b (avatar, M17, D-18) no guia; (2) `avatar_cue` opcional no contrato desde o MVP, com só `empathetic` e `pointing` usados na interface do MVP, demais expressões na Fase 2; (3) seção 10.1: Server Components só nas páginas públicas; (4) tabela 10.5 e guia com rotas em `/api/v1`; (5) D-15 reescrita como "versão principal da Bíblia em português"; (6) bloco "Como testar" duplicado do Prompt 2.5 unificado | 2026-11-18 |

## Pendências

- Decisões da Fase 0 (Prompt 0.1): D-02 (modelos de IA), D-03 (voz do professor), D-04 (fornecedor de voz), D-09 (fornecedor de embeddings), D-15 (versão principal da Bíblia).
- Criar repositório no GitHub e enviar o código (o repositório existe só localmente).
- Contas da Anthropic e do Supabase antes do Prompt 0.1 (guia, seção A.2).

## Problemas conhecidos

Nenhum.
