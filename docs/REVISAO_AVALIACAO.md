# Avaliação da função "Revisão" (22/11/2026)

## O que ela é
Repetição espaçada de memória (como Anki): ao **encerrar uma conversa de estudo**, o professor gera de 3 a 7 **cartões** (pergunta, resposta curta, versículo). Nos dias seguintes, a tela **Revisão** faz as perguntas por voz, o aluno responde falando ou escrevendo, a IA avalia (errou, parcial, acertou) e o cartão volta em 1, 6 e depois mais dias (algoritmo SM-2, `lib/review/sm2.ts`). Notificações lembram dos cartões do dia. Foi pedida na especificação (M09, RF-M09-01 a 03; jornada J06) para quem estuda **para lembrar** (EBD, pregador, seminarista).

## Ela é real?
O **código é real e testado** (algoritmo, avaliação por IA, rotas, tela, lembretes; 15 verificações de ponta a ponta passam).
Mas **na produção ela nunca entregou valor**, e medi o motivo:
- **0 cartões** existem no banco, de 203 conversas (nenhum aluno viu a função funcionar);
- só **2 de 203 conversas foram encerradas**, e os cartões só nascem no encerramento (botão "Encerrar e dar minha opinião" ou 10 min parado com a aba aberta); quem fecha a aba ou sai nunca gera cartões;
- testei agora na produção: 3 perguntas + encerrar devolveu `closed:false` e nenhum cartão, porque **as IAs gratuitas estão sem cota** (a chave da Anthropic sem crédito) e o resumo do encerramento depende de IA.
Por isso você nunca viu utilidade: a função existe, mas fica invisível e quebra no primeiro passo.

## Serve para alguma coisa?
Sim, **se** funcionar sem esforço: lembrar o que se estudou é o que separa "li" de "aprendi", e é o gancho de retorno diário (notificação "3 cartões para hoje"). Para o público da EBD e o seminarista é valioso; para o jovem curioso é opcional.

## Opções (decisão sua)
- **A. Manter e fazer funcionar (recomendada, baixo custo):** gerar os cartões **sozinho** ao sair da conversa (aba escondida ou fechada, com ≥ 3 respostas) em vez de exigir "encerrar"; botão visível "Criar cartões desta conversa" no fim da resposta; o cartão de Revisão no Início só aparece quando há cartões. Depende de IA disponível (crédito na Anthropic).
- **B. Esconder até haver cartões:** tirar "Revisão" da barra de baixo e deixá-la só no Início quando existirem cartões. Menos confusão hoje.
- **C. Retirar a função:** economiza manutenção, mas perde o gancho de retorno e o que a especificação prometeu.

Minha recomendação: **A + B**. Não mexi em nada disso sem a sua escolha.
