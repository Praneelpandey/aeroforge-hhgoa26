/* ============================================================================
 * AEROFORGE — central game state machine.
 * Two React contexts: low-frequency game state (reducer) + high-frequency
 * telemetry (throttled state) so the 3D canvas never re-renders at HUD rate.
 * ==========================================================================*/

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  ArStatus,
  FailureDiagnostic,
  LaunchState,
  MachineId,
  Phase,
  Telemetry,
  ViewMode,
} from '../types/engineering';
import { emptyTelemetry, HIST_CAP } from '../types/engineering';

/* ── Reducer state ──────────────────────────────────────────────────────── */

export interface GameState {
  level: MachineId;
  viewMode: ViewMode;
  xray: boolean;
  exploded: number; // 0..1
  muted: boolean;
  voiceOn: boolean;
  wwdcFrame: boolean;

  phase: Phase;
  visited: Record<MachineId, boolean>;
  solved: Record<MachineId, boolean>;
  collected: Record<MachineId, string[]>;
  stacks: Record<MachineId, string[]>;

  selectedPart: string | null;
  failure: FailureDiagnostic | null;

  arStatus: ArStatus;
  launchState: LaunchState;
  countdown: number | null;
  throttleRpm: number; // V8 dyno target rpm
  droneFlying: boolean;

  toast: { id: number; text: string; kind: 'info' | 'good' | 'bad' } | null;
}

const initial: GameState = {
  level: 'rocket',
  viewMode: 'room',
  xray: false,
  exploded: 0,
  muted: false,
  voiceOn: true,
  wwdcFrame: false,

  phase: 'briefing',
  visited: { rocket: false, v8: false, drone: false },
  solved: { rocket: false, v8: false, drone: false },
  collected: { rocket: [], v8: [], drone: [] },
  stacks: { rocket: [], v8: [], drone: [] },

  selectedPart: null,
  failure: null,

  arStatus: 'idle',
  launchState: 'idle',
  countdown: null,
  throttleRpm: 800,
  droneFlying: false,

  toast: null,
};

type Action =
  | { t: 'level'; level: MachineId }
  | { t: 'view'; view: ViewMode }
  | { t: 'xray'; on?: boolean }
  | { t: 'exploded'; v: number }
  | { t: 'muted' }
  | { t: 'voice' }
  | { t: 'wwdc' }
  | { t: 'collect'; part: string }
  | { t: 'mount'; part: string }
  | { t: 'unmount'; part: string }
  | { t: 'move'; part: string; dir: -1 | 1 }
  | { t: 'select'; part: string | null }
  | { t: 'phase'; phase: Phase }
  | { t: 'failure'; failure: FailureDiagnostic | null }
  | { t: 'solve' }
  | { t: 'ar'; status: ArStatus }
  | { t: 'launch'; state: LaunchState }
  | { t: 'countdown'; v: number | null }
  | { t: 'throttle'; rpm: number }
  | { t: 'droneFlying'; on: boolean }
  | { t: 'toast'; text: string; kind: 'info' | 'good' | 'bad' }
  | { t: 'clearToast' }
  | { t: 'resetLevel' }
  | { t: 'clearLevel'; level: MachineId }
  | { t: 'reopenBriefing' };

