# Teologia Sistemática: Fase 0, reconhecimento do código (28/11/2026)

Relatório pedido na Fase 0 do prompt "Módulo Teologia Sistemática + Ampliação das Bíblias em Português". **Nada foi alterado no código.** Termina com o que diverge do prompt, o encaixe proposto e as decisões que dependem do dono (CLAUDE.md: itens [DECISÃO] não são meus).

## 1. Mapa do que existe

### 1.1 O "Aprofundar"
- **Onde está:** tela `/modos` (`app/(app)/modos/page.tsx`): três cartões, Preparar aula, Sermão e **Aprofundar** (`modes.deep`). Escolher Aprofundar pede a passagem (`deep.ref`), cria uma sessão `mode: "deep"` com `context.ref` (`POST /api/v1/sessions`, validação `DeepContext` em `lib/modes/schema.ts`) e abre `/estudo?s=<id>`.
- **Como o professor explica:** `app/api/v1/teacher/turn/route.ts` lê o modo da sessão (`lib/modes/server.ts: loadSessionMode`), junta `deepSources(ref)` (palavras do original com Strong e léxico, STEPBible) e chama `runTurn` (`lib/teacher/pipeline.ts`). O prompt tem 4 camadas (`lib/teacher/prompts.ts`: identidade RA-01 a RA-25, aluno, lente, modo; `layerMode("deep")` fixa a estrutura: texto e tradução, palavras-chave, contexto, visões por tradição, bibliografia, falas de até 250 palavras).
- **Pesquisa profunda e documento:** `lib/modes/research.ts` (`gatherResearch`, `DEEP_STEPS`: visão geral, contexto, estrutura, palavras-chave, tradições, história, aplicação, referências cruzadas, bibliografia) monta um pacote único por sessão (versículos, palavras, melhores trechos da biblioteca, inclusive de outras tradições); `lib/modes/build.ts` escreve cada seção; o resultado fica em `deep_studies` (migration 0027, RLS) e aparece na aba de documento do `/estudo`, no caderno (`nb.kind.deep`) e em PDF. Limite por plano: `deepen_month` (`lib/entitlements`).
- **O outro "Entender":** no leitor da Bíblia (M24, `/biblia`) o painel `components/reader/HelpPanel.tsx` + `lib/reading/help.ts` mostra pessoas e lugares, palavras do original, textos relacionados e a explicação curta do professor. É outro fluxo, mas pode alimentar o módulo novo (tema relacionado a um versículo).

### 1.2 Geração da resposta, busca e cache
- Pipeline: moderação e crise → injeção → intenção → busca (`lib/knowledge/search.ts`: referências exatas + semântica e5 de 384 dimensões + palavra-chave, fusão RRF; reconhecimento de nomes bíblicos) → barreira de tema → pesquisa fora do app (só livre) → prompt → modelo → verificação de citações, idioma, números → resposta (`speech_delta` em fluxo, depois `structured`).
- Modelos: pool gratuito (Groq, Gemini, OpenRouter; Anthropic sem crédito). Cota gratuita: 8.000 tokens/minuto e 200.000/dia por modelo na Groq.
- Cache: `answer_cache` (Neon, resposta conferida a pergunta avulsa), cache de busca em memória (5 min), `verse_help` (explicação do leitor, por aluno).

### 1.3 i18n
- **Só dois idiomas:** `lib/i18n/pt-BR.json` e `es.json` (1.274 chaves cada, paridade total), `lib/i18n/index.ts` (`t()`, `setLanguage`), `lib/i18n/lang.ts` (escolha guardada pela camada de plataforma e espelhada em `profiles.locale`). A camada de prompt em espanhol é `layerLanguage` (`prompts.ts`). **Não existe inglês nem italiano.**

### 1.4 Voz e avatar
- Voz: provedores em `lib/voice` (Piper local, o padrão, só português; Gemini TTS e ElevenLabs como alternativas; Modal para a voz neural). Fila de frases, envelope da boca e sincronismo em `lib/voice/*` e `lib/platform/web/audio-player.ts`. Avatar Rive em `components/teacher`.
- Hoje só pt e es têm voz no app (`speech.setLanguage(lang === "es" ? "es" : "pt")`).

