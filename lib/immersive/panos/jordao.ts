// From the Sea of Galilee to the Judean desert (Prompt 3.5c): real wide photographs from Wikimedia Commons, open licenses, one credit per photo.
// Short texts cite verses and wait for the consultant's review.
import { PanoTour, type PanoScene } from "../pano";

const commons = (file: string) => `https://commons.wikimedia.org/wiki/File:${file}`;
const cov = (aspect: number) => { const h = Math.max(90, Math.min(220, Math.round(aspect * 30))); return { h, v: Math.round(h / aspect) }; };
const ids = ["kinneret", "jordao", "deserto", "wadi_qilt", "mar_morto"] as const;
const titles = { kinneret: "Mar da Galileia", jordao: "Vale do Jordão", deserto: "Deserto da Judeia", wadi_qilt: "Wadi Qilt", mar_morto: "Mar Morto" } as const;
const nav = (i: number) => [
  ...(ids[i + 1] ? [{ to: ids[i + 1], label: `Próximo: ${titles[ids[i + 1]]}`, yaw: 50, pitch: -8 }] : []),
  ...(ids[i - 1] ? [{ to: ids[i - 1], label: `Anterior: ${titles[ids[i - 1]]}`, yaw: -50, pitch: -8 }] : []),
];
type S = Omit<PanoScene, "startYaw" | "links">;
const base: Record<(typeof ids)[number], S> = {
  kinneret: { id: "kinneret", title: "O Mar da Galileia", image: "/panos/kinneret.jpg", coverage: cov(4.55),
    credit: { author: "joshuapiano", license: "CC BY 2.0", source: commons("Kinneret_Panarama_(8046857672).jpg") },
    hotspots: [{ id: "info", label: "O Mar da Galileia", text: "O Mar da Galileia, também chamado Quinerete, é um grande lago de água doce no norte de Israel. Foi à beira dele que Jesus chamou os primeiros discípulos, entre eles Pedro e André (Mateus 4:18). A foto mostra a paisagem de hoje.", refs: ["MAT.4.18"], yaw: 0, pitch: 0 }],
    script: "Foi à beira do Mar da Galileia que Jesus chamou Pedro e André, em Mateus 4. Se ele passasse por você hoje, o que estaria fazendo?" },
  jordao: { id: "jordao", title: "O Vale do Jordão", image: "/panos/jordao.jpg", coverage: cov(4.07),
    credit: { author: "Юкатан", license: "CC BY-SA 3.0", source: commons("Jordan_Valley_Panorama.jpg") },
    hotspots: [{ id: "info", label: "O Vale do Jordão", text: "O vale por onde corre o rio Jordão, que liga o Mar da Galileia ao Mar Morto. Jesus veio da Galileia ao Jordão para ser batizado por João (Mateus 3:13). A foto mostra o vale de hoje.", refs: ["MAT.3.13"], yaw: 0, pitch: 0 }],
    script: "Neste vale corre o Jordão, onde Jesus foi batizado, segundo Mateus 3. Por que ele quis ser batizado por João?" },
  deserto: { id: "deserto", title: "O deserto da Judeia", image: "/panos/deserto-judeia.jpg", coverage: cov(4.56),
    credit: { author: "Julien Menichini", license: "CC BY 2.0", source: commons("Judean_desert_(5100958997).jpg") },
    hotspots: [{ id: "info", label: "O deserto da Judeia", text: "A região seca entre Jerusalém e o Mar Morto. João Batista pregava no deserto da Judeia (Mateus 3:1), e Jesus foi levado ao deserto para ser tentado (Mateus 4:1). A foto mostra a paisagem de hoje.", refs: ["MAT.3.1", "MAT.4.1"], yaw: 0, pitch: 0 }],
    script: "O deserto da Judeia é o cenário da pregação de João e da tentação de Jesus, em Mateus 3 e 4. O que o deserto ensina que a cidade não ensina?" },
  wadi_qilt: { id: "wadi_qilt", title: "Wadi Qilt, a estrada para Jericó", image: "/panos/wadi-qilt.jpg", coverage: cov(6.18),
    credit: { author: "Joel (יוֹאֵל)", license: "CC BY-SA 2.0", source: commons("Wadi_Qilt_Panorama.jpg") },
    hotspots: [{ id: "info", label: "Wadi Qilt", text: "O vale do Wadi Qilt, junto ao antigo caminho de Jerusalém a Jericó, que a tradição associa à parábola do bom samaritano (Lucas 10:30). A foto mostra o vale de hoje.", refs: ["LUK.10.30"], yaw: 0, pitch: 0 }],
    script: "Este vale fica ao longo do caminho de Jerusalém a Jericó, onde a parábola do bom samaritano acontece, em Lucas 10. Quem é o seu próximo hoje?" },
  mar_morto: { id: "mar_morto", title: "O Mar Morto, ao norte", image: "/panos/mar-morto.jpg", coverage: cov(5.42),
    credit: { author: "Someone35", license: "CC BY-SA 3.0", source: commons("Northern_dead_sea_panorama.jpg") },
    hotspots: [{ id: "info", label: "O Mar Morto", text: "O Mar Morto, chamado na Bíblia de Mar Salgado, é o ponto mais baixo da terra. Ele aparece como limite de Israel e do vale do Jordão (Josué 3:16). A foto mostra a costa norte de hoje.", refs: ["JOS.3.16"], yaw: 0, pitch: 0 }],
    script: "O Mar Morto é o Mar Salgado da Bíblia, no fim do vale do Jordão, citado em Josué 3. O que você sente ao ver um mar onde quase nada vive?" },
};

export const JORDAO_TOUR: PanoTour = PanoTour.parse({
  id: "galileia_ao_deserto", title: "Do Mar da Galileia ao deserto", era: "Paisagens de lugares da vida de Jesus, como estão hoje",
  start: "kinneret", refs: ["MAT.4.18", "MAT.3.13", "MAT.3.1", "MAT.4.1", "LUK.10.30", "JOS.3.16"],
  scenes: ids.map((id, i) => ({ ...base[id], startYaw: 0, links: nav(i) })),
  sheet: { summary: "Cinco panorâmicas reais do caminho que vai do Mar da Galileia ao Mar Morto: o lago, o vale do Jordão, o deserto da Judeia, o Wadi Qilt e a costa norte do Mar Morto. São paisagens de hoje, ligadas a cenas dos Evangelhos.",
    sources: ["Wikimedia Commons (arquivos e licenças citados em cada foto)", "Bíblia Livre 2018 (versículos citados)"],
    uncertainty: "A ligação de cada lugar com uma cena bíblica é a da tradição e da pesquisa; algumas identificações (como o Wadi Qilt e a parábola) são tradicionais, não certas. Os textos curtos aguardam revisão do consultor." },
});
