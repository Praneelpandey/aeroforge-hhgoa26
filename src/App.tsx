/* ============================================================================
 * AEROFORGE — App.tsx (Apple Daylight Studio edition): 3D Canvas + Webcam AR
 * layer + Sound Engine + HUD. Owns test evaluation, launch countdown,
 * briefing & failure modals, toasts, keyboard shortcuts, WWDC frame.
 * ==========================================================================*/

import { useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertOctagon,
  CheckCircle2,
  Cog,
  Info,
  KeyRound,
  Radar,
  Rocket,
  ScanLine,
  TriangleAlert,
  Wrench,
  X,
} from 'lucide-react';
import { GameProvider, useGame, useTelemetry } from './state/gameStore';
import { machineById } from './data/machinesData';
import { sound } from './audio/SoundEngine';
import { flightInput } from './lib/fxBus';
import { Experience } from './components/canvas/Experience';
import { TopNavAndModes } from './components/hud/TopNavAndModes';
import { CuriosityInspector } from './components/hud/CuriosityInspector';
import { AssemblyStackPanel } from './components/hud/AssemblyStackPanel';
import { TelemetryDashboard } from './components/hud/TelemetryDashboard';
import { GlassPanel, HoloButton } from './components/hud/shared';
import { cn } from './lib/utils';

/* ═════════════════════════════════════════════════════════════════════════
 * APP
 * ════════════════════════════════════════════════════════════════════════*/

