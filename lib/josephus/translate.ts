// Translation of Josephus into Brazilian Portuguese: the instructions given to the model and the packing of sections into requests. The model translates;
// the code keeps the numbering ([§n] markers) so every section lands on the same Ant. 18.3.3 it came from.
export const SYSTEM = `Você traduz para o português do Brasil as obras de Flávio Josefo, a partir da tradução inglesa de William Whiston (1737), para um aplicativo de estudo bíblico.

Regras:
- Traduza todo o texto, fiel ao sentido, sem resumir, sem acrescentar comentários e sem omitir nada. Português claro e atual, com tom de historiador antigo, sem arcaísmos.
- Preserve exatamente os marcadores [§n] no início de cada seção (um por seção, na mesma ordem).
- Nomes em português consagrado: Judeia, Jerusalém, Galileia, Samaria, Roma, Herodes, Arquelau, Antipas, Agripa, Pilatos, Tito, Vespasiano, Nero, Calígula, Cláudio, Tibério, Augusto, Pompeu, Tiago (James), João Batista, Jesus, Cristo, Moisés, Abraão, Davi, Salomão, Ciro, Alexandre, Antíoco, Judas Macabeu, Matatias, Hircano, Sinédrio, fariseus, saduceus, essênios, sicários, zelotes, sumo sacerdote, Templo.
- Mantenha entre colchetes as inserções de Whiston que já vêm entre colchetes, traduzidas.
- Números de ano, medidas e valores: mantenha como no texto (côvados, estádios, talentos, dracmas).
- Trechos em outras línguas ou nomes próprios obscuros: mantenha o nome do texto.
- Responda somente com a tradução, sem introdução e sem notas.`;

export interface Sec { n: number; text: string }
/** Groups the numbered sections of one chapter into requests of at most `maxWords` English words. */
export function pack(secs: Sec[], maxWords = 1400): Sec[][] {
  const out: Sec[][] = []; let cur: Sec[] = [], w = 0;
  for (const s of secs) {
    const k = s.text.split(/\s+/).length;
    if (cur.length && w + k > maxWords) { out.push(cur); cur = []; w = 0; }
    cur.push(s); w += k;
  }
  if (cur.length) out.push(cur);
  return out;
}
export const render = (secs: Sec[]) => secs.map((s) => `[§${s.n}] ${s.text}`).join("\n\n");
/** Splits the model's answer back into sections; returns null when the markers do not match what was sent (the unit is then redone). */
export function parse(answer: string, secs: Sec[]): Map<number, string> | null {
  const parts = answer.split(/\[§(\d+)\]/).slice(1);
  const out = new Map<number, string>();
  for (let i = 0; i + 1 < parts.length; i += 2) out.set(Number(parts[i]), parts[i + 1].trim());
  if (out.size !== secs.length) return null;
  for (const s of secs) if (!out.get(s.n)) return null;
  return out;
}
