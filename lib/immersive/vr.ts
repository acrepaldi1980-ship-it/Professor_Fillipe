// Virtual reality comfort rules (spec 8.16, Prompt 3.5). Pure functions: the XR layer calls them, the tests check them.
// Comfort first: no smooth stick movement by default (the main cause of motion sickness), snap turns in steps, teleport with a blink.
import { hits, type V2 } from "./movement";
import type { Collider, EnvironmentPackage } from "./package";

export const COMFORT = {
  /** Snap turn in degrees per flick of the stick. */
  snapDegrees: 30,
  /** Stick deflection needed to turn (and the value it must fall under before another turn). */
  snapDead: 0.6,
  /** Longest teleport in meters: long hops disorient. */
  maxTeleport: 20,
  /** Distance and height of the reading panel in front of the head, in meters. */
  panelDistance: 1.7,
  panelDrop: 0.15,
  /** Target frame rates by device: Quest 72 Hz (90 Hz optional), Vision Pro 90 Hz. Below this the experience is uncomfortable. */
  minFps: 72,
};

/** Snap turn state machine: one step per flick, then the stick must return to the middle before the next one. */
export interface SnapState { armed: boolean }
export function snapTurn(state: SnapState, axisX: number, degrees = COMFORT.snapDegrees, dead = COMFORT.snapDead): { yawDelta: number; state: SnapState } {
  if (Math.abs(axisX) < dead * 0.5) return { yawDelta: 0, state: { armed: true } };
  if (!state.armed || Math.abs(axisX) < dead) return { yawDelta: 0, state };
  // thumbstick right = clockwise seen from above = the visitor's yaw decreases (yaw grows counter-clockwise)
  return { yawDelta: (axisX > 0 ? -1 : 1) * (degrees * Math.PI) / 180, state: { armed: false } };
}

/** Where a teleport to `point` (x, z) lands, or null when it is not allowed: out of the walkable area, inside a collider, or too far. */
export function teleportTarget(pkg: EnvironmentPackage, colliders: Collider[], from: V2, point: V2): V2 | null {
  const r = pkg.radius;
  const b = pkg.bounds as { min: V2; max: V2 };
  if (point[0] < b.min[0] + r || point[0] > b.max[0] - r || point[1] < b.min[1] + r || point[1] > b.max[1] - r) return null;
  if (colliders.some((c) => hits(point, r, c))) return null;
  if (Math.hypot(point[0] - from[0], point[1] - from[1]) > COMFORT.maxTeleport) return null;
  return point;
}

/** Position and facing of a panel placed in front of the head: `dist` meters ahead along the gaze (flattened), slightly below eye level, turned toward the viewer. */
export function panelPose(head: [number, number, number], yaw: number, dist = COMFORT.panelDistance, drop = COMFORT.panelDrop): { position: [number, number, number]; yaw: number } {
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  return { position: [head[0] + fx * dist, head[1] - drop, head[2] + fz * dist], yaw };
}

/** What the floating panel shows and which buttons it has, from the state of the scene (so the screen and the headset tell the same story). */
export interface PanelState {
  hotspot?: { label: string; text: string; verses: { ref: string; text: string }[] } | null;
  answer?: { text: string } | null;
  station?: { title: string; script: string; index: number; total: number } | null;
  recording?: boolean;
  busy?: boolean;
  hasTour: boolean;
}
export interface PanelModel { title: string; body: string; verses: { ref: string; text: string }[]; buttons: { id: "close" | "prev" | "next" | "listen" | "ask" | "sheet"; label: string }[] }
export function panelModel(s: PanelState, labels: { ask: string; stop: string; thinking: string; close: string; prev: string; next: string; start: string; listen: string; sheet: string }): PanelModel {
  const ask = { id: "ask" as const, label: s.recording ? labels.stop : labels.ask };
  if (s.hotspot) return { title: s.hotspot.label, body: s.hotspot.text, verses: s.hotspot.verses, buttons: [{ id: "close", label: labels.close }, ask] };
  if (s.busy) return { title: "", body: labels.thinking, verses: [], buttons: [] };
  if (s.answer) return { title: "", body: s.answer.text, verses: [], buttons: [{ id: "listen", label: labels.listen }, ask, ...(s.hasTour ? [{ id: "next" as const, label: labels.next }] : [])] };
  if (s.station) {
    const b: PanelModel["buttons"] = [];
    if (s.station.index > 0) b.push({ id: "prev", label: labels.prev });
    b.push({ id: "listen", label: labels.listen });
    if (s.station.index < s.station.total - 1) b.push({ id: "next", label: labels.next });
    b.push(ask);
    return { title: s.station.title, body: s.station.script, verses: [], buttons: b };
  }
  const idle: PanelModel["buttons"] = [{ id: "sheet", label: labels.sheet }, ask];
  if (s.hasTour) idle.unshift({ id: "next", label: labels.start });
  return { title: "", body: "", verses: [], buttons: idle };
}