function reducer(s: GameState, a: Action): GameState {
  switch (a.t) {
    case 'level': {
      if (a.level === s.level) return s;
      return {
        ...s,
        level: a.level,
        phase: s.visited[a.level] ? 'play' : 'briefing',
        failure: null,
        selectedPart: null,
        launchState: 'idle',
        countdown: null,
        droneFlying: false,
        toast: null,
      };
    }
    case 'view':
      return { ...s, viewMode: a.view };
    case 'xray':
      return { ...s, xray: a.on ?? !s.xray };
    case 'exploded':
      return { ...s, exploded: Math.max(0, Math.min(1, a.v)) };
    case 'muted':
      return { ...s, muted: !s.muted };
    case 'voice':
      return { ...s, voiceOn: !s.voiceOn };
    case 'wwdc':
      return { ...s, wwdcFrame: !s.wwdcFrame };
    case 'collect': {
      const cur = s.collected[s.level];
      if (cur.includes(a.part)) return s;
      return { ...s, collected: { ...s.collected, [s.level]: [...cur, a.part] } };
    }
    case 'mount': {
      const cur = s.stacks[s.level];
      if (cur.includes(a.part)) return s;
      return {
        ...s,
        stacks: { ...s.stacks, [s.level]: [...cur, a.part] },
        selectedPart: s.selectedPart === a.part ? null : s.selectedPart,
      };
    }
    case 'unmount': {
      const cur = s.stacks[s.level].filter((p) => p !== a.part);
      return { ...s, stacks: { ...s.stacks, [s.level]: cur } };
    }
    case 'move': {
      const cur = [...s.stacks[s.level]];
      const i = cur.indexOf(a.part);
      const j = i + a.dir;
      if (i === -1 || j < 0 || j >= cur.length) return s;
      [cur[i], cur[j]] = [cur[j], cur[i]];
      return { ...s, stacks: { ...s.stacks, [s.level]: cur } };
    }
    case 'select':
      return { ...s, selectedPart: a.part };
    case 'phase':
      return { ...s, phase: a.phase };
    case 'failure':
      return { ...s, failure: a.failure, phase: a.failure ? 'failure' : 'play' };
    case 'solve':
      return {
        ...s,
        solved: { ...s.solved, [s.level]: true },
        visited: { ...s.visited, [s.level]: true },
        phase: 'climax',
        failure: null,
      };
    case 'ar':
      return { ...s, arStatus: a.status };
    case 'launch':
      return { ...s, launchState: a.state };
    case 'countdown':
      return { ...s, countdown: a.v };
    case 'throttle':
      return { ...s, throttleRpm: a.rpm };
    case 'droneFlying':
      return { ...s, droneFlying: a.on };
    case 'toast':
      return { ...s, toast: { id: Date.now() + Math.random(), text: a.text, kind: a.kind } };
    case 'clearToast':
      return { ...s, toast: null };
    case 'resetLevel':
      return {
        ...s,
        stacks: { ...s.stacks, [s.level]: [] },
        phase: 'play',
        failure: null,
        launchState: 'idle',
        countdown: null,
        droneFlying: false,
      };
    case 'clearLevel':
      return {
        ...s,
        collected: { ...s.collected, [a.level]: [] },
        stacks: { ...s.stacks, [a.level]: [] },
        solved: { ...s.solved, [a.level]: false },
        visited: { ...s.visited, [a.level]: false },
        phase: s.level === a.level ? 'briefing' : s.phase,
        failure: null,
      };
    case 'reopenBriefing':
      return { ...s, phase: 'briefing' };
    default:
      return s;
  }
}

/* ── Contexts ───────────────────────────────────────────────────────────── */

interface GameCtxValue {
  s: GameState;
  d: React.Dispatch<Action>;
}

const GameCtx = createContext<GameCtxValue | null>(null);

interface TelemetryCtxValue {
  tel: Telemetry;
  push: (p: Partial<Telemetry>) => void;
}

const TelemetryCtx = createContext<TelemetryCtxValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [s, d] = useReducer(reducer, initial);
  const [tel, setTel] = useState<Telemetry>(emptyTelemetry);
  const lastPush = useRef(0);

  const push = useCallback((p: Partial<Telemetry>) => {
    const now = performance.now();
    if (now - lastPush.current < 90) return; // throttle to ~11 Hz
    lastPush.current = now;
    setTel((prev) => {
      const next: Telemetry = { ...prev, ...p };
      const cap = (arr: number[], v?: number) =>
        v === undefined ? arr : [...arr, v].slice(-HIST_CAP);
      next.histAlt = cap(prev.histAlt, p.altitudeKm);
      next.histVel = cap(prev.histVel, p.velocityMs);
      next.histG = cap(prev.histG, p.gforce);
      next.histHp = cap(prev.histHp, p.hp);
      next.histTq = cap(prev.histTq, p.torqueNm);
      return next;
    });
  }, []);

  const game = useMemo(() => ({ s, d }), [s]);
  const telem = useMemo(() => ({ tel, push }), [tel, push]);
  return (
    <TelemetryCtx.Provider value={telem}>
      <GameCtx.Provider value={game}>{children}</GameCtx.Provider>
    </TelemetryCtx.Provider>
  );
}

export function useGame(): GameCtxValue {
  const v = useContext(GameCtx);
  if (!v) throw new Error('useGame outside provider');
  return v;
}

export function useTelemetry(): TelemetryCtxValue {
  const v = useContext(TelemetryCtx);
  if (!v) throw new Error('useTelemetry outside provider');
  return v;
}

/** Machine-part lookup helper for the current level. */
export function partStatus(s: GameState, partId: string): 'hidden' | 'tray' | 'mounted' {
  if (s.stacks[s.level].includes(partId)) return 'mounted';
  if (s.collected[s.level].includes(partId)) return 'tray';
  return 'hidden';
}
