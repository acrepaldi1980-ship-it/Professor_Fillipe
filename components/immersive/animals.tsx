"use client";

// Stylized low-poly animals for the ark (no faces drawn, simple shapes): one merged geometry per kind, placed with instancing, so a hundred animals cost a few draw calls.
import { useMemo } from "react";
import { BoxGeometry, BufferAttribute, type BufferGeometry, Color, ConeGeometry, CylinderGeometry, Euler, Matrix4, Quaternion, SphereGeometry, Vector3 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Instances } from "./proc";

export type AnimalKind = "sheep" | "ox" | "lion" | "giraffe" | "elephant" | "bird";

type Vec = [number, number, number];
const box = new BoxGeometry(1, 1, 1), ball = new SphereGeometry(0.5, 8, 6), cone = new ConeGeometry(0.5, 1, 6), cyl = new CylinderGeometry(0.5, 0.5, 1, 6);

function part(g: BufferGeometry, color: string, pos: Vec, scale: Vec = [1, 1, 1], rot: Vec = [0, 0, 0]): BufferGeometry {
  const geo = g.clone();
  geo.applyMatrix4(new Matrix4().compose(new Vector3(...pos), new Quaternion().setFromEuler(new Euler(...rot)), new Vector3(...scale)));
  const n = geo.attributes.position.count, c = new Color(color), arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute("color", new BufferAttribute(arr, 3));
  return geo;
}
const legs = (color: string, x: number, z: number, h: number, w = 0.14): BufferGeometry[] => [[-x, -z], [x, -z], [-x, z], [x, z]].map(([lx, lz]) => part(box, color, [lx, h / 2, lz], [w, h, w]));

/** Faces forward along +x; feet at y = 0. */
export function buildAnimal(kind: AnimalKind): BufferGeometry {
  const P: BufferGeometry[] = [];
  switch (kind) {
    case "sheep": {
      P.push(part(box, "#eee7d8", [0, 0.62, 0], [0.95, 0.55, 0.55]), part(ball, "#eee7d8", [-0.05, 0.68, 0], [0.9, 0.62, 0.6]), part(box, "#3c3835", [0.55, 0.78, 0], [0.3, 0.3, 0.26]), part(box, "#3c3835", [0.62, 0.7, 0.12], [0.12, 0.12, 0.1]), ...legs("#3c3835", 0.3, 0.17, 0.36, 0.1));
      break;
    }
    case "ox": {
      P.push(part(box, "#7b4a2b", [0, 1.0, 0], [1.7, 0.9, 0.75]), part(box, "#8a5733", [0.55, 1.3, 0], [0.9, 0.35, 0.8]), part(box, "#6a3f24", [1.05, 1.05, 0], [0.5, 0.5, 0.45]), part(cone, "#e9e0cc", [1.15, 1.45, 0.25], [0.1, 0.35, 0.1], [0, 0, -0.5]), part(cone, "#e9e0cc", [1.15, 1.45, -0.25], [0.1, 0.35, 0.1], [0, 0, -0.5]), part(cyl, "#6a3f24", [-0.95, 0.9, 0], [0.06, 0.8, 0.06], [0, 0, 0.2]), ...legs("#5a361f", 0.55, 0.25, 0.6, 0.17));
      break;
    }
    case "lion": {
      P.push(part(box, "#c79a52", [0, 0.85, 0], [1.5, 0.65, 0.55]), part(ball, "#6b4423", [0.78, 1.05, 0], [0.8, 0.8, 0.8]), part(box, "#c79a52", [1.0, 0.98, 0], [0.4, 0.36, 0.36]), part(cyl, "#c79a52", [-0.85, 0.85, 0], [0.07, 0.8, 0.07], [0, 0, 1.0]), part(ball, "#6b4423", [-1.15, 0.5, 0], [0.18, 0.18, 0.18]), ...legs("#b8893f", 0.5, 0.2, 0.55, 0.16));
      break;
    }
    case "giraffe": {
      P.push(part(box, "#d9a741", [0, 1.8, 0], [1.3, 0.9, 0.5]), part(box, "#d9a741", [0.55, 2.9, 0], [0.32, 1.9, 0.3], [0, 0, -0.25]), part(box, "#d9a741", [0.95, 3.95, 0], [0.55, 0.3, 0.28]), part(box, "#6b4a1f", [0.8, 4.2, 0.1], [0.06, 0.2, 0.06]), part(box, "#6b4a1f", [0.8, 4.2, -0.1], [0.06, 0.2, 0.06]), ...legs("#d9a741", 0.45, 0.18, 1.4, 0.12));
      for (const [x, y, z] of [[-0.3, 2.0, 0.26], [0.1, 1.7, 0.26], [-0.2, 1.7, -0.26], [0.3, 2.1, -0.26], [0.5, 3.0, 0.16], [0.35, 2.6, -0.16]] as Vec[]) P.push(part(box, "#8a5a22", [x, y, z], [0.22, 0.22, 0.04]));
      break;
    }
    case "elephant": {
      P.push(part(box, "#8b8b8b", [0, 1.7, 0], [2.4, 1.6, 1.3]), part(ball, "#8b8b8b", [1.45, 1.9, 0], [1.2, 1.2, 1.1]), part(cyl, "#8b8b8b", [1.95, 1.35, 0], [0.28, 1.5, 0.28], [0, 0, -0.35]), part(box, "#7a7a7a", [1.25, 2.0, 0.7], [0.1, 0.9, 0.8]), part(box, "#7a7a7a", [1.25, 2.0, -0.7], [0.1, 0.9, 0.8]), part(cone, "#efe9dc", [1.9, 1.4, 0.3], [0.1, 0.5, 0.1], [0, 0, -1.2]), ...legs("#7d7d7d", 0.8, 0.45, 1.0, 0.45));
      break;
    }
    case "bird": {
      P.push(part(ball, "#dfe6f2", [0, 0.2, 0], [0.34, 0.26, 0.24]), part(ball, "#dfe6f2", [0.2, 0.3, 0], [0.16, 0.16, 0.16]), part(cone, "#e0a030", [0.32, 0.3, 0], [0.06, 0.12, 0.06], [0, 0, -1.57]), part(box, "#c9d3e6", [-0.02, 0.24, 0.15], [0.3, 0.03, 0.2], [0.3, 0, 0]), part(box, "#c9d3e6", [-0.02, 0.24, -0.15], [0.3, 0.03, 0.2], [-0.3, 0, 0]), part(box, "#c9d3e6", [-0.25, 0.2, 0], [0.2, 0.03, 0.1]));
      break;
    }
  }
  return mergeGeometries(P)!;
}

export function Animals({ kind, items }: { kind: AnimalKind; items: [number, number, number, number?, number?][] }) {
  const geo = useMemo(() => buildAnimal(kind), [kind]);
  if (!items.length) return null;
  return (
    <Instances items={items}>
      <primitive object={geo} attach="geometry" />
      <meshStandardMaterial vertexColors roughness={0.9} />
    </Instances>
  );
}
