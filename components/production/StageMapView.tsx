'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { Switch } from '@/components/shared/Switch';
import { ChevronRight, Plus, X } from '@/components/shared/Icons';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { drawProp } from '@/lib/production/drawings';
import { FULL_VIEWBOX, PROPS, PROP_ORDER, TABLE, cableRoute, rxOrderOf, zoneViewBox } from '@/lib/production/layout';
import { CABLE_COLOR, StageGraph, ZONES, zoneColor, zoneName } from '@/lib/production/graph';
import type { PackSingerDTO, StageCable, StageDevice, StageMapDTO, StageMapData, ZoneId } from '@/lib/production/types';
import { ConnCard, GearPicture, P16Face, PackList, PillTabs, StageBoxPanel } from './parts';

export type MapHighlight = { cables: string[]; props: string[] } | null;

type Sheet =
  | { kind: 'item'; pid: string; dev: string | null; tab: 'in' | 'out' | null }
  | { kind: 'cable'; id: string; back: Sheet | null }
  | { kind: 'add'; what: 'mic' | 'instrument' }
  | null;

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * The stage map: a top-down drawing of the hotel setup with every cable in its
 * real color. Tap gear for what plugs into it; pick a zone to zoom in and see
 * its setup steps and cables.
 */
export function StageMapView({
  map,
  onMapChange,
  zone,
  onZone,
  highlight,
  onClearHighlight,
  flow,
  onFlow,
  canManage,
  singers,
  onTrace,
}: {
  map: StageMapDTO;
  onMapChange: (data: StageMapData) => void;
  zone: ZoneId | null;
  onZone: (z: ZoneId | null) => void;
  highlight: MapHighlight;
  onClearHighlight: () => void;
  flow: boolean;
  onFlow: (v: boolean) => void;
  canManage: boolean;
  singers: PackSingerDTO[];
  onTrace: (cableId: string) => void;
}) {
  const graph = useMemo(() => new StageGraph(map.data), [map.data]);
  const [sheet, setSheet] = useState<Sheet>(null);

  return (
    <div className="space-y-4">
      <section className="card space-y-2 p-2">
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto p-0.5">
          <ZoneChip active={!zone} color="rgb(var(--ink-faint))" onClick={() => onZone(null)}>Whole stage</ZoneChip>
          {ZONES.map((z) => (
            <ZoneChip key={z.id} active={zone === z.id} color={zoneColor(z.id)} onClick={() => onZone(z.id)}>
              {z.name}
            </ZoneChip>
          ))}
        </div>
        <div className="overflow-hidden rounded-2xl border border-line" style={{ background: 'var(--pd-floor)' }}>
          <MapSvg graph={graph} zone={zone} highlight={highlight} flow={flow} onItem={(pid) => setSheet({ kind: 'item', pid, dev: null, tab: null })} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-1">
          <span className="text-xs text-ink-soft">{highlight ? 'Showing one traced sound.' : 'Tap any piece of gear to see what plugs into it.'}</span>
          <span className="flex items-center gap-3">
            {highlight && (
              <button type="button" onClick={onClearHighlight} className="text-xs font-semibold text-accent-ink underline underline-offset-2 dark:text-accent-on">
                Clear trace
              </button>
            )}
            <span className="flex items-center gap-2 text-xs font-semibold text-ink-soft">
              <Switch checked={flow} onChange={onFlow} aria-label="Signal flow" />
              Signal flow
            </span>
          </span>
        </div>
      </section>

      {zone ? (
        <ZoneDetail
          graph={graph}
          zone={zone}
          flow={flow}
          canManage={canManage}
          singers={singers}
          onClose={() => onZone(null)}
          onCable={(c) => setSheet({ kind: 'cable', id: c.id, back: null })}
          onItem={(pid, dev) => setSheet({ kind: 'item', pid, dev, tab: null })}
          onAdd={(what) => setSheet({ kind: 'add', what })}
          onRemove={async (d) => {
            const { data } = await apiFetch<{ data: StageMapData }>(`/api/production/map/items/${d.id}?mapId=${map.id}`, { method: 'DELETE' });
            onMapChange(data);
          }}
        />
      ) : (
        <section className="card divide-y divide-line overflow-hidden">
          {ZONES.map((z) => {
            const st = graph.zoneStats(z.id);
            return (
              <button key={z.id} type="button" onClick={() => onZone(z.id)} className="row-press flex w-full items-center gap-3 px-4 py-3.5 text-left">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${zoneColor(z.id)} 16%, transparent)` }}>
                  <span className="h-3 w-3 rounded-full" style={{ background: zoneColor(z.id) }} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{z.name}</span>
                  <span className="block text-xs text-ink-faint">
                    {z.blurb} · {st.cables} cable{st.cables === 1 ? '' : 's'}
                    {st.powered ? ` · ${st.powered} to plug in` : ''}
                  </span>
                </span>
                <ChevronRight width={20} height={20} className="shrink-0 text-ink-faint" />
              </button>
            );
          })}
        </section>
      )}

      {sheet?.kind === 'item' && (
        <ItemSheet
          graph={graph}
          sheet={sheet}
          flow={flow}
          singers={singers}
          onChange={setSheet}
          onCable={(c) => setSheet({ kind: 'cable', id: c.id, back: sheet })}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'cable' && (
        <CableSheet
          graph={graph}
          sheet={sheet}
          flow={flow}
          onBack={() => setSheet(sheet.back)}
          onTrace={(id) => {
            setSheet(null);
            onTrace(id);
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'add' && (
        <AddGearSheet
          graph={graph}
          mapId={map.id}
          what={sheet.what}
          onDone={(data) => {
            onMapChange(data);
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}

function ZoneChip({ active, color, onClick, children }: { active: boolean; color: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn('row-press inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold', active ? 'text-ink' : 'border-line bg-surface text-ink-soft')}
      style={active ? { borderColor: color, background: `color-mix(in srgb, ${color} 12%, rgb(var(--surface)))` } : undefined}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {children}
    </button>
  );
}

// ------------------------------------------------------------------ map ----

function MapSvg({ graph, zone, highlight, flow, onItem }: { graph: StageGraph; zone: ZoneId | null; highlight: MapHighlight; flow: boolean; onItem: (pid: string) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const vbRef = useRef<number[]>([...FULL_VIEWBOX]);

  // Glide the view box to the chosen zone (or back out to the whole stage).
  useEffect(() => {
    const target = highlight ? FULL_VIEWBOX : zoneViewBox(zone);
    const from = vbRef.current.slice();
    const apply = (vb: number[]) => {
      vbRef.current = vb;
      svgRef.current?.setAttribute('viewBox', vb.map((n) => n.toFixed(2)).join(' '));
    };
    if (reduceMotion()) return apply([...target]);
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 560);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      apply(from.map((v, i) => v + (target[i] - v) * e));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [zone, highlight]);

  const hlC = highlight ? new Set(highlight.cables) : null;
  const hlP = highlight ? new Set(highlight.props) : null;
  const rxOrder = rxOrderOf(graph.data);
  const cableInZone = (c: StageCable) => (zone === 'stagebox' ? c.from[0] === 'sb' || c.to[0] === 'sb' : c.zone === zone);
  const isOn = (pid: string) => (hlP ? hlP.has(pid) : zone ? PROPS[pid].zone === zone : false);
  const isDim = (pid: string) => (!!hlP || !!zone) && !isOn(pid);
  const animate = flow && !reduceMotion();

  return (
    <svg ref={svgRef} viewBox={FULL_VIEWBOX.join(' ')} className="block aspect-[550/650] h-auto w-full touch-manipulation" role="img" aria-label="Stage map seen from above, crowd to the left, singers below">
      <rect x="280" y="80" width="660" height="760" style={{ fill: 'var(--pd-floor)' }} />
      <rect x="280" y="80" width="660" height="760" fill="url(#pd-dots)" />
      <text x="346" y="453" transform="rotate(-90 346 453)" textAnchor="middle" className="fill-ink-faint text-[11px] font-bold tracking-[0.2em]">← CROWD</text>
      <text x="560" y="770" textAnchor="middle" className="fill-ink-faint text-[11px] font-bold tracking-[0.2em]">SINGERS ↓</text>
      <g aria-hidden>
        <rect x={TABLE.x} y={TABLE.y} width={TABLE.w} height={TABLE.h} rx="4" style={{ fill: 'var(--pd-table)', stroke: 'var(--pd-table-edge)', strokeWidth: 1 }} />
        <rect x={TABLE.x + 4} y={TABLE.y + 4} width={TABLE.w - 8} height={TABLE.h - 8} rx="2" style={{ fill: 'none', stroke: 'var(--pd-table-edge)', strokeWidth: 0.6, opacity: 0.7 }} />
      </g>

      {graph.cables.map((c) => {
        const d = cableRoute(c, rxOrder);
        if (!d) return null;
        const on = hlC ? hlC.has(c.id) : zone ? cableInZone(c) : true;
        return (
          <g key={c.id} style={{ opacity: on ? 1 : 0.1, transition: 'opacity .25s' }}>
            <path className="pd-cab-halo" d={d} />
            <path className="pd-cab" d={d} style={{ stroke: CABLE_COLOR[c.color], strokeWidth: hlC && on ? 3 : 1.9 }} />
            {animate && on && <path className="pd-cab-flow" d={d} />}
          </g>
        );
      })}

      {PROP_ORDER.map((pid) => {
        const p = PROPS[pid];
        const hw = Math.max(p.w + 12, 44);
        const hh = Math.max(p.h + 12, 40);
        return (
          <g
            key={pid}
            className={cn('pd-prop', isOn(pid) && 'pd-on', isDim(pid) && 'pd-dim')}
            transform={`translate(${p.x},${p.y})`}
            style={{ ['--pd-zc' as string]: zoneColor(p.zone) }}
            role="button"
            tabIndex={0}
            aria-label={p.label ?? pid}
            onClick={() => onItem(pid)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onItem(pid))}
          >
            <rect x={-hw / 2} y={-hh / 2} width={hw} height={hh} fill="transparent" />
            <g dangerouslySetInnerHTML={{ __html: drawProp(pid) }} />
          </g>
        );
      })}

      {PROP_ORDER.filter((pid) => PROPS[pid].label).map((pid) => {
        const p = PROPS[pid];
        const label = p.label!;
        const w = label.length * 6.3 + 24;
        return (
          <g
            key={`l-${pid}`}
            className={cn('pd-prop', isDim(pid) && 'pd-dim')}
            transform={`translate(${p.x + (p.lx ?? 0)},${p.y + (p.ly ?? 30)})`}
            onClick={() => onItem(pid)}
            aria-hidden
          >
            <rect x={-w / 2} y={-10.5} width={w} height={21} rx={10.5} className="fill-surface stroke-line" strokeWidth={1} />
            <circle cx={-w / 2 + 10} cy={0} r={3.2} style={{ fill: zoneColor(p.zone) }} />
            <text x={5} y={4} textAnchor="middle" className="fill-ink text-[11.5px] font-semibold">{label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------- zones ----

function ZoneDetail({
  graph,
  zone,
  flow,
  canManage,
  singers,
  onClose,
  onCable,
  onItem,
  onAdd,
  onRemove,
}: {
  graph: StageGraph;
  zone: ZoneId;
  flow: boolean;
  canManage: boolean;
  singers: PackSingerDTO[];
  onClose: () => void;
  onCable: (c: StageCable) => void;
  onItem: (pid: string, dev: string) => void;
  onAdd: (what: 'mic' | 'instrument') => void;
  onRemove: (d: StageDevice) => Promise<void>;
}) {
  const st = graph.zoneStats(zone);
  const devices = graph.data.devices.filter((d) => d.zone === zone && d.kind !== 'mic' && d.kind !== 'packs');
  const cables = graph.cables.filter((c) => c.zone === zone && c.type !== 'Wireless');
  const steps = graph.data.steps[zone] ?? [];
  const note = graph.data.notes[zone];
  const addWhat = zone === 'mics' ? 'mic' : zone === 'instruments' ? 'instrument' : null;
  const color = zoneColor(zone);

  return (
    <section className="card space-y-5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div>
            <p className="eyebrow">Zone</p>
            <h2 className="font-display text-2xl font-semibold">{zoneName(zone)}</h2>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="chip bg-surface-2 text-ink-soft"><span className="h-2 w-2 rounded-full" style={{ background: color }} />{st.cables} cable{st.cables === 1 ? '' : 's'}</span>
            {st.powered > 0 && <span className="chip bg-surface-2 text-ink-soft">{st.powered} to plug in</span>}
            <span className="chip bg-surface-2 text-ink-soft">{st.gear} item{st.gear === 1 ? '' : 's'}</span>
          </div>
        </div>
        <button type="button" onClick={onClose} className="row-press grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-soft" aria-label="Back to the whole stage">
          <X width={18} height={18} />
        </button>
      </div>

      {zone === 'stagebox' && <StageBoxPanel data={graph.data} onCable={onCable} />}
      {zone === 'musician_ears' && <P16Face data={graph.data} />}
      {zone === 'vocal_ears' && <PackList singers={singers} />}

      {steps.length > 0 && (
        <section className="space-y-2.5">
          <p className="eyebrow">How to set it up</p>
          <ol className="space-y-2.5">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-2.5 text-sm">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold tabular-nums" style={{ background: `color-mix(in srgb, ${color} 18%, transparent)` }}>{i + 1}</span>
                <span className="pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
          {note && <p className="rounded-2xl bg-surface-2 px-3 py-2.5 text-[13px] text-ink-soft">{note}</p>}
        </section>
      )}

      {cables.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-baseline justify-between">
            <p className="eyebrow">Every cable</p>
            <p className="text-xs text-ink-faint">Tap one to trace it</p>
          </div>
          {cables.map((c) => <ConnCard key={c.id} graph={graph} cable={c} flow={flow} onClick={() => onCable(c)} />)}
        </section>
      )}

      <section className="space-y-2">
        <p className="eyebrow">Gear</p>
        {devices.map((d) => {
          const pid = d.prop && PROPS[d.prop] ? d.prop : null;
          const body = (
            <>
              <span className="grid h-[52px] w-16 shrink-0 place-items-center overflow-hidden rounded-xl" style={{ background: 'var(--pd-floor)' }}>
                {pid && <GearPicture pid={pid} className="h-full w-full" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{d.name}</span>
                <span className="block text-[13px] text-ink-soft">{[d.model, d.where].filter(Boolean).join(' · ')}</span>
                <GearChips d={d} />
              </span>
            </>
          );
          return (
            <div key={d.id} className="space-y-1.5">
              {pid ? (
                <button type="button" onClick={() => onItem(pid, d.id)} className="card row-press flex w-full items-center gap-3 p-3 text-left">{body}</button>
              ) : (
                <div className="card flex items-center gap-3 p-3">{body}</div>
              )}
              {canManage && d.added && <RemoveButton onRemove={() => onRemove(d)} />}
            </div>
          );
        })}
      </section>

      {canManage && addWhat && (
        <button type="button" onClick={() => onAdd(addWhat)} className="btn-primary w-full">
          <Plus width={18} height={18} /> Add {addWhat === 'mic' ? 'a mic' : 'an instrument'}
        </button>
      )}
    </section>
  );
}

function GearChips({ d }: { d: StageDevice }) {
  const chips = [
    d.power && (d.power === 'Batteries' ? 'Batteries' : `Plug in: ${d.power}`),
    d.packed && `Packed in: ${d.packed}`,
    d.own && 'Player brings it',
    d.gc,
    d.pairs && `Pairs with the ${d.pairs} handheld`,
  ].filter(Boolean) as string[];
  if (!chips.length && !d.added) return null;
  return (
    <span className="mt-1.5 flex flex-wrap gap-1.5">
      {chips.map((c) => <span key={c} className="chip bg-surface-2 font-semibold text-ink-soft">{c}</span>)}
      {d.added && <span className="chip bg-warn/15 text-ink">Added</span>}
    </span>
  );
}

function RemoveButton({ onRemove }: { onRemove: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await onRemove();
        } finally {
          setBusy(false);
        }
      }}
      className="rounded-full border border-line bg-surface-2 px-3 py-1 text-xs font-semibold text-ink-soft"
    >
      {busy ? 'Removing…' : 'Remove from the map'}
    </button>
  );
}

// --------------------------------------------------------------- sheets ----

function ItemSheet({
  graph,
  sheet,
  flow,
  singers,
  onChange,
  onCable,
  onClose,
}: {
  graph: StageGraph;
  sheet: Extract<Sheet, { kind: 'item' }>;
  flow: boolean;
  singers: PackSingerDTO[];
  onChange: (s: Sheet) => void;
  onCable: (c: StageCable) => void;
  onClose: () => void;
}) {
  const p = PROPS[sheet.pid];
  const devs = graph.data.devices.filter((d) => d.prop === sheet.pid);
  if (!devs.length) return null;
  const d = devs.find((x) => x.id === sheet.dev) ?? devs[0];
  const many = devs.length > 1;
  const incoming = graph.cables.filter((c) => c.to[0] === d.id && c.type !== 'Wireless');
  const outgoing = graph.cables.filter((c) => c.from[0] === d.id && c.type !== 'Wireless');
  const wireless = graph.cables.find((c) => c.from[0] === d.id && c.type === 'Wireless');
  const tab = sheet.tab ?? (incoming.length ? 'in' : 'out');
  const list = tab === 'in' ? incoming : outgoing;
  const color = zoneColor(d.zone);
  const isSB = d.id === 'sb';
  const empty =
    tab === 'in'
      ? d.kind === 'rx' ? `Nothing plugs into this by cable. It picks up the ${d.pairs} handheld wirelessly.` : 'Nothing plugs into this.'
      : wireless ? `It sends wirelessly to the ${graph.dev(wireless.to[0]).name.toLowerCase()} on ${d.gc}.` : 'Nothing. This is where the sound ends up.';

  return (
    <Modal
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-line" style={{ background: 'var(--pd-floor)' }}>
            <GearPicture pid={sheet.pid} className="h-full w-full" />
          </span>
          <span className="min-w-0">
            <span className="eyebrow block !text-[10px]" style={{ color }}>{zoneName(d.zone)}</span>
            <span className="block truncate">{many ? p?.label ?? d.name : d.name}</span>
          </span>
        </span>
      }
    >
      <div className="space-y-4">
        {many && (
          <div className="flex flex-wrap gap-1.5">
            {devs.map((x) => (
              <ZoneChip key={x.id} active={x.id === d.id} color={color} onClick={() => onChange({ ...sheet, dev: x.id, tab: null })}>
                {x.short ?? x.name}
              </ZoneChip>
            ))}
          </div>
        )}

        {isSB ? (
          <StageBoxPanel data={graph.data} onCable={onCable} />
        ) : (
          <section className="space-y-2">
            <PillTabs
              size="lg"
              tint={color}
              value={tab}
              onChange={(t) => onChange({ ...sheet, dev: d.id, tab: t })}
              options={[
                { value: 'in', label: 'Plugs Into It', count: incoming.length },
                { value: 'out', label: 'Plugs Into', count: outgoing.length },
              ]}
            />
            {list.length ? (
              list.map((c) => <ConnCard key={c.id} graph={graph} cable={c} flow={flow} onClick={() => onCable(c)} />)
            ) : (
              <p className="rounded-2xl bg-surface-2 px-3 py-2.5 text-[13px] text-ink-soft">{empty}</p>
            )}
          </section>
        )}

        {d.kind === 'p16' && <P16Face data={graph.data} />}
        {d.kind === 'tx' && d.group && <PackList singers={singers} only={d.group} />}

        <section className="space-y-1.5 border-t border-line pt-3">
          <p className="eyebrow">About {many ? d.short ?? d.name : 'it'}</p>
          <p className="text-[13px] text-ink-soft">{[many && d.name, d.model, d.where].filter(Boolean).join(' · ')}</p>
          <GearChips d={d} />
        </section>
      </div>
    </Modal>
  );
}

function CableSheet({
  graph,
  sheet,
  flow,
  onBack,
  onTrace,
  onClose,
}: {
  graph: StageGraph;
  sheet: Extract<Sheet, { kind: 'cable' }>;
  flow: boolean;
  onBack: () => void;
  onTrace: (id: string) => void;
  onClose: () => void;
}) {
  const c = graph.cables.find((x) => x.id === sheet.id);
  if (!c) return null;
  return (
    <Modal
      open
      onClose={onClose}
      title={`${graph.endName(...c.from)} to ${graph.endName(...c.to)}`}
      footer={
        <div className="flex gap-2">
          {!c.noTrace && (
            <button type="button" className="btn-primary flex-1" onClick={() => onTrace(c.id)}>
              Trace this sound
            </button>
          )}
          {sheet.back && (
            <button type="button" className="btn-ghost" onClick={onBack}>
              Back
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-2">
        <p className="eyebrow" style={{ color: zoneColor(c.zone) }}>{zoneName(c.zone)} · cable</p>
        <ConnCard graph={graph} cable={c} flow={flow} />
      </div>
    </Modal>
  );
}

function AddGearSheet({
  graph,
  mapId,
  what,
  onDone,
  onClose,
}: {
  graph: StageGraph;
  mapId: string;
  what: 'mic' | 'instrument';
  onDone: (data: StageMapData) => void;
  onClose: () => void;
}) {
  const open = graph.openInputs();
  const [name, setName] = useState('');
  const [wireless, setWireless] = useState(true);
  const [cableType, setCableType] = useState<'XLR' | 'TS' | 'TRS'>('XLR');
  const [power, setPower] = useState<'' | 'AC adapter' | 'DC adapter'>('');
  const [sbIn, setSbIn] = useState(open[0] ?? 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('Give it a name first.');
    setBusy(true);
    setError(null);
    try {
      const { data } = await apiFetch<{ data: StageMapData }>('/api/production/map/items', {
        method: 'POST',
        body: JSON.stringify({ mapId, kind: what, name: name.trim(), wireless: what === 'mic' ? wireless : undefined, sbIn, cableType: what === 'instrument' ? cableType : undefined, power: what === 'instrument' ? power || null : undefined }),
      });
      onDone(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add it.');
      setBusy(false);
    }
  }

  const field = 'w-full rounded-2xl border border-line bg-surface px-3 py-3 text-[15px]';
  return (
    <Modal open onClose={onClose} title={what === 'mic' ? 'Add a mic' : 'Add an instrument'}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="label">Name</span>
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder={what === 'mic' ? 'Mic 8' : 'Acoustic guitar'} autoFocus />
        </label>
        {what === 'mic' ? (
          <div className="space-y-1.5">
            <span className="label">Kind</span>
            <PillTabs value={wireless ? 'w' : 'c'} onChange={(v) => setWireless(v === 'w')} options={[{ value: 'w', label: 'Wireless handheld' }, { value: 'c', label: 'Wired' }]} />
          </div>
        ) : (
          <>
            <label className="block space-y-1.5">
              <span className="label">Cable</span>
              <select className={field} value={cableType} onChange={(e) => setCableType(e.target.value as 'XLR' | 'TS' | 'TRS')}>
                <option value="XLR">XLR</option>
                <option value="TS">¼″ TS</option>
                <option value="TRS">¼″ TRS</option>
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="label">Power</span>
              <select className={field} value={power} onChange={(e) => setPower(e.target.value as '' | 'AC adapter' | 'DC adapter')}>
                <option value="">Doesn’t need power</option>
                <option>AC adapter</option>
                <option>DC adapter</option>
              </select>
            </label>
          </>
        )}
        <label className="block space-y-1.5">
          <span className="label">Plug into stage box input</span>
          <select className={field} value={sbIn} onChange={(e) => setSbIn(Number(e.target.value))}>
            {open.map((n) => <option key={n} value={n}>Input {n} (open)</option>)}
          </select>
          <span className="block text-xs text-ink-faint">Only open inputs are listed. The DI box is full, so new instruments go straight into the stage box.</span>
        </label>
        {error && <p className="text-sm font-semibold text-bad">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy || !open.length}>
          {busy ? 'Adding…' : 'Add to the map'}
        </button>
      </form>
    </Modal>
  );
}
