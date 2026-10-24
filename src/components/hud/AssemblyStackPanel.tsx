/* ============================================================================
 * AEROFORGE — Assembly Stack Panel (Daylight): build-order manager with
 * 1-click MOUNT / INSPECT per module, reorder controls and the orange
 * high-stakes RUN TEST trigger.
 * ==========================================================================*/

import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  CircleDot,
  Info,
  PackagePlus,
  Play,
  RotateCcw,
  ScanSearch,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { machineById } from '../../data/machinesData';
import { partStatus, useGame } from '../../state/gameStore';
import { sound } from '../../audio/SoundEngine';
import { cn } from '../../lib/utils';
import { HoloButton, SectionLabel, StatusDot } from './shared';

export function AssemblyStackPanel() {
  const { s, d } = useGame();
  const def = machineById(s.level);
  const stack = s.stacks[s.level];
  const collectedCount = s.collected[s.level].length;
  const totalParts = def.parts.length;
  const allMounted = stack.length === totalParts;
  const busy = s.phase === 'testing';

  const hidden = def.parts.filter((p) => partStatus(s, p.id) === 'hidden').length;
  const inTray = def.parts.filter((p) => partStatus(s, p.id) === 'tray');
  const nextSuggested = def.parts.find((p) => !stack.includes(p.id));

  const objective = s.solved[s.level]
    ? 'SECTOR VALIDATED — climax unlocked'
    : hidden > 0
      ? `Find ${hidden} more module${hidden > 1 ? 's' : ''} on the tool carts${s.viewMode === 'ar' ? ' (AR ring)' : ''} — hover & click in 3D`
      : inTray.length > 0
        ? `Mount from tray or sidebar — suggested next: ${nextSuggested?.short ?? '—'}`
        : s.phase === 'failure'
          ? 'Fix the assembly order, then re-run the test'
          : allMounted
            ? 'All modules mounted — RUN THE TEST'
            : 'Assemble the build';

  return (
    <motion.aside
      initial={{ x: -60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      className="pointer-events-auto absolute left-3 top-[74px] z-20 flex max-h-[calc(100vh-190px)] w-[300px] flex-col overflow-hidden"
    >
      <div className="glass glass-strong spec-border flex min-h-0 flex-col rounded-2xl">
        {/* header */}
        <div className="border-b border-slate-900/8 p-3.5">
          <div className="flex items-center justify-between">
            <SectionLabel>{def.codename} · ASSEMBLY TRAIN</SectionLabel>
            <span
              className={cn(
                'rounded-lg px-1.5 py-0.5 text-[8.5px] font-bold tracking-[0.14em]',
                s.solved[s.level] ? 'bg-[#dcfce7] text-[#059669]' : 'bg-slate-900/[0.05] text-slate-500',
              )}
            >
              {s.solved[s.level] ? '● VALIDATED' : '○ IN BUILD'}
            </span>
          </div>
          <h2 className="mt-1 text-[15px] font-bold leading-tight text-slate-900">{def.name}</h2>
          {/* progress bars */}
          <div className="mt-2.5 flex items-center gap-2">
            <div className="flex-1">
              <div className="mb-1 flex justify-between text-[8px] font-bold tracking-[0.14em] text-slate-400">
                <span>SCAVENGED</span>
                <span className="mono-num text-[#b45309]">
                  {collectedCount}/{totalParts}
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-slate-900/[0.07]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#f59e0b] to-[#ff5500] transition-all duration-500"
                  style={{ width: `${(collectedCount / totalParts) * 100}%` }}
                />
              </div>
            </div>
            <div className="flex-1">
              <div className="mb-1 flex justify-between text-[8px] font-bold tracking-[0.14em] text-slate-400">
                <span>MOUNTED</span>
                <span className="mono-num text-[#0071e3]">
                  {stack.length}/{totalParts}
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-slate-900/[0.07]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#0071e3] to-[#40a1ff] transition-all duration-500"
                  style={{ width: `${(stack.length / totalParts) * 100}%` }}
                />
              </div>
            </div>
          </div>
          {/* objective */}
          <div className="mt-2.5 flex items-start gap-1.5 rounded-lg border border-[#0071e3]/15 bg-[#0071e3]/[0.05] px-2 py-1.5">
            <CircleDot size={10} className="mt-[3px] shrink-0 text-[#0071e3]" />
            <span className="text-[10.5px] font-medium leading-snug text-slate-700">{objective}</span>
          </div>
        </div>

        {/* part rows */}
        <div className="min-h-0 flex-1 overflow-y-auto p-2 af-scroll">
          {def.parts.map((p) => {
            const st = partStatus(s, p.id);
            const mountIdx = stack.indexOf(p.id);
            return (
              <div
                key={p.id}
                className={cn(
                  'group mb-1 flex items-center gap-2 rounded-xl border px-2 py-1.5 transition-all',
                  st === 'mounted'
                    ? 'border-[#0071e3]/25 bg-[#0071e3]/[0.06]'
                    : st === 'tray'
                      ? 'border-[#f59e0b]/25 bg-[#f59e0b]/[0.06]'
                      : 'border-slate-900/8 bg-white/50',
                )}
              >
                <span
                  className={cn(
                    'mono-num flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[10px] font-bold',
                    st === 'mounted'
                      ? 'border-[#0071e3]/40 bg-[#0071e3]/10 text-[#0071e3]'
                      : 'border-slate-900/10 bg-white text-slate-400',
                  )}
                >
                  {st === 'mounted' ? mountIdx + 1 : '·'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        'truncate text-[11px] font-semibold',
                        st === 'hidden' ? 'text-slate-400' : 'text-slate-800',
                      )}
                    >
                      {p.short}
                    </span>
                    {st === 'mounted' && (
                      <span className="rounded-md bg-[#dcfce7] px-1 py-[1px] text-[7.5px] font-bold tracking-[0.1em] text-[#059669]">
                        #{mountIdx + 1}
                      </span>
                    )}
                  </div>
                  <div className="text-[8px] font-bold tracking-[0.12em] text-slate-400">
                    {st === 'mounted'
                      ? `MOUNTED · POSITION ${mountIdx + 1}`
                      : st === 'tray'
                        ? 'IN TRAY — 3D CLICK / DRAG / MOUNT'
                        : `ON A TOOL CART · ${p.tag.toUpperCase()}`}
                  </div>
                </div>
                <StatusDot state={st} />
                <div className="flex items-center gap-0.5">
                  {st === 'tray' && s.phase === 'play' && (
                    <button
                      type="button"
                      title="Mount onto the stack"
                      onClick={() => {
                        sound.snap();
                        d({ t: 'mount', part: p.id });
                      }}
                      className="flex items-center gap-1 rounded-lg border border-[#0071e3]/30 bg-[#0071e3]/10 px-1.5 py-1 text-[9px] font-bold text-[#0071e3] hover:bg-[#0071e3] hover:text-white"
                    >
                      <PackagePlus size={11} />
                      MOUNT
                    </button>
                  )}
                  <button
                    type="button"
                    title="Inspect module"
                    onClick={() => {
                      sound.uiClick();
                      d({ t: 'select', part: p.id });
                    }}
                    className="flex items-center gap-1 rounded-lg border border-slate-900/10 bg-white px-1.5 py-1 text-[9px] font-bold text-slate-600 hover:bg-slate-900/[0.06]"
                  >
                    <ScanSearch size={11} />
                    INSPECT
                  </button>
                  {st === 'mounted' && s.phase === 'play' && (
                    <>
                      <button
                        type="button"
                        title="Move earlier"
                        disabled={mountIdx <= 0}
                        onClick={() => {
                          sound.uiClick();
                          d({ t: 'move', part: p.id, dir: -1 });
                        }}
                        className="rounded-md border border-slate-900/10 bg-white p-1 text-slate-500 hover:bg-slate-900/[0.06] disabled:opacity-25"
                      >
                        <ChevronUp size={11} />
                      </button>
                      <button
                        type="button"
                        title="Move later"
                        disabled={mountIdx >= stack.length - 1}
                        onClick={() => {
                          sound.uiClick();
                          d({ t: 'move', part: p.id, dir: 1 });
                        }}
                        className="rounded-md border border-slate-900/10 bg-white p-1 text-slate-500 hover:bg-slate-900/[0.06] disabled:opacity-25"
                      >
                        <ChevronDown size={11} />
                      </button>
                      <button
                        type="button"
                        title="Unmount"
                        onClick={() => {
                          sound.unsnap();
                          d({ t: 'unmount', part: p.id });
                        }}
                        className="rounded-md border border-slate-900/10 bg-white p-1 text-[#e11d48] hover:bg-[#fef2f2]"
                      >
                        <Trash2 size={11} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* footer: run test */}
        <div className="border-t border-slate-900/8 p-3">
          <div className="mb-2 flex items-center gap-1.5">
            <Info size={10} className="shrink-0 text-slate-400" />
            <span className="text-[9px] leading-snug text-slate-400">
              Bottom-to-top build order decides load path & cooling — the test bench shows no mercy.
            </span>
          </div>
          <AnimatePresence mode="wait">
            {busy ? (
              <motion.div
                key="testing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center gap-2 rounded-xl border border-[#f59e0b]/40 bg-[#fffbeb] px-3 py-2.5"
              >
                <TriangleAlert size={14} className="animate-pulse text-[#b45309]" />
                <span className="text-[11px] font-bold tracking-[0.18em] text-[#92400e]">
                  TEST IN PROGRESS…
                </span>
              </motion.div>
            ) : (
              <motion.div key="run" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <HoloButton
                  variant={allMounted && s.phase === 'play' ? 'cta' : 'ghost'}
                  className="w-full py-2.5"
                  icon={Play}
                  disabled={!allMounted || s.phase !== 'play'}
                  onClick={() => {
                    sound.klaxon(1);
                    sound.speak(`${def.testLabel.replace('RUN ', '')} initiated. Stand by.`);
                    d({ t: 'phase', phase: 'testing' });
                  }}
                >
                  {def.testLabel}
                </HoloButton>
              </motion.div>
            )}
          </AnimatePresence>
          {s.phase === 'play' && stack.length > 0 && (
            <HoloButton
              className="mt-2 w-full"
              icon={RotateCcw}
              onClick={() => {
                d({ t: 'resetLevel' });
                sound.unsnap();
              }}
            >
              RESET ASSEMBLY
            </HoloButton>
          )}
        </div>
      </div>
    </motion.aside>
  );
}
