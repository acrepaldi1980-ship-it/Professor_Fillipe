# Biblioteca Histórica Cristã (pedido do dono, 22/11/2026)

Seis autores e 20 obras, todas **em português**, com a divisão original preservada e a localização exata de cada passagem. O texto vem de edições e traduções cujo uso é permitido (regra 8.10.9: nenhuma obra entra sem ficha em `docs/LICENSES.md`).

## Como o português é feito
A tradução para o português é **automática** (modelo Claude, pela API de lotes), feita a partir de uma tradução inglesa de domínio público, com as divisões e os marcadores de seção preservados. O texto original em inglês fica guardado e pode ser mostrado ao lado. O leitor avisa que é tradução automática. Pipeline: `scripts/translate/josephus-pt.ts` (planejar, enviar, coletar, aplicar), `lib/josephus/translate.ts`.

Custo estimado (lote com 50% de desconto, preços da tabela da Anthropic de 03/11/2026): **Josefo inteiro** (762 mil palavras, 773 pedidos) ≈ **US$ 0,40 com Haiku 5.5** ou ≈ **US$ 7,90 com Sonnet 5.5**. As demais obras somam cerca de quatro vezes isso.

## Alternativas à tradução paga (avaliadas em 22/11/2026)
1. **Mistral, plano gratuito "Experiment"** (sem cartão, com verificação de telefone): capacidade informada de cerca de 1 bilhão de tokens por mês e 1 pedido por segundo (números de terceiros; confirmar no painel). Josefo inteiro usa menos de 0,3% disso e levaria cerca de 15 a 30 minutos. Qualidade boa em português. Atenção: no plano gratuito a Mistral pode usar os pedidos para treinar modelos; o texto de Josefo é de domínio público, então não há problema. `--provider mistral`.
2. **Gemini, chave gratuita em projeto sem faturamento** (AI Studio, sem cartão): qualidade alta, mas cota diária curta (o Flash dá algumas centenas de pedidos por dia, então Josefo levaria alguns dias). `--provider gemini`.
3. **Tradução local gratuita** (NLLB, Marian): testada. O modelo `opus-mt-en-ROMANCE` responde em espanhol; o NLLB-600M traduz bem, mas no motor atual leva dezenas de horas e trava em repetições. Rodar com CTranslate2 exigiria liberar outros endereços da rede e instalar o PyTorch. Qualidade menor e muito trabalho.
4. **Traduções portuguesas já existentes:** a Wikisource em português só tem trechos (*Contra Ápio*); as edições completas em português são protegidas por direitos autorais.
5. **Claude (lotes):** o caminho mais simples e de melhor qualidade, cerca de US$ 0,40 (Haiku 5.5) a US$ 7,90 (Sonnet 5.5) para Josefo inteiro.

## Catálogo (situação em 22/11/2026)

| # | Autor | Obra | Tradução-base proposta | Direitos | Situação |
| --- | --- | --- | --- | --- | --- |
| 1 | Flávio Josefo | Antiguidades Judaicas (20 livros) | Whiston, 1737 (Gutenberg 2848) | Domínio público | **Ingerida em inglês; tradução para o português pronta para rodar** |
| 2 | Flávio Josefo | Guerra dos Judeus (7 livros) | Whiston (Gutenberg 2850) | Domínio público | idem |
| 3 | Flávio Josefo | Vida (Autobiografia) | Whiston (Gutenberg 2846) | Domínio público | idem |
| 4 | Flávio Josefo | Contra Apião (2 livros) | Whiston (Gutenberg 2849) | Domínio público | idem |
| 5–8 | Eusébio de Cesareia | 4 obras (a definir: História Eclesiástica, Vida de Constantino, Mártires da Palestina, Teofania ou Preparação Evangélica) | NPNF série 2, vol. 1 (McGiffert, 1890) via CCEL (`schaff/npnf201`) | Domínio público | A obter (CCEL liberada na rede) |
| 9–12 | Tácito | Anais, Histórias, Agrícola, Germânia | **Anais e Histórias: Church e Brodribb (1864–1876)**; Agrícola e Germânia: idem | Domínio público | Gutenberg 16927 (Histórias) é a tradução de **Fyfe, 1912 (falecido em 1965): NÃO pode entrar**; buscar Church e Brodribb |
| 13–14 | Plínio, o Jovem | Cartas (livros 1–9) e Correspondência com Trajano (livro 10) | Melmoth (1746) / Bosanquet (1906, Gutenberg 2811) | Domínio público (verificar o ano de morte de cada tradutor) | A obter |
| 15 | Suetônio | Vidas dos Doze Césares | Thomson/Forester (Gutenberg 6400) | Domínio público | A obter (Gutenberg liberado) |
| 16–20 | Fílon de Alexandria | 5 obras (a definir: Sobre a Criação do Mundo, Alegoria das Leis, Contra Flaco, Embaixada a Gaio, Vida de Moisés) | Yonge (1854–1855) | Domínio público | A obter (CCEL ou Wikisource) |

Observações: a lista dos 20 foi montada a partir do prompt do dono, que dá o número de obras por autor e não os títulos; os títulos entre parênteses são proposta a confirmar. "Total 20" no prompt soma 4 + 4 + 4 + 2 + 1 + 5 = 20, com seis autores (o prompt diz "cinco" em um trecho).

## Regras para Josefo (já cumpridas no código)
- Divisão original: 20 livros de Antiguidades, 7 da Guerra, a Vida e 2 do Contra Apião; cada seção citável (*Ant.* 18.3.3).
- Controvérsias: o *Testimonium Flavianum* (*Ant.* 18.3.3) e a menção a Tiago (*Ant.* 20.9.1) têm discussão acadêmica sobre autenticidade e interpolação. **Pendência:** acrescentar uma nota de controvérsia nesses dois pontos (autenticidade total, interpolação parcial, falsificação; a maioria dos estudiosos admite um núcleo autêntico com acréscimos cristãos) e problemas de transmissão (manuscritos medievais; a tradição cristã copiou Josefo).
- O professor não apresenta hipótese discutida como consenso.

## Comparação entre historiadores (IA)
Quando Tácito (*Anais* 15.44), Suetônio (*Cláudio* 25, *Nero* 16) e Plínio (*Cartas* 10.96) entrarem na base, o contexto do professor receberá as passagens de todos juntas, com a regra de distinguir testemunho independente de referência posterior e de dizer as limitações de cada fonte.
