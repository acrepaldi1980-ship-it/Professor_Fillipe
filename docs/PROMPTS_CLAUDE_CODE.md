# Guia de Execução no Claude Code — App de Estudo Bíblico (Professor Filipe)

> **Para que serve este guia:** levar você, passo a passo, da pasta vazia até o app completo. Cada prompt é para copiar e colar no Claude Code, **um por vez**, na ordem.
> **Arquivo irmão:** `ESPECIFICACAO_FUNCIONAL.md`. Os prompts apontam para as seções dela, e é isso que dá precisão ao Claude Code.
> **Versão:** 1.1 — 18/11/2026
> **Formato:** web primeiro (app instalável pelo navegador, vendido direto, fora das lojas), já construído para ir para as lojas depois só com empacotamento. Ver seções 4.0 e 10.6 da especificação.

---

## Parte A — Antes de começar

### A.1 O que instalar no seu computador

| Ferramenta | Para quê | Como conferir |
| --- | --- | --- |
| Node.js 20 ou superior | Rodar o app | `node -v` no terminal |
| Git | Salvar versões do código | `git --version` |
| Claude Code | Escrever o código com você | `claude --version` |
| Google Chrome | Testar o app | — |

### A.2 Contas que você vai precisar (crie antes do prompt indicado)

| Conta | Para quê | Necessária a partir do |
| --- | --- | --- |
| GitHub | Guardar o código | Prompt 00 |
| Anthropic Console (API) | Inteligência do professor | Prompt 0.1 |
| Supabase | Banco, login e arquivos | Prompt 0.1 |
| Fornecedor de embeddings | Busca semântica na base | Prompt 0.1 (o Claude Code sugere opções) |
| Fornecedor de voz | Ouvir e falar | Prompt 0.1 (o Claude Code sugere opções) |
| Vercel | Publicar o app | Prompt 1.1 |
| Domínio próprio (ex.: no Registro.br) | Login, links e verificação futura nas lojas | Prompt 1.1 |
| Fornecedor de imagens | Ilustrações | Prompt 1.9 |
| Asaas (sandbox, depois produção) | Pagamentos | Prompt 1.11 |
| Sentry | Monitorar erros | Prompt 1.13 |
| Apple Developer e Google Play Console | Apps nas lojas | Prompt 2.5 |

**Regra de segurança:** chaves de API vão **só** no arquivo `.env.local`. Nunca cole chave dentro de um prompt, nunca mande para o Git.

### A.3 As 8 regras de ouro

1. **Um prompt por vez.** Só cole o próximo quando o atual estiver pronto e testado.
2. **Comece cada prompt grande no modo de planejamento:** aperte `Shift+Tab` até aparecer "plan mode", cole o prompt, leia o plano e só então aprove.
3. **Responda às perguntas do Claude Code.** Os prompts mandam ele parar e perguntar nas decisões que são suas (as "[DECISÃO]" da seção 19 da especificação).
4. **Teste você mesmo** seguindo o bloco "Como testar" de cada prompt.
5. **Commit ao final de cada prompt.** Todos os prompts terminam pedindo isso; confira que aconteceu.
6. **Use `/clear` entre prompts** para começar com o contexto limpo. O Claude Code relê o `CLAUDE.md` e o `docs/PROGRESS.md` sozinho.
7. **Se algo quebrar, use o prompt utilitário U1** (Parte G) em vez de tentar explicar de cabeça.
8. **Mudou de ideia sobre o produto?** Use o U5 para atualizar a especificação antes de mudar o código.

### A.4 Como montar a pasta do projeto

1. Crie uma pasta vazia, por exemplo `estudo-biblico`.
2. Dentro dela, crie a subpasta `docs`.
3. Copie o arquivo `ESPECIFICACAO_FUNCIONAL.md` para `docs/`.
4. Abra o terminal na pasta `estudo-biblico` e digite `claude`.
5. Cole o **Prompt 00**.

### A.5 Mapa dos prompts

| Fase | Prompts | Resultado |
| --- | --- | --- |
| Preparação | 00 | Projeto organizado, CLAUDE.md e Git |
| Fase 0 — Protótipo | 0.1, 0.2 | Professor falando por voz, testado com a turma |
| Fase 1 — MVP | 1.1 a 1.14 | App completo no navegador, com pagamento, pronto para o beta |
| Fase 2 — Robusto | 2.1 a 2.7 | Plano Igreja, ensaio, lojas, 3D ampliado, trilhas |
| Fase 3 — Imersão | 3.1 a 3.5 | Ambientes 3D caminháveis e realidade virtual |
| Utilitários | U1 a U6 | Corrigir, retomar, revisar, avaliar, mudar escopo, publicar |

### A.6 Como ler cada prompt deste guia

Todo prompt tem cinco partes:

- **Objetivo:** o que você terá ao final.
- **Antes de colar:** o que precisa estar pronto.
- **Prompt:** o texto exato para copiar e colar.
- **Como testar:** o que você mesmo confere.
- **Se der errado:** os problemas mais prováveis e o que fazer.

---

## Parte B — Preparação

### Prompt 00 — Preparar o projeto e o CLAUDE.md

**Objetivo:** repositório criado, com o `CLAUDE.md` que o Claude Code relê em toda sessão.

**Antes de colar:** pasta criada e `docs/ESPECIFICACAO_FUNCIONAL.md` copiado (A.4).

**Prompt:**

```text
Este é um projeto novo. Leia por inteiro o arquivo docs/ESPECIFICACAO_FUNCIONAL.md: ele é a fonte da verdade do produto.

Não escreva código de aplicação ainda. Faça apenas o seguinte:

1. Crie o arquivo CLAUDE.md na raiz com estas seções:
   - "Produto": resumo de 10 linhas da seção 2 da especificação.
   - "Fonte da verdade": a especificação está em docs/ESPECIFICACAO_FUNCIONAL.md; antes de qualquer tarefa, leia as seções indicadas no pedido; se o código precisar divergir da especificação, pare, explique e peça aprovação; depois de aprovado, atualize a especificação na mesma entrega.
   - "Decisões do dono": itens marcados [DECISÃO] (seção 19) nunca são decididos por você; apresente 2 ou 3 opções com prós, contras e custo, recomende uma e espere a resposta.
   - "Regras do Professor Filipe": copie a lista RA-01 a RA-23 da seção 5, resumida em uma linha cada.
   - "Stack": copie a tabela da seção 10.1.
   - "Estrutura de pastas": copie a árvore da seção 10.3.
   - "Convenções": código e nomes em inglês; interface e falas em português do Brasil; toda string de interface via i18n; TypeScript estrito; validação com Zod nas fronteiras; nenhum segredo fora do .env.local.
   - "Como trabalhar": (a) leia docs/PROGRESS.md ao começar; (b) apresente um plano antes de mudanças grandes; (c) escreva testes junto com o código (Vitest para lógica, Playwright para fluxos); (d) rode lint, typecheck e testes antes de dizer que terminou; (e) ao terminar, atualize docs/PROGRESS.md com o que foi feito, o que falta e decisões tomadas; (f) faça commit com mensagem clara em inglês.
   - "Licenças de conteúdo": nenhuma obra entra na base sem ficha em docs/LICENSES.md e sem passar pela regra da seção 8.10.9.
   - "Portabilidade (web primeiro, lojas depois)": resuma as regras da seção 10.6 como regras obrigatórias de código: (a) telas do app só buscam dados pelo lib/api-client; (b) toda a API fica em /api/v1, com token no cabeçalho; (c) microfone, áudio, notificações, armazenamento local, compartilhamento, arquivos, links e compras só via lib/platform; (d) acesso a recursos pagos só via lib/entitlements; (e) o build estático do app precisa passar sempre; (f) a cada módulo novo, atualize docs/STORE_DATA_INVENTORY.md.
2. Crie docs/PROGRESS.md com as seções: "Estado atual", "Prompts concluídos", "Decisões tomadas" (tabela com ID da decisão, escolha, data), "Pendências", "Problemas conhecidos".
3. Crie docs/LICENSES.md vazio, só com o cabeçalho e o modelo de ficha da seção 14.8.
4. Crie .gitignore para Node/Next.js, incluindo .env, .env.local e pastas de dados baixados (data/raw/).
5. Inicialize o Git e faça o primeiro commit.
6. Ao final, me mostre o CLAUDE.md completo e a lista das decisões da seção 19 que precisarei tomar na Fase 0.
```

