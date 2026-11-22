# Relatório de qualidade (gerado por `scripts/qa-all.mjs`)

Data: 2026-11-22T03:30:42.296Z

| Etapa | Resultado | Tempo | Observação |
| --- | --- | --- | --- |
| eslint (0 warnings allowed) | OK | 8s |  |
| typecheck | OK | 4s |  |
| unit tests | OK | 7s | Tests  652 passed (652) |
| portability | OK | 0s |  |
| static build | OK | 55s |  |
| production build | OK | 42s |  |
| e2e admin | **FALHOU** | 35s | 54 ok / FAIL  admin: settings list plans, sermon types (4 with Explicativo) and prompt versions / FAIL  page: an admin sees the hub with every section |
| e2e api-contract | **FALHOU** | 73s | 4 ok / FAIL  every error is JSON with an error code  visitor GET /account -> 405  / visitor POST /account -> 405  / visitor POST /account -> 405  / visitor PUT /account -> 405  / student GET /account -> 405  / student POST /account -> 405  / student POST /account -> 405  / student PUT /account -> 405  / FAIL  private routes refuse visitors (401)  visitor POST /feedback -> 400 / visitor POST /feedback ->  |
| e2e billing | OK | 21s | 21 ok |
| e2e church-ui | OK | 14s | 9 ok |
| e2e church | OK | 45s | 38 ok |
| e2e devices | **FALHOU** | 45s | 40 ok |
| e2e engagement | OK | 32s | 27 ok |
| e2e environments | OK | 28s | 35 ok |
| e2e immersive | **FALHOU** | 72s | 27 ok / FAIL  guide: the teacher was told where the student is (zone and direction) / FAIL  guide: and the sourced historical fact sheet |
| e2e j01-first-access | OK | 48s | 17 ok |
| e2e models3d | **FALHOU** | 26s | 31 ok / FAIL  every change is audited |
| e2e modes | OK | 47s | 19 ok |
| e2e notify | OK | 14s | 24 ok |
| e2e pages-smoke | **FALHOU** | 367s | 0 ok / FAIL  252 page visits (42 pages x 3 roles x 2 sizes)  66 problems |
| e2e pano | **FALHOU** | 55s | 16 ok / FAIL  guide: the teacher answers  Você /  / O que estou vendo? /  / O professor está pensando /  / 🎤 / Enviar |
| e2e referral | OK | 64s | 26 ok |
| e2e rehearsal-ui | **FALHOU** | 110s | 7 ok / ERROR page.waitForSelector: Timeout 5000ms exceeded. |
| e2e rehearsal | OK | 49s | 27 ok |
| e2e research | **FALHOU** | 421s | 4 ok / FAIL  deep: the study is delivered with its sections (5) / FAIL  deep: every key word comes from the original-language data (Strong number present) / FAIL  deep: asking for a change in the conversation rewrites the summary |
| e2e review | OK | 17s | 15 ok |
| e2e security | OK | 10s | 16 ok |
| e2e spanish | **FALHOU** | 51s | 14 ok / FAIL  documents: the section is asked in Spanish for a Spanish-speaking student |
| e2e user-functions | **FALHOU** | 147s | 46 ok / FAIL  study: the student's question shows and the teacher answers / FAIL  study: the answer offers the cited verses as buttons |
| e2e visuals | OK | 37s | 17 ok |
| e2e vr | OK | 7s | 4 ok |

Total: 20/31 etapas OK
