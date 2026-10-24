/* ============================================================================
 * AEROFORGE — Curiosity Inspector (Daylight): frosted blueprint card with
 * ELI10 ⇄ Aerospace-Engineer toggle, "what if this disappears" facts and
 * live interactive physics calculators per module.
 * ==========================================================================*/

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Calculator, FlaskConical, GraduationCap, Lightbulb, PackagePlus, Trash2, X, Zap } from 'lucide-react';
import { machineById } from '../../data/machinesData';
import { partStatus, useGame } from '../../state/gameStore';
import { sound } from '../../audio/SoundEngine';
import { HoloButton, HoloSlider, SectionLabel } from './shared';
import { cn } from '../../lib/utils';

export function CuriosityInspector() {
  const { s, d } = useGame();
  const def = machineById(s.level);
  const part = def.parts.find((p) => p.id === s.selectedPart) ?? null;

  const [eli10, setEli10] = useState(true);
  const [params, setParams] = useState<Record<string, number>>({});

  /* reset local slider state when a new part is inspected */
  useEffect(() => {
    if (!part) return;
    setEli10(true);
    const init: Record<string, number> = {};
    part.params.forEach((p) => (init[p.id] = p.value));
    setParams(init);
    const firstSentence = part.eli10.split(/(?<=\.)\s/)[0];
    sound.speak(`Inspecting ${part.name}. ${firstSentence}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [part?.id]);

  const readouts = useMemo(() => {
    if (!part) return [];
    try {
      return part.compute(params);
    } catch {
      return [];
    }
  }, [part, params]);

  const status = part ? partStatus(s, part.id) : 'hidden';

  return (
    <AnimatePresence>
      {part && (
        <motion.aside
          key={part.id}
          initial={{ x: 60, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          className="pointer-events-auto absolute right-3 top-[74px] z-20 flex max-h-[calc(100vh-190px)] w-[336px] flex-col overflow-hidden"
        >
          <div className="glass glass-strong spec-border flex flex-col overflow-hidden rounded-2xl">
            {/* header */}
            <div className="relative border-b border-slate-900/8 p-4">
              <div
                className="absolute inset-x-0 top-0 h-[3px]"
                style={{ background: `linear-gradient(90deg, transparent, ${part.accent}, transparent)` }}
              />
              <button
                type="button"
                onClick={() => {
                  sound.uiClick();
                  d({ t: 'select', part: null });
                }}
                className="absolute right-3 top-3 rounded-lg border border-slate-900/10 bg-white/80 p-1 text-slate-400 hover:text-slate-800"
              >
                <X size={13} />
              </button>
              <SectionLabel>{def.codename} · MODULE BLUEPRINT</SectionLabel>
              <h2 className="mt-1 pr-6 text-[16px] font-bold leading-tight text-slate-900">
                {part.name}
              </h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span
                  className="rounded-md border px-1.5 py-0.5 text-[9px] font-bold tracking-[0.14em]"
                  style={{ color: part.accent, borderColor: `${part.accent}55`, background: `${part.accent}14` }}
                >
                  {part.tag.toUpperCase()}
                </span>
                <span className="mono-num rounded-md border border-slate-900/10 bg-white/80 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600">
                  {part.massKg.toLocaleString()} kg
                </span>
                <span
                  className={cn(
                    'rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-[0.14em]',
                    status === 'mounted'
                      ? 'bg-[#dcfce7] text-[#059669]'
                      : status === 'tray'
                        ? 'bg-[#fef3c7] text-[#b45309]'
                        : 'bg-slate-900/[0.05] text-slate-500',
                  )}
                >
                  {status === 'mounted'
                    ? `MOUNTED #${s.stacks[s.level].indexOf(part.id) + 1}`
                    : status === 'tray'
                      ? 'IN TRAY'
                      : 'ON A TOOL CART'}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 af-scroll">
              {/* ELI10 ⇄ PRO toggle */}
              <div className="mb-3 flex items-center gap-1 rounded-xl border border-slate-900/10 bg-white/60 p-1">
                {[
                  { k: true, label: "EXPLAIN LIKE I'M 10", icon: Lightbulb },
                  { k: false, label: 'AEROSPACE ENGINEER', icon: GraduationCap },
                ].map((o) => (
                  <button
                    key={String(o.k)}
                    type="button"
                    onClick={() => {
                      sound.uiClick();
                      setEli10(o.k);
                    }}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[9.5px] font-bold tracking-[0.1em] transition-all',
                      eli10 === o.k
                        ? 'border border-[#0071e3]/40 bg-[#0071e3]/10 text-[#0071e3]'
                        : 'text-slate-400 hover:text-slate-700',
                    )}
                  >
                    <o.icon size={11} />
                    {o.label}
                  </button>
                ))}
              </div>

              {/* narration */}
              <p className="text-[12px] font-medium leading-relaxed text-slate-700">
                {eli10 ? part.eli10 : part.pro}
              </p>

              {/* formula card (pro mode) */}
              {!eli10 && (
                <div className="mt-3 rounded-xl border border-[#7c3aed]/20 bg-[#7c3aed]/[0.06] p-2.5">
                  <div className="mb-1 flex items-center gap-1.5 text-[9px] font-bold tracking-[0.18em] text-[#7c3aed]">
                    <FlaskConical size={11} /> GOVERNING PHYSICS
                  </div>
                  <code className="mono-num block text-[11px] font-medium leading-relaxed text-slate-800">
                    {part.formula}
                  </code>
                </div>
              )}

              {/* what if it disappears */}
              <div className="mt-3 rounded-xl border border-[#f59e0b]/25 bg-[#fffbeb] p-2.5">
                <div className="mb-1 flex items-center gap-1.5 text-[9px] font-bold tracking-[0.18em] text-[#b45309]">
                  <Zap size={11} /> WHAT IF THIS PART DISAPPEARS?
                </div>
                <p className="text-[11.5px] font-medium leading-relaxed text-slate-700">{part.whatIfGone}</p>
              </div>

              {/* interactive physics sliders */}
              {part.params.length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 flex items-center gap-1.5">
                    <Calculator size={11} className="text-[#0071e3]" />
                    <SectionLabel className="text-[#0071e3]">LIVE PHYSICS SANDBOX</SectionLabel>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {part.params.map((p) => (
                      <div key={p.id} className="rounded-xl border border-slate-900/10 bg-white/70 p-2.5">
                        <div className="mb-1.5 flex items-baseline justify-between">
                          <span className="text-[10px] font-semibold text-slate-600">
                            {p.symbol && <span className="mono-num mr-1 text-[#0071e3]">{p.symbol}</span>}
                            {p.label}
                          </span>
                          <span className="mono-num text-[11px] font-bold text-slate-900">
                            {params[p.id] !== undefined ? params[p.id].toFixed(p.step < 1 ? 1 : 0) : p.value.toFixed(p.step < 1 ? 1 : 0)}
                            <span className="ml-1 text-[8.5px] font-semibold text-slate-400">{p.unit}</span>
                          </span>
                        </div>
                        <HoloSlider
                          value={params[p.id] ?? p.value}
                          min={p.min}
                          max={p.max}
                          step={p.step}
                          onChange={(v) => setParams((prev) => ({ ...prev, [p.id]: v }))}
                        />
                      </div>
                    ))}
                  </div>

                  {/* computed readouts */}
                  <div className="mt-3 grid grid-cols-2 gap-1.5">
                    {readouts.map((r, i) => (
                      <div
                        key={i}
                        className={cn(
                          'rounded-xl border p-2',
                          r.value.startsWith('⚠')
                            ? 'border-[#ef4444]/30 bg-[#fef2f2]'
                            : 'border-slate-900/10 bg-white/70',
                        )}
                      >
                        <div className="text-[8px] font-bold tracking-[0.14em] text-slate-400">
                          {r.label.toUpperCase()}
                        </div>
                        <div
                          className={cn(
                            'mono-num mt-0.5 text-[13px] font-bold',
                            r.value.startsWith('⚠') ? 'text-[#e11d48]' : 'text-slate-900',
                          )}
                        >
                          {r.value}
                        </div>
                        {r.hint && <div className="mt-0.5 text-[8.5px] text-slate-400">{r.hint}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* footer actions */}
            <div className="flex items-center gap-2 border-t border-slate-900/8 p-3">
              {status === 'tray' && s.phase === 'play' && (
                <HoloButton
                  variant="success"
                  className="flex-1"
                  icon={PackagePlus}
                  onClick={() => {
                    d({ t: 'mount', part: part.id });
                    sound.snap();
                  }}
                >
                  MOUNT TO STACK
                </HoloButton>
              )}
              {status === 'mounted' && s.phase === 'play' && (
                <HoloButton
                  variant="danger"
                  className="flex-1"
                  icon={Trash2}
                  onClick={() => {
                    d({ t: 'unmount', part: part.id });
                    sound.unsnap();
                  }}
                >
                  REMOVE FROM STACK
                </HoloButton>
              )}
              <HoloButton
                onClick={() => d({ t: 'select', part: null })}
                className={status === 'hidden' || s.phase !== 'play' ? 'flex-1' : ''}
              >
                CLOSE
              </HoloButton>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
