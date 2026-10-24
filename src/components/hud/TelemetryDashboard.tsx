/* ============================================================================
 * AEROFORGE — Telemetry Dashboard (Daylight): per-level instrumentation.
 * Rocket: launch CTA, static-fire → liftoff telemetry with live meters.
 * V8: throttle pedal, RPM / HP / TQ curves, boost + knock warning.
 * Drone: battery, position, speed, LiDAR hits + flight key legend.
 * ==========================================================================*/

import { motion } from 'framer-motion';
import {
  Battery,
  CheckCircle2,
  Fan,
  Flame,
  Gauge,
  Keyboard,
  Orbit,
  Radar,
  Rocket as RocketIcon,
  RotateCcw,
  Timer,
} from 'lucide-react';
import { machineById } from '../../data/machinesData';
import { useGame, useTelemetry } from '../../state/gameStore';
import { HoloButton, HoloSlider, SectionLabel, Sparkline, StatChip } from './shared';
import { cn } from '../../lib/utils';

export function TelemetryDashboard() {
  const { s, d } = useGame();
  const { tel } = useTelemetry();
  const def = machineById(s.level);
  const climax = s.phase === 'climax';

  return (
    <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 w-[min(880px,calc(100vw-24px))] -translate-x-1/2">
      <div className="glass glass-strong spec-border pointer-events-auto rounded-2xl px-4 py-3">
        {!climax ? (
          <StandbyStrip />
        ) : s.level === 'rocket' ? (
          <RocketTelemetry />
        ) : s.level === 'v8' ? (
          <V8Telemetry />
        ) : (
          <DroneTelemetry />
        )}
      </div>
    </div>
  );

  function launchCountdown() {
    d({ t: 'launch', state: 'counting' });
    d({ t: 'countdown', v: null });
  }

  /* ── pre-climax strip ── */
  function StandbyStrip() {
    const solved = s.solved[s.level];
    return (
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-900/10 bg-white/80">
            <Gauge size={16} className="text-[#0071e3]" />
          </div>
          <div>
            <SectionLabel>{def.codename} · INSTRUMENTATION</SectionLabel>
            <div className="text-[12px] font-semibold text-slate-700">
              {solved ? (
                <span className="text-[#059669]">SECTOR VALIDATED — replay the climax any time</span>
              ) : s.phase === 'testing' ? (
                <span className="animate-pulse text-[#b45309]">TEST CYCLE RUNNING — sensors hot…</span>
              ) : s.phase === 'failure' ? (
                <span className="text-[#e11d48]">ANOMALY LOGGED — see diagnostic, then fix the build</span>
              ) : (
                'Telemetry unlocks after a successful validation test'
              )}
            </div>
          </div>
        </div>
        {solved && s.level === 'rocket' && s.launchState === 'idle' && (
          <HoloButton variant="cta" icon={RocketIcon} onClick={launchCountdown}>
            LAUNCH
          </HoloButton>
        )}
        {solved && s.level === 'rocket' && s.launchState === 'done' && (
          <HoloButton variant="primary" icon={RotateCcw} onClick={() => d({ t: 'launch', state: 'idle' })}>
            RESET TO LAUNCHPAD
          </HoloButton>
        )}
        {solved && s.level === 'v8' && (
          <span className="rounded-lg bg-[#fef3c7] px-2 py-1 text-[10px] font-bold tracking-[0.14em] text-[#b45309]">
            DYNO UNLOCKED
          </span>
        )}
        {solved && s.level === 'drone' && (
          <span className="rounded-lg bg-[#dcfce7] px-2 py-1 text-[10px] font-bold tracking-[0.14em] text-[#059669]">
            FLIGHT AUTHORITY
          </span>
        )}
      </div>
    );
  }

  /* ── LEVEL 1 · rocket: static fire → liftoff ── */
  function RocketTelemetry() {
    const counting = s.launchState === 'counting';
    const flying = s.launchState === 'flying';
    const done = s.launchState === 'done';
    const idle = s.launchState === 'idle';
    return (
      <div className="relative flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl border',
              flying
                ? 'animate-pulse border-[#ff5500]/60 bg-[#ff5500]/15'
                : 'border-slate-900/10 bg-white/80',
            )}
          >
            <Flame size={17} className={flying ? 'text-[#ff5500]' : 'text-slate-400'} />
          </div>
          <div className="min-w-[128px]">
            <SectionLabel>
              {done ? 'MISSION COMPLETE' : counting ? 'IGNITION SEQUENCE' : 'FLIGHT TELEMETRY'}
            </SectionLabel>
            <div className="mono-num text-[24px] font-extrabold leading-none text-slate-900">
              {counting ? (
                <span className="text-[#b45309]">
                  T−{s.countdown ?? 5}
                  <span className="text-[13px] font-semibold text-slate-400"> s</span>
                </span>
              ) : done ? (
                <span className="flex items-center text-[#059669]">
                  <CheckCircle2 size={20} className="mr-1" />
                  APOGEE
                </span>
              ) : (
                <>
                  T+{tel.tPlus.toFixed(1)}
                  <span className="text-[13px] font-semibold text-slate-400"> s</span>
                </>
              )}
            </div>
          </div>
        </div>

        {counting ? (
          <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.14em] text-[#b45309]">
            <Timer size={14} className="animate-pulse" />
            CRYO VENTING · AUTO-SEQUENCE ARMED
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <StatChip label="ALTITUDE" value={tel.altitudeKm >= 10 ? (tel.altitudeKm).toFixed(2) : (tel.altitudeKm * 1000).toFixed(0)} unit={tel.altitudeKm >= 10 ? 'km' : 'm'} wide />
              <StatChip label="VELOCITY" value={tel.velocityMs.toFixed(0)} unit="m/s" accent="violet" />
              <StatChip label="MACH" value={tel.mach.toFixed(2)} accent="slate" />
              <StatChip label="G-FORCE" value={tel.gforce.toFixed(2)} unit="G" accent="rose" />
              <StatChip label="Isp" value={tel.isp.toFixed(0)} unit="s" accent="green" />
              <StatChip label="THRUST" value={tel.thrustKN.toFixed(0)} unit="kN" accent="orange" wide />
            </div>
            <div className="hidden items-center gap-3 lg:flex">
              <Sparkline data={tel.histAlt} label="ALT" unit="km" color="#0071e3" width={104} />
              <Sparkline data={tel.histVel} label="VEL" unit="m/s" color="#7c3aed" width={104} />
              <Sparkline data={tel.histG} label="G" unit="G" color="#e11d48" width={88} />
            </div>
          </>
        )}

        {idle && (
          <HoloButton variant="cta" icon={RocketIcon} onClick={launchCountdown}>
            INITIATE LAUNCH
          </HoloButton>
        )}
        {flying && (
          <HoloButton icon={Orbit} onClick={() => d({ t: 'launch', state: 'done' })}>
            END FLIGHT
          </HoloButton>
        )}
        {done && (
          <div className="flex gap-2">
            <HoloButton icon={RotateCcw} onClick={() => d({ t: 'launch', state: 'idle' })}>
              RESET TO LAUNCHPAD
            </HoloButton>
            <HoloButton variant="cta" icon={RocketIcon} onClick={launchCountdown}>
              RELAUNCH
            </HoloButton>
          </div>
        )}
      </div>
    );
  }

  /* ── LEVEL 2 · V8 dyno ── */
  function V8Telemetry() {
    return (
      <div className="relative flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-900/10 bg-white/80">
            <Fan size={17} className={tel.rpm > 6500 ? 'animate-spin text-[#e11d48]' : 'text-[#0071e3]'} />
          </div>
          <div className="min-w-[150px]">
            <SectionLabel>DYNO CELL · LIVE</SectionLabel>
            <div className="mono-num text-[24px] font-extrabold leading-none text-slate-900">
              {tel.rpm.toLocaleString()}
              <span className="text-[13px] font-semibold text-slate-400"> rpm</span>
            </div>
          </div>
        </div>

        {/* throttle pedal */}
        <div className="flex min-w-[210px] flex-1 flex-col gap-1">
          <div className="flex items-baseline justify-between">
            <span className="text-[9px] font-bold tracking-[0.16em] text-slate-400">THROTTLE PEDAL</span>
            <span className="mono-num text-[10px] font-bold text-[#0071e3]">
              {s.throttleRpm.toLocaleString()} rpm target
            </span>
          </div>
          <HoloSlider
            value={s.throttleRpm}
            min={800}
            max={8500}
            step={50}
            onChange={(v) => d({ t: 'throttle', rpm: v })}
          />
          <div className="flex justify-between text-[8px] font-bold tracking-[0.12em] text-slate-400">
            <span>IDLE 800</span>
            <span className={s.throttleRpm > 8200 ? 'text-[#e11d48]' : ''}>REDLINE 8,500 ⚠KNOCK&gt;8,200</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <StatChip label="POWER" value={tel.hp.toLocaleString()} unit="hp" accent="orange" wide />
          <StatChip label="TORQUE" value={tel.torqueNm.toLocaleString()} unit="Nm" accent="violet" wide />
          <StatChip label="BOOST" value={tel.boostPsi.toFixed(1)} unit="psi" accent="rose" />
        </div>

        <div className="hidden items-center gap-3 xl:flex">
          <Sparkline data={tel.histHp} label="HP" color="#ff5500" width={96} />
          <Sparkline data={tel.histTq} label="TQ" unit="Nm" color="#7c3aed" width={96} />
        </div>

        {tel.knock > 0.5 && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute -top-9 left-1/2 -translate-x-1/2 rounded-lg border border-[#ef4444]/50 bg-[#fee2e2] px-3 py-1 text-[10px] font-bold tracking-[0.18em] text-[#dc2626]"
          >
            ⚠ DETONATION — POWER CUT 32%
          </motion.div>
        )}
      </div>
    );
  }

  /* ── LEVEL 3 · drone flight ── */
  function DroneTelemetry() {
    return (
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#10b981]/40 bg-[#10b981]/10">
            <Radar size={17} className="animate-pulse text-[#059669]" />
          </div>
          <div className="min-w-[120px]">
            <SectionLabel>HELIOS-X · FLIGHT</SectionLabel>
            <div className="mono-num text-[20px] font-extrabold leading-none text-slate-900">
              {tel.droneSpeed.toFixed(1)}
              <span className="text-[12px] font-semibold text-slate-400"> m/s</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <StatChip label="POS X" value={tel.droneX.toFixed(1)} unit="m" accent="slate" />
          <StatChip label="ALT Y" value={tel.droneY.toFixed(1)} unit="m" accent="blue" />
          <StatChip label="POS Z" value={tel.droneZ.toFixed(1)} unit="m" accent="slate" />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex min-w-[92px] flex-col gap-0.5 rounded-xl border border-[#10b981]/25 bg-white/80 px-2.5 py-1.5">
            <span className="flex items-center gap-1 text-[8.5px] font-bold tracking-[0.16em] text-slate-400">
              <Battery size={9} /> PACK
            </span>
            <span className="mono-num text-[15px] font-bold leading-none text-[#059669]">
              {tel.batteryPct.toFixed(0)}%
            </span>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-900/[0.07]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#10b981] to-[#34d399] transition-all"
                style={{ width: `${tel.batteryPct}%` }}
              />
            </div>
          </div>
          <StatChip label="LIDAR PTS" value={tel.lidarHits.toLocaleString()} accent="violet" wide />
        </div>

        {/* key legend */}
        <div className="hidden flex-col gap-1 md:flex">
          <div className="flex items-center gap-1 text-[8.5px] font-bold tracking-[0.16em] text-slate-400">
            <Keyboard size={10} /> FLIGHT CONTROLS
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {[
              ['W/S', 'fwd/rev'],
              ['A/D', 'strafe'],
              ['←/→', 'yaw'],
              ['↑/↓', 'climb/sink'],
              ['⇧', 'boost'],
            ].map(([k, v]) => (
              <span
                key={k}
                className="flex items-center gap-1 rounded-md border border-slate-900/10 bg-white/80 px-1.5 py-0.5 text-[9px] text-slate-600"
              >
                <kbd className="mono-num font-bold text-[#0071e3]">{k}</kbd>
                <span className="text-slate-400">{v}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }
}