**Como testar:** abra o `CLAUDE.md` e confira se as 10 seções existem (incluindo "Portabilidade"); rode `git log` e veja o primeiro commit.

**Se der errado:** se ele começar a criar o app, interrompa com `Esc` e diga "Pare. Neste prompt só quero os arquivos de documentação."

---

## Parte C — Fase 0: Protótipo

### Prompt 0.1 — Professor falando por voz com base mínima

**Objetivo:** uma tela com microfone em que você pergunta e o Professor Filipe responde falando, com fontes reais.

**Antes de colar:** contas da Anthropic e do Supabase criadas. Tenha em mãos a URL e as chaves do Supabase e a chave da Anthropic; você vai colá-las no `.env.local` quando o Claude Code pedir.

**Prompt:**

```text
Leia o CLAUDE.md, o docs/PROGRESS.md e estas seções da especificação: 5 (regras do professor), 8.5 (motor), 8.6 (voz), 8.10.3 a 8.10.5 (divisão em trechos, busca, parser de referências), 10 (arquitetura) e 11 (prompt de sistema).

Construa o PROTÓTIPO da Fase 0 (seção 4.1). Sem login, sem pagamento, sem banco de usuários. Siga esta ordem e pare nos pontos indicados:

ETAPA 1 — Projeto base
- Next.js (App Router) + TypeScript estrito + Tailwind, já configurado como PWA (manifest e service worker básicos, ícones provisórios).
- Estrutura de pastas da seção 10.3 (crie só o que for usar agora).
- Já no formato portável da seção 10.6: rotas em /api/v1; a tela chama a API só por lib/api-client; microfone e reprodução de áudio só pelas interfaces Microphone e AudioPlayer de lib/platform (implementação web).
- Arquivo .env.example conforme a seção 10.4. Me peça para preencher o .env.local e espere eu confirmar.

ETAPA 2 — Decisões (PARE e pergunte)
Apresente opções, com preço aproximado e prós e contras, para:
- D-04 fornecedor de voz (STT e TTS em pt-BR, com streaming e baixa latência);
- D-09 fornecedor de embeddings multilíngue;
- D-15 edição da Almeida/Bíblia em português para o protótipo (mostre a licença de cada uma);
- D-02 confirme os modelos padrão da seção 8.5.3;
- D-03 voz do professor (me deixe ouvir amostras se o fornecedor permitir).
Espere minhas respostas e registre-as em docs/PROGRESS.md.

ETAPA 3 — Base mínima de conhecimento
- Supabase com pgvector. Migrations só para: works, bible_versions, bible_verses, chunks (seção 9.3).
- Scripts em scripts/ingest/ para: a Bíblia em português escolhida e o Easton's Bible Dictionary (domínio público). Siga a seção 8.10.3 para dividir em trechos.
- Gere embeddings e o índice de texto completo (tsvector em português e inglês).
- Escreva as fichas em docs/LICENSES.md (seção 14.8).

ETAPA 4 — Parser de referências bíblicas
- Implemente lib/knowledge/refs-parser.ts conforme a seção 8.10.5, com pelo menos 60 casos de teste no Vitest (o conjunto completo de 200 vem no prompt 1.2).

ETAPA 5 — Busca
- Implemente lib/knowledge/search.ts com a busca híbrida da seção 8.10.4 (referência exata + semântica + palavra-chave + fusão RRF). Por enquanto, sem pesos de lente.

ETAPA 6 — Motor mínimo do professor
- lib/teacher com: montagem do prompt (camadas 11.1, 11.3 com versão fixa, 11.4 Estudo livre, 11.5 trechos), chamada à API da Anthropic com streaming e com a ferramenta teacher_response (contrato 8.5.5, validado com Zod), verificação de citações (8.5.6) e memória da sessão em memória do servidor.
- Rota POST /api/teacher/turn com streaming (SSE).

ETAPA 7 — Voz
- lib/voice com a interface VoiceProvider (transcribe e synthesize) e o fornecedor escolhido.
- Síntese por frase em streaming: a primeira frase começa a tocar enquanto o resto é gerado.
- Dicionário de pronúncia inicial com 50 nomes bíblicos (lib/voice/lexicon.pt-BR.json).

ETAPA 8 — Tela única
- Avatar provisório do professor com estados ouvindo, pensando e falando.
- Botão grande de microfone (tocar para começar e para parar, com detecção de fim de fala).
- Bolhas da conversa com legenda da fala, chips de referência que abrem o versículo e botões vindos de next_options.
- Botão para interromper o professor (seção 8.6, RF-M06-04).
- Campo de texto como alternativa à voz.

ETAPA 9 — Medição
- Registre no console do servidor, para cada turno: tempo até o primeiro áudio, tempo total, tokens e custo estimado.

Critérios de pronto:
- Eu pergunto por voz "Quem foi Barnabé?" e ouço o início da resposta em até 4 segundos, com fala curta, referências corretas e uma pergunta no final.
- Eu peço "Me mostra João 3:17 a 3:40" (versículos que não existem depois do 36) e o professor diz que esses versículos não existem.
- Todos os testes passam, lint e typecheck sem erros.
Atualize docs/PROGRESS.md e faça commit.
```

**Como testar:**
1. Rode `npm run dev` e abra o endereço que aparecer.
2. Faça 5 perguntas por voz, incluindo uma pegadinha (versículo que não existe).
3. Confira se cada resposta tem menos de 45 segundos e termina com pergunta.
4. Toque num chip de referência e veja o versículo.

**Se der errado:**
- *"Não ouço nada":* confira a permissão de microfone do navegador e se a chave de voz está no `.env.local`.
- *"Demora muito":* peça "Mostre os tempos de cada etapa do último turno e proponha como reduzir a latência".
- *"Inventou um versículo":* use o U1 com o exemplo exato.

---

### Prompt 0.2 — Avaliação inicial e teste com a turma

**Objetivo:** medir a qualidade do professor antes de investir no MVP e colher a opinião de pessoas reais.

**Antes de colar:** prompt 0.1 concluído.

**Prompt:**

```text
Leia o CLAUDE.md, o docs/PROGRESS.md e a seção 16 da especificação.

1. Crie a estrutura evals/ com: datasets/, runners/, reports/.
2. Crie os conjuntos iniciais, em JSON, com pergunta, público, nível e o que se espera da resposta:
   - general: 30 perguntas (10 iniciante, 10 intermediário, 10 avançado);
   - traps: 15 pegadinhas (versículos, autores e fatos inexistentes);
   - injection: 10 tentativas de tirar o professor do papel;
   - pastoral: 5 mensagens de sofrimento intenso (resposta esperada: acolher, não aconselhar, encaminhar, CVV 188 e SAMU 192 quando houver risco).
3. Crie o runner que envia cada pergunta ao motor e um avaliador automático (usando o modelo profundo, temperatura 0) que dá nota de 1 a 5 em: fidelidade às fontes, didática, tamanho da fala, termina com pergunta, respeito às regras RA. Para traps, injection e pastoral, o resultado é passa ou não passa.
4. Gere evals/reports/AAAA-MM-DD.md com médias, os 5 piores casos e sugestões de melhoria do prompt.
5. Crie uma página /feedback simples no protótipo, onde quem testar dá nota de 1 a 5 e escreve um comentário ao fim de cada conversa. Grave numa tabela feedback(id, created_at, rating, comment, session_ref).
6. Crie docs/ROTEIRO_TESTE_TURMA.md: um roteiro de 20 minutos para eu aplicar com 5 a 10 pessoas da EBD (tarefas para cada pessoa fazer, perguntas para fazer depois, o que observar).

Rode os evals, me mostre o relatório e proponha até 5 ajustes no prompt de sistema. Não aplique os ajustes antes da minha aprovação.
Atualize docs/PROGRESS.md e faça commit.
```

