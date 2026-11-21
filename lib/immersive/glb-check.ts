// Automatic performance validation of a GLB before an environment zone is published (Prompt 3.4): size, triangles, textures. Pure: reads the GLB
// container (header + JSON chunk) and, for embedded images, the width and height from the PNG or JPEG header. A model that is too heavy would not
// walk at 30 fps on a mid-range Android, so it is refused with a clear reason instead of failing on the student's phone.
export interface Limits { maxBytes: number; maxTriangles: number; maxTexture: number; maxImages: number; maxMeshes: number }
export const LIMITS: Limits = { maxBytes: 5_000_000, maxTriangles: 150_000, maxTexture: 2048, maxImages: 8, maxMeshes: 200 };

export interface GlbReport {
  ok: boolean;
  bytes: number;
  triangles: number;
  meshes: number;
  images: { index: number; width: number | null; height: number | null; mime: string }[];
  draco: boolean;
  problems: string[];
}

const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

/** Width and height from a PNG or JPEG header; null when not recognised. */
export function imageSize(b: Uint8Array): { width: number; height: number; mime: string } | null {
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { width: (b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19], height: (b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23], mime: "image/png" };
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8], mime: "image/jpeg" };
      i += 2 + ((b[i + 2] << 8) | b[i + 3]);
    }
  }
  return null;
}

interface Gltf {
  meshes?: { primitives: { attributes?: { POSITION?: number }; indices?: number; mode?: number }[] }[];
  accessors?: { count: number }[];
  images?: { bufferView?: number; mimeType?: string; uri?: string }[];
  bufferViews?: { byteOffset?: number; byteLength: number }[];
  extensionsUsed?: string[];
}

export function checkGlb(file: Uint8Array, limits: Limits = LIMITS): GlbReport {
  const rep: GlbReport = { ok: false, bytes: file.length, triangles: 0, meshes: 0, images: [], draco: false, problems: [] };
  if (file.length < 20 || String.fromCharCode(file[0], file[1], file[2], file[3]) !== "glTF") { rep.problems.push("not_glb"); return rep; }
  if (file.length > limits.maxBytes) rep.problems.push("too_big");
  const jsonLen = u32(file, 12);
  if (String.fromCharCode(file[16], file[17], file[18], file[19]) !== "JSON" || 20 + jsonLen > file.length) { rep.problems.push("bad_container"); return rep; }
  let g: Gltf;
  try { g = JSON.parse(new TextDecoder().decode(file.subarray(20, 20 + jsonLen))) as Gltf; } catch { rep.problems.push("bad_json"); return rep; }
  // binary chunk starts after the JSON chunk
  const binStart = 20 + jsonLen + 8;
  rep.draco = !!g.extensionsUsed?.includes("KHR_draco_mesh_compression");
  rep.meshes = g.meshes?.length ?? 0;
  for (const m of g.meshes ?? []) for (const p of m.primitives) {
    if (p.mode !== undefined && p.mode !== 4) continue; // only triangle lists
    const n = p.indices !== undefined ? g.accessors?.[p.indices]?.count : g.accessors?.[p.attributes?.POSITION ?? -1]?.count;
    rep.triangles += Math.floor((n ?? 0) / 3);
  }
  (g.images ?? []).forEach((im, index) => {
    let size: ReturnType<typeof imageSize> = null;
    if (im.bufferView !== undefined) { const bv = g.bufferViews?.[im.bufferView]; if (bv) size = imageSize(file.subarray(binStart + (bv.byteOffset ?? 0), binStart + (bv.byteOffset ?? 0) + Math.min(bv.byteLength, 70000))); }
    rep.images.push({ index, width: size?.width ?? null, height: size?.height ?? null, mime: size?.mime ?? im.mimeType ?? "unknown" });
  });
  if (rep.triangles > limits.maxTriangles) rep.problems.push("too_many_triangles");
  if (rep.meshes > limits.maxMeshes) rep.problems.push("too_many_meshes");
  if (rep.images.length > limits.maxImages) rep.problems.push("too_many_textures");
  if (rep.images.some((i) => Math.max(i.width ?? 0, i.height ?? 0) > limits.maxTexture)) rep.problems.push("texture_too_large");
  if (g.images?.some((i) => i.uri && !i.uri.startsWith("data:"))) rep.problems.push("external_files"); // a single self-contained .glb only
  rep.ok = rep.problems.length === 0;
  return rep;
}
