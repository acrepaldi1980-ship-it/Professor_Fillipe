import { describe, expect, it } from "vitest";
import { checkGlb, imageSize, LIMITS } from "@/lib/immersive/glb-check";

/** Builds a GLB with `tris` triangles (one mesh) and optional embedded images. */
function glb(opts: { tris?: number; images?: { bytes: Uint8Array }[]; extra?: Record<string, unknown> } = {}) {
  const tris = opts.tris ?? 12;
  const bin: number[] = [];
  const views: { byteOffset: number; byteLength: number }[] = [];
  const imgs: { bufferView: number; mimeType: string }[] = [];
  for (const im of opts.images ?? []) { views.push({ byteOffset: bin.length, byteLength: im.bytes.length }); imgs.push({ bufferView: views.length - 1, mimeType: "image/png" }); bin.push(...im.bytes); while (bin.length % 4) bin.push(0); }
  const json = { asset: { version: "2.0" }, meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }], accessors: [{ count: tris * 3 }, { count: tris * 3 }], bufferViews: views, images: imgs, ...opts.extra };
  let j = Buffer.from(JSON.stringify(json)); while (j.length % 4) j = Buffer.concat([j, Buffer.from(" ")]);
  const b = Buffer.from(bin.length ? bin : [0, 0, 0, 0]);
  const h = Buffer.alloc(12); h.write("glTF"); h.writeUInt32LE(2, 4); h.writeUInt32LE(12 + 8 + j.length + 8 + b.length, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(j.length, 0); jh.write("JSON", 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(b.length, 0); bh.write("BIN\0", 4);
  return new Uint8Array(Buffer.concat([h, jh, j, bh, b]));
}
const png = (w: number, h: number) => { const b = Buffer.alloc(33); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b); b.writeUInt32BE(13, 8); b.write("IHDR", 12); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return new Uint8Array(b); };

describe("checkGlb", () => {
  it("accepts a light model and counts its triangles", () => {
    const r = checkGlb(glb({ tris: 1200 }));
    expect(r.ok).toBe(true); expect(r.triangles).toBe(1200); expect(r.meshes).toBe(1);
  });
  it("refuses a file that is not a GLB", () => {
    expect(checkGlb(new Uint8Array(Buffer.from("not a glb file at all, really"))).problems).toContain("not_glb");
  });
  it("refuses too many triangles", () => {
    const r = checkGlb(glb({ tris: LIMITS.maxTriangles + 3 }));
    expect(r.ok).toBe(false); expect(r.problems).toContain("too_many_triangles");
  });
  it("reads the size of embedded PNG textures and refuses those over the limit", () => {
    const ok = checkGlb(glb({ images: [{ bytes: png(1024, 1024) }] }));
    expect(ok.ok).toBe(true); expect(ok.images[0]).toMatchObject({ width: 1024, height: 1024, mime: "image/png" });
    const big = checkGlb(glb({ images: [{ bytes: png(4096, 2048) }] }));
    expect(big.problems).toContain("texture_too_large");
  });
  it("refuses too many textures", () => {
    const r = checkGlb(glb({ images: Array.from({ length: LIMITS.maxImages + 1 }, () => ({ bytes: png(64, 64) })) }));
    expect(r.problems).toContain("too_many_textures");
  });
  it("refuses a file over the size limit", () => {
    const r = checkGlb(glb(), { ...LIMITS, maxBytes: 100 });
    expect(r.problems).toContain("too_big");
  });
  it("refuses a model that points to external files", () => {
    const r = checkGlb(glb({ extra: { images: [{ uri: "textura.png" }] } }));
    expect(r.problems).toContain("external_files");
  });
  it("does not count line or point primitives as triangles", () => {
    const r = checkGlb(glb({ tris: 10, extra: { meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, mode: 1 }] }] } }));
    expect(r.triangles).toBe(0);
  });
});

describe("imageSize", () => {
  it("reads PNG and JPEG headers and ignores unknown data", () => {
    expect(imageSize(png(300, 200))).toMatchObject({ width: 300, height: 200 });
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, 1, 0x2c, 1, 0x90, 3, 0, 0, 0]);
    expect(imageSize(jpg)).toMatchObject({ width: 400, height: 300, mime: "image/jpeg" });
    expect(imageSize(new Uint8Array(40))).toBeNull();
  });
});