**Como testar:** leia o relatório e os 5 piores casos; aplique o roteiro com a turma; leia os feedbacks.

**Se der errado:** se as notas forem baixas, use o U4 para melhorar o professor antes de seguir para a Fase 1.

> **Ponto de decisão:** só siga para a Fase 1 se a turma gostou e se os evals tiverem 100% nas pegadinhas e na crise pastoral.

---

## Parte D — Fase 1: MVP

### Prompt 1.1 — Fundação: login, banco, identidade visual e deploy

**Objetivo:** base do produto definitivo, com login, banco completo, design e o app publicado num endereço de teste.

**Antes de colar:** conta na Vercel; no Supabase, provedores Google e Apple configurados (o Claude Code te guia).

**Prompt:**

```text
Leia o CLAUDE.md, o docs/PROGRESS.md e as seções 8.1 (M01), 8.2 (M02), 9 (modelo de dados), 10, 13 e 17 da especificação.

Transforme o protótipo na base do produto:

1. Autenticação (RF-M01-01 a 03): Supabase Auth com link mágico, Google e Apple; sessão de 30 dias; tela de login; middleware que protege as rotas autenticadas; exclusão de conta com dupla confirmação e job de remoção.
2. Menores (RN-09) — DECISÃO D-08: apresente as opções e espere.
3. Banco completo: migrations de TODAS as tabelas das seções 9.1, 9.2, 9.3 e 9.4 (exceto as marcadas P1, que ficam para depois), com chaves, índices e Row Level Security. Gere docs/DATA_MODEL.md com o diagrama em Mermaid. Escreva testes que provam que um usuário não lê dados de outro.
4. Criptografia dos campos sensíveis (profiles.ministry_role, preferences.lenses) conforme a seção 13.
5. Consentimento (RF-M02-01 e 02): telas de Termos, Privacidade (rascunhos marcados "para revisão jurídica") e consentimento separado de dado religioso, gravando em consent_records.
6. Identidade visual — DECISÃO D-13: proponha 3 direções (paleta, tipografia, estilo de ilustração), cada uma com uma tela de exemplo renderizada, pensando que o avatar do Professor Filipe (seção 8.17) será o centro da marca. Espere minha escolha. O avatar em si é desenhado no prompt 1.6b; aqui use um marcador provisório com os estados ouvindo, pensando e falando.
7. Design system com a direção escolhida: botão, cartão, chip de referência, bolha de conversa, barra inferior, campo, modal, toast, avatar com estados; modo claro e escuro; fonte ajustável; "reduzir movimento".
8. i18n desde já (lib/i18n/pt-BR.json) para todas as strings.
9. Layout autenticado com navegação inferior: Início, Estudar, Revisão, Caderno, Conta.
10. Mova o protótipo para a rota /estudo/[sessionId], agora gravando sessions e messages no banco.
11. Base de portabilidade (seção 10.6, inteira):
    - lib/platform com TODAS as interfaces da tabela 10.6.2, implementação web de cada uma, getPlatform() e mocks para testes; a pasta native/ fica criada e vazia, com um README explicando o que entra na Fase 2.
    - lib/api-client tipado a partir dos esquemas Zod; todas as telas do app usam só ele.
    - Autenticação por token no cabeçalho (Authorization: Bearer) em todas as rotas /api/v1, com renovação automática.
    - Teste de build estático do app no CI (10.6.1), falhando se alguma tela do app depender do servidor.
    - Tabela app_config e verificação de versão mínima ao abrir o app (10.6.6); cabeçalhos X-App-Version e X-Platform em toda chamada.
    - docs/STORE_DATA_INVENTORY.md iniciado (10.6.5).
    - Interface com cara de app: áreas seguras do celular, alvos de toque ≥ 44 px, sem dependência de passar o mouse.
12. DECISÃO D-17: confirme comigo o domínio próprio e o identificador futuro do app. Configure o domínio na Vercel e as URLs de retorno do login no Supabase já para esse domínio.
13. Deploy na Vercel (ambiente de preview) com as variáveis de ambiente. Me guie passo a passo no que eu precisar fazer no painel da Vercel, do Supabase e do registrador do domínio.

Critérios: login nos três métodos funcionando no domínio próprio; testes de RLS passando; consentimento gravado; conversa do protótipo funcionando dentro do app logado; build estático do app passando no CI; nenhuma tela chamando API do navegador fora de lib/platform (faça uma verificação automática por busca no código e coloque no CI).
Atualize docs/PROGRESS.md e faça commit.
```

**Como testar:** entre com Google no endereço da Vercel; dê e revogue o consentimento; converse; saia e entre de novo e veja a conversa salva.

**Se der errado:** erro de login com Google ou Apple geralmente é URL de retorno; peça "Confira as URLs de redirecionamento do Supabase e da Vercel e me diga exatamente o que preencher".

---

### Prompt 1.2 — Bíblias, textos originais e referências

**Objetivo:** todas as Bíblias liberadas, o hebraico e o grego com morfologia, léxicos e referências cruzadas.

**Antes de colar:** 1.1 concluído.

**Prompt:**

```text
Leia o CLAUDE.md, o docs/PROGRESS.md e as seções 8.10 (inteira) e 14.1 a 14.3 da especificação.

1. Verificador de licença (8.10.9) em lib/knowledge/licenses.ts, com testes: datas de corte calculadas a partir do ano atual; NC, ND e "sem informação" vão para revisão manual (review_status = 'pending'). Nenhum script de ingestão grava obra sem passar por ele.
2. Ingestão das Bíblias da tabela 14.2 (português, inglês, espanhol e originais). Para cada uma: script idempotente em scripts/ingest/, normalização para o formato bible_verses com referência canônica, ficha em docs/LICENSES.md com o crédito exato. Fontes preferidas: eBible.org, Open Scriptures, STEPBible-Data (GitHub), Project Gutenberg. Confirme a licença de cada fonte na página oficial antes de baixar e me mostre a lista final para aprovação antes de rodar.
3. Textos originais palavra por palavra em original_words (WLC + morfologia Open Scriptures; STEPBible TAHOT e TAGNT), com lema, Strong, morfologia, transliteração e glosa.
4. Léxicos em lexicon_entries: Strong, Thayer, Brown-Driver-Briggs, os léxicos do STEPBible (TBESH, TBESG, TFLSJ).
5. Referências cruzadas (Treasury of Scripture Knowledge via OpenBible, CC BY) em cross_refs.
6. Mapeamento de versificação entre versões (quando a numeração difere), usando o TVTMS do STEPBible.
7. Parser de referências completo: os 200 casos da seção 8.10.5 e 16.1.
8. Rotas GET /api/bible/:version/:ref e GET /api/bible/original/:ref.
9. Tela "Fontes e licenças" pública, gerada a partir da tabela works.

Critérios: todas as versões da tabela 14.2 carregadas e consultáveis; João 1:1 aparece no grego com Strong; 200 testes do parser passando; nenhuma obra sem ficha.
Atualize docs/PROGRESS.md e faça commit.
```

**Como testar:** abra `/api/bible/por_blivre_2018/JHN.3.16` e `/api/bible/original/JHN.1.1`; abra a tela "Fontes e licenças".

**Se der errado:** se uma fonte tiver licença confusa, deixe fora e siga; o importante é não importar nada duvidoso.

---

### Prompt 1.3 — Biblioteca ampliada e grafo de conhecimento

**Objetivo:** todas as linhas teológicas, enciclopédias, história, arqueologia, mapas e filosofia na base, mais o grafo de pessoas, lugares e eventos.

**Antes de colar:** 1.2 concluído.

**Prompt:**

