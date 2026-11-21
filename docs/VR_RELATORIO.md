# Realidade virtual — caminho, conforto e desempenho (Prompt 3.5)

Data: 21/11/2026. **Aviso de honestidade:** nenhum óculos esteve disponível nesta entrega. O que foi testado aqui: lógica de conforto (testes de unidade), entrada em VR com um WebXR simulado (e2e) e compilação. **Não foi medido** quadro por segundo nem conforto em aparelho real. A lista da seção 5 deve ser cumprida num Quest antes de chamar o VR de validado.

## 1. Caminho recomendado

| Opção | Prós | Contras | Custo |
| --- | --- | --- | --- |
| **A. WebXR no próprio PWA (escolhida)** | Mesmo código e mesmo professor por voz; sem loja; atualiza sem nova versão; Quest Browser tem WebXR completo | Safari no Vision Pro só aceita `immersive-vr` (sem AR) e só no visionOS 2+; desempenho abaixo do nativo | R$ 0 (`@react-three/xr`, MIT) |
| B. App nativo Quest (Unity/Godot) | Melhor desempenho; loja da Meta | Segunda base de código, motor novo, revisão da Meta, reescreve o motor de ambientes | Alto (meses) |
| C. App nativo visionOS | Melhor integração com o Vision Pro | Mac, conta de desenvolvedor, SwiftUI/RealityKit, outra base de código | Alto |

Recomendação: **A agora**; B e C só se a procura por VR justificar (decisão do dono, [DECISÃO]). Aparelhos: Meta Quest 2/3/3S pelo Quest Browser; Apple Vision Pro pelo Safari (olhar + pinça).

## 2. O que foi feito

- Botão **Entrar em VR** (`imm.vr`) só aparece se o navegador responde `isSessionSupported('immersive-vr')`. Se o óculos recusa, o aluno continua na tela com aviso.
- **Conforto por padrão:** sem andar com o direcional (principal causa de enjoo); **rotação em passos de 30°** no direcional direito (um toque, um passo, volta ao centro para o próximo); **teletransporte** por raio do controle ou pinça, só em chão livre, dentro da área e até 20 m (`lib/immersive/vr.ts`, testado). As estações do passeio também levam o aluno por teletransporte.
- **Interação:** painel flutuante a 1,7 m, ligeiramente abaixo dos olhos, colocado uma vez por conteúdo novo (não persegue a cabeça); botões por raio do controle, pinça das mãos ou olhar+pinça (Vision Pro).
- **Versículos em 3D:** ao chegar perto de um ponto de interesse o painel mostra o texto e até 2 versículos (versão principal do aluno), com a referência.
- **Professor por voz dentro do óculos:** botão Perguntar liga o microfone (via `lib/platform`), a resposta aparece no painel e é falada (Piper, voz masculina); Ouvir repete a estação. O professor sabe onde o aluno está e o que olha (mesmo contexto de cena da tela).
- **Ficha histórica** no painel (resumo e fontes). RA-20 continua nos textos dos pacotes.
- Desempenho: `foveation` máxima e taxa de quadros alta no `createXRStore`; só as zonas próximas são montadas; a queda de qualidade automática da tela continua.

## 3. Decisões de conforto (e por quê)
- Sem curvas suaves nem andar suave: evita conflito visual-vestibular.
- Sem escurecimento (blink) nos passos: o passo instantâneo de 30° já é o padrão de conforto; o teletransporte é instantâneo. Se testes mostrarem desconforto, acrescentar vinheta.
- Painel fixo no mundo, não na cabeça.

## 4. Metas de desempenho
Quest 72 Hz (mínimo `COMFORT.minFps` = 72); Vision Pro 90 Hz. Orçamento por ambiente continua o de `glb-check` (150 mil triângulos, 5 MB); em VR, renderiza-se duas vezes, por isso o Tabernáculo deve usar o limite mais baixo e ser medido.

## 5. Lista de teste manual (cumprir num Quest 3 e, se possível, num Vision Pro)
1. Abrir `/imersao?e=campo_de_teste` no Quest Browser; botão Entrar em VR aparece; entra sem erro.
2. Rotação em passos de 30° (12 toques = volta completa); sem rotação contínua.
3. Teletransporte com o raio: marca o chão, recusa dentro de colunas e além de 20 m.
4. Painel legível a 1,7 m (texto do ponto, versículos); botões acionados por controle e por mão.
5. Perguntar por voz: gravar, resposta falada e no painel.
6. Estações: Próxima/Anterior levam à posição certa.
7. Medir: `?fps=1` (ou o Oculus Developer Hub) por 3 min: ≥ 72 fps estável; anotar aparelho, data e resultado aqui.
8. Conforto: 10 minutos; nota de enjoo (0–10) de 3 pessoas.
9. Sair do modo VR e voltar à tela sem recarregar.

Resultados medidos: **pendentes**.
