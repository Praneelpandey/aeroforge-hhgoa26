/* ============================================================================
 * Daylight-studio material factory.
 * X-Ray mode turns outer casings into translucent frosted polycarbonate glass
 * (NOT neon wireframe) so internal mechanisms read crisply on the bright
 * cyclorama. Ghost snap targets are soft Apple-blue glass silhouettes.
 * ==========================================================================*/

import type { ThreeElements } from '@react-three/fiber';

export type MatProps = ThreeElements['meshStandardMaterial'];

export interface MatOpts {
  color?: string;
  metalness?: number;
  roughness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  side?: MatProps['side'];
}

export const GHOST_COLOR = '#0071e3';
export const XRAY_GLASS = '#64748b';

/** Casing material: physical CAD finish → frosted x-ray glass → blue ghost. */
export function casingMat(xray: boolean, ghost: boolean, o: MatOpts = {}): MatProps {
  if (ghost) {
    return {
      color: GHOST_COLOR,
      emissive: GHOST_COLOR,
      emissiveIntensity: 0.12,
      metalness: 0,
      roughness: 0.12,
      wireframe: false,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: o.side,
    };
  }
  if (xray) {
    return {
      color: XRAY_GLASS,
      emissive: '#94a3b8',
      emissiveIntensity: 0.04,
      metalness: 0.05,
      roughness: 0.1,
      wireframe: false,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: o.side,
    };
  }
  return {
    color: o.color ?? '#cbd5e1',
    metalness: o.metalness ?? 0.8,
    roughness: o.roughness ?? 0.25,
    emissive: o.emissive ?? '#000000',
    emissiveIntensity: o.emissiveIntensity ?? 0,
    wireframe: false,
    transparent: o.transparent ?? false,
    opacity: o.opacity ?? 1,
    side: o.side,
  };
}

/** Internal-mechanism material — bright, stays solid inside the frosted casing. */
export function internalMat(o: MatOpts = {}): MatProps {
  return {
    color: o.color ?? '#0f172a',
    emissive: o.emissive ?? o.color ?? '#0071e3',
    emissiveIntensity: o.emissiveIntensity ?? 0.55,
    metalness: 0.35,
    roughness: 0.35,
  };
}

/** Shared Daylight-Studio palette for procedural machines. */
export const PALETTE = {
  /* structural metals */
  titanium: { color: '#cbd5e1', metalness: 0.8, roughness: 0.22 }, // brushed aerospace silver
  darkTitanium: { color: '#334155', metalness: 0.85, roughness: 0.25 }, // anodized dark titanium
  steel: { color: '#e2e8f0', metalness: 0.92, roughness: 0.12 }, // polished chrome steel
  forged: { color: '#dbe3ec', metalness: 0.9, roughness: 0.16 }, // polished forged steel
  castIron: { color: '#94a3b8', metalness: 0.8, roughness: 0.28 }, // bead-blasted aluminium
  gunmetal: { color: '#1e293b', metalness: 0.75, roughness: 0.4 }, // dark gunmetal ribs
  /* brand accents */
  copper: { color: '#d97706', metalness: 0.9, roughness: 0.15 }, // polished copper/bronze
  nasaOrange: { color: '#ff5500', metalness: 0.25, roughness: 0.42 }, // international aerospace orange
  satinWhite: { color: '#ffffff', metalness: 0.12, roughness: 0.25 }, // satin aerospace white
  performanceRed: { color: '#dc2626', metalness: 0.4, roughness: 0.15 }, // anodized red
  /* small parts */
  carbon: { color: '#1e293b', metalness: 0.55, roughness: 0.45 }, // matte carbon fibre
  pcb: { color: '#0f5132', metalness: 0.3, roughness: 0.55 },
  gold: { color: '#f59e0b', metalness: 0.85, roughness: 0.2 }, // thermal mylar foil
} as const;
