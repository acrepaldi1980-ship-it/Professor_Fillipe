# Análise de arquitetura: desempenho e segurança (28/11/2026)

Pedido do dono: rever toda a arquitetura para garantir **desempenho** e **segurança**, e responder se migrar 100% do banco para o Neon deixaria o app mais seguro e mais rápido.

## 1. Resposta curta

**Migrar 100% para o Neon não deixaria o app mais rápido nem mais seguro. Não recomendo.**

- **Mais rápido? Não.** Medi, de dentro do servidor da Vercel, a mesma busca híbrida nos dois bancos: **Supabase 440 a 990 ms (típico 590 ms) e Neon 520 a 555 ms**. É o mesmo mecanismo (Postgres) com computação pequena nos dois planos gratuitos. O tempo que o aluno sente não está no banco (seção 3).
- **Mais seguro? Não, ficaria pior.** Hoje o Supabase entrega login (Google e e-mail), tokens assinados e *Row Level Security* (RLS): o próprio banco impede um aluno de ler dados de outro, mesmo se uma rota da API tiver um erro. No Neon puro isso teria de ser refeito no código do app (uma credencial poderosa no servidor e a autorização feita à mão), que é exatamente o desenho mais fácil de invadir.
- **Cabe no plano gratuito? Não.** Os dados somam cerca de 1,5 GB (Neon: 759 MB + 367 MB; Supabase: mais uns centenas de MB) e o limite é 1 GB por projeto Neon. Para um banco só, seria preciso plano pago (precisa de cartão, e você pediu para evitar).
- **Risco da migração:** reescrever login, sessões, 70 tabelas, políticas de acesso e 80 rotas; um erro aqui é uma falha de segurança, não só de desempenho.

O que melhora de verdade o tempo e a segurança está na seção 5; parte já foi feita hoje.

## 2. Arquitetura hoje

```
Aluno (PWA)  ──HTTPS──►  Vercel (iad1, Hobby, 12 funções)  ──►  Supabase  (login, dados do aluno, RLS, textos da Bíblia, verbetes, notas próprias)
                              │                              ──►  Neon 1  (759 MB: obras, léxicos, grafo, Josefo)   somente leitura
                              │                              ──►  Neon 2  (367 MB: obras, tradução, conteúdo do app) somente leitura
                              ├──►  IA: Groq / OpenRouter / Gemini (cotas gratuitas), Anthropic sem crédito
                              ├──►  Wikipédia (pesquisa fora do app)
                              └──►  Modal (voz)
```
- Busca: embedding (modelo e5 de 384 dimensões rodando **dentro** da função da Vercel) + palavra-chave + referências exatas, fundidos por RRF.
- Dados do aluno ficam só no Supabase, com RLS em todas as tabelas. Os dois Neon têm apenas conhecimento público, com papel somente leitura (`app_reader`).

## 3. Onde o tempo vai (medido)

| Etapa | Medido | Observação |
| --- | --- | --- |
| Embedding da pergunta (a quente) | 7 a 12 ms | rápido |
| Embedding + carga do modelo (instância fria) | 4 a 10 s | **a maior perda evitável**; aquecimento agendado ligado em 28/11 |
| Busca híbrida no Supabase (a quente) | 440 a 990 ms | uma ida ao banco |
| Busca híbrida nos Neon (a quente) | ~530 ms | duas partições em paralelo |
| Consulta simples ao Neon | 16 a 55 ms | rede e banco estão bem |
| Verificação do token do aluno | 100 a 300 ms por pedido | **corrigido hoje** (seção 5) |
| IA gratuita para responder | 3 a 30 s, e cotas diárias acabam | **o maior tempo percebido**; sem crédito da Anthropic |
| Passagens extras (reescrever, ajustar tamanho, pesquisa fora) | +2 a 8 s cada | só quando necessárias |

Conclusão: com tudo quente, a busca leva cerca de 1 s. O que o aluno sente como "demora" é (1) instância fria, (2) a IA gratuita e (3) a resposta só aparecer inteira no fim. O banco não é o gargalo.

