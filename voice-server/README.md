# Servidor de voz de locutor (Kokoro)

A voz de locutor mais natural que existe de graça (Kokoro-82M, licença Apache-2.0, voz masculina em português do Brasil) precisa de mais processador
do que a hospedagem gratuita do app oferece (lá ela leva 8 a 14 s por frase). Este servidor roda **numa máquina separada** e o app o usa
automaticamente; se ele estiver lento ou dormindo, o app cai sozinho na voz que já tem (Piper), então nada quebra.

## Opção A: Hugging Face Space (grátis, sem cartão)
1. Crie uma conta em huggingface.co, depois **New Space** → SDK **Docker** → CPU basic (gratuito).
2. Envie os arquivos `Dockerfile` e `server.mjs` desta pasta para o Space (e, no topo de um `README.md` do Space, `app_port: 7860`).
3. Em **Settings → Variables and secrets**, crie o segredo `VOICE_TOKEN` com uma senha longa qualquer.
4. Quando o Space ficar "Running", sua URL é `https://SEU-USUARIO-NOME-DO-SPACE.hf.space`.
5. Aviso honesto: o plano gratuito dorme após 48 h sem uso e leva cerca de 1 a 2 minutos para acordar (nesse tempo o app usa a voz reserva).

## Opção B: Oracle Cloud "Always Free" (grátis, pede cartão só para verificar)
Máquina ARM com 4 núcleos e 24 GB: a mais rápida das gratuitas. Instale o Docker, rode
`docker build -t voz . && docker run -d --restart always -p 7860:7860 -e VOICE_TOKEN=SUA_SENHA voz` e abra a porta 7860 (de preferência atrás de HTTPS).

## Ligar ao app (Vercel → Settings → Environment Variables)
| Variável | Valor |
| --- | --- |
| `REMOTE_TTS_URL` | a URL do servidor, sem barra no final |
| `REMOTE_TTS_TOKEN` | a mesma senha do `VOICE_TOKEN` |
| `VOICE_PROVIDER` | `remote` |

Ajustes de estilo (opcionais): `KOKORO_SPEED` (0,9 = calmo; 1,0 mais rápido), `KOKORO_SPEAKER` (44 = Alex, 45 = Santa), `KOKORO_DEEPEN` (1 = natural; 0,95 = mais grave),
`REMOTE_TTS_TIMEOUT_MS` (7000 = tempo máximo de espera antes de usar a voz reserva).

Teste rápido do servidor: `curl -s -X POST URL/tts -H "Authorization: Bearer SUA_SENHA" -d '{"text":"Olá, tudo bem?"}' -o teste.wav`.
