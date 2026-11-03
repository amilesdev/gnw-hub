'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Avatar } from '@/components/shared/Avatar';
import { cn } from '@/lib/utils';
import { drawPlug, drawProp, propViewBox } from '@/lib/production/drawings';
import { CABLE_COLOR, CABLE_TYPE_LABEL, PACK_LABEL, StageGraph, zoneColor } from '@/lib/production/graph';
import type { PackGroup, PackSingerDTO, StageCable, StageMapData } from '@/lib/production/types';

// Building blocks shared by the stage map, its sheets and the checklist.

/** The shared SVG <defs> every drawing references (key pattern, drop shadow, floor dots). Render once per screen. */
export function ProductionDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden focusable="false">
      <defs>
        {/* One octave, 3 units per white key; black keys toward the back (away from the player). */}
        <pattern id="pd-kbr" width="21" height="18" patternUnits="userSpaceOnUse">
          <rect width="21" height="18" style={{ fill: 'var(--pd-key-white)' }} />
          <g style={{ fill: 'var(--pd-key-black)' }}>
            {[2.9, 5.9, 8.9, 11.9, 14.9, 17.9, 20.65].map((x) => <rect key={x} x={x} width=".35" height="18" opacity=".35" />)}
            {[1.9, 4.9, 10.9, 13.9, 16.9].map((x) => <rect key={x} x={x} y="7.5" width="1.9" height="10.5" rx=".4" />)}
          </g>
        </pattern>
        <pattern id="pd-dots" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="10" cy="10" r="1" style={{ fill: 'var(--pd-grid)' }} />
        </pattern>
        <filter id="pd-sh" x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="2.2" stdDeviation="2.2" style={{ floodColor: 'var(--pd-drop)' }} floodOpacity="1" />
        </filter>
      </defs>
    </svg>
  );
}

/** One piece of gear drawn on its own (thumbnails, sheet headers). */
export function GearPicture({ pid, className }: { pid: string; className?: string }) {
  return <svg viewBox={propViewBox(pid)} className={className} aria-hidden dangerouslySetInnerHTML={{ __html: drawProp(pid) }} />;
}

function cableArtMarkup(c: StageCable, flow: boolean): string {
  const W = 320;
  const y = 17;
  if (c.type === 'Wireless') {
    return `<path d="M20,${y} H${W - 20}" style="stroke: rgb(var(--ink-faint)); stroke-width: 2; stroke-dasharray: 3 5; fill: none"/>
      <g transform="translate(${W / 2},${y})" style="stroke: rgb(var(--ink-faint)); stroke-width: 1.8; fill: none; stroke-linecap: round">
      <path d="M-6,-6 a9,9 0 0 0 0,12"/><path d="M6,-6 a9,9 0 0 1 0,12"/><path d="M-11,-10 a15,15 0 0 0 0,20"/><path d="M11,-10 a15,15 0 0 1 0,20"/></g>`;
  }
  const col = CABLE_COLOR[c.color] ?? CABLE_COLOR.black;
  const left = c.type === 'XLRP' ? 'XLR' : c.type;
  const right = c.type === 'XLRP' ? 'TS' : c.type;
  const L = 36;
  const R = W - 36;
  const d = `M${L},${y} C${L + 70},${y + 9} ${R - 70},${y + 9} ${R},${y}`;
  const join = c.type === 'XLRP'
    ? `<g transform="translate(${W / 2},${y + 6.8})"><rect x="-11" y="-6" width="22" height="12" rx="3" style="fill: ${col}; stroke: var(--pd-cable-halo); stroke-width: 1"/><rect x="-2" y="-6" width="4" height="12" style="fill: var(--pd-silver)"/></g>`
    : '';
  return `<path d="${d}" style="fill: none; stroke: var(--pd-cable-halo); stroke-width: 6; stroke-linecap: round"/>
    <path d="${d}" style="fill: none; stroke: ${col}; stroke-width: 3.6; stroke-linecap: round"/>
    ${flow ? `<path class="pd-cab-flow" d="${d}" style="stroke-width: 2; stroke-dasharray: .1 12"/>` : ''}${join}
    <g transform="translate(${L},${y}) scale(-1,1)">${drawPlug(left, col)}</g><g transform="translate(${R},${y})">${drawPlug(right, col)}</g>`;
}

/**
 * One real cable, end to end: both ends named, the cable drawn with its actual
 * plugs and color, and the same thing written out as a sentence.
 */
