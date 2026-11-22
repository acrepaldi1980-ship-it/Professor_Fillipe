// Real wide panoramas of Bible lands (Prompt 3.5c), from Wikimedia Commons with open licenses. The files here are the 960 px previews the owner
// sent; swap them for the originals (same file name) and the tour gets sharp. Texts are short and cite verses; they need the consultant's review.
import { PanoTour, type PanoScene } from "../pano";

const commons = (file: string) => `https://commons.wikimedia.org/wiki/File:${file}`;
/** Horizontal coverage guessed from the aspect ratio (a 3:1 panorama ~ 90°, 8:1 ~ 250°) with a fixed 30° of height. */
const cov = (aspect: number) => { const h = Math.max(90, Math.min(200, Math.round(aspect * 30))); return { h, v: Math.round(h / aspect) }; };

const scenes: Omit<PanoScene, "startYaw">[] = [
  { id: "areopago", title: "Atenas: o Areópago e a Acrópole", image: "/panos/areopago.jpg", coverage: cov(3.06),
    credit: { author: "Ggia", license: "CC BY-SA 3.0", source: commons("20101024_Acropolis_panoramic_view_from_Areopagus_hill_Athens_Greece.jpg") },
    hotspots: [{ id: "info", label: "A Acrópole vista do Areópago", text: "Atenas, Grécia. A foto mostra a Acrópole vista da colina do Areópago, onde Paulo foi levado para explicar o que ensinava, segundo Atos 17. As ruínas são de hoje; os monumentos que se veem são dos séculos V a.C. em diante.", refs: ["ACT.17.19", "ACT.17.22"], yaw: 0, pitch: 0 }],
    links: [{ to: "cesareia", label: "Próximo: Cesareia", yaw: 50, pitch: -8 }],
    script: "Você está olhando a Acrópole de Atenas, vista do Areópago, a colina onde Paulo falou aos atenienses em Atos 17. O que você acha que ele sentiu diante de tantos templos?" },
  { id: "cesareia", title: "Cesareia Marítima: o teatro", image: "/panos/cesareia.jpg", coverage: cov(3.8),
    credit: { author: "Mustang Joe", license: "CC0", source: commons("Caesarea_Amphitheater_(53330987674).jpg") },
    hotspots: [{ id: "info", label: "O teatro de Cesareia", text: "Cesareia Marítima, Israel. Foi a capital romana da Judeia. Aqui aparecem Cornélio, o centurião, em Atos 10, e Paulo preso e levado diante das autoridades em Atos 23 a 26. A foto mostra o teatro de hoje, restaurado.", refs: ["ACT.10.1", "ACT.23.23"], yaw: 0, pitch: 0 }],
    links: [{ to: "tel_dan", label: "Próximo: Tel Dan", yaw: 55, pitch: -8 }, { to: "areopago", label: "Anterior: Atenas", yaw: -55, pitch: -8 }],
    script: "Este é o teatro de Cesareia Marítima, a cidade de Cornélio e da prisão de Paulo, em Atos 10 e 23. Se você fosse um romano aqui, o que esperaria do evangelho?" },
  { id: "tel_dan", title: "Tel Dan, no norte de Israel", image: "/panos/tel-dan-pano.jpg", coverage: cov(8.4),
    credit: { author: "Jotpe", license: "CC BY-SA 4.0", source: commons("Tel_Dan_Panorama.tif") },
    hotspots: [{ id: "info", label: "Tel Dan", text: "Tel Dan, no extremo norte do antigo Israel (de \"Dã até Berseba\"). Em 1 Reis 12 o rei Jeroboão colocou aqui um dos bezerros de ouro. A foto mostra a paisagem de hoje do sítio arqueológico.", refs: ["1KI.12.29", "JDG.18.29"], yaw: 0, pitch: 0 }],
    links: [{ to: "hattin", label: "Próximo: Baixa Galileia", yaw: 60, pitch: -8 }, { to: "cesareia", label: "Anterior: Cesareia", yaw: -60, pitch: -8 }],
    script: "Tel Dan marcava o limite norte de Israel. Em 1 Reis 12, Jeroboão colocou aqui um bezerro de ouro. Por que você acha que o povo se apegava a imagens?" },
  { id: "hattin", title: "Baixa Galileia: colinas perto do Mar da Galileia", image: "/panos/hattin.jpg", coverage: cov(4.19),
    credit: { author: "Ondřej Žváček", license: "CC BY 2.5", source: commons("Hatt%C3%ADnsk%C3%A9_rohy.jpg") },
    hotspots: [{ id: "info", label: "Paisagem da Galileia", text: "Colinas de origem vulcânica na Baixa Galileia, perto do Mar da Galileia, na região onde Jesus ensinou e curou, segundo Mateus 4:23. A foto mostra a paisagem de hoje.", refs: ["MAT.4.23"], yaw: 0, pitch: 0 }],
    links: [{ to: "jezreel", label: "Próximo: Vale de Jezreel", yaw: 55, pitch: -8 }, { to: "tel_dan", label: "Anterior: Tel Dan", yaw: -55, pitch: -8 }],
    script: "Esta é a paisagem da Baixa Galileia, onde Jesus percorreu cidades e vilas, segundo Mateus 4:23. Que cena da vida de Jesus você imagina por aqui?" },
  { id: "jezreel", title: "O Vale de Jezreel", image: "/panos/jezreel.jpg", coverage: cov(5.7),
    credit: { author: "Tomisti", license: "CC BY-SA 3.0", source: commons("Jezreel_Valley_panorama.jpg") },
    hotspots: [{ id: "info", label: "Vale de Jezreel", text: "A grande planície agrícola do norte de Israel. Em Juízes 6 os midianitas acamparam neste vale, e Gideão os enfrentou. A foto mostra o vale de hoje, visto do alto.", refs: ["JDG.6.33"], yaw: 0, pitch: 0 }],
    links: [{ to: "hattin", label: "Anterior: Baixa Galileia", yaw: -60, pitch: -8 }],
    script: "O Vale de Jezreel foi cenário de batalhas, como a de Gideão em Juízes 6 e 7. O que a Bíblia ensina sobre vencer com poucos?" },
];

export const PANORAMAS_TOUR: PanoTour = PanoTour.parse({
  id: "panoramicas_reais", title: "Panorâmicas reais do mundo bíblico", era: "Fotos panorâmicas de lugares bíblicos como estão hoje",
  start: "areopago", refs: ["ACT.17.22", "ACT.10.1", "1KI.12.29", "MAT.4.23", "JDG.6.33"], scenes,
  sheet: { summary: "Cinco fotos panorâmicas reais de lugares citados na Bíblia: o Areópago de Atenas, o teatro de Cesareia, Tel Dan, a paisagem da Baixa Galileia e o Vale de Jezreel. São paisagens e ruínas de hoje, não as cidades da época bíblica.",
    sources: ["Wikimedia Commons (arquivos e licenças citados em cada foto)", "Bíblia Livre 2018 (versículos citados)"],
    uncertainty: "Cada foto é de hoje; construções visíveis podem ser de épocas posteriores à bíblica. Os textos curtos ainda aguardam revisão do consultor." },
});
