# Espanhol (Prompt 2.7, RNF-10)

O app agora pode ser usado em **espanhol** (América Latina, tratamento "tú"): em **Conta > Idioma** o aluno escolhe entre Português (Brasil) e Español.

## O que está em espanhol
- **Interface:** `lib/i18n/es.json` tem as mesmas 893 chaves do `pt-BR.json`. Uma chave sem tradução cai no português, então nenhuma tela fica em branco. Testes garantem as mesmas chaves, nenhuma vazia e os mesmos marcadores (`{n}`, `{title}`).
- **Professor Filipe:** o aluno em espanhol recebe uma camada de prompt (`layerLanguage` em `lib/teacher/prompts.ts`) que manda falar em espanhol, mantendo **todas** as regras do personagem (fonte antes de fala, falas curtas, lente, aviso de divergência, é uma IA). Versículos vêm da versão em espanhol e nunca são traduzidos por conta própria.
- **Documentos** (aula, sermão, aprofundamento): pedidos em espanhol à IA.
- **Bíblia:** padrão **Reina-Valera 1909** (domínio público) para quem não escolheu outra. Também estão no acervo, com licença aberta (CC0): Santa Biblia libre (Latinoamericano e para el mundo) e La Biblia en Español Sencillo 2026.
- **Voz:** a voz do servidor (Piper) é em português, então em espanhol o app usa **vozes masculinas do aparelho** em espanhol (Diego, Jorge, Pablo, Raúl, Juan, Carlos e parecidas). Se o aparelho não tiver uma, o professor só escreve e a tela explica como instalar (regra de que toda fala é masculina). O reconhecimento de fala (Whisper) já recebe o idioma.
- **Lembretes** (push): texto em português e espanhol.
- O idioma fica no aparelho (`lib/platform`) e no perfil (`profiles.locale`), para o servidor e para um aparelho novo.

## O que continua em português
- Trilhas guiadas, rotas de mapa, linhas do tempo, modelos 3D, curiosidades, arqueologia e termos legais: conteúdo próprio, ainda não traduzido. A Conta avisa isso ao aluno em espanhol.
- PDFs gerados (títulos fixos), textos de erro do servidor e a lista de obras da biblioteca (em sua maioria em português e inglês; o professor as explica em espanhol).

## Precisa de revisão por falante nativo
As traduções foram feitas por IA e passaram só por checagens automáticas. **Antes de divulgar em espanhol, peça a um falante nativo (ou a um pastor/professor de língua espanhola) para ler o `es.json` e a camada do professor.** Pontos de atenção: termos teológicos, tom de "tú", e o texto da tela de dados religiosos (LGPD).

## Divergência com a especificação (a decidir)
A especificação (seção 14, espanhol) cita **Biblica Open Nueva Biblia Viva (CC BY-SA)** como segunda versão. Ela **não foi ingerida**: não estava entre as fontes já carregadas e não consegui baixá-la neste ambiente. Em seu lugar entram as versões CC0 acima. Para incluí-la, é preciso baixar o arquivo, registrar a licença em `docs/LICENSES.md` e rodar a ingestão (`scripts/ingest/bible-ebible.ts`). Decisão do dono: manter as CC0 ou trazer a Nueva Biblia Viva.
