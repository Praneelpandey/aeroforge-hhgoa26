/* ============================================================================
 * AEROFORGE — shared HUD primitives (Apple Daylight Studio edition):
 * frosted white glass panels, tactile Teenage-Engineering accent buttons,
 * segmented controls, sparklines, stat chips, styled sliders.
 * ==========================================================================*/

import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { sound } from '../../audio/SoundEngine';

/* ── Glass panel ─────────────────────────────────────────────────────────── */

export function GlassPanel({
  className,
  children,
  strong = false,
}: {
  className?: string;
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className={cn(strong ? 'glass glass-strong' : 'glass', 'spec-border rounded-2xl', className)}>
      {children}
    </div>
  );
}

/* ── Buttons ─────────────────────────────────────────────────────────────── */

type BtnVariant = 'primary' | 'ghost' | 'danger' | 'success' | 'cta';

export function HoloButton({
  children,
  onClick,
  icon: Icon,
  variant = 'ghost',
  className,
  disabled,
  title,
}: {
  children?: React.ReactNode;
  onClick?: () => void;
  icon?: LucideIcon;
  variant?: BtnVariant;
  className?: string;
  disabled?: boolean;
  title?: string;
}) {
  const variants: Record<BtnVariant, string> = {
    primary:
      'bg-[#0071e3] border-[#0071e3] text-white hover:bg-[#0077f0] shadow-[0_6px_16px_-4px_rgba(0,113,227,0.45)]',
    cta:
      'bg-[#ff5500] border-[#ff5500] text-white font-extrabold hover:bg-[#ff660f] shadow-[0_6px_18px_-4px_rgba(255,85,0,0.5)]',
    ghost:
      'bg-white/70 border-slate-900/10 text-slate-700 hover:bg-white hover:border-slate-900/20 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.1)]',
    danger:
      'bg-white/70 border-[#ef4444]/35 text-[#dc2626] hover:bg-[#fef2f2] shadow-[0_2px_8px_-2px_rgba(239,68,68,0.25)]',
    success:
      'bg-[#10b981] border-[#10b981] text-white hover:bg-[#0ea973] shadow-[0_6px_16px_-4px_rgba(16,185,129,0.4)]',
  };
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseEnter={() => sound.uiHover()}
      onClick={() => {
        if (disabled) return;
        sound.uiClick();
        onClick?.();
      }}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2 text-[12px] font-semibold tracking-wide backdrop-blur-xl transition-all duration-150 active:scale-[0.97]',
        variants[variant],
        disabled && 'cursor-not-allowed opacity-40 hover:bg-white/70',
        className,
      )}
    >
      {Icon && <Icon size={14} strokeWidth={2.4} />}
      {children}
    </button>
  );
}

/** Small square icon-only button. */
export function IconButton({
  icon: Icon,
  onClick,
  active = false,
  title,
  className,
  disabled,
}: {
  icon: LucideIcon;
  onClick?: () => void;
  active?: boolean;
  title?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseEnter={() => sound.uiHover()}
      onClick={() => {
        if (disabled) return;
        sound.uiClick();
        onClick?.();
      }}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-xl border backdrop-blur-xl transition-all active:scale-95',
        active
          ? 'border-[#0071e3] bg-[#0071e3] text-white shadow-[0_4px_12px_-2px_rgba(0,113,227,0.5)]'
          : 'border-slate-900/10 bg-white/70 text-slate-500 hover:bg-white hover:text-slate-800',
        disabled && 'cursor-not-allowed opacity-40',
        className,
      )}
    >
      <Icon size={16} strokeWidth={2.2} />
    </button>
  );
}

/* ── Segmented control ───────────────────────────────────────────────────── */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string; icon?: LucideIcon }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-1 rounded-xl border border-slate-900/10 bg-white/70 p-1 backdrop-blur-xl', className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onMouseEnter={() => sound.uiHover()}
            onClick={() => {
              sound.uiClick();
              onChange(o.value);
            }}
            className={cn(
              'relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold tracking-wide transition-all',
              on ? 'text-white' : 'text-slate-500 hover:text-slate-800',
            )}
          >
            {on && (
              <motion.span
                layoutId={undefined}
                className="absolute inset-0 rounded-lg bg-[#0071e3] shadow-[0_3px_10px_-2px_rgba(0,113,227,0.55)]"
              />
            )}
            {o.icon && <o.icon size={13} strokeWidth={2.3} />}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Sparkline ───────────────────────────────────────────────────────────── */