## 4. Segurança: o que já protege e o que encontrei

**Já protege (verificado hoje):** RLS em todas as tabelas de usuário (49 na revisão de 21/11, mais 5 novas do leitor); o visitante anônimo recebe `[]` nas tabelas pessoais e 401 ao tentar gravar; nenhuma tabela pessoal vaza dados; as rotas pedem token; limite de requisições por usuário e IP no banco; defesa contra injeção de comandos no professor; campos sensíveis cifrados (AES-256-GCM); papéis de administrador não se autoatribuem; os bancos Neon têm papel somente leitura; sem CORS aberto na API (o pré-voo responde sem `Access-Control-Allow-Origin`); a chave pública do Supabase é pública por desenho e sozinha não dá acesso.

**Achados e o que fiz:**
| # | Achado | Gravidade | Situação |
| --- | --- | --- | --- |
| 1 | Faltavam cabeçalhos de segurança (só havia HSTS): sem proteção contra clickjacking, sniffing de tipo, referrer, permissões | média | **corrigido e no ar hoje** (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `COOP`, CSP de `frame-ancestors`/`base-uri`/`object-src`) |
| 2 | Cada pedido consultava o servidor de login para validar o token (lento) | desempenho | **corrigido hoje**: validação local com a chave pública (ES256); administração, conta e cobrança continuam consultando o servidor |
| 3 | `npm audit` de produção: 3 alertas (MapLibre GL crítico: XSS no sanitizador; PostCSS alto, dentro do Next, em tempo de build) | média | **aberto**: as correções exigem saltos de versão maiores (MapLibre 6, Next 16); precisa de testes das telas de mapa. Não usamos HTML de usuário nos mapas, mas vale atualizar |
| 4 | CSP sem restrição de scripts e estilos | média | **aberto**: precisa de implantação medida (modo relatório primeiro) por causa de mapa, 3D e WebAssembly |
| 5 | Token de administração do Supabase deste ambiente foi recusado; o backup diário do GitHub também usa um token (`SUPABASE_ACCESS_TOKEN`) | alta (backup) | **depende do dono**: conferir se o backup do GitHub está rodando e girar os tokens |
| 6 | Chaves coladas em chats antigos (risco registrado em 21/11) | alta | **depende do dono**: girar |
| 7 | Sem Sentry (sem alerta de erro e ataque) | média | **depende do dono**: criar conta e colocar o DSN |
| 8 | Sem firewall de borda: limite de requisições só dentro da aplicação | média | **recomendado**: ligar o Firewall da Vercel (regra de limite e "Attack Challenge Mode" em caso de ataque), que existe no plano gratuito |
| 9 | Autenticação em dois fatores na conta do dono (Supabase, Vercel, GitHub, Neon, Google) | alta | **depende do dono** |

Sobre "um sistema que não seja invadido": nenhum sistema tem garantia absoluta. O que dá para fazer, e está em andamento, é reduzir a superfície (cabeçalhos, mínimo privilégio), limitar o estrago de um erro (RLS no banco, bancos de conhecimento somente leitura), detectar (alertas) e se recuperar (backup testado). O ponto mais importante é manter os dados dos alunos no banco com RLS, que a migração total para o Neon enfraqueceria.

## 5. Plano

**Feito hoje (28/11/2026), sem decisão do dono:**
1. Cabeçalhos de segurança em todas as respostas.
2. Validação local do token do aluno (economiza 100 a 300 ms por pedido).
3. Cache de CDN para os dados públicos da Bíblia (texto, referências cruzadas, palavras do original): 160 ms em vez de 285 ms, e sem tocar no banco.
4. Aquecimento a cada 4 minutos (aplicado a pedido do dono), medição no `?bench=1` do aquecimento.

