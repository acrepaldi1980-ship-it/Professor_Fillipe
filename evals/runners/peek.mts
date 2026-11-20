// Prints the teacher's answer for one question in remote mode: tsx evals/runners/peek.ts "pergunta" [lente]
import { closeRemote, remoteTurn } from "./remote";
const [q, lens] = process.argv.slice(2);
try {
  const { response } = await remoteTurn(q, "intermediário", lens);
  console.log(response.speech, "\n---\nwords:", response.speech.split(/\s+/).length, "| divergence:", JSON.stringify(response.lens_divergence), "| cites:", response.citations.map((c) => (c.type === "work" ? c.label : c.ref)).join("; "));
} finally {
  await closeRemote();
}