```text
Leia o CLAUDE.md, o docs/PROGRESS.md e as seções 8.10.6 a 8.10.9 e 14.3 a 14.7 da especificação.

1. Copie as seções 14.3 a 14.6 para docs/BIBLIOTECA.md e transforme-as numa lista de ingestão com colunas: obra, linha, tipo, fonte de texto escolhida, licença confirmada, status.
2. Para cada obra: encontre a melhor fonte de TEXTO em domínio público (Project Gutenberg, Internet Archive, Wikisource, HathiTrust só itens públicos, Perseus/Scaife no GitHub). A CCEL serve só como catálogo: não copie a formatação dela. Me mostre a lista com as fontes e espere aprovação.
3. Pipeline de OCR para obras escaneadas, com correção, detecção de capítulos, verbetes e notas, e revisão por amostragem (relatório com 20 trechos aleatórios para eu conferir).
4. Extração automática de referências bíblicas de dentro dos textos (usando o parser) e gravação em chunks.refs.
5. Marcação de cada trecho com tradição, tipo e camada de autoridade (8.10.6).
6. Pesos de autoridade e de lente na busca (8.10.6), ligados às preferências do aluno.
7. Grafo de conhecimento (8.10.7): unir Theographic, STEPBible TIPNR, OpenBible Geocoding e Pleiades em kg_entities e kg_relations, com deduplicação de pessoas e lugares e ligação a versículos e verbetes.
8. Coletor de artigos acadêmicos: busca no DOAJ e no SciELO artigos de teologia, arqueologia bíblica e história do cristianismo com licença CC BY ou CC BY-SA (pt, en, es), grava como obras do tipo academic_article com autor, revista, ano, DOI e licença. Comece com no máximo 300 artigos e me mostre amostras.
9. Painel temporário em /admin/biblioteca (só para admin) com totais por linha, tipo, idioma e a fila de revisão de licenças.
10. Avaliação de busca: conjunto retrieval com 50 perguntas e o trecho esperado (seção 16.1), incluindo perguntas em português que devem achar trechos em inglês.

Faça a ingestão em lotes e me mostre o progresso a cada lote. Critérios: pelo menos uma obra-base de cada linha da tabela 14.5 pesquisável; grafo com pessoas, lugares e eventos; busca ≥ 85% no top 5; zero obras sem ficha.
Atualize docs/PROGRESS.md e faça commit.
```

**Como testar:** no painel, veja os totais; faça buscas como "Barnabé Antioquia", "batismo no Espírito Santo" e "Templo de Herodes" e veja se vêm trechos de linhas diferentes.

**Se der errado:** OCR ruim numa obra: peça para deixar a obra com `enabled = false` e seguir; volte nela depois.

---

### Prompt 1.4 — Notas de Estudo Pentecostais próprias

**Objetivo:** a camada pentecostal própria do app, com fluxo de aprovação e prova de originalidade.

**Antes de colar:** 1.3 concluído. Tenha o nome de 1 a 3 pessoas do conselho teológico (pode ser só você no começo).

**Prompt:**

```text
Leia o CLAUDE.md, o docs/PROGRESS.md e as seções 8.11 e 14.4 da especificação.

1. Pesquise em fontes públicas as doutrinas distintivas do pentecostalismo clássico (batismo no Espírito Santo como experiência distinta da conversão, evidência de falar em línguas, dons espirituais, cura divina, santificação, volta de Cristo, missões) e monte docs/pentecostal/linha.md com um resumo e referências à Bíblia e ao acervo pentecostal liberado. PARE e espere minha revisão.
2. Gerador de notas (own_notes): introdução por livro, notas por perícope e artigos temáticos, escritos com redação própria a partir só da Bíblia e das obras liberadas. É proibido copiar, parafrasear ou seguir a estrutura da Bíblia de Estudo Pentecostal ou de qualquer obra protegida. Cada nota cita as fontes que usou.
3. Relatório de originalidade (8.11): similaridade de n-gramas e de embeddings contra as obras da base; trechos acima de 0,85 são reescritos automaticamente e reavaliados.
4. Fluxo de aprovação no /admin: draft → in_review → approved → published; papel reviewer; comentários do revisor por nota.
5. Gere as notas de Atos (introdução, todas as perícopes e os artigos temáticos ligados a Atos) em rascunho.
6. As notas publicadas entram na busca como tradição 'pentecostal', tipo 'own_notes', camada 3.

Critérios: notas de Atos em rascunho com relatório de originalidade; fluxo de aprovação funcionando; uma nota aprovada aparece numa resposta do professor quando a lente é pentecostal.
Atualize docs/PROGRESS.md e faça commit.
```

**Como testar:** aprove 3 notas no /admin; escolha a lente pentecostal e pergunte sobre Atos 2; veja se a nota aparece citada.

**Se der errado:** se uma nota parecer muito com algum livro que você conhece, marque como reprovada e peça reescrita.

---

### Prompt 1.5 — Motor completo do Professor Filipe

**Objetivo:** o professor definitivo, com intenções, memória, lentes, divergências, crise pastoral e avaliação contínua.

**Antes de colar:** 1.4 concluído.

**Prompt:**

```text
Leia o CLAUDE.md, o docs/PROGRESS.md e as seções 5, 8.5 (inteira) e 11 (inteira) da especificação.

Reescreva lib/teacher como o motor definitivo:

1. Pipeline completo de 8.5.1, cada etapa como função separada e testada.
2. Classificador de intenções (8.5.2) com a tabela de comandos de voz.
3. Escolha de modelo (8.5.3).
4. Memória de curto e longo prazo (8.5.4), com geração de session_summaries ao fim da sessão.
5. Contrato de saída (8.5.5) com Zod, correção automática em caso de falha e queda para texto.
6. Verificação de citações (8.5.6) com os 3 níveis.
7. Detecção e selo de divergência entre lentes (8.5.7).
8. Crise pastoral (8.5.8): classificador antes da geração, resposta padrão (deixe o texto em lib/teacher/pastoral.ts para revisão do conselho), registro em pastoral_events sem conteúdo.
9. Montagem do prompt em 5 camadas (seção 11), carregando os textos de prompt_versions (versão ativa) com os textos da seção 11 como versão 1.
10. Botão "Isso está errado?" em cada resposta, gravando em answer_flags.
11. Amplie os evals para os tamanhos da seção 16.1 (general 100, lenses 60, traps 30, pastoral 20, injection 30) e aplique os limiares da 16.2.

Rode os evals. Se algum limiar não for atingido, proponha os ajustes de prompt, espere minha aprovação, aplique como nova versão em prompt_versions e rode de novo.
Me mostre 4 conversas de exemplo, uma por persona da seção 3.
Atualize docs/PROGRESS.md e faça commit.
```

**Como testar:** escolha a lente batista e pergunte sobre batismo; depois troque para reformada e pergunte de novo; veja o selo de divergência. Teste uma tentativa de "esqueça suas regras".

**Se der errado:** se o professor ficar prolixo, peça "Mostre a contagem de palavras das últimas 20 falas e ajuste o prompt para respeitar RA-06".

---

### Prompt 1.6 — Voz definitiva

**Objetivo:** voz rápida, natural, interrompível, com pronúncia correta dos nomes bíblicos.

**Antes de colar:** 1.5 concluído.

**Prompt:**

```text
Leia o CLAUDE.md, o docs/PROGRESS.md e as seções 8.6 e 12 (RNF-01) da especificação.

1. Leve a voz ao padrão de produção: os dois modos de captura, detecção de fim de fala com 1,2 s de silêncio, interrupção em até 300 ms, legendas sincronizadas, modo só texto, velocidade da voz ajustável.
2. Vocabulário de reforço no reconhecimento com nomes bíblicos e termos teológicos.
3. Amplie lib/voice/lexicon.pt-BR.json para pelo menos 500 nomes e termos (personagens, lugares, livros, termos como "propiciação" e "Melquisedeque"), com teste de pronúncia.
4. Conjunto de teste stt_names (50 frases) e medição da taxa de erro de palavras; meta ≤ 10%.
5. Tratamento das falhas da seção RF-M06-06.
6. Painel de latência: grave por turno o tempo até o primeiro áudio (mediana e p95) e mostre no /admin.
7. Otimize até cumprir RNF-01 (mediana ≤ 2,5 s, p95 ≤ 4 s). Me mostre o antes e o depois.

Atualize docs/PROGRESS.md e faça commit.
```

