# IAs gratuitas em paralelo (roteador de IA)

O app não depende de uma IA só. Todas as chamadas (professor, sugestões de documento, resumos, reescrita de busca) passam por um **roteador** (`lib/llm/`) que escolhe um *endpoint* (provedor + modelo + chave), chama e, se ele estiver no limite, sem crédito, fora do ar ou responder mal, **troca para outro sozinho**, sem o aluno perceber.

## Como funciona

- **Pool automático:** um provedor entra no pool só por ter chave configurada. Cada modelo de cada provedor, com cada chave, é um endpoint. Várias chaves do mesmo provedor multiplicam a cota gratuita (`GROQ_API_KEYS=a,b,c`).
- **Espalha a carga:** dentro de cada nível de qualidade, o tráfego é sorteado entre os endpoints (com peso), então nenhum bate no limite sozinho. Níveis: 0 = Claude (pago), 1 = bons gratuitos, 2 = pequenos e rápidos. Respostas do professor preferem o nível mais forte; tarefas pequenas (reescrita de busca, resumos) preferem os rápidos.
- **Pausa compartilhada:** quando um endpoint devolve limite (429), sem cota, chave inválida ou erro, ele sai do pool por um tempo (30 s a 1 h, conforme o erro, respeitando `Retry-After`) e **todas as instâncias do servidor** sabem disso (banco, funções protegidas pelo segredo do servidor). Ninguém fica martelando uma chave bloqueada.
- **Limite por chave:** no máximo 4 chamadas simultâneas por chave em cada instância, para um pico não derrubar um endpoint.
- **Resposta ruim também troca:** se a resposta não passa na validação (esquema), o roteador tenta o próximo endpoint (até 3 respostas ruins).
- **Quando tudo está ocupado:** espera até 12 s pelo endpoint que volta primeiro; se ainda não der, devolve um erro claro e a tela mostra "o serviço de IA está sobrecarregado, tente em alguns minutos".
- **Montagem em paralelo:** ao montar uma aula, um sermão ou um estudo, várias seções são escritas **ao mesmo tempo**, cada uma em um endpoint diferente, e o servidor mescla os resultados sem sobrescrever. Isso reduz o tempo e usa a cota de vários provedores de uma vez.
- **Painel:** em *Admin > Métricas > IAs gratuitas em uso* aparece, por endpoint, quantas chamadas deram certo, quantas bateram no limite, a latência média e quem está em pausa agora.

## Provedores prontos (basta a chave)

Os limites mudam com frequência: confira na página de cada um. Todos têm camada gratuita na data deste documento; **nenhum pede cartão** para começar, exceto quando indicado.

| Provedor | Variável | Onde criar a chave | Observação |
| --- | --- | --- | --- |
| Groq | `GROQ_API_KEY` ou `GROQ_API_KEYS` | console.groq.com | já configurado; 3 modelos de chat ativos hoje |
| Cerebras | `CEREBRAS_API_KEY(S)` | cloud.cerebras.ai | **atenção (nov/2026): a camada gratuita sem cartão acabou; hoje é um crédito de teste de US$ 5 que pede cartão e vence em 30 dias.** Só use se aceitar isso |
| Google Gemini (camada gratuita) | `GEMINI_LLM_API_KEY(S)` | aistudio.google.com, **em um projeto sem faturamento pré-pago** | a chave atual do app está em projeto pré-pago e dá erro 402 |
| OpenRouter (modelos `:free`) | `OPENROUTER_API_KEY(S)` | openrouter.ai | cota diária pequena por chave; ótimo como reserva |
| Mistral (plano Experiment) | `MISTRAL_API_KEY(S)` | console.mistral.ai | pede verificação de telefone |
| SambaNova | `SAMBANOVA_API_KEY` | cloud.sambanova.ai | |
| NVIDIA NIM | `NVIDIA_API_KEY` | build.nvidia.com | créditos de teste |
| Cloudflare Workers AI | `LLM_EXTRA` (sem código) | dash.cloudflare.com > Workers AI | 10.000 neurons por dia sem cartão; endereço `https://api.cloudflare.com/client/v4/accounts/<ID>/ai/v1`; confirmar limites e suporte a respostas estruturadas |
| GitHub Models | `GITHUB_MODELS_TOKEN` | github.com/settings/tokens | limites baixos; só reserva |

Trocar os modelos de um provedor sem mexer no código: `CEREBRAS_MODELS=modelo-1,modelo-2`. Usar só alguns provedores: `LLM_ONLY=groq,cerebras`.

**Qualquer outro provedor compatível com a API da OpenAI** entra sem código, com `LLM_EXTRA`:

```json
[{"id":"meuprovedor","baseUrl":"https://api.exemplo.com/v1","keyEnv":"MEUPROVEDOR_API_KEY","models":[{"name":"modelo-x","tier":1,"tools":false}]}]
```

**Modelos gratuitos do OpenRouter são descobertos sozinhos:** os nomes `:free` mudam toda hora, então a cada 6 horas o servidor consulta a lista atual do OpenRouter e usa os gratuitos que aceitam resposta estruturada (os de maior contexto primeiro). Se você definir `OPENROUTER_MODELS=...`, essa descoberta é desligada e vale a sua lista.

**Diagnóstico:** em *Admin > Métricas > IAs gratuitas em uso*, a linha "Em pausa agora" mostra o motivo exato (por exemplo `quota: ... prepayment credits are depleted` quando a chave do Gemini está em projeto pré-pago).

**Cota da conta, não do modelo:** quando o erro é de cota diária, falta de crédito ou chave inválida, o roteador pausa **todos os modelos daquela chave** de uma vez (no OpenRouter, por exemplo, os modelos `:free` dividem uma cota diária pequena da conta; colocar US$ 10 de crédito no OpenRouter, uma única vez, libera 1000 requisições gratuitas por dia, segundo o próprio site).

## Como colocar as chaves em produção

1. Crie a conta e a chave no provedor (links acima).
2. Na Vercel: projeto *professor-filipe* > Settings > Environment Variables > adicione a variável (ex.: `CEREBRAS_API_KEY`) para Production e faça um novo deploy. **Não cole chaves no chat.**
3. Abra *Admin > Métricas*: o novo endpoint aparece depois das primeiras chamadas.

## Em larga escala

- **Mais usuários = mais chaves.** A cota gratuita é por conta/chave. O caminho barato é criar mais chaves (contas diferentes dos provedores, dentro dos termos de cada um) e listá-las em `*_API_KEYS`. O roteador distribui entre elas.
- **O gargalo gratuito é o tempo, não o custo.** Para uma turma grande abrindo documentos ao mesmo tempo, os limites por minuto vão aparecer; o roteador absorve com pausa e troca, mas a resposta pode demorar alguns segundos a mais.
- **Quando passar de um limite razoável**, o Claude (pago) entra como nível 0 sem mudar nada: basta o crédito na Anthropic. O custo é medido em `docs/SECURITY_REVIEW.md` (RNF-08).
- **Qualidade:** modelos gratuitos escrevem pior que o Claude e podem errar. Tudo o que o app gera continua preso às fontes (RA-09), mas a revisão do conselho teológico segue necessária.
- **Termos de uso:** respeite os termos de cada provedor (por exemplo, não criar contas falsas para burlar limites). Para um produto pago, o caminho sustentável é o Claude como base e os gratuitos como reserva.