export function ConnCard({ graph, cable, flow, onClick }: { graph: StageGraph; cable: StageCable; flow: boolean; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cn('card block w-full space-y-1 p-3 text-left', onClick && 'row-press')}
    >
      <span className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
        <span className="min-w-0">
          <span className="block break-words text-sm font-bold">{graph.endName(...cable.from)}</span>
          <span className="block text-xs font-semibold text-ink-soft">{graph.endSub(...cable.from)}</span>
        </span>
        <span className="pb-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-faint">to</span>
        <span className="min-w-0 text-right">
          <span className="block break-words text-sm font-bold">{graph.endName(...cable.to)}</span>
          <span className="block text-xs font-semibold text-ink-soft">{graph.endSub(...cable.to)}</span>
        </span>
      </span>
      <svg viewBox="0 0 320 34" className="block h-[34px] w-full" aria-hidden dangerouslySetInnerHTML={{ __html: cableArtMarkup(cable, flow) }} />
      <span className="block text-[13px] leading-snug text-ink-soft">
        {graph.sentence(cable).map((p, i) => (p.bold ? <b key={i} className="font-semibold text-ink">{p.text}</b> : <span key={i}>{p.text}</span>))}
        {cable.note ? ` ${cable.note}.` : ''}
        {cable.added && <span className="ml-1 text-xs font-bold text-warn">Added</span>}
      </span>
    </Tag>
  );
}

export function CableSwatch({ color }: { color: string }) {
  return <span className="inline-block h-[11px] w-[11px] rounded-[3px] ring-1 ring-line" style={{ background: CABLE_COLOR[color] ?? CABLE_COLOR.black }} />;
}

export function cableLabel(c: StageCable) {
  return `${CABLE_TYPE_LABEL[c.type]}${c.type === 'Wireless' ? '' : ` · ${c.color}`}`;
}

/** The S32's front panel: every input and output, colored by the zone that uses it. */
export function StageBoxPanel({ data, onCable }: { data: StageMapData; onCable: (c: StageCable) => void }) {
  const ins: Record<number, StageCable> = {};
  const outs: Record<number, StageCable> = {};
  let ultra: StageCable | null = null;
  for (const c of data.cables) {
    if (c.to[0] === 'sb') ins[Number(c.to[1].slice(3))] = c;
    if (c.from[0] === 'sb') {
      if (c.from[1] === 'Ultranet') ultra = c;
      else outs[Number(c.from[1].slice(4))] = c;
    }
  }
  const jack = (n: number, c?: StageCable) =>
    c ? (
      <button
        key={n}
        type="button"
        onClick={() => onCable(c)}
        className="grid min-w-0 justify-items-center gap-0.5 rounded-[10px] px-px pb-1 pt-1.5 text-white transition active:scale-95"
        style={{ background: `color-mix(in srgb, ${zoneColor(c.zone)} 32%, transparent)` } as CSSProperties}
        aria-label={`${n}: ${c.label ?? ''}`}
      >
        <span className="h-4 w-4 rounded-full border-2" style={{ background: zoneColor(c.zone), borderColor: 'var(--pd-silver)' }} />
        <b className="text-[11px] tabular-nums">{n}</b>
        <small className="line-clamp-2 min-h-[2.2em] break-all text-center text-[8.5px] leading-[1.1]">{c.label}</small>
      </button>
    ) : (
      <div key={n} className="grid min-w-0 justify-items-center gap-0.5 rounded-[10px] bg-white/5 px-px pb-1 pt-1.5" style={{ color: 'var(--pd-silver)' }}>
        <span className="h-4 w-4 rounded-full border-2 bg-black" style={{ borderColor: 'var(--pd-silver-dark)' }} />
        <b className="text-[11px] tabular-nums">{n}</b>
        <small className="min-h-[2.2em] text-[8.5px] leading-[1.1]">open</small>
      </div>
    );
  const label = 'flex justify-between text-[11px] font-bold uppercase tracking-[0.1em]';
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <p className="eyebrow">Front panel</p>
        <p className="text-xs text-ink-faint">Tap a jack</p>
      </div>
      <div className="grid gap-2.5 rounded-2xl p-3" style={{ background: 'var(--pd-metal-dark)' }}>
        <div className={label} style={{ color: 'var(--pd-silver)' }}><span>Inputs</span><span>Behringer S32</span></div>
        <div className="grid grid-cols-8 gap-[5px]">{Array.from({ length: 32 }, (_, i) => jack(i + 1, ins[i + 1]))}</div>
        <div className={label} style={{ color: 'var(--pd-silver)' }}><span>Outputs</span></div>
        <div className="grid grid-cols-8 gap-[5px]">{Array.from({ length: 16 }, (_, i) => jack(i + 1, outs[i + 1]))}</div>
        {ultra && (
          <button
            type="button"
            onClick={() => onCable(ultra!)}
            className="flex w-fit items-center gap-2 rounded-[10px] px-3 py-1.5 text-[11px] font-semibold text-white"
            style={{ background: `color-mix(in srgb, ${zoneColor('musician_ears')} 32%, transparent)` }}
          >
            <span className="h-3.5 w-3.5 rounded-full border-2" style={{ background: zoneColor('musician_ears'), borderColor: 'var(--pd-silver)' }} />
            Ultranet → P16 hub
          </button>
        )}
      </div>
      <p className="text-xs text-ink-faint">Each jack takes the color of the zone it belongs to.</p>
    </section>
  );
}