### 1.5 Banco
- **Supabase:** login (Google e e-mail), dados dos alunos (54 tabelas com RLS), `works` (catálogo e portão de licença), `bible_versions`/`bible_verses` (25 versões), lentes, notas próprias publicadas.
- **Neon:** partição 1 (759 MB de 1 GB; obras, léxicos, grafo, Josefo), partição 2 (cerca de 480 MB; obras, traduções, conteúdo do app, núcleo da busca: Bíblia e Easton, cache de respostas). Código de busca já aceita até 6 partições.
- **Bíblias hoje (25):** pt 4 (Bíblia Livre 2018, Biblia Livre Para Todos só NT, Bíblia Portuguesa Mundial, Biblica Open Nova Bíblia Viva 2007); en 11; es 4; grego 4; hebraico 1; latim 1. Seletor de versão: preferências do aluno (`main_version_id`) e o leitor (`/biblia`).
- **Linha teológica:** `preferences.lenses` (cifrada), 9 valores (`LENSES` em `lib/auth/preferences.ts`), usada por `authorityLayer` (pesos) e pela busca de lente (obras da tradição + contraste). A coluna `works.tradition` tem uma lista fechada de 12 valores.
- **Acervo teológico atual:** 229 obras de teologia, comentário, dicionário e história: 227 em domínio público, 228 em inglês, **1 em português**. Por tradição: geral 126, reformada 22, católica 19, batista 19, dispensacional 13, luterana 9, wesleyana 8, patrística 7, judaica 5, pentecostal 1.

### 1.6 O que o módulo pode reaproveitar
`research.ts` (pacote de pesquisa), `build.ts` (seções), modos de sessão, trilhas (`lib/paths`), grafo de entidades, `topics.ts` (passagens por tema), cartões de revisão (SM-2) para o "Pratique", cache de respostas, portão de licença (`lib/knowledge/licenses.ts`), ingestão por obra (`scripts/ingest/*`), tradução automática local pt (`scripts/translate`).

## 2. Onde o prompt diverge da realidade (e precisa de decisão)

| # | Divergência | Impacto |
| --- | --- | --- |
| 1 | **4 idiomas (pt, en, es, it) × 2 hoje (pt, es).** Inglês e italiano exigem 2.548 textos de interface novos, camada de prompt, voz, Bíblias italianas (Diodati 1885 e Riveduta 1927 existem no eBible, domínio público) e glossário. | Mudança de especificação (RNF-10) e trabalho grande, separado do módulo |
| 2 | **Espaço gratuito.** "O acervo mais completo possível" não cabe: cada trecho custa ~6 KB (texto, vetor e índices); 100 mil trechos ≈ 600 MB. Sobram cerca de 500 MB na partição 2 e é possível criar novas partições gratuitas. | Escolher o tamanho do acervo (D-30) |
| 3 | **IA gratuita não classifica nem traduz em escala.** 200 mil tokens por dia por modelo dão para uma aula por vez, não para dezenas de milhares de trechos. | Classificação por vetores e regras (sem IA generativa); tradução com modelos locais gratuitos (já existe en→pt; es e it exigem os modelos Helsinki equivalentes); aulas geradas sob demanda com cache |
| 4 | **Nomes de tabela em português** (`obras`, `trechos`, `aulas_cache`) × CLAUDE.md (tabelas em inglês). | Uso nomes em inglês: `traditions`, `topics`, `chunk_topics`, `chunk_translations`, `lesson_cache`, `glossary`, etc. |
| 5 | **Modelo de dados duplicaria o que existe** (`works`/`chunks` já são obras e trechos, com licença e tradição). | Estender (tabelas de tema, tradução, glossário, aula) em vez de criar `obras`/`trechos` |
| 6 | **Lista de tradições do prompt** (anglicana, santidade, carismática, acadêmica neutra, wesleyana-arminiana) não cabe nos 12 valores da coluna e nas 9 lentes. | Migração da lista de tradições e das lentes (atenção: lentes do aluno são dado sensível, cifrado) |
| 7 | **Migrações no Supabase dependem do dono** (token de administração recusado; só pelo SQL Editor). | Colocar as tabelas públicas novas no **Neon** (sem dado pessoal, sem RLS) e só o progresso do aluno no Supabase (uma tabela) |
| 8 | **Limite de 12 funções da Vercel (plano gratuito).** | Rotas novas consolidadas numa só (`/api/v1/teologia/*` num handler) |
| 9 | **Obras do prompt já no acervo?** Ainda não conferi uma a uma (Strong, Hodge, Wesley, Torrey, Larkin etc.). | Fará parte da Fase 4 (auditoria do catálogo antes de ingerir) |