**Próximo (eu faço, sem custo), em ordem de ganho:**
1. **Resposta em fluxo:** mostrar e falar a resposta enquanto é gerada (hoje o texto só aparece no fim): reduz o tempo percebido de 10 a 25 s para 2 a 4 s até as primeiras palavras.
2. **Embedding fora da função:** mover o modelo para um serviço sempre quente (Modal, que já usamos para a voz): some o atraso de 4 a 10 s a frio e alivia o limite de 12 funções.
3. **Cache de respostas e de buscas** de perguntas comuns (nomes bíblicos, versículos) compartilhado entre alunos.
4. **Menos passagens da IA** (juntar reescrita e checagem de tamanho) e orçamento de tempo mais curto.
5. **Reescrever a busca híbrida do Supabase com avaliação** (a tentativa de 0043 mudou 22% dos resultados e foi desfeita).
6. Atualizar MapLibre e Next, e implantar CSP de scripts em modo relatório.

**Depende de você (decisões e ações):**
- **D-27 (decisão):** banco. Opções na seção 6.
- **D-28 (decisão):** orçamento mensal para desempenho e segurança. O maior ganho de tempo é crédito da Anthropic (respostas de 3 a 6 s com qualidade melhor); depois Vercel Pro (limite de funções, firewall, duração maior) e Supabase Pro (backup diário e computação dedicada).
- Girar os tokens e chaves antigos; ligar autenticação em dois fatores; criar o Sentry; informar a **região do projeto Supabase** (Settings > Infrastructure) para eu conferir se está perto da Vercel (iad1, Virgínia).

## 6. Opções para o banco (D-27)

| Opção | Desempenho | Segurança | Custo | Risco |
| --- | --- | --- | --- | --- |
| **A. Manter o híbrido e otimizar (recomendada)** | igual ao medido; ganhos vêm da seção 5 | mantém RLS e login do Supabase; conhecimento público somente leitura | R$ 0 | baixo |
| B. Conhecimento todo no Neon, Supabase só login e dados do aluno | sem ganho medido (~0,55 s nos dois); simplifica a leitura | melhora a separação (dado pessoal fica só no Supabase) | R$ 0 se couber (não cabe em 1 GB; precisa de mais um Neon) | médio: copiar 12 mil trechos e 780 mil versículos e refazer as buscas |
| C. 100% Neon (login, usuários, tudo) | sem ganho; perde as ferramentas do Supabase | **pior**: some a RLS por token e o login pronto | pode exigir plano pago (1,5 GB) | **alto** |
| D. Planos pagos (Supabase Pro ou Neon Launch, Vercel Pro) | computação dedicada, sem pausa, mais funções e firewall | backup diário, mais recursos de proteção | ~US$ 20 a 25 por mês cada | baixo |

Recomendação: **A agora**, e **D** (primeiro crédito da Anthropic, depois Vercel Pro) quando houver orçamento, porque é onde estão o tempo e a proteção extras. B só vale se, depois das melhorias, a medição mostrar que a busca no Supabase é o gargalo.

## 7. Atualização (28/11/2026): modelo de busca sempre quente

- **Serviço externo gratuito não é possível:** os "Spaces" Docker do Hugging Face em CPU gratuita agora exigem assinatura PRO (erro 402), e o Modal só pode ser publicado com o token do dono numa máquina com a ferramenta de linha de comando. Alternativas (Render, Fly, Cloud Run, Oracle) pedem cartão.
- **Medido na Vercel (campo `embedLoad` do `/api/v1/warmup`):** carregar o modelo numa instância nova leva **2,06 s** (importar 0,16 s; arquivos do modelo 0,25 s; sessão ONNX 1,63 s; primeira execução 0,02 s), não os 4 a 10 s que aparecia antes (isso incluía bancos frios e o modelo de voz). A 7 a 12 ms por pergunta quando quente.
- **O que foi feito:** a rota do professor passa a começar a carregar o modelo no começo do pedido, em paralelo com o login e a leitura da sessão. O aquecimento a cada 4 minutos mantém uma instância quente das 07h às 23h (Brasília).
- **Opcional (você, no SQL Editor do Supabase):** deixar o aquecimento 24 horas, para não haver primeira pergunta fria de madrugada ou em outros fusos:
```sql
select cron.unschedule('app-warmup');
select cron.schedule('app-warmup', '*/4 * * * *', $$select net.http_get('https://professor-filipe.vercel.app/api/v1/warmup', timeout_milliseconds := 60000)$$);
```

