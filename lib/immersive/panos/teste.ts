// Test tour (Prompt 3.5b): proves the 360° viewer, the points navigation and the guide. The image is a generated drawing, not a real place.
import { PanoTour } from "../pano";

const credit = { author: "Gerada para teste", license: "Domínio público (CC0)", source: "Desenho gerado por script, não é um lugar real" };
export const TEST_TOUR: PanoTour = PanoTour.parse({
  id: "panorama_teste",
  title: "Panorama de teste",
  era: "Teste do visualizador 360° (não é um lugar bíblico)",
  refs: ["JHN.10.9"],
  start: "entrada",
  scenes: [
    { id: "entrada", title: "Entrada", image: "/panos/teste.jpg", credit, startYaw: 0,
      hotspots: [{ id: "porta", label: "A porta", text: "Um ponto de interesse de teste, para ver o texto e o versículo.", refs: ["JHN.10.9"], yaw: 45, pitch: 5 }],
      links: [{ to: "patio", label: "Ir ao pátio", yaw: 90, pitch: -10, arriveYaw: 90 }],
      script: "Esta é a entrada do panorama de teste. Arraste para olhar em volta. Qual ponto você quer ver primeiro?" },
    { id: "patio", title: "Pátio", image: "/panos/teste.jpg", credit, startYaw: 180,
      hotspots: [{ id: "poco", label: "O poço", text: "Outro ponto de teste, para conferir a navegação entre fotos.", refs: [], yaw: -120, pitch: 0 }],
      links: [{ to: "entrada", label: "Voltar à entrada", yaw: -90, pitch: -10, arriveYaw: -90 }] },
  ],
  sheet: { summary: "Panorama de teste do visualizador; não representa um lugar real.", sources: ["Desenho gerado por script"] },
});
