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
| `FIELD_ENCRYPTION_KEY` | sensível | chave de criptografia dos campos de fé, gerada só para produção |

O app em produção **não usa** o token pessoal do Supabase: só a chave pública e as funções restritas (migration 0007).

## Modelo de busca no servidor

O modelo multilíngue (multilingual-e5-small) roda dentro da função da Vercel (ONNX, Linux x64, 71 MB empacotados). A **primeira** conversa depois de um tempo parado leva ~7 a 13 s (o servidor baixa e carrega o modelo); as seguintes levam ~1 s de busca.

## Limites a conhecer

- **Groq (gratuito):** teto de 200 mil tokens por dia por modelo (≈ 60 respostas por modelo). Ao acabar, o professor responde com a mensagem amigável de falha (`degraded`), sem quebrar a tela. A janela é rolante (libera em ~20 a 40 min).
- **E-mail do link mágico:** o Supabase limita a ~2 e-mails por hora; para a turma, configurar SMTP próprio gratuito (Resend ou Brevo).
- **Google (modo Teste):** só e-mails cadastrados como "usuários de teste" no Google Cloud conseguem entrar até o app ser publicado.
