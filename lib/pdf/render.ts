// PDF of the lesson plan and the sermon outline (spec 8.7.2/8.7.3): A4, simple cover, sections and sources. Server only.
import PDFDocument from "pdfkit";
import { formatRefPt } from "../knowledge/refs-parser";
import type { LessonPlan, SermonOutline } from "../modes/schema";

const AGE: Record<string, string> = { kids: "Crianças", teens: "Pré-adolescentes", youth: "Jovens", adults: "Adultos", mixed: "Turma mista" };
const ref = (r: string) => (/^[0-9A-Z]{3}\.\d+/.test(r) ? formatRefPt(r) : r);

function build(title: string, subtitle: string, draw: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 56, info: { Title: title, Author: "Professor Filipe" } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    // cover
    doc.rect(0, 0, doc.page.width, 12).fill("#B5532D");
    doc.fillColor("#2E2A24").font("Helvetica-Bold").fontSize(30).text(title, 56, 220, { align: "left" });
    doc.moveDown(0.6).font("Helvetica").fontSize(14).fillColor("#6B645A").text(subtitle);
    doc.moveDown(10).fontSize(11).text("Preparado com o Professor Filipe, um professor de Bíblia e teologia que é uma inteligência artificial.\nEntendes o que lês? (Atos 8:30)");
    doc.addPage();
    draw(doc);
    doc.end();
  });
}

const heading = (doc: PDFKit.PDFDocument, text: string) => {
  doc.moveDown(0.8).fillColor("#B5532D").font("Helvetica-Bold").fontSize(13).text(text.toUpperCase());
  doc.moveDown(0.2).fillColor("#2E2A24").font("Helvetica").fontSize(11.5);
};
const para = (doc: PDFKit.PDFDocument, text?: string) => { if (text) doc.text(text, { lineGap: 3 }); };
const list = (doc: PDFKit.PDFDocument, items?: string[], numbered = false) => items?.forEach((x, i) => doc.text(`${numbered ? `${i + 1}.` : "•"} ${x}`, { lineGap: 3, indent: 8 }));

export function lessonPdf(plan: LessonPlan, ctx: { age_group?: string; minutes?: number; topic?: string }): Promise<Buffer> {
  const sub = [ctx.age_group ? AGE[ctx.age_group] : null, ctx.minutes ? `${ctx.minutes} minutos` : null, plan.base_text ?? null].filter(Boolean).join(" · ");
  return build(plan.title ?? ctx.topic ?? "Plano de aula", sub, (doc) => {
    doc.fillColor("#2E2A24").font("Helvetica-Bold").fontSize(18).text(plan.title ?? ctx.topic ?? "Plano de aula");
    if (plan.objective?.length) { heading(doc, "Objetivos"); list(doc, plan.objective, true); }
    if (plan.icebreaker) { heading(doc, "Quebra-gelo"); para(doc, plan.icebreaker); }
    if (plan.context) { heading(doc, "Contexto"); para(doc, plan.context); }
    if (plan.points?.length) {
      heading(doc, "Pontos principais");
      plan.points.forEach((p, i) => {
        doc.font("Helvetica-Bold").text(`${i + 1}. ${p.title}`);
        doc.font("Helvetica");
        if (p.verses?.length) doc.fillColor("#6B645A").text(p.verses.map(ref).join("; ")).fillColor("#2E2A24");
        para(doc, p.explanation);
        if (p.illustration) doc.font("Helvetica-Oblique").text(`Ilustração: ${p.illustration}`).font("Helvetica");
        doc.moveDown(0.3);
      });
    }
    if (plan.dynamic) { heading(doc, "Dinâmica"); para(doc, plan.dynamic); }
    if (plan.questions?.length) { heading(doc, "Perguntas de discussão"); list(doc, plan.questions, true); }
    if (plan.application) { heading(doc, "Aplicação"); para(doc, plan.application); }
    if (plan.memory_verse) { heading(doc, "Versículo para memorizar"); para(doc, plan.memory_verse); }
    if (plan.visuals?.length) { heading(doc, "Materiais visuais"); list(doc, plan.visuals); }
    if (plan.timing?.length) { heading(doc, "Tempo por seção"); plan.timing.forEach((t) => doc.text(`${t.section}: ${t.minutes} min`)); }
    if (plan.sources?.length) { heading(doc, "Fontes"); list(doc, plan.sources); }
  });
}

export function sermonPdf(o: SermonOutline): Promise<Buffer> {
  const sub = [o.type, o.base_text, o.estimated_minutes ? `${o.estimated_minutes} min` : null].filter(Boolean).join(" · ");
  return build(o.title ?? "Esboço de sermão", sub, (doc) => {
    doc.fillColor("#2E2A24").font("Helvetica-Bold").fontSize(18).text(o.title ?? "Esboço de sermão");
    if (o.central_idea) { heading(doc, "Ideia central"); para(doc, o.central_idea); }
    if (o.introduction) { heading(doc, "Introdução"); para(doc, o.introduction); }
    (o.divisions ?? []).forEach((d, i) => {
      heading(doc, `${i + 1}. ${d.title}`);
      if (d.texts?.length) doc.fillColor("#6B645A").text(d.texts.map(ref).join("; ")).fillColor("#2E2A24");
      para(doc, d.explanation);
      if (d.illustration) doc.font("Helvetica-Oblique").text(`Ilustração: ${d.illustration}`).font("Helvetica");
      if (d.application) doc.font("Helvetica-Bold").text("Aplicação: ", { continued: true }).font("Helvetica").text(d.application);
    });
    if (o.conclusion) { heading(doc, "Conclusão"); para(doc, o.conclusion); }
    if (o.appeal) { heading(doc, "Apelo"); para(doc, o.appeal); }
    if (o.sources?.length) { heading(doc, "Fontes"); list(doc, o.sources); }
  });
}