function AppInner() {
  const { s, d } = useGame();
  const { push } = useTelemetry();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const def = machineById(s.level);
  const climaxSpoken = useRef<Record<string, boolean>>({});

  /* ── audio sync ── */
  useEffect(() => {
    sound.setMuted(s.muted);
  }, [s.muted]);
  useEffect(() => {
    sound.voiceOn = s.voiceOn;
    if (!s.voiceOn) sound.cancelSpeech();
  }, [s.voiceOn]);

  /* ── unlock WebAudio on first gesture ── */
  useEffect(() => {
    const unlock = () => sound.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  /* ── keyboard shortcuts ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key.toLowerCase()) {
        case 'x':
          d({ t: 'xray' });
          sound.uiClick();
          break;
        case '1':
          d({ t: 'level', level: 'rocket' });
          break;
        case '2':
          d({ t: 'level', level: 'v8' });
          break;
        case '3':
          d({ t: 'level', level: 'drone' });
          break;
        case 'm':
          d({ t: 'muted' });
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [d]);

  /* ── WEBCAM AR lifecycle ── */
  useEffect(() => {
    if (s.viewMode !== 'ar') {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (s.arStatus === 'live') d({ t: 'ar', status: 'idle' });
      return;
    }
    if (s.arStatus !== 'idle') return;
    let cancelled = false;
    d({ t: 'ar', status: 'requesting' });
    navigator.mediaDevices
      ?.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
        d({ t: 'ar', status: 'live' });
        sound.speak('Augmented reality mode online. Modules projected into your room.');
      })
      .catch(() => {
        if (cancelled) return;
        d({ t: 'ar', status: 'denied' });
        d({ t: 'view', view: 'room' });
        d({ t: 'toast', text: 'Camera unavailable — AR needs permission. Returning to Room mode.', kind: 'bad' });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.viewMode, s.arStatus]);

  /* ── TEST EVALUATION (static fire / dyno / hover trial) ── */
  useEffect(() => {
    if (s.phase !== 'testing') return;
    const id = setTimeout(() => {
      const diag = def.diagnose(s.stacks[s.level]);
      if (diag) {
        sound.cancelSpeech();
        d({ t: 'failure', failure: diag });
        sound.speak(`${diag.title}. ${diag.eli10.split(/(?<=\.)\s/)[0]}`);
      } else {
        d({ t: 'solve' });
        sound.successChime();
        if (s.level === 'rocket') {
          sound.speak('Static fire validated across all subsystems. Launch is armed — press INITIATE LAUNCH.');
        } else {
          sound.speak(`${def.successTitle}. ${def.successText.split(/(?<=\.)\s/)[0]}`);
        }
      }
    }, 2100);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.phase]);

  /* ── ROCKET COUNTDOWN SEQUENCE ── */
  useEffect(() => {
    if (s.launchState !== 'counting') return;
    const c = s.countdown;
    if (c === null) {
      d({ t: 'countdown', v: 5 });
      sound.klaxon(1);
      sound.speak('Launch sequence initiated. T minus 5 seconds.');
      return;
    }
    if (c <= 0) {
      d({ t: 'launch', state: 'flying' });
      d({ t: 'countdown', v: null });
      sound.speak('Ignition. Hold-down released. The Ares five has cleared the pad.');
      return;
    }
    const id = setTimeout(() => {
      sound.beep(c <= 2 ? 760 : 520);
      sound.speak(String(c), { interrupt: false });
      d({ t: 'countdown', v: c - 1 });
    }, 1000);
    return () => clearTimeout(id);
  }, [s.launchState, s.countdown, d]);

  /* ── climax narration (once per level entry) ── */
  useEffect(() => {
    if (s.phase !== 'climax') return;
    if (s.level === 'rocket') return; // rocket narrates via launch sequence
    if (climaxSpoken.current[s.level]) return;
    climaxSpoken.current[s.level] = true;
    if (s.level === 'v8') {
      sound.speak('Dyno cell unlocked. Ride the throttle and watch horsepower cross torque at 5,252 rpm.');
    } else {
      sound.speak('Flight authority granted. Take the sticks — W A S D to fly, arrow keys for yaw and altitude.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.phase, s.level]);

  /* ── flight input must not stick when leaving climax ── */
  useEffect(() => {
    if (s.phase !== 'climax' || s.level !== 'drone') flightInput.reset();
  }, [s.phase, s.level]);

  /* ── toast auto-clear ── */
  useEffect(() => {
    if (!s.toast) return;
    const id = setTimeout(() => d({ t: 'clearToast' }), 2800);
    return () => clearTimeout(id);
  }, [s.toast, d]);

  /* ── reset telemetry buffers on level switch ── */
  useEffect(() => {
    push({
      tPlus: 0,
      altitudeKm: 0,
      velocityMs: 0,
      mach: 0,
      gforce: 0,
      rpm: 0,
      hp: 0,
      torqueNm: 0,
      boostPsi: 0,
      knock: 0,
      batteryPct: 100,
      lidarHits: 0,
      droneSpeed: 0,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.level]);

  const levelIcons = { rocket: Rocket, v8: Cog, drone: Radar } as const;
  const LevelIcon = levelIcons[s.level];

  return (
    <div className={cn('studio-page fixed inset-0 overflow-hidden', s.wwdcFrame && 'p-5 sm:p-7')}>
      {/* WWDC / iPad Pro playground frame */}
      {s.wwdcFrame && (
        <div className="pointer-events-none absolute inset-0 z-50 flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] text-slate-400">
              <span className="h-2 w-2 rounded-full bg-[#10b981]" />
              SWIFT PLAYGROUND ▸ AEROFORGE.playground
            </div>
            <div className="mono-num text-[10px] text-slate-400">120 FPS · DAYLIGHT · SPATIAL</div>
          </div>
        </div>
      )}
      <div
        className={cn(
          'relative h-full w-full overflow-hidden',
          s.wwdcFrame &&
            'rounded-[28px] border-[10px] border-[#e2e8f0] shadow-[0_40px_120px_rgba(15,23,42,0.16),inset_0_0_0_1px_rgba(15,23,42,0.08)]',
        )}
      >
        {/* AR webcam layer */}
        <video
          ref={videoRef}
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-500',
            s.viewMode === 'ar' && s.arStatus === 'live' ? 'opacity-100' : 'opacity-0',
          )}
          playsInline
          muted
          style={{ transform: 'scaleX(-1)' }}
        />
        {s.viewMode === 'ar' && s.arStatus === 'requesting' && (
          <div className="studio-page absolute inset-0 z-10 flex items-center justify-center">
            <div className="glass glass-strong spec-border rounded-2xl px-6 py-4 text-center">
              <ScanLine className="mx-auto mb-2 animate-pulse text-[#0071e3]" />
              <div className="text-[12px] font-semibold tracking-[0.14em] text-slate-700">
                REQUESTING CAMERA FOR AR PASSTHROUGH…
              </div>
            </div>
          </div>
        )}

        {/* 3D canvas */}
        <div className="absolute inset-0 z-10">
          <Canvas
            shadows
            dpr={[1, 2]}
            gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
            camera={{ position: [8.2, 4.8, 10], fov: 45, near: 0.1, far: 220 }}
            style={{ background: 'transparent' }}
            onCreated={({ gl }) => gl.setClearAlpha(0)}
            onPointerMissed={() => {
              if (s.selectedPart) d({ t: 'select', part: null });
            }}
          >
            <Experience />
          </Canvas>
        </div>

        {/* soft studio vignette */}
        <div className="studio-vignette pointer-events-none absolute inset-0 z-20" />

        {/* HUD */}
        <div className="pointer-events-none absolute inset-0 z-30">
          <TopNavAndModes />
          <AssemblyStackPanel />
          <CuriosityInspector />
          <TelemetryDashboard />

          {/* corner badges */}
          <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex items-center gap-2">
            <div className="glass rounded-xl px-2.5 py-1.5 text-[9px] font-bold tracking-[0.14em] text-slate-500">
              <KeyRound size={9} className="mr-1 inline text-[#0071e3]" />
              [X] X-RAY · [1·2·3] SECTOR · [M] MUTE
            </div>
          </div>
          <div className="pointer-events-none absolute bottom-3 right-3 z-20">
            <div className="glass flex items-center gap-2 rounded-xl px-2.5 py-1.5">
              <LevelIcon size={12} className="text-[#0071e3]" />
              <span className="mono-num text-[9px] font-bold tracking-[0.16em] text-slate-500">
                {s.viewMode === 'ar' ? 'WEBCAM AR' : s.viewMode === 'cad' ? 'CAD STUDIO' : 'DAYLIGHT STUDIO'} ·{' '}
                {def.codename}
              </span>
            </div>
          </div>
        </div>

        {/* ── MODALS ── */}
        <AnimatePresence>
          {s.phase === 'briefing' && <BriefingOverlay key="brief" />}
          {s.phase === 'failure' && s.failure && <FailureModal key="fail" />}
        </AnimatePresence>

        {/* toast */}
        <AnimatePresence>
          {s.toast && (
            <motion.div
              key={s.toast.id}
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 12, opacity: 0 }}
              className={cn(
                'glass glass-strong spec-border absolute left-1/2 top-[64px] z-40 -translate-x-1/2 rounded-xl px-4 py-2 text-[11px] font-bold tracking-[0.12em]',
                s.toast.kind === 'good'
                  ? 'text-[#059669]'
                  : s.toast.kind === 'bad'
                    ? 'text-[#e11d48]'
                    : 'text-[#0071e3]',
              )}
            >
              {s.toast.text}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  /* ── mission briefing overlay ── */
  function BriefingOverlay() {
    const lvlDef = machineById(s.level);
    const icons = { rocket: Rocket, v8: Cog, drone: Radar } as const;
    const Icon = icons[s.level];
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-40 flex items-center justify-center bg-white/55 backdrop-blur-md"
      >
        <motion.div
          initial={{ scale: 0.92, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          className="w-[min(560px,92vw)]"
        >
          <GlassPanel strong className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0f172a] shadow-[0_8px_20px_-6px_rgba(15,23,42,0.4)]">
                  <Icon size={22} className="text-white" />
                </div>
                <div>
                  <div className="text-[9px] font-bold tracking-[0.26em] text-[#0071e3]">
                    LOCKDOWN PROTOCOL · {lvlDef.codename}
                  </div>
                  <h1 className="text-[20px] font-extrabold leading-tight text-slate-900">{lvlDef.name}</h1>
                  <div className="text-[11px] font-semibold text-slate-500">{lvlDef.subtitle}</div>
                </div>
              </div>
              <span className="rounded-lg bg-[#fef2f2] px-2 py-1 text-[9px] font-bold tracking-[0.16em] text-[#e11d48]">
                ⚠ SEALED
              </span>
            </div>

            <p className="mt-4 text-[12.5px] font-medium leading-relaxed text-slate-600">{lvlDef.missionBrief}</p>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                ['MODULES', String(lvlDef.parts.length)],
                ['TEST', lvlDef.testLabel.replace('RUN ', '')],
                ['MODES', 'ROOM · AR · CAD'],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-slate-900/10 bg-white/70 p-2.5">
                  <div className="text-[8px] font-bold tracking-[0.18em] text-slate-400">{k}</div>
                  <div className="mt-0.5 text-[11px] font-bold text-slate-800">{v}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                <Info size={11} />
                Scavenge · Inspect · Assemble · X-Ray · Survive the test
              </div>
              <HoloButton
                variant="primary"
                className="px-6 py-2.5"
                icon={Wrench}
                onClick={() => {
                  sound.unlock();
                  sound.wrench();
                  sound.speak(`${lvlDef.codename} unsealed. ${lvlDef.name}. Good luck, engineer.`);
                  d({ t: 'phase', phase: 'play' });
                }}
              >
                ENTER LAB
              </HoloButton>
            </div>
          </GlassPanel>
        </motion.div>
      </motion.div>
    );
  }

  /* ── failure diagnostic modal ── */
  function FailureModal() {
    const f = s.failure!;
    const lvlDef = machineById(s.level);
    const sev = f.severity === 'CRITICAL';
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-40 flex items-center justify-center bg-white/55 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.9, y: 24 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 24 }}
          className="w-[min(600px,94vw)]"
        >
          <div className="glass glass-strong spec-border overflow-hidden rounded-2xl">
            <div
              className={cn(
                'relative flex items-center gap-3 border-b p-4',
                sev ? 'border-[#ef4444]/25 bg-[#fef2f2]' : 'border-[#f59e0b]/25 bg-[#fffbeb]',
              )}
            >
              <div
                className={cn(
                  'flex h-11 w-11 animate-pulse items-center justify-center rounded-xl',
                  sev ? 'bg-[#fee2e2]' : 'bg-[#fef3c7]',
                )}
              >
                <AlertOctagon size={22} className={sev ? 'text-[#e11d48]' : 'text-[#b45309]'} />
              </div>
              <div className="flex-1">
                <div className="text-[9px] font-bold tracking-[0.24em] text-slate-400">
                  {lvlDef.failureBanner} · DIAGNOSTIC {sev ? '· CLASS-A' : '· CLASS-B'}
                </div>
                <h2 className={cn('text-[19px] font-extrabold leading-tight', sev ? 'text-[#dc2626]' : 'text-[#b45309]')}>
                  {f.title}
                </h2>
              </div>
              <span
                className={cn(
                  'rounded-lg px-2 py-1 text-[9px] font-bold tracking-[0.16em]',
                  sev ? 'bg-[#fee2e2] text-[#dc2626]' : 'bg-[#fef3c7] text-[#b45309]',
                )}
              >
                {f.severity}
              </span>
            </div>

            <div className="max-h-[52vh] overflow-y-auto p-4 af-scroll">
              <div className="mb-3 rounded-xl border border-[#ef4444]/25 bg-[#fef2f2] p-2.5">
                <div className="mb-1 flex items-center gap-1.5 text-[9px] font-bold tracking-[0.18em] text-[#e11d48]">
                  <TriangleAlert size={11} /> RULE VIOLATED
                </div>
                <div className="text-[12px] font-semibold text-slate-800">{f.ruleBroken}</div>
              </div>

              <div className="mb-3 rounded-xl border border-slate-900/10 bg-white/70 p-3">
                <div className="mb-1 text-[9px] font-bold tracking-[0.18em] text-[#0071e3]">
                  EXPLAIN LIKE I'M 10
                </div>
                <p className="text-[12px] font-medium leading-relaxed text-slate-600">{f.eli10}</p>
              </div>

              <div className="rounded-xl border border-[#7c3aed]/20 bg-[#7c3aed]/[0.06] p-3">
                <div className="mb-1 text-[9px] font-bold tracking-[0.18em] text-[#7c3aed]">
                  FAILURE ANALYSIS · ENGINEER MODE
                </div>
                <p className="text-[12px] font-medium leading-relaxed text-slate-600">{f.pro}</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-900/8 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-[#059669]">
                <CheckCircle2 size={12} />
                <span>{f.fixHint}</span>
              </div>
              <div className="flex items-center gap-2">
                <HoloButton
                  icon={X}
                  onClick={() => {
                    d({ t: 'failure', failure: null });
                    sound.speak('Diagnostic closed. Correct the assembly order and re-run the test.');
                  }}
                >
                  RECALIBRATE
                </HoloButton>
                <HoloButton
                  variant="danger"
                  onClick={() => {
                    d({ t: 'failure', failure: null });
                    d({ t: 'resetLevel' });
                  }}
                >
                  RESET ASSEMBLY
                </HoloButton>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  }
}

/* ── root ── */

export default function App() {
  return (
    <GameProvider>
      <AppInner />
    </GameProvider>
  );
}
