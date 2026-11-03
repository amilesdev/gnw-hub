'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from '@/components/shared/Icons';
import { formatEventDate, formatTimeLabel } from '@/lib/dates';
import { eventTypeLabel } from '@/components/shared/EventTypeBadge';
import { StageGraph } from '@/lib/production/graph';
import { PROPS } from '@/lib/production/layout';
import type { ProductionScreenData } from '@/lib/production/server';
import type { StageCable, StageMapData, ZoneId } from '@/lib/production/types';
import type { EventType } from '@prisma/client';
import { ProductionDefs, PillTabs } from './parts';
import { StageMapView, type MapHighlight } from './StageMapView';
import { ChecklistView } from './ChecklistView';
import { TraceView } from './TraceView';

export type ProductionTab = 'map' | 'checklist' | 'trace';

/**
 * Production: the stage map (how everything connects), the event's setup
 * checklist, and a signal tracer. Opened from an event, the Home card, or a
 * reminder push.
 */
export function ProductionScreen({
  initial,
  base,
  meId,
  canManage,
  initialTab,
}: {
  initial: ProductionScreenData;
  base: '/home' | '/dashboard';
  meId: string;
  canManage: boolean;
  initialTab: ProductionTab;
}) {
  const router = useRouter();
  const { event, events, people, singers } = initial;
  const [map, setMap] = useState(initial.map);
  const [tasks, setTasks] = useState(initial.tasks);
  const [templates, setTemplates] = useState(initial.templates);
  // "Other" events are checklist-only, so they open there.
  const [tab, setTab] = useState<ProductionTab>(map ? initialTab : 'checklist');
  const [zone, setZone] = useState<ZoneId | null>(null);
  const [traceId, setTraceId] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<MapHighlight>(null);
  const [flow, setFlow] = useState(true);

  const eventLabel = event ? `${eventTypeLabel(event.type as EventType)} · ${formatEventDate(new Date(event.date))}` : '';

  function showOnMap(c: StageCable) {
    if (!map) return;
    const graph = new StageGraph(map.data);
    const path = graph.pathThrough(c);
    const props = [...new Set(path.nodes.map((n) => graph.dev(n.dev).prop).filter((p): p is string => !!p && !!PROPS[p]))];
    setHighlight({ cables: path.cables.map((x) => x.id), props });
    setZone(null);
    setTab('map');
  }

  const tabs: { value: ProductionTab; label: string }[] = [
    ...(map ? [{ value: 'map' as const, label: 'Stage map' }] : []),
    { value: 'checklist', label: 'Checklist' },
    ...(map ? [{ value: 'trace' as const, label: 'Trace a sound' }] : []),
  ];

  return (
    <div className="space-y-4 pb-6 pt-2">
      <ProductionDefs />
      <header className="pr-12">
        <Link href={`${base}/events`} className="row-press mb-2 -ml-1 grid h-9 w-9 place-items-center rounded-xl bg-surface-2 text-ink-soft" aria-label="Back to Events">
          <ChevronLeft width={18} height={18} />
        </Link>
        <p className="eyebrow">Production</p>
        <h1 className="page-title mt-2">{event?.eventName ?? 'Production'}</h1>
        {event && (
          <p className="mt-2 text-sm text-ink-soft">
            {formatEventDate(new Date(event.date))} · {formatTimeLabel(event.time)}
            {map ? ` · ${map.venue} setup` : ''}
          </p>
        )}
      </header>

      {events.length > 1 && (
        <label className="block">
          <span className="sr-only">Event</span>
          <select
            className="w-full rounded-2xl border border-line bg-surface px-3 py-2.5 text-sm font-semibold"
            value={event?.id ?? ''}
            onChange={(e) => router.push(`${base}/production?event=${e.target.value}&tab=${tab}`)}
          >
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.eventName} · {formatEventDate(new Date(e.date))}
              </option>
            ))}
          </select>
        </label>
      )}

      {tabs.length > 1 && <PillTabs value={tab} onChange={setTab} options={tabs} />}

      {tab === 'map' && map && (
        <StageMapView
          map={map}
          onMapChange={(data: StageMapData) => setMap({ ...map, data })}
          zone={zone}
          onZone={(z) => {
            setZone(z);
            setHighlight(null);
          }}
          highlight={highlight}
          onClearHighlight={() => setHighlight(null)}
          flow={flow}
          onFlow={setFlow}
          canManage={canManage}
          singers={singers}
          onTrace={(id) => {
            setTraceId(id);
            setTab('trace');
          }}
        />
      )}

      {tab === 'checklist' &&
        (event ? (
          <ChecklistView
            key={event.id}
            eventId={event.id}
            eventLabel={eventLabel}
            tasks={tasks}
            onTasks={setTasks}
            people={people}
            meId={meId}
            canManage={canManage}
            templates={templates}
            onTemplates={setTemplates}
            hasMap={!!map}
            onMapZone={(z) => {
              setZone(z);
              setHighlight(null);
              setTab('map');
            }}
          />
        ) : (
          <p className="card p-6 text-center text-sm text-ink-soft">No upcoming services or events need a checklist yet.</p>
        ))}

      {tab === 'trace' && map && <TraceView data={map.data} cableId={traceId} onPick={setTraceId} onShowOnMap={showOnMap} flow={flow} />}
    </div>
  );
}
