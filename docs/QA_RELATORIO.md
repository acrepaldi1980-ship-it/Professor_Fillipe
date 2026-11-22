# Relatório de qualidade (gerado por `scripts/qa-all.mjs`)

Data: 2026-11-22T04:27:19.632Z

| Etapa | Resultado | Tempo | Observação |
| --- | --- | --- | --- |
| eslint (0 warnings allowed) | OK | 7s |  |
| typecheck | OK | 4s |  |
| unit tests | OK | 6s | Tests  652 passed (652) |
| portability | OK | 0s |  |
| static build | OK | 50s |  |
| production build | OK | 47s |  |
| e2e admin | OK | 31s | 56 ok |
| e2e api-contract | OK | 52s | 6 ok |
| e2e billing | OK | 24s | 21 ok |
| e2e church-ui | OK | 14s | 9 ok |
| e2e church | OK | 46s | 38 ok |
| e2e devices | OK | 25s | 41 ok |
| e2e engagement | OK | 24s | 27 ok |
| e2e environments | OK | 27s | 35 ok |
| e2e immersive | OK | 60s | 29 ok |
| e2e j01-first-access | OK | 54s | 17 ok |
| e2e models3d | OK | 44s | 32 ok |
| e2e modes | OK | 48s | 19 ok |
| e2e notify | OK | 14s | 24 ok |
| e2e pages-smoke | OK | 370s | 1 ok |
| e2e pano | OK | 34s | 17 ok |
| e2e referral | OK | 75s | 26 ok |
| e2e rehearsal-ui | OK | 106s | 9 ok |
| e2e rehearsal | OK | 28s | 27 ok |
| e2e research | **FALHOU** | 327s | 8 ok / FAIL  deep: the research starts by itself and shows progress / FAIL  deep: the study is delivered with its sections (3) / FAIL  deep: every key word comes from the original-language data (Strong number present) |
| e2e review | OK | 18s | 15 ok |
| e2e security | OK | 12s | 16 ok |
| e2e spanish | OK | 40s | 15 ok |
| e2e user-functions | **FALHOU** | 158s | 46 ok / FAIL  study: the student's question shows and the teacher answers / FAIL  study: the answer offers the cited verses as buttons |
| e2e visuals | OK | 38s | 17 ok |
| e2e vr | OK | 7s | 4 ok |

Total: 29/31 etapas OK
