# Velocidade das respostas e sincronismo da fala (22/11/2026)

## 1. O que foi medido na produção (antes)
Respostas do professor levavam **9 a 39 s**. Onde ia o tempo (campos `retrievalMs`, `llmMs` e `trace` do `done` de `/teacher/turn`):
- busca na biblioteca: 5 a 25 s (consulta em inglês feita por IA **antes** da busca: 2 a 7 s; embedding frio: ~5 s; banco principal: 2 a 9 s; títulos: até 6 s);
- IA: 2 a 21 s;
- primeira frase falada depois de parada: até 9 s; frases pedidas uma de cada vez.

## 2. Causa principal encontrada (depende do dono)
A resposta de diagnóstico mostra que **a chave da Anthropic está sem crédito**: `"Your credit balance is too low to access the Anthropic API"`. Em produção o professor usa o Claude primeiro; sem crédito, cada pergunta cai nas IAs gratuitas (Groq, Gemini, OpenRouter), que **atingem limite (429), recusam o pedido grande (413) e às vezes demoram 10 s ou mais**. É a razão da lentidão e da irregularidade (2 s a 30 s) que ainda restam.
**Ação do dono:** adicionar crédito em *Plans & Billing* do console da Anthropic. Com crédito, as respostas voltam a ~3 a 6 s com a qualidade do Claude. Sem crédito, o app continua respondendo (veja 3), mas mais devagar e com qualidade menor.

## 3. O que foi feito
**Toda pergunta tem resposta**
- A resposta nunca depende de uma única IA: tentativa de outro modelo, repetição da busca e, se tudo falhar, **resposta de emergência com o versículo já encontrado** (citado, nunca inventado) e botão "Tentar de novo".
- O cliente tenta de novo sozinho em falha passageira (erro 5xx, conexão caiu, 50 s sem resposta).
- Corrigido: mensagem enviada antes de a sessão existir dava "pedido inválido"; agora o botão só habilita com a sessão pronta e o envio espera.

**Velocidade**
- A consulta em inglês roda **ao lado** da busca (não na frente) e só entra se chegar em 1,6 s.
- Limites duros: banco principal 3,2 s, títulos 1,5 s, biblioteca 2,5 s; o que não chegou é dispensado.
- Embeddings repetidos calculados uma vez.
- A resposta sai **antes** de ser gravada no banco (salvar, medidor e análise vêm depois).
- Tentativas de IA mais curtas (10 s) e orçamento total de 30 s; orçamento de 3,2 s para a consulta em inglês.
- Depois de uma resposta "sem crédito", o Claude é pulado por 10 min e os pedidos já saem do tamanho das IAs gratuitas (sem 413).
- Aquecimento: ao abrir o app logado, o servidor acorda busca e bancos (no máximo a cada 8 min).
- Diagnóstico permanente no `done`: etapas da busca (`trace`), IA que respondeu e o que falhou (`route`).
- Medido depois (antes das últimas correções, com crédito esgotado): perguntas simples 2,3 a 6 s; as lentas ainda 15 a 30 s quando as IAs gratuitas estão no limite.

## 4. Sincronismo da fala
Antes: a boca vinha de um "analisador" ligado na saída do áudio (adiantado em relação ao alto-falante e irregular), as frases eram pedidas e tocadas uma de cada vez (pausas variáveis) e o texto aparecia segundos antes da voz.
Agora (`lib/voice/envelope.ts`, `playhead.ts`, `speak-queue.ts`, `lib/platform/web/audio-player.ts`):
- o **envelope da boca é calculado do áudio real** de cada frase (10 ms) e lido na **posição realmente audível** do relógio de áudio (`getOutputTimestamp`, já descontado o atraso do alto-falante ou do Bluetooth);
- as frases são pedidas juntas (3 em paralelo) e **encadeadas no relógio de áudio**: uma começa exatamente quando a anterior termina, sem intervalo;
- **o texto, o avatar falando e o mapa aparecem junto com o primeiro som audível** (no máximo 2 s de espera, para nunca esconder a resposta);
- silêncio = boca fechada.
**Teste automatizado** (`tests/e2e/voice-sync.mjs`, navegador real, áudio sintético de 400 ms de silêncio + 600 ms de tom): a boca abre entre −2 e 0 ms do início audível do tom (limite −20 a +45 ms), fica fechada no silêncio, fecha depois do som, as frases se encadeiam com folga < 5 ms e o texto aparece até 8 ms do início audível da voz.
**Limites honestos:** (1) medi o relógio e a lógica no Chromium, não ouvi num aparelho: a precisão real depende do atraso que o aparelho informa (Bluetooth pode informar errado); (2) a voz do aparelho (fallback, `speechSynthesis`) não expõe o áudio, então segue com o plano por palavras e **não** é perfeita; (3) o rosto só abre e fecha a mandíbula (uma imagem): formas de boca por vogal exigiriam novas artes.

## 5. O que falta
- **Crédito da Anthropic** (ver 2): maior ganho de uma vez.
- **Fala em fluxo:** começar a falar enquanto o texto longo ainda é gerado (precisa de resposta em fluxo do modelo e checagem de citações antes de falar).
- **Banco:** a busca híbrida (`search_chunks`) leva 0,5 a 6 s no servidor; uma versão com índice (0043, testada) trouxe 0,25 s mas mudou 22% dos resultados e foi desfeita. Vale reescrever com avaliação de qualidade.
- **Embedding frio** (~5 s na primeira pergunta de cada instância): mover para serviço sempre quente.
- **Medir em aparelho real** o sincronismo e o tempo até a primeira voz.