### 7.1 O que a investigação achou de verdade (28/11/2026)
O atraso da primeira pergunta depois de uma pausa **não é o modelo de busca** (2 s). Medindo dentro da Vercel, chamada por chamada (`/api/v1/warmup?bench=1`):

| Etapa numa instância nova | Tempo |
| --- | --- |
| Carregar o modelo de busca | 2,1 s |
| Consulta simples ao Supabase | 0,2 a 0,8 s |
| **Primeira busca híbrida no Supabase** (`api_search_chunks`) | **3 a 5,6 s** (tempo até a resposta chegar, medido com a requisição crua; o corpo vem em 2 ms) |
| Segunda busca em diante | 0,5 a 1,0 s |
| Primeira consulta ao Neon | 0,6 a 1,0 s |

- Repetir a requisição depois de 1,1 s (tentativa de "segunda chamada") **não ajuda**: a segunda também demora. Por isso essa tentativa foi removida do código.
- Não depende só de a instância ser nova: depois de 25 s parado a primeira busca levou 2,8 s; depois de 50 s, 0,6 s. É um comportamento do lado do Supabase (plano gratuito, computação compartilhada).
- **O que o dono pode testar no SQL Editor do Supabase** (baixo risco, reversível): desligar a compilação JIT do Postgres, que costuma deixar a primeira execução de consultas vetoriais lenta:
```sql
alter database postgres set jit = off;
```
  Depois, rodar `https://professor-filipe.vercel.app/api/v1/warmup?bench=1&novoice=1` duas ou três vezes (esperando 30 s entre elas) e comparar o campo `raw_search`: se o primeiro `headers_ms` cair de 3 a 5 s para menos de 1 s, a causa era essa. Para desfazer: `alter database postgres reset jit;`.
- Se não resolver, o próximo passo é rodar `explain (analyze, buffers)` da função de busca, para ver se o tempo é leitura de disco do índice vetorial (então a solução seria um plano pago com mais memória) ou outro ponto.

### 7.2 Resultado do teste do JIT (28/11/2026): não era o JIT
Com `jit = off`, quatro medições seguidas (35 s entre elas) deram, para a primeira busca crua: **5,7 s, 0,57 s, 0,61 s e 3,8 s**. A lentidão continua aparecendo de vez em quando (2 de 4), e não depende de a instância da Vercel ser nova (as medições rápidas e lentas ocorreram nos dois casos). Depois da primeira, a busca leva sempre 0,5 a 0,7 s; o Neon fica estável em 0,53 s.

**Hipótese seguinte:** o índice vetorial é tirado da memória do banco entre uma chamada e outra (computação pequena e compartilhada do plano gratuito), e a primeira leitura volta do disco. Teste, sem custo e reversível, no SQL Editor: uma tarefa dentro do próprio banco que faz a busca a cada minuto, para manter as páginas do índice quentes (não passa pela Vercel):
```sql
select cron.schedule('db-warm-search', '* * * * *', $$ select count(*) from api_search_chunks((select embedding from chunks where embedding is not null limit 1), 'aquecimento', '{}', 3, null) $$);
```
Depois de uns 10 minutos, rodar `/api/v1/warmup?bench=1&novoice=1` quatro vezes (35 s entre elas). Se o primeiro `headers_ms` ficar sempre abaixo de 1 s, está resolvido. Para desfazer: `select cron.unschedule('db-warm-search');`. Se continuar intermitente, a causa é o próprio plano do Supabase (computação e memória), e a saída é o plano pago ou mover a busca da Bíblia para o Neon (opção B da seção 6), que no teste ficou estável em 0,53 s.