**Como testar:** faça 10 perguntas seguidas no celular, em 4G; interrompa o professor no meio; peça nomes difíceis como "Nabucodonosor" e "Mefibosete".

**Se der errado:** se a meta de latência não fechar, peça um relatório de onde o tempo é gasto e as opções de fornecedor com menor latência.

---

### Prompt 1.7 — Entrevista guiada, configuração e primeira aula

**Objetivo:** a experiência de primeiro acesso completa (jornada J01).

**Antes de colar:** 1.6 concluído.

**Prompt:**

```text
Leia o CLAUDE.md, o docs/PROGRESS.md e as seções 7 (J01), 8.3 (M03), 8.4 (M04) e 17 da especificação.

1. Entrevista por voz com o roteiro exato de RF-M03-01, conduzida pelo Professor Filipe com reação natural a cada resposta, alternativa por texto e botões de resposta rápida, barra de progresso de 7 passos. A pergunta 4 só aparece com consentimento de dado religioso.
2. Cálculo de nível de RF-M03-02, com testes (mesmas respostas geram o mesmo nível).
3. Configuração (M04): lentes com explicação de uma frase e escolha de até 3; versão principal e comparação; obras filtradas pela lente; preferências de experiência. Tudo editável depois em Conta.
4. Cartão de boas-vindas animado (RF-M03-03), respeitando "reduzir movimento".
5. Primeira aula imediata sobre o first_topic, no nível estimado (RF-M03-04).
6. Ajuste contínuo de nível (RF-M03-05).
7. Tela Início diária (RF-M09-05) com os blocos que já existirem; os outros aparecem vazios com convite.
8. Teste Playwright de ponta a ponta da jornada J01.

Atualize docs/PROGRESS.md e faça commit.
```

**Como testar:** crie uma conta nova e faça a jornada inteira duas vezes, uma como "Ana, 17 anos" e outra como "Pr. Joel"; compare os níveis e o tom da primeira aula.

**Se der errado:** se a entrevista parecer formulário, peça "Deixe as reações do professor mais naturais e variadas; me mostre 3 exemplos".

---

### Prompt 1.8 — Modos: Preparar aula, Sermão e Aprofundar

**Objetivo:** os três modos guiados, com editor ao vivo e exportação em PDF.

**Antes de colar:** 1.7 concluído. **Decida D-06** (o que é o sermão "explicativo" para você).

**Prompt:**

```text
Leia o CLAUDE.md, o docs/PROGRESS.md e as seções 7 (J03, J04, J05), 8.7 (inteira), 11.4 e 5 (RA-10) da especificação.

1. Seletor de modos na tela Início e na conversa.
2. Preparar aula (8.7.2): coleta inicial; condução na ordem da camada 11.4; editor do plano de aula ao lado da conversa (celular: aba alternável), preenchido seção a seção pelo mode_payload e editável à mão; distribuição de minutos; exportação em PDF A4 com capa, visuais e fontes; grava em lesson_plans.
3. Sermão (8.7.3): tabela sermon_types com temático, textual e expositivo (e o explicativo conforme a decisão D-06 que eu vou te dar); fluxo completo; cada parte só entra no esboço com aprovação do pregador; editor do esboço ao lado; revisão final de lacunas; exportação; grava em sermon_outlines.
4. Aprofundar básico (8.7.4 P0): texto na versão principal, original transliterado, Strong por palavra-chave (toque na palavra abre o léxico), contexto, visões por tradição, bibliografia.
5. Evals do conjunto modes (16.1): 4 aulas, 4 sermões (incluindo o expositivo de Atos 8:26-40) e 4 aprofundamentos, rodados de ponta a ponta com usuário simulado.
6. Testes Playwright de cada modo.

Antes de começar, me pergunte a definição do sermão explicativo (D-06).
Atualize docs/PROGRESS.md e faça commit.
```

**Como testar:** prepare uma aula real da sua próxima EBD e um esboço de sermão; exporte os PDFs e abra no celular.

**Se der errado:** se o professor "escrever o sermão inteiro", peça "Reforce RA-10: nenhuma parte entra no esboço sem minha aprovação; teste com 3 sermões".

---

### Prompt 1.9 — Multimídia: mapas, linhas do tempo, ilustrações e 3D

**Objetivo:** os visuais acionados pelo professor e sincronizados com a fala.

**Antes de colar:** 1.8 concluído. Conta no fornecedor de imagens (o Claude Code sugere opções).

**Prompt:**

```text
Leia o CLAUDE.md, o docs/PROGRESS.md e as seções 8.8 (M08), 5 (RA-20) e 14.6 da especificação.

1. Painel de visuais (RF-M08-01) para celular, tablet e desktop.
2. Mapas (RF-M08-02): MapLibre com lugares do grafo; camada do Império Romano; as 10 rotas do MVP em map_routes, com passos, versículos e fontes; animação da rota; sincronização com a fala via highlight_place_ids; créditos visíveis.
3. Linhas do tempo (RF-M08-03): as 6 do MVP em timelines, com zoom, eventos clicáveis e datas com incerteza. DECISÃO D-07: apresente as opções de cronologia de referência e espere.
4. Ilustrações (RF-M08-04): DECISÃO D-05, apresente fornecedores com preço e espere; estilo fixo em lib/visuals/style.ts; filtro das regras RA-20; cache por hash; biblioteca de ilustrações aprovadas consultada antes de gerar; limites por plano.
5. 3D (RF-M08-05): React Three Fiber com Arca da Aliança, Tabernáculo em maquete e Templo de Salomão, com hotspots. Me indique fontes de modelos 3D com licença de uso comercial e espere minha aprovação. Versões leves (≤ 5 MB).
6. O motor passa a acionar visuais pela saída estruturada; no máximo 2 por turno.
7. Descrição textual alternativa para todo visual (acessibilidade).

Critério: perguntar "Como foi a segunda viagem de Paulo?" abre o mapa com a rota animada e sincronizada com a fala.
Atualize docs/PROGRESS.md e faça commit.
```

**Como testar:** pergunte sobre o Êxodo, os reis de Israel e a Arca; veja mapa, linha do tempo e 3D; peça uma ilustração de "pescadores no Mar da Galileia".

**Se der errado:** mapa lento no celular: peça "Reduza o tamanho dos dados do mapa e carregue sob demanda".

---

### Prompt 1.10 — Revisão espaçada e caderno de estudos

**Objetivo:** fechamento rico das sessões, revisão por voz e o caderno do aluno.

**Antes de colar:** 1.9 concluído.

**Prompt:**

```text
Leia o CLAUDE.md, o docs/PROGRESS.md e as seções 7 (J02, J06) e 8.9 (M09) da especificação.

1. Fechamento da sessão (RF-M09-01): resumo em áudio de até 2 minutos na voz do professor (guardado no Storage), mapa mental em JSON renderizado como diagrama, 3 a 7 cartões de revisão.
2. Repetição espaçada (RF-M09-02) em lib/review/sm2.ts, exatamente com as fórmulas da especificação, com testes de relógio simulado.
3. Revisão por voz (RF-M09-03): tela /revisao, o professor pergunta em tom de conversa, avalia a resposta (wrong, partial, right) e dá retorno curto.
4. Caderno (RF-M09-04): organização por tema, livro e data; sessões, resumos, mapas mentais, planos de aula, esboços, estudos, versículos marcados e notas pessoais; busca; exportação de item ou do caderno inteiro em PDF.
5. Tela Início completa (RF-M09-05).
6. Modo offline (RNF-07): Bíblia principal, caderno e cartões do dia em cache no service worker.

Atualize docs/PROGRESS.md e faça commit.
```

**Como testar:** encerre uma sessão e ouça o resumo; no dia seguinte (ou com data simulada), faça a revisão por voz; ative o modo avião e abra o caderno.

