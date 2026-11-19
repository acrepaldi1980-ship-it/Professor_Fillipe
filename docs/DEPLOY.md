# Publicação (Vercel)

**Endereço:** https://professor-filipe.vercel.app (projeto `professor-filipe`, conta Vercel do Anderson, plano Hobby; separado do `ganhos-cnc`).

## Como publicar uma nova versão

```bash
node scripts/deploy-vercel.mjs
```

O script envia os arquivos versionados no Git (sem conexão com o GitHub), garante as variáveis de ambiente e cria o deploy de produção. O token da Vercel fica no ambiente da sessão (nunca no código).

## Variáveis de ambiente no servidor

| Variável | Tipo | Observação |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | pública | endereço do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | pública | chave pública (segura para o navegador) |
| `NEXT_PUBLIC_APP_VERSION` | pública | versão do app (cabeçalho `X-App-Version`) |
| `GROQ_API_KEY` | sensível | IA gratuita do protótipo |
| `TEACHER_LLM_PROVIDER` | normal | `groq` (trocar para `anthropic` quando houver chave) |
| `TRANSFORMERS_CACHE_DIR` | normal | `/tmp/hf-cache` (cache do modelo de busca) |
| `REFERENCE_DATABASE_URL` | sensível | banco de referência no Neon, usuário `app_reader` (só leitura). O administrador (`NEON_OWNER_URL`) nunca vai para a Vercel |
| `FIELD_ENCRYPTION_KEY` | sensível | chave de criptografia dos campos de fé, gerada só para produção |

O app em produção **não usa** o token pessoal do Supabase: só a chave pública e as funções restritas (migration 0007).

## Modelo de busca no servidor

O modelo multilíngue (multilingual-e5-small) roda dentro da função da Vercel (ONNX, Linux x64, 71 MB empacotados). A **primeira** conversa depois de um tempo parado leva ~7 a 13 s (o servidor baixa e carrega o modelo); as seguintes levam ~1 s de busca.

## Limites a conhecer

- **Groq (gratuito):** teto de 200 mil tokens por dia por modelo (≈ 60 respostas por modelo). Ao acabar, o professor responde com a mensagem amigável de falha (`degraded`), sem quebrar a tela. A janela é rolante (libera em ~20 a 40 min).
- **E-mail do link mágico:** o Supabase limita a ~2 e-mails por hora; para a turma, configurar SMTP próprio gratuito (Resend ou Brevo).
- **Google (modo Teste):** só e-mails cadastrados como "usuários de teste" no Google Cloud conseguem entrar até o app ser publicado.

## Banco híbrido (Neon)

- Esquema em `neon/*.sql`; aplicar com `node --env-file=.env.local scripts/neon-migrate.mjs` (cria também o usuário `app_reader` e grava `REFERENCE_DATABASE_URL` no `.env.local`).
- Carga: `scripts/ingest/greek-nt-step.ts`, `hebrew-ot-step.ts`, `versification-step.ts` e `crossrefs-tsk.ts` (todos gravam no Neon; a ficha da obra em `works` fica no Supabase).
- Para rodar scripts aqui, o ambiente precisa liberar o endereço do projeto Neon (`ep-...neon.tech`) e a chave da API `console.neon.tech`.
- Plano gratuito: 1 GB por projeto; ao passar disso a escrita falha (sem cobrança). Novo projeto = mais 1 GB.