/** What each P16 channel carries — the same on every P16. Always a dark device face. */
export function P16Face({ data }: { data: StageMapData }) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <p className="eyebrow">P16 channels</p>
        <p className="text-xs text-ink-faint">Same on every P16</p>
      </div>
      <div className="grid gap-2 rounded-2xl bg-[#232227] p-3">
        <div className="flex justify-between text-[11px] font-bold uppercase tracking-[0.1em] text-[#C9CCD3]">
          <span>Channel</span>
          <span>What you hear</span>
        </div>
        <div className="grid grid-cols-8 gap-[5px]">
          {data.p16Channels.map((c) => (
            <div
              key={c.ch}
              className={cn('grid min-w-0 content-start justify-items-center gap-1 rounded-[9px] px-0.5 py-1.5 text-center text-[#F4F2EE]', c.span === 2 && 'col-span-2')}
              style={{ background: `color-mix(in srgb, ${c.color} 26%, #2E2D33)` }}
            >
              <span className="h-1 w-[70%] rounded-sm" style={{ background: c.color, boxShadow: `0 0 6px ${c.color}` }} />
              <b className="text-[10px] tabular-nums opacity-75">{c.ch}</b>
              <span className="break-words text-[9.5px] font-bold leading-[1.15]">{c.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Who takes which in-ear pack this Sunday (Lead = leading a song). */
export function PackList({ singers, only, footer }: { singers: PackSingerDTO[]; only?: PackGroup; footer?: ReactNode }) {
  const list = only ? singers.filter((s) => s.group === only) : singers;
  const count = (g: PackGroup) => singers.filter((s) => s.group === g).length;
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <p className="eyebrow">{only ? 'Who takes this pack' : 'Who takes which pack'}</p>
        <p className="text-xs text-ink-faint">Pack labels coming soon</p>
      </div>
      {!only && singers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="chip bg-surface-2 text-ink-soft">{count('lead')} Lead</span>
          <span className="chip bg-surface-2 text-ink-soft">{count('bgv')} BGV</span>
        </div>
      )}
      {list.length === 0 ? (
        <p className="rounded-2xl bg-surface-2 px-3 py-2.5 text-sm text-ink-soft">
          {singers.length === 0 ? 'Nobody is assigned to sing yet. Assignments and song leads on the event fill this in.' : 'Nobody on this pack this Sunday.'}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {list.map((s) => (
            <li key={s.userId} className="flex items-center gap-2.5 rounded-2xl border border-line px-2.5 py-2">
              <Avatar image={s.image} alt={s.name} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-bold text-ink-soft">
                {s.name.slice(0, 1).toUpperCase()}
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{s.name}</span>
                <span className="block truncate text-xs text-ink-soft">
                  {[s.part, s.leads.length ? `leading ${s.leads.map((t) => `“${t}”`).join(', ')}` : 'not leading a song'].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span
                className="grid shrink-0 justify-items-center rounded-xl px-2.5 py-1 text-xs font-bold leading-tight"
                style={{ background: `color-mix(in srgb, ${zoneColor('vocal_ears')} 16%, transparent)` }}
              >
                {PACK_LABEL[s.group][0]}
                <small className="text-[10px] font-semibold text-ink-soft">{PACK_LABEL[s.group][1]}</small>
              </span>
            </li>
          ))}
        </ul>
      )}
      {footer}
    </section>
  );
}

/** Larger pill tabs used for "Plugs Into It / Plugs Into" and the checklist filters. */
export function PillTabs<T extends string>({
  options,
  value,
  onChange,
  tint,
  size = 'md',
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  tint?: string;
  size?: 'md' | 'lg';
}) {
  return (
    <div className="flex gap-1 rounded-2xl bg-surface-2 p-1" role="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-xl font-semibold transition active:scale-[0.97]',
              size === 'lg' ? 'py-2.5 text-[15px] font-bold' : 'py-2 text-sm',
              active ? 'bg-surface text-ink shadow-card' : 'text-ink-soft',
            )}
            style={active && tint ? { boxShadow: `inset 0 0 0 1.5px ${tint}`, background: `color-mix(in srgb, ${tint} 14%, rgb(var(--surface)))` } : undefined}
          >
            {o.label}
            {o.count !== undefined && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-surface px-1 text-xs font-bold tabular-nums text-ink-soft">{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