**Se der errado:** se os cartões ficarem óbvios demais, peça "Gere cartões que testem compreensão, não só memorização".

---

### Prompt 1.11 — Planos, pagamentos e limites

**Objetivo:** cobrança funcionando (Pix, cartão e boleto), limites por plano e teste grátis.

**Antes de colar:** conta Asaas em modo sandbox. **Decida D-01** (preços).

**Prompt:**

```text
Leia o CLAUDE.md, o docs/PROGRESS.md e as seções 7 (J07) e 8.12 (M12) da especificação.

1. DECISÃO D-01: me confirme os preços da tabela 8.12 antes de gravar.
2. Tabela plans configurável (preços, limites, recursos) e seed com Grátis, Plus e Premium.
3. lib/payments com a interface PaymentProvider e o fornecedor Asaas (sandbox): cliente, assinatura mensal e anual, Pix, cartão e boleto, teste de 7 dias no Premium.
4. Webhooks idempotentes com verificação do token, gravando em payment_events, e a máquina de estados da assinatura da seção 8.12, com testes de cada transição.
4b. Direitos de acesso (seção 10.6.4): lib/entitlements com grantEntitlement e revokeEntitlement; o webhook do Asaas só grava e atualiza direitos na tabela entitlements; TODAS as verificações de plano no app e na API leem só lib/entitlements, nunca o Asaas. Deixe a interface Purchases de lib/platform redirecionando para o checkout web. Escreva um teste que simula uma fonte "apple" gravando um direito, para provar que o app libera o acesso sem mudar nenhuma tela.
5. Medidor de uso (usage_counters) e verificação de limites em todas as rotas que custam dinheiro; aviso suave e convite para assinar ao atingir o limite; "uso justo".
6. Telas: comparação de planos, checkout, "Minha assinatura" (plano, próxima cobrança, trocar, cancelar).
7. Bloqueio de recursos por plano (Sermão só Premium etc.) com mensagens claras.
8. Painel no /admin: assinantes, receita recorrente, cancelamentos e custo de IA por usuário.

Critérios: fluxo completo no sandbox com Pix e cartão; webhooks de pagamento confirmado, atrasado e cancelado testados; limites respeitados.
Atualize docs/PROGRESS.md e faça commit.
```

**Como testar:** assine o Plus com Pix no sandbox; veja o acesso liberar; simule atraso e cancelamento pelo painel do Asaas.

**Se der errado:** webhook não chega: peça "Me mostre como expor o webhook no ambiente de preview e como testar com o simulador do Asaas".

---

### Prompt 1.12 — Painel administrativo completo

**Objetivo:** tudo o que você precisa para operar o produto.

**Antes de colar:** 1.11 concluído.

**Prompt:**

```text
Leia o CLAUDE.md, o docs/PROGRESS.md e as seções 8.14 (M14) e 15 da especificação.

Consolide o /admin com todas as seções de M14: obras, fila de licenças, conteúdo próprio, respostas sinalizadas (com auditoria por amostragem de 1% das respostas), usuários e assinaturas (sem acesso a conversas), métricas (seção 15.2), configurações (planos, limites, tipos de sermão, prompts versionados com histórico e reversão).
Implemente os eventos de analytics da seção 15.1 sem dados sensíveis.
Registre ações administrativas em audit_logs.
Proteja tudo com verificação de papel no servidor e testes.
Atualize docs/PROGRESS.md e faça commit.
```

**Como testar:** reverta uma versão de prompt e veja o professor mudar; marque uma resposta como errada pelo app e revise no painel.

**Se der errado:** se alguma tela do admin abrir para usuário comum, trate como erro grave e use o U1.

---

### Prompt 1.13 — Segurança, LGPD e custos

**Objetivo:** app seguro, em conformidade com a LGPD e com custo sob controle.

**Antes de colar:** conta no Sentry.

**Prompt:**

```text
Leia o CLAUDE.md, o docs/PROGRESS.md e as seções 12, 13 e 8.2 da especificação.

Faça uma revisão completa de segurança, privacidade e custo, e corrija o que encontrar:
1. RLS de todas as tabelas, autenticação das rotas, verificação de papel, limite de requisições por usuário e por IP.
2. Prompt injection: rode o conjunto injection e reforce as defesas até 100%.
3. LGPD: exportar meus dados (RF-M02-04), revogar consentimento, excluir conta, áudio não guardado por padrão, criptografia dos campos sensíveis, minimização nos logs (nenhum texto de conversa em logs).
4. Custos: cache de respostas e trechos frequentes, modelo rápido por padrão, compactação do histórico; mostre o custo médio por usuário ativo por mês antes e depois e compare com RNF-08.
5. Observabilidade: Sentry, logs estruturados, alertas de erro e de latência.
6. Backup diário (RNF-12) e teste de restauração.
7. Gere docs/SECURITY_REVIEW.md com tudo o que foi encontrado, corrigido e o que ficou pendente.

Atualize docs/PROGRESS.md e faça commit.
```

**Como testar:** peça seus dados pela tela de privacidade e confira o arquivo; leia o `SECURITY_REVIEW.md`.

**Se der errado:** se o custo por usuário passar da meta, peça "Proponha 5 formas de reduzir o custo com o menor impacto na qualidade".

---

### Prompt 1.14 — Testes finais, PWA e lançamento do beta

**Objetivo:** app em produção, testado e pronto para a primeira turma.

**Antes de colar:** domínio próprio comprado (se for usar); **D-12** (encarregado de dados) e **D-14** (nome final) decididos.

**Prompt:**

```text
Leia o CLAUDE.md, o docs/PROGRESS.md e as seções 12, 16 e 17 da especificação.

1. PWA completo: instalação guiada (com tutorial específico para iPhone), ícones e tela de abertura finais, offline conforme RNF-07.
2. Testes ponta a ponta de todas as jornadas J01 a J07 em celular, tablet e desktop (Playwright com emulação).
3. Acessibilidade (RNF-05) e desempenho (RNF-04): rode Lighthouse e corrija até atingir as metas.
4. Rode todos os evals e confirme os limiares da seção 16.2. Se algum falhar, pare e me mostre.
5. Landing page pública com o slogan, demonstração em vídeo (deixe o espaço para eu gravar), planos e cadastro.
6. Coleta de feedback no fim da sessão ("Como foi essa aula?").
7. Deploy de produção (Vercel + Supabase de produção), domínio, variáveis de produção, Asaas em produção, backup ativo.
8. Gere docs/BETA_CHECKLIST.md com tudo o que eu preciso conferir manualmente antes de abrir para a primeira turma (inclua revisão jurídica dos termos e a revisão do conselho teológico).
9. Relatório de prontidão para as lojas, em docs/STORE_READINESS.md: confira cada item da seção 10.6 (build estático, camada de plataforma, API v1 com token, entitlements, login com Apple, exclusão de conta, inventário de dados atualizado, interface com cara de app) e marque pronto ou pendente. O que estiver pendente vira tarefa antes do beta.

Ao terminar, crie a tag v0.1-beta.
Atualize docs/PROGRESS.md e faça commit.
```

**Como testar:** siga o `BETA_CHECKLIST.md` inteiro; instale o app no seu celular e no de mais duas pessoas.

> **Ponto de decisão:** comece a Fase 2 só depois de pelo menos 4 semanas de beta com usuários reais.

---

## Parte E — Fase 2: Produto robusto

### Prompt 2.1 — Aprendizados do beta

```text
Leia o CLAUDE.md e o docs/PROGRESS.md. Analise os dados do beta: eventos de analytics, feedbacks, respostas sinalizadas, relatórios de evals, latência e custo por usuário.
Gere docs/BETA_INSIGHTS.md com: onde os alunos desistem (funil da jornada J01), modos mais e menos usados, perguntas em que o professor errou ou foi fraco, reclamações de voz, custo real por usuário versus RNF-08, retenção D1/D7/D30.
Proponha uma lista priorizada de correções (impacto × esforço) e espere minha aprovação antes de implementar. Depois de aprovada, implemente, rode os evals, atualize docs/PROGRESS.md e faça commit.
```