### 7.3 Resultado do aquecimento dentro do banco (28/11/2026): não resolveu
Com a tarefa `db-warm-search` rodando a cada minuto, 12 medições da primeira busca crua no Supabase deram: 2,0 / 3,9 / 0,9 / 0,55 / 0,61 / 0,53 / 0,71 / 0,64 / **3,8 / 6,5 / 3,7** / 0,51 s. Ou seja, **5 de 12 (42%) ainda levam de 2 a 6,5 s**, mesmo com o índice mantido quente por outra via. Não é o JIT (7.2) nem a saída de memória do índice. Resta o próprio Supabase gratuito (conexões do PostgREST, CPU compartilhada), que daqui não consigo diagnosticar sem acesso ao painel dele.
No mesmo teste, o Neon (a mesma busca, 3 vezes em cada rodada) ficou em **0,52 a 0,55 s em todas as rodadas, sem uma única lentidão**.

**Efeito na resposta do aluno:** a busca do Supabase tem limite de 3,2 s na pergunta; quando a primeira chamada leva 3 a 6 s, o resultado é descartado e a busca é repetida com mais paciência. É exatamente a origem das respostas com 8 a 12 s de busca depois de uma pausa.

**Proposta (decisão do dono, D-27 emenda):** mover só a **busca** dos textos bíblicos, dos verbetes (Easton) e das notas próprias para o Neon (partição 2, que tem espaço), mantendo no Supabase o login, os dados dos alunos e a segurança por usuário. É a opção B da seção 6, restrita ao que se mostrou lento. Ganho esperado: busca estável em ~0,55 s, sem a cauda de 3 a 6 s. Custo: R$ 0. Risco: a ordem dos resultados pode mudar um pouco; por isso rodo antes a avaliação (`scripts/eval-retrieval.ts`) e só troco se a qualidade se mantiver.
Para desfazer o teste que não ajudou: `select cron.unschedule('db-warm-search');`.

### 7.4 A busca central passou para o Neon (28/11/2026): feito e medido
- **O que mudou:** os 12.440 trechos bíblicos (português e inglês) e os 4.100 do Easton, que eram buscados no Supabase, agora são buscados no Neon (partição 2, tabelas `core_chunks` e `core_works`, função `core_search`, que é a mesma busca SQL de antes com o mesmo equilíbrio entre Bíblia e verbetes; títulos de verbetes por `core_titles`). No Supabase ficam o login, os dados dos alunos, os versículos exatos, as lentes e as notas próprias publicadas (best-effort, com limite de 1,2 s para nunca atrasar a resposta). Se o Neon falhar ou vier vazio, a busca volta sozinha ao Supabase. Chave: `CORE_SEARCH=neon` (desligar: `supabase`).
- **Velocidade medida dentro da Vercel (3 chamadas por rodada, 4 rodadas):** busca central no Neon **115 a 459 ms (típico 200 ms)**; a mesma busca no Supabase 524 a 789 ms, com o primeiro acesso de 3 a 7 s em cerca de 40% das vezes (isso agora não pesa mais na resposta).
- **Qualidade:** textos dos trechos idênticos; os primeiros resultados coincidem (46 de 60 perguntas com 4 ou mais dos 5 primeiros iguais) e as diferenças ficam nas posições finais, onde os trechos estão empatados (os vetores foram recalculados). Avaliação completa com o Neon: perguntas por nome 40/40, conteúdo do app 60/60, amostra do núcleo 59/60 (98%), versículos exatos 37/37, p95 da busca 1,3 s (antes 2,4 a 4,4 s).
- **Manutenção:** para recarregar o núcleo, `scripts/ingest/core-neon.ts` (lê os versículos pela API pública e o Easton de `data/raw/easton.json`). Notas próprias publicadas pelo painel continuam entrando no Supabase.
