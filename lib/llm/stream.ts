// Streaming helpers: the model's JSON arrives in pieces; the student reads the `speech` field while it is still being written.

/** The text of the "speech" field of a JSON object that is still being written (`{"speech":"Oi, Ana. Davi foi...`). Empty until the field starts; never includes a half escape sequence. */
export function speechFromPartialJson(acc: string, field = "speech"): string {
  const m = new RegExp(`"${field}"\\s*:\\s*"`).exec(acc);
  if (!m) return "";
  let out = "";
  for (let i = m.index + m[0].length; i < acc.length; i++) {
    const c = acc[i];
    if (c === '"') return out; // the field ended
    if (c !== "\\") { out += c; continue; }
    const n = acc[i + 1];
    if (n === undefined) break; // a backslash at the very end: wait for the next piece
    if (n === "u") {
      const hex = acc.slice(i + 2, i + 6);
      if (hex.length < 4 || !/^[0-9a-fA-F]{4}$/.test(hex)) break;
      out += String.fromCharCode(parseInt(hex, 16)); i += 5; continue;
    }
    out += n === "n" ? "\n" : n === "t" ? "\t" : n === "r" ? "" : n; i++;
  }
  return out;
}

/** Server-sent events of a provider: calls `onData` with the text after each "data:" line of a complete event. Handles pieces cut anywhere. */
export async function readSse(body: ReadableStream<Uint8Array>, onData: (data: string) => void): Promise<void> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.search(/\r?\n\r?\n/)) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i).replace(/^\r?\n\r?\n/, "");
      for (const line of block.split(/\r?\n/)) if (line.startsWith("data:")) onData(line.slice(5).trim());
    }
  }
  for (const line of buf.split(/\r?\n/)) if (line.startsWith("data:")) onData(line.slice(5).trim());
}
