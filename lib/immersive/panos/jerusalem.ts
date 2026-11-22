// Jerusalem panoramas (Prompt 3.5c): real wide photographs of the Old City from Wikimedia Commons, open licenses, one credit per photo. The files are
// the 960 px previews the owner uploaded; replace them by the originals (same names) to make them sharp. Short texts need the consultant's review.
import { PanoTour, type PanoScene } from "../pano";

const commons = (file: string) => `https://commons.wikimedia.org/wiki/File:${file}`;
const cov = (aspect: number) => { const h = Math.max(90, Math.min(220, Math.round(aspect * 30))); return { h, v: Math.round(h / aspect) }; };
const ids = ["oliveiras", "drorab", "templo", "gravura", "entardecer", "vista", "torre_davi"] as const;
const nav = (i: number) => [
  ...(ids[i + 1] ? [{ to: ids[i + 1], label: `Próximo: ${titles[ids[i + 1]]}`, yaw: 50, pitch: -8 }] : []),
  ...(ids[i - 1] ? [{ to: ids[i - 1], label: `Anterior: ${titles[ids[i - 1]]}`, yaw: -50, pitch: -8 }] : []),
];
const titles: Record<(typeof ids)[number], string> = { oliveiras: "Monte das Oliveiras", drorab: "Cidade Velha", templo: "Monte do Templo", gravura: "Gravura histórica", entardecer: "Entardecer", vista: "Vista da cidade", torre_davi: "Torre de Davi" };

