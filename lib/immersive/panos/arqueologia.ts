// Real-photo tours (Prompt 3.5b) made from the credited archaeology photos of the app (lib/archaeology/items.json): real places of the Bible,
// photographed today. Each photo keeps its author, license and Commons page; each pin carries the text and verses already reviewed in the gallery.
import items from "@/lib/archaeology/items.json";
import { PanoTour, type PanoScene } from "../pano";

interface Item { id: string; name: string; period: string; place: string; refs: string[]; wiki?: string; text: string; image: string; credit: { title: string; author: string; license: string; page?: string } }
const byId = new Map((items as Item[]).map((i) => [i.id, i]));
const slug = (id: string) => id.replace(/-/g, "_");

function scene(id: string, next?: string, prev?: string): PanoScene {
  const it = byId.get(id);
  if (!it) throw new Error(`archaeology item ${id} not found`);
  const links = [
    ...(next ? [{ to: slug(next), label: `Próximo: ${byId.get(next)!.name}`, yaw: 38, pitch: -14 }] : []),
    ...(prev ? [{ to: slug(prev), label: `Anterior: ${byId.get(prev)!.name}`, yaw: -38, pitch: -14 }] : []),
  ];
  return {
    id: slug(id), title: it.name, image: it.image,
    credit: { author: it.credit.author, license: it.credit.license, source: it.credit.page ?? it.credit.title },
    startYaw: 0, hotspots: [{ id: "info", label: it.name, text: `${it.place} · ${it.period}. ${it.text}`.slice(0, 600), refs: it.refs.slice(0, 3), yaw: 0, pitch: 0 }], links,
    script: `${it.name}, em ${it.place}. ${it.text} O que você já sabia sobre este lugar?`.slice(0, 900),
  } as PanoScene;
}
function chain(ids: string[]): PanoScene[] { return ids.map((id, i) => scene(id, ids[i + 1], ids[i - 1])); }
const sources = (ids: string[]) => [...ids.map((id) => byId.get(id)!.wiki).filter((w): w is string => !!w), "Easton's Bible Dictionary (domínio público)"];

function tour(o: { id: string; title: string; era: string; ids: string[]; summary: string; uncertainty: string }): PanoTour {
  return PanoTour.parse({ id: o.id, title: o.title, era: o.era, start: slug(o.ids[0]), scenes: chain(o.ids), refs: [...new Set(o.ids.flatMap((i) => byId.get(i)!.refs))].slice(0, 12), sheet: { summary: o.summary, sources: sources(o.ids), uncertainty: o.uncertainty } });
}

export const ARCHAEOLOGY_TOURS: PanoTour[] = [
  tour({ id: "galileia", title: "Galileia de Jesus", era: "Ruínas de hoje de lugares do ministério de Jesus", ids: ["capernaum-synagogue", "sepphoris", "hazor", "megiddo"],
    summary: "Lugares da Galileia e do norte de Israel citados na Bíblia, fotografados como estão hoje. As fotos mostram ruínas de várias épocas: por exemplo, a sinagoga visível em Cafarnaum é dos séculos IV e V, construída depois do tempo de Jesus, sobre uma construção mais antiga.",
    uncertainty: "O que se vê é o sítio arqueológico de hoje, não a cidade do primeiro século. Datas e usos de cada ruína seguem a pesquisa arqueológica, que pode mudar." }),
  tour({ id: "jerusalem_e_judeia", title: "Jerusalém e Judeia", era: "Lugares de Jerusalém, Belém e Jericó como estão hoje", ids: ["hezekiah-tunnel", "herodium", "jericho", "beth-shean"],
    summary: "Fotos reais de lugares da Judeia e do vale do Jordão ligados a reis, ao nascimento de Jesus e à conquista de Canaã. O Túnel de Ezequias é um canal de água escavado cerca de 700 a.C.; o Herodium é a fortaleza de Herodes, o Grande, perto de Belém.",
    uncertainty: "São sítios de hoje. A ligação de cada lugar com os textos bíblicos é a da tradição e da pesquisa arqueológica, e algumas identificações são debatidas." }),
  tour({ id: "paulo_na_grecia_e_asia", title: "Paulo na Grécia e na Ásia", era: "Cidades das viagens de Paulo, como estão hoje", ids: ["philippi", "areopagus", "ephesus-theatre"],
    summary: "Filipos (Macedônia), o Areópago de Atenas e o grande teatro de Éfeso aparecem no livro de Atos. As fotos mostram as ruínas e o terreno de hoje; muitas construções visíveis foram erguidas ou reformadas depois do tempo de Paulo.",
    uncertainty: "O teatro de Éfeso que se vê é do período romano e pode ter sido ampliado depois do tempo de Paulo. A foto do Areópago mostra o monte, não a cidade do primeiro século." }),
];
