/* ============================================================================
 * AEROFORGE — Top navigation (Daylight Studio): level selector, viewport
 * mode switcher, X-Ray vision, exploded-view slider, voice / audio / frame.
 * ==========================================================================*/

import { Boxes, Camera, Cog, Layers, Mic, MicOff, Radar, Rocket, ScanLine, TabletSmartphone, Volume2, VolumeX } from 'lucide-react';
import { MACHINE_ORDER, machineById } from '../../data/machinesData';
import { useGame } from '../../state/gameStore';
import { sound } from '../../audio/SoundEngine';
import { cn } from '../../lib/utils';
import { HoloSlider, IconButton, Segmented } from './shared';

export function TopNavAndModes() {
  const { s, d } = useGame();

  const levelIcons: Record<string, typeof Rocket> = {
    rocket: Rocket,
    v8: Cog,
    drone: Radar,
  };

  return (
    <div className="pointer-events-auto absolute left-0 right-0 top-0 z-30 flex items-center justify-between gap-3 px-3 py-2.5">
      {/* ── brand ── */}
      <div className="glass spec-border flex items-center gap-3 rounded-2xl px-3 py-2">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-[#0f172a] shadow-[0_4px_12px_-2px_rgba(15,23,42,0.35)]">
          <Rocket size={18} className="text-white" strokeWidth={2.4} />
        </div>
        <div className="leading-tight">
          <div className="text-[13px] font-extrabold tracking-[0.16em] text-slate-900">AEROFORGE</div>
          <div className="text-[8.5px] font-semibold tracking-[0.24em] text-[#0071e3]">
            HOW IT WORKS · SPATIAL LAB
          </div>
        </div>
      </div>

      {/* ── level selector ── */}
      <div className="glass spec-border hidden items-center gap-1 rounded-2xl px-2 py-1.5 md:flex">
        {MACHINE_ORDER.map((id) => {
          const def = machineById(id);
          const Icon = levelIcons[id];
          const active = s.level === id;
          return (
            <button
              key={id}
              type="button"
              onMouseEnter={() => sound.uiHover()}
              onClick={() => {
                sound.uiClick();
                d({ t: 'level', level: id });
                sound.speak(`${def.codename}. ${def.name}.`);
              }}
              className={cn(
                'group flex items-center gap-2 rounded-xl border px-3 py-1.5 transition-all',
                active
                  ? 'border-[#0071e3] bg-[#0071e3]/10 shadow-[0_3px_10px_-3px_rgba(0,113,227,0.4)]'
                  : 'border-transparent hover:bg-slate-900/[0.04]',
              )}
            >
              <Icon size={15} strokeWidth={2.3} className={active ? 'text-[#0071e3]' : 'text-slate-400'} />
              <span className="flex flex-col items-start leading-none">
                <span className="text-[8px] font-bold tracking-[0.2em] text-slate-400">
                  {def.codename}
                </span>
                <span className={cn('text-[11px] font-semibold', active ? 'text-slate-900' : 'text-slate-600')}>
                  {def.subtitle.split(' ')[0]}
                </span>
              </span>
              {s.solved[id] && (
                <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-[#10b981] shadow-[0_0_6px_rgba(16,185,129,0.7)]" />
              )}
            </button>
          );
        })}
      </div>

      {/* ── viewport modes + tools ── */}
      <div className="flex items-center gap-2">
        <Segmented
          value={s.viewMode}
          onChange={(v) => {
            d({ t: 'view', view: v });
            if (v === 'cad') d({ t: 'toast', text: 'CAD STUDIO — turntable + exploded view slider active', kind: 'info' });
          }}
          options={[
            { value: 'room', label: 'ROOM', icon: Boxes },
            { value: 'ar', label: 'AR', icon: Camera },
            { value: 'cad', label: 'CAD', icon: Layers },
          ]}
        />

        <div className="glass spec-border flex items-center gap-2 rounded-2xl px-3 py-1.5">
          <IconButton
            icon={ScanLine}
            active={s.xray}
            title="X-Ray Cutaway Vision  [X]"
            onClick={() => {
              d({ t: 'xray' });
              sound.speak(s.xray ? 'X-ray vision disabled.' : 'X-ray cutaway vision engaged.');
            }}
          />
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between gap-2 text-[8px] font-bold tracking-[0.16em] text-slate-400">
              <span className="flex items-center gap-1">
                <Layers size={9} /> EXPLODE
              </span>
              <span className="mono-num text-[#0071e3]">{Math.round(s.exploded * 100)}%</span>
            </div>
            <HoloSlider
              value={s.exploded * 100}
              min={0}
              max={100}
              step={1}
              onChange={(v) => d({ t: 'exploded', v: v / 100 })}
              className="w-[86px]"
            />
          </div>
        </div>

        <div className="glass spec-border flex items-center gap-1 rounded-2xl px-2 py-1.5">
          <IconButton
            icon={s.voiceOn ? Mic : MicOff}
            active={s.voiceOn}
            title="AI Mission Control voice"
            onClick={() => d({ t: 'voice' })}
          />
          <IconButton
            icon={s.muted ? VolumeX : Volume2}
            active={!s.muted}
            title="Procedural audio [M]"
            onClick={() => {
              d({ t: 'muted' });
            }}
          />
          <IconButton
            icon={TabletSmartphone}
            active={s.wwdcFrame}
            title="WWDC Playground frame"
            onClick={() => d({ t: 'wwdc' })}
          />
        </div>
      </div>
    </div>
  );
}
