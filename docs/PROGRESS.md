# Progresso

## Estado atual

Prompt 0.1 em andamento. Etapas 1 e 4 concluídas; Etapa 2 (decisões) quase fechada. Próximo: Etapa 3 (migrations e ingestão, depende do Supabase) e Etapa 5 (busca).

## Prompts concluídos

| Prompt | Data | Resumo |
| --- | --- | --- |
| 00 | 2026-11-18 | CLAUDE.md, PROGRESS.md, LICENSES.md, .gitignore e Git inicializado |
| 0.1 (Etapa 4) | 2026-11-18 | Parser de referências bíblicas (`lib/knowledge/refs-parser.ts`, `books.ts`): pt-BR e inglês, números romanos e por extenso, intervalos, listas, capítulos, livros de um capítulo, validação de capítulo; 118 testes (meta do protótipo: 60; os 200 completos vêm no Prompt 1.2) |
| 0.1 (Etapa 1) | 2026-11-18 | Next.js 15 + TypeScript estrito + Tailwind 4 + PWA básico; pastas da seção 10.3; `/api/v1/health`; `lib/platform` (Microphone e AudioPlayer, web) com `getPlatform()`; `lib/api-client` com Bearer, X-App-Version e X-Platform; i18n pt-BR; `.env.example`; Vitest |

## Decisões tomadas

| ID | Escolha | Data |
| --- | --- | --- |
| D-02 | Três níveis: Haiku 5.5 (classificador), Sonnet 5.5 (conversa), Opus 5.5 só no profundo; no protótipo o profundo usa Sonnet | 2026-11-18 |
| D-04 | STT: Groq (Whisper large-v3-turbo), chave testada e funcionando. TTS no protótipo: ElevenLabs (plano gratuito, só para teste interno, sem uso comercial); no produto: Google Cloud TTS (pt-BR) ou ElevenLabs pago. Aguardando a chave do ElevenLabs | 2026-11-18 |
| D-09 | Gemini Embedding 001 (camada gratuita), só para obras públicas, nunca para conversas de alunos | 2026-11-18 |
| D-15 | Acervo amplo de versões em vários idiomas, só com licença confirmada. Protótipo: Bíblia Livre 2018, Almeida 1911 e WEB; as demais entram no Prompt 1.2 | 2026-11-18 |
| Ajuste de especificação | Especificação v1.2 e guia v1.2 aprovados pelo Anderson ("pode corrigir o que precisar"): (1) criado o Prompt 1.6b (avatar, M17, D-18) no guia; (2) `avatar_cue` opcional no contrato desde o MVP, com só `empathetic` e `pointing` usados na interface do MVP, demais expressões na Fase 2; (3) seção 10.1: Server Components só nas páginas públicas; (4) tabela 10.5 e guia com rotas em `/api/v1`; (5) D-15 reescrita como "versão principal da Bíblia em português"; (6) bloco "Como testar" duplicado do Prompt 2.5 unificado | 2026-11-18 |

## Pendências

- Chave do ElevenLabs (D-04/D-03). Chave do Gemini: o projeto atual está sem crédito (erro 402); gerar chave em outro projeto no AI Studio. Chave da OpenAI recusada (não usada no plano).
- Supabase: URL e chaves (para as Etapas 3 e 5).
- Recomendado: apagar e recriar as chaves do Groq e do Gemini depois dos testes, pois foram coladas no chat.
- Criar repositório no GitHub e enviar o código (o repositório existe só localmente).
- Contas da Anthropic e do Supabase antes do Prompt 0.1 (guia, seção A.2).

## Problemas conhecidos

Nenhum.