## 3. Encaixe proposto (reutiliza ao máximo)
- **Modo novo `systematic`** ao lado de Aprofundar, no mesmo `/modos`, na mesma sessão e no mesmo documento, usando `research.ts`/`build.ts` com passos próprios (gancho, definição, base bíblica, na história, na sua linha, outras visões, aplicação, verificação, resumo, fontes). A aula sai em blocos curtos e fica em `lesson_cache` (tema × idioma × nível × lentes × versão da Bíblia).
- **Telas:** `/teologia` (grupo, matéria, tema), `/teologia/[tema]` (abas Aula, Base bíblica, Visões, Acervo, Glossário, Pratique, Fontes), trilha por matéria com progresso, botão no `/modos` e "Temas relacionados" no `HelpPanel` e no Aprofundar.
- **Taxonomia como dado versionado** (`seed/taxonomia.json`, empacotado como o índice de nomes bíblicos): sem banco para navegar, sem migração para publicar.
- **Dados públicos novos no Neon** (`chunk_topics`, `chunk_translations`, `glossary`, `lesson_cache`), **progresso do aluno no Supabase** (`theology_progress`, RLS).
- **Idioma:** o módulo nasce com chaves de interface e camada de idioma prontas para os 4; entram pt e es agora (o que o app já tem) e en e it como etapa própria (D-29).

## 4. Bíblias em português: estado real do eBible (consultado hoje)
| Versão | eBible | No app? | Observação |
| --- | --- | --- | --- |
| Bíblia Livre (BLIVRE) | `porbr2018`, completa, CC BY | **já está** | atualizada no eBible em 28/11/2026 (pode ser reimportada) |
| Biblica Open Nova Bíblia Viva | `poronbv`, completa | **já está** (`por_nbv_open`) | |
| Bíblia Portuguesa Mundial | `porbrbsl`, completa, com 15 deuterocanônicos, domínio público | **já está**; **os deuterocanônicos ainda não** | ganho: cânon católico |
| Bíblia Livre Para Todos (BLT) | `porblt`, **só Novo Testamento** (27 livros) | só NT (`por_blpt_nt`) | não existe versão completa no eBible |
| Tradução para Tradutores (TfTP) | `portft`, **só Novo Testamento** | **falta** | CC BY-SA, útil para iniciantes |
| Almeida (domínio público) | Gutenberg #62383 | **falta** | confirmar a edição |
| ARC 1914, Tradução Brasileira 1917, Figueiredo | sem arquivo estruturado | **faltam** | precisam de escaneamento e OCR; ficam `pendente_revisao` até confirmar a licença |
| Outras no eBible | `por-WBTC` e `porbrntbt` **não redistribuíveis** | **não entram** | |
Italiano: `ita1885` (Diodati) e `ita1927` (Riveduta) são domínio público e importáveis.
**Conclusão:** o eBible tem só 5 versões portuguesas redistribuíveis e 4 já estão no app; o ganho real da ampliação está em TfTP (NT), Almeida de domínio público, deuterocanônicos da Mundial e nas edições antigas por OCR (ARC 1914, TB 1917, Figueiredo), que dão trabalho e risco de licença.

## 5. Decisões que peço (CLAUDE.md: opções, recomendação, e espero a resposta)

**D-29 Idiomas do módulo**
- A) Só pt e es agora (o que o app já suporta); módulo pronto para en e it depois. *Recomendada.* Custo: baixo; prazo curto.
- B) pt, es, en e it já na primeira entrega. Custo: alto (2.548 textos de interface, voz, Bíblias italianas, glossário), atrasa a entrega.
- C) A) agora e en/it como etapa seguinte aprovada à parte.

**D-30 Tamanho do acervo**
- A) *Núcleo curado* de 60 a 80 mil trechos: sistemáticas, comentários, verbetes e fontes primárias da lista 10.3 (em torno de 400 a 500 MB), gratuito, em novas partições Neon. *Recomendada.*
- B) "Tudo o que for livre" (centenas de milhares de trechos): exige plano pago do Neon (cerca de US$ 19 por mês) e muito mais tempo de coleta e classificação.
- C) Núcleo agora, ampliação por demanda nas matérias com lacuna (painel de cobertura).

**D-31 Ordem de entrega**
- A) Fases 1 e 2 (telas e taxonomia, com aulas geradas a partir do acervo atual de 229 obras) primeiro, ingestão ampla depois. *Recomendada:* o aluno já usa o módulo e o painel mostra onde faltam fontes.
- B) Seguir as fases na ordem do prompt (ingestão antes das telas).

**D-32 Bíblias:** ampliar já (TfTP NT, Almeida de domínio público, deuterocanônicos da Mundial, Diodati e Riveduta), e deixar ARC 1914, TB 1917 e Figueiredo por OCR como etapa separada. *Recomendada.* Posso fazer em paralelo, sem esperar o resto.

Aguardo sua aprovação do encaixe (seção 3) e as respostas de D-29 a D-32 para começar a Fase 1.