export function Sparkline({
  data,
  color = '#0071e3',
  height = 34,
  width = 120,
  label,
  unit = '',
}: {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
  label?: string;
  unit?: string;
}) {
  const pts = data.length > 1 ? data : [0, ...data];
  const max = Math.max(...pts, 1e-6);
  const min = Math.min(...pts, 0);
  const range = Math.max(max - min, 1e-6);
  const step = width / (pts.length - 1);
  const path = pts
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(height - ((v - min) / range) * (height - 4) - 2).toFixed(1)}`)
    .join(' ');
  const id = `sg-${color.replace('#', '')}`;
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <div className="flex items-baseline justify-between">
          <span className="text-[9px] font-bold tracking-[0.14em] text-slate-400">{label}</span>
          <span className="mono-num text-[10px] font-semibold text-slate-700">
            {pts.length > 0 ? formatNum(pts[pts.length - 1]) : '0'}
            <span className="text-slate-400">{unit}</span>
          </span>
        </div>
      )}
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={`${path} L${width},${height} L0,${height} Z`} fill={`url(#${id})`} stroke="none" />
        <path d={path} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
        <circle
          cx={width}
          cy={height - ((pts[pts.length - 1] - min) / range) * (height - 4) - 2}
          r={2.6}
          fill={color}
        />
      </svg>
    </div>
  );
}

function formatNum(v: number): string {
  if (Math.abs(v) >= 1000) return v.toFixed(0);
  if (Math.abs(v) >= 10) return v.toFixed(1);
  return v.toFixed(2);
}

/* ── Stat readout chip ───────────────────────────────────────────────────── */

export function StatChip({
  label,
  value,
  unit,
  accent = 'blue',
  wide = false,
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: 'blue' | 'orange' | 'green' | 'rose' | 'violet' | 'slate';
  wide?: boolean;
}) {
  const accents: Record<string, string> = {
    blue: 'text-[#0071e3] border-[#0071e3]/25',
    orange: 'text-[#ff5500] border-[#ff5500]/30',
    green: 'text-[#059669] border-[#10b981]/30',
    rose: 'text-[#e11d48] border-[#ef4444]/30',
    violet: 'text-[#7c3aed] border-[#7c3aed]/25',
    slate: 'text-slate-700 border-slate-900/10',
  };
  return (
    <div
      className={cn(
        'flex flex-col gap-0.5 rounded-xl border bg-white/80 px-2.5 py-1.5 backdrop-blur-md',
        accents[accent],
        wide ? 'min-w-[108px]' : 'min-w-[72px]',
      )}
    >
      <span className="text-[8.5px] font-bold tracking-[0.16em] text-slate-400">{label}</span>
      <span className="mono-num text-[15px] font-bold leading-none text-slate-900">
        {value}
        {unit && <span className="ml-0.5 text-[9px] font-semibold text-slate-400">{unit}</span>}
      </span>
    </div>
  );
}

/* ── Styled range slider ─────────────────────────────────────────────────── */

export function HoloSlider({
  value,
  min,
  max,
  step = 1,
  onChange,
  className,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  className?: string;
}) {
  return (
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className={cn('holo-slider', className)}
    />
  );
}

/* ── Status dot ──────────────────────────────────────────────────────────── */

export function StatusDot({ state }: { state: 'hidden' | 'tray' | 'mounted' | 'done' | 'locked' }) {
  const map = {
    hidden: 'bg-slate-300',
    tray: 'bg-[#f59e0b] shadow-[0_0_6px_rgba(245,158,11,0.5)]',
    mounted: 'bg-[#0071e3] shadow-[0_0_6px_rgba(0,113,227,0.45)]',
    done: 'bg-[#10b981] shadow-[0_0_8px_rgba(16,185,129,0.6)]',
    locked: 'bg-[#ef4444]',
  } as const;
  return <span className={cn('inline-block h-2 w-2 shrink-0 rounded-full', map[state])} />;
}

/* ── Section label ───────────────────────────────────────────────────────── */

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('text-[9px] font-bold tracking-[0.22em] text-slate-400', className)}>{children}</div>
  );
}