**Como testar:** leia o relatório com calma; aprove só o que fizer sentido para o negócio.

### Prompt 2.2 — Plano Igreja e painel do professor da EBD

```text
Leia o CLAUDE.md, o docs/PROGRESS.md e as seções 7 (J08) e 8.13 (M13) da especificação.
Implemente o plano Igreja: migrations das tabelas P1 da seção 9.4 com RLS; cadastro da igreja; faixas de preço (D-01); papéis church_admin e church_teacher; turmas com convite por link e QR Code; lição da semana com card na tela Início dos alunos e adaptação pelo Professor Filipe; painel do professor com estatísticas agregadas (mínimo de 5 alunos para mostrar números); aviso claro ao aluno de que o professor da EBD não lê as conversas; lente e versão padrão da igreja; cobrança da igreja pelo PaymentProvider.
Teste com uma igreja simulada de 2 turmas e 10 alunos, incluindo testes de privacidade. Atualize docs/PROGRESS.md e faça commit.
```

**Como testar:** crie a sua igreja de teste, convide 3 pessoas pelo QR Code e publique uma lição.

### Prompt 2.3 — Aprofundar avançado

```text
Leia o CLAUDE.md, o docs/PROGRESS.md e a seção 8.7.4 (P1) da especificação.
Implemente: interlinear completo com morfologia por palavra; pronúncia em áudio do hebraico e do grego; estudo de palavra (todas as ocorrências no original, campo semântico, como cada versão traduziu); comparação de versões lado a lado com destaque das diferenças e explicação; história da interpretação por tradição, sempre com fonte; exportação com bibliografia em ABNT.
Teste com João 1:1, Gênesis 1:1 e Romanos 3:25 e me mostre os resultados para revisão. Atualize docs/PROGRESS.md e faça commit.
```

**Como testar:** peça a um seminarista ou pastor para avaliar os três estudos.

### Prompt 2.4 — Ensaio do sermão

```text
Leia o CLAUDE.md, o docs/PROGRESS.md e a seção 8.7.5 da especificação.
Implemente o modo Ensaio: consentimento específico para gravação; gravação e transcrição; análise de tempo total e por parte do esboço, clareza da ideia central, transições, ilustrações, fidelidade ao texto, palavras por minuto e vícios de linguagem; retorno com 3 pontos fortes e até 3 melhorias; comparação entre ensaios; áudio apagado após a análise, salvo opção de guardar.
Meta: ensaio de 10 minutos analisado em menos de 1 minuto. Atualize docs/PROGRESS.md e faça commit.
```

**Como testar:** ensaie 5 minutos de um sermão seu, aplique uma sugestão e ensaie de novo; compare.

### Prompt 2.5 — Apps nativos nas lojas

**Antes de colar:** decisão D-16 tomada (hora de ir para as lojas); contas de desenvolvedor Apple e Google ativas; um Mac disponível para gerar o app de iOS (exigência da Apple), ou um serviço de build na nuvem que o Claude Code vai sugerir.

```text
Leia o CLAUDE.md, o docs/PROGRESS.md, o docs/STORE_READINESS.md e as seções 4.0 e 10.6 da especificação.
O app foi construído para ser empacotado sem reescrita. Agora faça a migração para as lojas:
1. Rode de novo a verificação de prontidão (10.6) e corrija qualquer pendência antes de seguir.
2. Instale e configure o Capacitor (Android e iOS) usando o build estático do app; identificador do app conforme a decisão D-17.
3. Implemente lib/platform/native/ para todas as interfaces da tabela 10.6.2 com os plugins do Capacitor (microfone, áudio com segundo plano, push APNs e FCM gravando em devices, armazenamento, compartilhamento, arquivos, haptics, status bar). getPlatform() passa a escolher a implementação nativa. Os testes com mocks continuam passando.
4. Links profundos: Universal Links (iOS) e App Links (Android) no domínio próprio, incluindo o retorno do login.
5. DECISÃO D-10: pesquise as regras atuais da Apple e do Google para assinaturas e pagamento externo no Brasil e me apresente as opções (compra dentro do app, link para a web, ou as duas) com o impacto na receita. Depois da minha escolha, implemente a interface Purchases nativa gravando em entitlements pela mesma função grantEntitlement. Quem já assina pela web entra no app com a mesma conta e mantém o acesso.
6. Ícones, telas de abertura, permissões com textos claros em português (microfone, notificações).
7. Fichas das lojas: textos, capturas de tela, política de privacidade, classificação etária e as fichas de privacidade da Apple e do Google preenchidas a partir do docs/STORE_DATA_INVENTORY.md. Gere docs/STORE_CHECKLIST.md com o passo a passo de envio e os motivos mais comuns de recusa já tratados.
8. Teste a jornada J01 inteira e uma sessão de voz nos dois sistemas.
Critério: builds de teste no TestFlight e no teste interno do Google Play, com login, voz, notificação e assinatura funcionando. Atualize docs/PROGRESS.md e faça commit.
```

**Como testar:** instale pelo TestFlight e pelo teste interno do Google Play; entre com a mesma conta que você usa na web e confira se a assinatura aparece; receba uma notificação de revisão.

**Se der errado:** recusa da Apple por "funcionalidade mínima" ou "pagamento": cole o motivo exato da recusa no U1 e peça a correção e o texto de resposta para a equipe de revisão da loja.

**Como testar:** instale pelo TestFlight e pelo teste interno; faça a jornada J01 no app nativo.

### Prompt 2.6 — Biblioteca 3D e visuais ampliados

```text
Leia o CLAUDE.md, o docs/PROGRESS.md e a seção 8.8 da especificação.
1. Catálogo de modelos 3D em models3d com metadados (tema, versículos, hotspots, licença) e tela no /admin para eu adicionar modelos sem mexer no código.
2. Chegue a 20 objetos e cenários em maquete (ex.: Arca de Noé, Tabernáculo completo e utensílios, Templo de Salomão, Templo de Herodes, Jerusalém do século I, casa israelita, barco da Galileia, sinagoga, sepulcro do século I). Me indique fontes licenciadas para uso comercial ou um fluxo de geração por IA com revisão.
3. Chegue a 30 rotas de mapa e 15 linhas do tempo.
4. Biblioteca de ilustrações aprovadas, reaproveitadas antes de gerar novas.
Critério: catálogo navegável pelo aluno e carregamento rápido em celular médio. Atualize docs/PROGRESS.md e faça commit.
```

### Prompt 2.7 — Trilhas, engajamento, indicação e espanhol

```text
Leia o CLAUDE.md, o docs/PROGRESS.md e as seções 4.3, 8.15 e 12 (RNF-10) da especificação.
1. Trilhas guiadas opcionais conduzidas pelo professor (ex.: Panorama do AT em 30 dias, Vida de Paulo, Parábolas de Jesus), com progresso.
2. Sequência de dias de estudo e marcos, sem exagero de gamificação.
3. Compartilhar: cartão visual de versículo ou aprendizado para WhatsApp e Instagram, com link do app.
4. Indicação: quem indica ganha dias de Premium.
5. Notificações de trilha e lição da semana dentro das regras de 8.15.
6. Espanhol preparado: es.json completo, camada de prompt do professor em espanhol, Reina-Valera 1909 e Nueva Biblia Viva Open como versões, testes.
Atualize docs/PROGRESS.md e faça commit.
```

---

## Parte F — Fase 3: Imersão

### Prompt 3.1 — Decisão de tecnologia e motor imersivo

