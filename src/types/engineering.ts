/* ============================================================================
 * AEROFORGE: HOW IT WORKS — Core engineering domain types
 * Data structures for machines, parts, physics rules, failure diagnostics
 * and live telemetry used across the entire lab.
 * ==========================================================================*/

/** The three playable machines (each is an "unlockable sector" of the facility). */
export type MachineId = 'rocket' | 'v8' | 'drone';

/** Spatial viewport modes. */
export type ViewMode = 'room' | 'ar' | 'cad';

/** Master game-flow phase per level. */
export type Phase = 'briefing' | 'play' | 'testing' | 'failure' | 'climax';

/** Rocket launch sub-state machine. */
export type LaunchState = 'idle' | 'counting' | 'flying' | 'done';

/** Webcam AR lifecycle. */
export type ArStatus = 'idle' | 'requesting' | 'live' | 'denied';

/** Every distinct physics-failure animation the simulator can play. */
export type FailureType =
  | 'thermal-meltdown'
  | 'structural-buckle'
  | 'mechanical-seizure'
  | 'engine-knock'
  | 'torque-spinout'
  | 'generic';

/** One interactive parameter slider on a Curiosity Inspector card. */
export interface ParamDef {
  id: string;
  label: string;
  /** Short engineering symbol shown next to the label (e.g. "P_c"). */
  symbol?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  unit: string;
}

/** One live-computed physics readout (formatted for the HUD). */
export interface Readout {
  label: string;
  value: string;
  hint?: string;
}

/** A single interlocking machine module (scavengeable / mountable 3D part). */
export interface PartDef {
  id: string;
  name: string;
  /** Compact name for 3D labels / stack rows. */
  short: string;
  /** Engineering discipline tag, e.g. "Thermal". */
  tag: string;
  /** Accent colour (hex) used for holo labels and UI chips. */
  accent: string;
  /** Mass in kg, shown in the inspector stats strip. */
  massKg: number;
  /** Vertical stack contribution in metres (rocket-style vertical builds). */
  buildHeight: number;

  /** "Explain Like I'm 10" narration. */
  eli10: string;
  /** Aerospace-engineer-grade narration with real terminology. */
  pro: string;
  /** "What happens if this part disappears?" mini-fact. */
  whatIfGone: string;
  /** Formula / governing relation rendered in the Pro card. */
  formula: string;

  /** Interactive physics sliders. */
  params: ParamDef[];
  /** Pure live-math evaluated whenever a slider moves. */
  compute: (p: Record<string, number>) => Readout[];
}

/** A failure diagnostic returned by a machine's validation rules. */
export interface FailureDiagnostic {
  type: FailureType;
  title: string;
  severity: 'CRITICAL' | 'MAJOR';
  /** Which assembly rule was violated (plain-language). */
  ruleBroken: string;
  eli10: string;
  pro: string;
  fixHint: string;
}

/** A complete playable machine (level) definition. */
export interface MachineDef {
  id: MachineId;
  name: string;
  codename: string;
  subtitle: string;
  missionBrief: string;
  successTitle: string;
  successText: string;
  /** Label of the high-stakes validation button, e.g. "RUN STATIC FIRE". */
  testLabel: string;
  /** Human name of the failure event if validation goes wrong. */
  failureBanner: string;
  /** Parts listed in the CORRECT bottom-to-top assembly order. */
  parts: PartDef[];
  /**
   * Validate a mounted stack (ordered bottom-to-top, ids only).
   * Returns null when the build is mechanically sound.
   */
  diagnose: (stack: string[]) => FailureDiagnostic | null;
  /** Camera presets for the spatial viewport. */
  camera: {
    room: [number, number, number];
    cad: [number, number, number];
    ar: [number, number, number];
    target: [number, number, number];
    cadTarget: [number, number, number];
  };
}

/** High-frequency live telemetry pushed from the 3D world to the HUD. */
export interface Telemetry {
  /* ── Rocket launch ─────────────────────────────────────────────── */
  tPlus: number;
  altitudeKm: number;
  velocityMs: number;
  mach: number;
  gforce: number;
  isp: number;
  thrustKN: number;
  massKg: number;
  /* ── V8 dyno bench ─────────────────────────────────────────────── */
  rpm: number;
  hp: number;
  torqueNm: number;
  boostPsi: number;
  knock: number; // 0..1 detonation stress
  /* ── Drone flight ──────────────────────────────────────────────── */
  droneX: number;
  droneY: number;
  droneZ: number;
  droneSpeed: number;
  batteryPct: number;
  lidarHits: number;
  /* ── Rolling history buffers for HUD sparklines ────────────────── */
  histAlt: number[];
  histVel: number[];
  histG: number[];
  histHp: number[];
  histTq: number[];
}

export const emptyTelemetry = (): Telemetry => ({
  tPlus: 0,
  altitudeKm: 0,
  velocityMs: 0,
  mach: 0,
  gforce: 0,
  isp: 0,
  thrustKN: 0,
  massKg: 0,
  rpm: 0,
  hp: 0,
  torqueNm: 0,
  boostPsi: 0,
  knock: 0,
  droneX: 0,
  droneY: 0,
  droneZ: 0,
  droneSpeed: 0,
  batteryPct: 100,
  lidarHits: 0,
  histAlt: [],
  histVel: [],
  histG: [],
  histHp: [],
  histTq: [],
});

export const HIST_CAP = 140;

/** Convenience: format helpers shared by data + HUD. */
export const fmt = {
  n: (v: number, digits = 0) =>
    v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }),
  fixed: (v: number, digits = 1) => v.toFixed(digits),
};
