'use client';

import { useMemo } from 'react';
import { StageGraph, CABLE_COLOR, CABLE_TYPE_LABEL, prettyPort, zoneColor } from '@/lib/production/graph';
import type { StageCable, StageMapData } from '@/lib/production/types';
import { cn } from '@/lib/utils';

/**
 * "Trace a sound": pick what isn't working and see every box and cable it
 * passes through, in order, with what to check at each one.
 */
export function TraceView({
  data,
  cableId,
  onPick,
  onShowOnMap,
  flow,
}: {
  data: StageMapData;
  cableId: string | null;
  onPick: (id: string | null) => void;
  onShowOnMap: (cable: StageCable) => void;
  flow: boolean;
}) {
  const graph = useMemo(() => new StageGraph(data), [data]);
  const choices = graph.traceChoices();
  const cable = cableId ? graph.cables.find((c) => c.id === cableId) ?? null : null;

  return (
    <section className="card space-y-4 p-4">
      <div>
        <h2 className="font-display text-2xl font-semibold">Trace a sound</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Pick something that isn’t working. You’ll see every cable and box it passes through, in order, and what to check at each one.
        </p>
      </div>
      <label className="block space-y-1.5">
        <span className="label">What isn’t working?</span>
        <select className="w-full rounded-2xl border border-line bg-surface px-3 py-3 text-[15px]" value={cableId ?? ''} onChange={(e) => onPick(e.target.value || null)}>
          <option value="">Choose one…</option>
          <optgroup label="Sound going in (instruments & mics)">
            {choices.ins.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </optgroup>
          <optgroup label="Sound coming out (ears)">
            {choices.outs.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </optgroup>
        </select>
      </label>
      {cable ? <TracePath graph={graph} cable={cable} flow={flow} onShowOnMap={() => onShowOnMap(cable)} /> : (
        <div className="py-6 text-center text-sm text-ink-soft">
          <b className="block text-ink">Nothing picked yet</b>
          You can also tap any cable on the map, then “Trace this sound”.
        </div>
      )}
    </section>
  );
}

function TracePath({ graph, cable, flow, onShowOnMap }: { graph: StageGraph; cable: StageCable; flow: boolean; onShowOnMap: () => void }) {
  const { cables, nodes } = graph.pathThrough(cable);
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  return (
    <div className="space-y-4">
      <ol>
        {first.dev === 'sb' && (
          <>
            <WingNode text="The sound team sends this mix out. If nothing is coming through anywhere, check with them first." />
            <Gap />
          </>
        )}
        {nodes.map((n, i) => {
          const d = graph.dev(n.dev);
          const drum = n.dev === 'drums' && n.out ? graph.drum.get(n.out) : undefined;
          const name = drum ? drum.label : d.name;
          const port = drum ? graph.endSub('drums', n.out!) : n.in && n.out ? `${prettyPort(n.in)} → ${prettyPort(n.out)}` : prettyPort(n.in ?? n.out ?? '');
          const tips = [
            (d.power === 'AC adapter' || d.power === 'DC adapter') && `Is its ${d.power} plugged in?`,
            d.power === 'Batteries' && 'Check the batteries.',
            d.gc && `Should be on ${d.gc}.`,
          ].filter(Boolean);
          return (
            <li key={i}>
              <div className="flex items-start gap-3">
                <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full border-2 text-xs font-bold tabular-nums" style={{ borderColor: zoneColor(d.zone), background: `color-mix(in srgb, ${zoneColor(d.zone)} 18%, transparent)` }}>
                  {i + 1}
                </span>
                <span className="grid gap-0.5 pt-1">
                  <b className="text-[15px]">{name}</b>
                  <span className="text-[13px] text-ink-soft">{[port, ...tips].join(' · ')}</span>
                </span>
              </div>
              {i < cables.length && <CableStep cable={cables[i]} flow={flow} />}
            </li>
          );
        })}
        {last.dev === 'sb' && (
          <>
            <Gap />
            <WingNode text="From here the sound team takes it." />
          </>
        )}
      </ol>
      <button type="button" className="btn-ghost w-full" onClick={onShowOnMap}>
        Show it on the stage map
      </button>
    </div>
  );
}

function CableStep({ cable, flow }: { cable: StageCable; flow: boolean }) {
  if (cable.type === 'Wireless') {
    return (
      <div className="flex min-h-[46px] gap-3">
        <span className="ml-[13.5px] w-0 border-l-[3px] border-dashed border-ink-faint" />
        <span className="ml-[13px] self-center text-[12.5px] font-semibold text-ink-soft">Wireless</span>
      </div>
    );
  }
  const col = CABLE_COLOR[cable.color];
  return (
    <div className="flex min-h-[46px] gap-3">
      <span className={cn('relative my-1 ml-3 w-1.5 overflow-hidden rounded-full', flow && 'pd-flow-v')} style={{ background: col, boxShadow: '0 0 0 1.5px var(--pd-cable-halo)' }} />
      <span className="ml-3 flex items-center gap-1.5 self-center text-[12.5px] font-semibold text-ink-soft">
        <span className="inline-block h-[11px] w-[11px] rounded-[3px] ring-1 ring-line" style={{ background: col }} />
        {CABLE_TYPE_LABEL[cable.type]} · {cable.color}
        {cable.note ? ` · ${cable.note}` : ''}
      </span>
    </div>
  );
}

function Gap() {
  return <div className="ml-[13.5px] h-6 w-0 border-l-[3px] border-dotted border-ink-faint" aria-hidden />;
}

function WingNode({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full border-2 border-dashed border-ink-faint bg-surface-2 text-xs font-bold">W</span>
      <span className="grid gap-0.5 pt-1">
        <b className="text-[15px]">The Wing</b>
        <span className="text-[13px] text-ink-soft">{text}</span>
      </span>
    </div>
  );
}