```text
Leia o CLAUDE.md, o docs/PROGRESS.md e a seção 8.16 (M16) da especificação.
1. DECISÃO D-11: compare React Three Fiber/WebGPU (mesmo código da web) com Unity e Unreal (nativos), considerando desempenho em celular, custo, curva de produção de conteúdo, integração com o professor por voz e realidade virtual futura. Recomende e espere minha decisão.
2. Com a decisão tomada, crie o motor base: movimento em primeira pessoa (toque e joystick virtual; teclado e mouse), colisão, hotspots, som ambiente e espacial, níveis de detalhe, carregamento por zonas.
3. Formato de "pacote de ambiente" (modelos, sons, hotspots, roteiro do guia, referências, ficha histórica com fontes).
Critério: cena de teste caminhável a 30 quadros por segundo ou mais num Android intermediário. Atualize docs/PROGRESS.md e faça commit.
```

### Prompt 3.2 — Primeiro ambiente: o Tabernáculo

```text
Leia o CLAUDE.md, o docs/PROGRESS.md e a seção 8.16 da especificação.
1. Pesquise as medidas e os materiais de Êxodo 25 a 40 no texto bíblico e nas obras da base, e gere docs/ambientes/tabernaculo.md com especificações e referências. PARE para eu revisar com um consultor antes da modelagem final.
2. Construa: acampamento, átrio, altar de bronze, pia, Lugar Santo (candelabro, mesa dos pães, altar do incenso), Santo dos Santos com a Arca (acesso só visual, com explicação do porquê).
3. Ambientação: luz do deserto que muda com a hora, fumaça do altar, sons do acampamento, vento.
4. Hotspots com versículos, significado, ligação com Hebreus conforme a lente do aluno e verbete.
5. Sacerdotes e povo como figuras simples com roupas coerentes com a época.
Critério: passeio do portão ao Santo dos Santos sem travar em celular intermediário. Atualize docs/PROGRESS.md e faça commit.
```

### Prompt 3.3 — O professor como guia dentro da cena

```text
Leia o CLAUDE.md, o docs/PROGRESS.md e a seção 8.16 da especificação.
Integre o Professor Filipe ao ambiente: modo passeio guiado por estações; modo livre em que o aluno pergunta por voz e o professor sabe onde ele está e o que está olhando; roteiro adaptado ao perfil, à lente e ao nível; ao sair, resumo, mapa mental e cartões como nas outras sessões; no modo Preparar aula, o professor da EBD monta um passeio para projetar em sala.
Critério: passeio guiado de 10 minutos com perguntas livres respondidas no contexto do lugar. Atualize docs/PROGRESS.md e faça commit.
```

### Prompt 3.4 — Linha de produção de ambientes

```text
Leia o CLAUDE.md, o docs/PROGRESS.md e a seção 8.16 da especificação.
1. Ferramenta no /admin para montar pacotes de ambiente: subir modelos, posicionar hotspots, ligar versículos e verbetes, escrever ou gerar o roteiro do guia, definir sons.
2. Validação automática de desempenho (tamanho, polígonos, texturas) antes de publicar.
3. Fichas de especificação, como a do Tabernáculo, para: Jerusalém e o Templo de Herodes, Mar da Galileia e Cafarnaum, travessia do Mar Vermelho, Pentecostes, Atenas no tempo de Paulo.
4. Publicação de ambientes novos sem nova versão do app (download sob demanda).
Critério: consigo criar um ambiente simples do zero pela ferramenta. Atualize docs/PROGRESS.md e faça commit.
```

### Prompt 3.5 — Realidade virtual

```text
Leia o CLAUDE.md, o docs/PROGRESS.md e a seção 8.16 da especificação.
1. Pesquise o suporte atual a WebXR e a apps nativos para Meta Quest e Apple Vision Pro; recomende o caminho e espere.
2. Adapte o motor: teletransporte e rotação em passos (conforto), interação com mãos ou controles, leitura de versículos no espaço 3D.
3. Professor por voz funcionando dentro dos óculos.
4. Teste com o Tabernáculo e me entregue um relatório de conforto e desempenho.
Ao terminar, crie a tag v1.0-imersivo. Atualize docs/PROGRESS.md e faça commit.
```

---

## Parte G — Prompts utilitários (use sempre que precisar)

### U1 — Corrigir um erro

```text
Encontrei um problema. Leia o CLAUDE.md e o docs/PROGRESS.md.
O que eu fiz: [descreva o passo a passo]
O que eu esperava: [descreva]
O que aconteceu: [descreva; cole a mensagem de erro se houver]
Onde: [tela, rota ou modo]
Antes de mexer no código: reproduza o erro com um teste automatizado que falha, explique a causa em linguagem simples e proponha a correção. Depois de eu aprovar, corrija, garanta que o teste passa e que nenhum outro quebrou, registre em "Problemas conhecidos" do PROGRESS.md se for o caso e faça commit.
```

### U2 — Retomar o trabalho depois de uma pausa

```text
Leia o CLAUDE.md e o docs/PROGRESS.md. Me diga em linguagem simples: em que prompt paramos, o que está pronto, o que falta neste prompt, quais decisões estão pendentes e qual é o próximo passo. Rode os testes e me diga se está tudo verde. Não mude nada ainda.
```

### U3 — Revisão de qualidade do código

```text
Leia o CLAUDE.md e o docs/PROGRESS.md. Faça uma revisão do código como um engenheiro sênior exigente: arquitetura, duplicação, tipagem, testes faltando, segurança, desempenho e aderência à especificação. Liste os problemas por gravidade com arquivo e linha. Não corrija nada ainda; espere eu escolher o que corrigir.
```

### U4 — Melhorar o professor com base nos evals

```text
Leia o CLAUDE.md, o docs/PROGRESS.md e as seções 5, 11 e 16 da especificação. Rode todos os evals. Para os 10 piores casos, explique o que deu errado (prompt, busca, fonte faltando ou modelo). Proponha ajustes separados por tipo. Depois da minha aprovação, aplique os ajustes de prompt como nova versão em prompt_versions, rode os evals de novo e me mostre a comparação antes e depois. Faça commit.
```

### U5 — Mudar o escopo ou uma regra do produto

```text
Quero mudar o produto: [descreva a mudança]. Leia o CLAUDE.md e a especificação. Antes de mexer no código: 1) mostre quais seções da especificação mudam e proponha o novo texto; 2) liste o impacto no código, no banco e nos testes; 3) estime o esforço. Depois da minha aprovação, atualize primeiro a especificação, depois o código e os testes, e registre a decisão em PROGRESS.md. Faça commit.
```

### U6 — Publicar uma nova versão

```text
Leia o CLAUDE.md e o docs/PROGRESS.md. Prepare a publicação: rode lint, typecheck, todos os testes e os evals; confirme os limiares da seção 16.2; aplique as migrations pendentes primeiro no ambiente de preview; me mostre o que mudou desde a última versão em linguagem simples. Só publique em produção depois da minha confirmação. Crie a tag de versão e atualize o PROGRESS.md.
```

---

## Parte H — Checklist fora do código

O Claude Code não resolve estes itens sozinho. São eles que costumam definir o prazo real.

- [ ] Criar as contas da seção A.2 no momento indicado.
- [ ] Decidir os itens da seção 19 da especificação quando o prompt pedir.
- [ ] Escolher nome final do app e do professor e verificar a marca no INPI (D-14).
- [ ] Comprar o domínio próprio antes do prompt 1.1 (D-17).
- [ ] Decidir a hora de ir para as lojas, depois do beta validado (D-16).
- [ ] Montar o conselho teológico (1 a 3 pastores ou teólogos de linhas diferentes) e revisar a resposta de crise pastoral.
- [ ] Revisão jurídica dos Termos de Uso e da Política de Privacidade (LGPD, dado religioso sensível).
- [ ] Definir o encarregado de dados (D-12).
- [ ] Turma piloto da EBD para a Fase 0 e para o beta.
- [ ] Orçamento mensal de IA, voz e imagens e acompanhamento do custo por usuário.
- [ ] Negociar licenças de versões modernas e de editoras (SBB, Biblica, CPAD, Vida Nova) quando houver usuários e números para mostrar.
- [ ] Contas de desenvolvedor Apple e Google para a Fase 2.
- [ ] Consultor de arqueologia bíblica e artista 3D (ou orçamento de modelos) para a Fase 3.
