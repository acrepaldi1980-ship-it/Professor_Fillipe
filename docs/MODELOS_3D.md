# Modelos 3D: como adicionar, onde achar e como revisar

O catálogo tem **20 modelos feitos no código** (maquetes esquemáticas, sem figura de Jesus nem de Deus Pai) e aceita **modelos adicionados por você** em `/admin/modelos-3d`, sem mexer no código.

## Como adicionar um modelo (passo a passo)

1. Tenha um arquivo **.glb** de até **3,5 MB** (limite para abrir rápido em celular médio; o app recusa arquivos maiores).
2. Entre em `/admin` > **Modelos 3D** > **Novo modelo** e preencha: identificador (minúsculas, números e `_`), nome, tema, descrição para leitor de tela, nota do estudo (o que a Bíblia diz e o que é reconstrução), versículos relacionados (`EXO.25.10, JHN.4.6`), posição da câmera, **licença**, **fontes e créditos** e o arquivo.
3. Clique em **Ver como o aluno vê**. **Toque no modelo** para pegar as coordenadas de um ponto e use **Adicionar ponto**; depois edite o texto e os versículos do ponto na caixa de pontos.
4. **Salvar modelo.** Deixe "Visível para os alunos" desmarcado enquanto revisa; marque quando aprovar. Dá para editar sem enviar o arquivo de novo e para excluir.

O app recusa o cadastro se: o arquivo não for um GLB válido; passar de 3,5 MB; faltar licença ou fonte; um versículo não estiver no formato `LIV.cap.ver`; o texto descrever o rosto de Jesus ou representar Deus Pai (RA-20); ou o identificador for de um modelo do app. Toda alteração fica no registro de auditoria.

## Preparar o arquivo para o celular

- Reduza as texturas a **1024 px** e use poucas texturas; prefira cores simples.
- Menos de cerca de **100 mil triângulos**; apague o que o aluno não vê.
- Exporte como **.glb** (glTF binário). No Blender: File > Export > glTF 2.0 > "glb"; marque a compressão Draco ou use o `gltf-transform` (ferramenta gratuita) para otimizar.
- Centralize no meio e deixe o chão em y = 0 não é necessário: o app **ajusta a escala (4 unidades) e centraliza** o modelo sozinho; as coordenadas dos pontos são dadas depois desse ajuste, por isso use sempre a pré-visualização para pegá-las.

## Onde achar modelos com licença para uso comercial

Confira a licença **em cada modelo**, não no site inteiro, e guarde o endereço em "Fontes e créditos".

| Fonte | O que costuma ter | Cuidado |
| --- | --- | --- |
| Sketchfab (filtro "Downloadable") | Muita arqueologia e arquitetura antiga | Aceite só **CC0** ou **CC BY** (e CC BY-SA se aceitar a obrigação de compartilhar igual). **Recuse CC BY-NC, CC BY-ND e CC BY-NC-ND.** CC BY exige citar o autor |
| Poly Pizza | Modelos leves, bons para celular | Verifique **CC0** ou **CC BY** em cada um |
| Smithsonian 3D e acervos de museus com "acesso aberto" | Peças de museu escaneadas | Só as marcadas como **CC0** ou domínio público |
| Quaternius e Kenney | Pacotes de modelos leves em **CC0** | Servem para cenário (casas, árvores, barcos), não para peças bíblicas específicas |
| Modelos pagos (por exemplo lojas de modelos 3D) | Maquetes detalhadas | A licença "comercial" precisa cobrir um **aplicativo vendido** e redistribuição do arquivo |

Regra do app (igual à dos livros): licença NC, ND ou sem informação **não entra**.

## Geração por IA com revisão (fluxo sugerido)

1. Gere o modelo numa ferramenta de texto/imagem para 3D. **Antes**, leia os termos da ferramenta e do **plano que você usa**: o uso comercial e a propriedade do resultado dependem do plano e mudam com o tempo.
2. Descreva só o que a Bíblia sustenta ("tenda de pelo de cabra, pátio de 100 por 50 côvados"); **nunca peça o rosto de Jesus nem Deus Pai** (RA-20).
3. **Revisão obrigatória antes de ficar visível** (modelo salvo com "Visível" desmarcado):
   - Confere com o texto: medidas, materiais e partes citados na nota existem na Bíblia? O que é reconstrução está dito na nota?
   - Sem figuras humanas com rosto, sem símbolos de outras religiões fora de contexto, sem anacronismo evidente (vidro, parafusos, concreto).
   - Abre bem num celular médio (arquivo ≤ 3,5 MB; gire e aproxime).
   - Licença e fonte preenchidas (para IA: nome da ferramenta, data e o plano usado).
4. Marque como visível e confira como aluno.

## O que o aluno vê

Em **Mapas e linhas do tempo** > **Modelos em 3D**: busca por nome, **filtro por tema** e abertura em 3D com pontos de toque (texto e versículos), texto alternativo para leitor de tela e opção de movimento reduzido.

## Limites conhecidos

- O professor (conversa) só sugere modelos feitos no código; os adicionados no admin aparecem no catálogo do aluno, mas ainda não entram nas sugestões da conversa.
- Mapas e modelos usam coordenadas e medidas aproximadas; onde há debate, a nota diz.