type S = Omit<PanoScene, "startYaw" | "links">;
const base: Record<(typeof ids)[number], S> = {
  oliveiras: { id: "oliveiras", title: "Jerusalém vista do Monte das Oliveiras", image: "/panos/jerusalem-oliveiras.jpg", coverage: cov(7.4),
    credit: { author: "Yigal Dekel (יגאל דקל)", license: "CC BY-SA 4.0", source: commons("%D7%94%D7%A2%D7%99%D7%A8_%D7%94%D7%A2%D7%AA%D7%99%D7%A7%D7%94_-%D7%9E%D7%91%D7%98_%D7%9E%D7%94%D7%A8_%D7%94%D7%96%D7%99%D7%AA%D7%99%D7%9D.jpg") },
    hotspots: [{ id: "info", label: "A Cidade Velha vista do leste", text: "Do Monte das Oliveiras vê-se a Cidade Velha e o Monte do Templo, do outro lado do vale. Jesus ensinou sobre o futuro sentado no Monte das Oliveiras, de frente para o Templo (Mateus 24:3).", refs: ["MAT.24.3", "ACT.1.12"], yaw: 0, pitch: 0 }],
    script: "Do Monte das Oliveiras, Jesus via a cidade e o Templo. Em Mateus 24 ele falou aqui aos discípulos. O que você perguntaria a ele sentado neste monte?" },
  drorab: { id: "drorab", title: "A Cidade Velha e o Domo da Rocha", image: "/panos/jerusalem-drorab.jpg", coverage: cov(3.37),
    credit: { author: "Drorab", license: "CC BY-SA 3.0", source: commons("Untitled_Panorama4_13_%D7%99%D7%A8%D7%95%D7%A9%D7%9C%D7%99%D7%9D_%D7%94%D7%A2%D7%99%D7%A8_%D7%94%D7%A2%D7%AA%D7%99%D7%A7%D7%94.jpg") },
    hotspots: [{ id: "info", label: "Jerusalém hoje", text: "A Cidade Velha de Jerusalém como é hoje. O Domo dourado marca o Monte do Templo. Os Salmos chamam Jerusalém de cidade para onde as tribos sobem (Salmo 122).", refs: ["PSA.122.2"], yaw: 0, pitch: 0 }],
    script: "Esta é Jerusalém hoje, com o domo dourado sobre o Monte do Templo. O Salmo 122 fala da alegria de subir a esta cidade. O que significa subir a Jerusalém para você?" },
  templo: { id: "templo", title: "O Monte do Templo", image: "/panos/jerusalem-templo.jpg", coverage: cov(3.44),
    credit: { author: "365grad", license: "CC BY 3.0", source: commons("Panorama_Jerusalem_Tempelberg.jpg") },
    hotspots: [{ id: "info", label: "O Monte do Templo", text: "O Monte do Templo, onde ficaram o Templo de Salomão e depois o de Herodes. Em 2 Crônicas 3:1 Salomão começa a construir a casa do Senhor no monte Moriá, em Jerusalém. Hoje o local tem construções posteriores, como o Domo da Rocha.", refs: ["2CH.3.1"], yaw: 0, pitch: 0 }],
    script: "Neste monte ficaram o Templo de Salomão e o de Herodes. Segundo 2 Crônicas 3, Salomão começou a obra no monte Moriá. Por que o lugar da adoração importava tanto para Israel?" },
  gravura: { id: "gravura", title: "Gravura histórica de Jerusalém", image: "/panos/jerusalem-gravura.jpg", coverage: cov(3.47),
    credit: { author: "Biblioteca Nacional de Israel (imagem histórica)", license: "Domínio público", source: commons("Panorama_of_Jerusalem_from_the_Mount_of_Olives.jpg") },
    hotspots: [{ id: "info", label: "Panorama antigo", text: "Gravura antiga com legendas que mostra Jerusalém do Monte das Oliveiras, com a muralha, o Domo da Rocha e as igrejas. Não é uma foto nem a cidade do tempo bíblico: mostra Jerusalém como era desenhada há mais de cem anos.", refs: [], yaw: 0, pitch: 0 }],
    script: "Esta é uma gravura antiga de Jerusalém, com as legendas dos lugares. Ela mostra como a cidade era desenhada séculos depois da época bíblica. O que mudou desde então?" },
  entardecer: { id: "entardecer", title: "Jerusalém ao entardecer", image: "/panos/jerusalem-entardecer.jpg", coverage: cov(2.46),
    credit: { author: "Rhododendrites", license: "CC BY-SA 4.0", source: commons("Jerusalem_hazy_dusk_(20115).jpg") },
    hotspots: [{ id: "info", label: "Jerusalém ao entardecer", text: "Jerusalém ao pôr do sol, com a Cidade Velha ao fundo. A cidade é citada em toda a Bíblia como o lugar onde Deus escolheu pôr o seu nome (1 Reis 11:36).", refs: ["1KI.11.36"], yaw: 0, pitch: 0 }],
    script: "Jerusalém ao entardecer. A Bíblia a chama de cidade que Deus escolheu, em 1 Reis 11. O que faz um lugar ser especial para você?" },
  vista: { id: "vista", title: "Vista de Jerusalém", image: "/panos/jerusalem-creisor.jpg", coverage: cov(4.9),
    credit: { author: "C. Reisor (creisor)", license: "CC BY-SA 2.0", source: commons("Jerusalem_(24420817989).jpg") },
    hotspots: [{ id: "info", label: "Jerusalém e suas colinas", text: "Jerusalém é uma cidade construída sobre colinas e cercada de vales. O Salmo 125 diz que, como os montes cercam Jerusalém, assim o Senhor cerca o seu povo.", refs: ["PSA.125.2"], yaw: 0, pitch: 0 }],
    script: "Jerusalém é cercada de colinas. O Salmo 125 usa essa imagem para falar do cuidado de Deus. Que imagem da natureza fala de Deus para você?" },
  torre_davi: { id: "torre_davi", title: "A Cidadela, a \"Torre de Davi\"", image: "/panos/jerusalem-torre-davi.jpg", coverage: cov(3.37),
    credit: { author: "Xsteadfastx", license: "CC BY 3.0", source: commons("Towerofdavid.jpg") },
    hotspots: [{ id: "info", label: "A \"Torre de Davi\"", text: "A Cidadela de Jerusalém, perto da Porta de Jafa, é chamada de Torre de Davi por tradição. As construções que se veem são de épocas muito posteriores ao rei Davi.", refs: [], yaw: 0, pitch: 0 }],
    script: "Este lugar é chamado de Torre de Davi, mas o nome vem de uma tradição posterior: as construções são de épocas bem depois de Davi. Como a gente separa tradição de texto bíblico?" },
};

export const JERUSALEM_TOUR: PanoTour = PanoTour.parse({
  id: "jerusalem_panoramas", title: "Jerusalém em panorâmicas", era: "A Cidade Velha e o Monte das Oliveiras como estão hoje",
  start: "oliveiras", refs: ["MAT.24.3", "ACT.1.12", "PSA.122.2", "2CH.3.1", "1KI.11.36", "PSA.125.2"],
  scenes: ids.map((id, i) => ({ ...base[id], startYaw: 0, links: nav(i) })),
  sheet: { summary: "Sete imagens panorâmicas de Jerusalém: fotos reais da Cidade Velha, do Monte do Templo e da Cidadela, e uma gravura antiga. São imagens da cidade de hoje, não da época bíblica.",
    sources: ["Wikimedia Commons (arquivos e licenças citados em cada imagem)", "Bíblia Livre 2018 (versículos citados)"],
    uncertainty: "As construções visíveis (Domo da Rocha, muralhas, Cidadela) são posteriores ao tempo bíblico. Os textos curtos aguardam revisão do consultor." },
});
