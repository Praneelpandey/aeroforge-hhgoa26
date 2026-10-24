/* ============================================================================
 * Procedural curve + geometry helpers for the CAD-style 3D models.
 * ==========================================================================*/

import * as THREE from 'three';

/** Helix around the Y axis — used for cooling jackets & cable wraps. */
export class HelixCurve extends THREE.Curve<THREE.Vector3> {
  constructor(
    private radius: number,
    private height: number,
    private turns: number,
    private y0 = 0,
  ) {
    super();
  }
  getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    const a = t * this.turns * Math.PI * 2;
    return target.set(Math.cos(a) * this.radius, this.y0 + t * this.height, Math.sin(a) * this.radius);
  }
}

/** Bell (De Laval) nozzle profile points for LatheGeometry, base y=0. */
export function bellProfile(throatR: number, exitR: number, height: number, steps = 16): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  // converging section (0 .. 0.28 h) then diverging bell (0.28 .. 1 h)
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let r: number;
    if (t < 0.28) {
      const u = t / 0.28;
      r = exitR * 0.62 + (throatR - exitR * 0.62) * Math.pow(u, 0.8);
    } else {
      const u = (t - 0.28) / 0.72;
      // parabolic bell — gentle near throat, flaring at exit
      r = throatR + (exitR - throatR) * Math.pow(u, 1.7);
    }
    pts.push(new THREE.Vector2(Math.max(r, 0.02), t * height));
  }
  return pts;
}

/** Ogive nose-cone profile for LatheGeometry, base y=0. */
export function ogiveProfile(baseR: number, height: number, steps = 14): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = baseR * Math.pow(1 - t, 0.72) * Math.sqrt(Math.max(0, 1 - Math.pow(t, 2.2)));
    pts.push(new THREE.Vector2(Math.max(r, 0.001), t * height));
  }
  return pts;
}

/** Catmull-Rom tube through waypoints. */
export function tube(points: [number, number, number][]): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
}

/** Straight-line curve between two points (flow particles use these). */
export function seg(a: [number, number, number], b: [number, number, number]): THREE.LineCurve3 {
  return new THREE.LineCurve3(new THREE.Vector3(...a), new THREE.Vector3(...b));
}

/** Circle line-segments geometry in the XZ plane at height y. */
export function circleLines(radius: number, y: number, segments = 72): THREE.BufferGeometry {
  const pos: number[] = [];
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    pos.push(Math.cos(a0) * radius, y, Math.sin(a0) * radius);
    pos.push(Math.cos(a1) * radius, y, Math.sin(a1) * radius);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

/** Radial spoke line-segments in the XZ plane at height y. */
export function spokeLines(radius: number, y: number, count = 12, inner = 0.06): THREE.BufferGeometry {
  const pos: number[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    pos.push(Math.cos(a) * inner, y, Math.sin(a) * inner);
    pos.push(Math.cos(a) * radius, y, Math.sin(a) * radius);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

/** Frame-rate independent damping (Freya Holmér style). */
export const damp = (current: number, target: number, lambda: number, dt: number): number =>
  THREE.MathUtils.damp(current, target, lambda, dt);

export const clamp = THREE.MathUtils.clamp;
export const lerp = THREE.MathUtils.lerp;
export const degToRad = THREE.MathUtils.degToRad;
