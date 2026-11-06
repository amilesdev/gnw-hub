'use client';

import { useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { Avatar } from '@/components/shared/Avatar';
import { Check, Plus, Trash } from '@/components/shared/Icons';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { ZONES, ZONE_IDS, zoneColor, zoneName } from '@/lib/production/graph';
import type { PersonDTO, ProductionTaskDTO, TemplateDTO, ZoneId } from '@/lib/production/types';
import { PillTabs } from './parts';

type Filter = 'all' | 'mine' | 'open' | 'none';
type Sheet = { kind: 'task'; id: string } | { kind: 'add' } | { kind: 'templates'; tpl: TemplateDTO['kind'] } | null;

const GROUP_ORDER: (string | null)[] = [...ZONE_IDS, null];
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });

/**
 * One event's production checklist, grouped by zone. Members check off their
 * own tasks; leaders can check off anything, assign owners, add one-off tasks
 * and edit the templates. Owners carry forward from the previous event.
 */
export function ChecklistView({
  eventId,
  eventLabel,
  tasks,
  onTasks,
  people,
  meId,
  canManage,
  templates,
  onTemplates,
  hasMap,
  onMapZone,
}: {
  eventId: string;
  eventLabel: string;
  tasks: ProductionTaskDTO[];
  onTasks: (t: ProductionTaskDTO[]) => void;
  people: PersonDTO[];
  meId: string;
  canManage: boolean;
  templates: TemplateDTO[] | null;
  onTemplates: (t: TemplateDTO[]) => void;
  hasMap: boolean;
  onMapZone: (z: ZoneId) => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [sheet, setSheet] = useState<Sheet>(null);
  const [error, setError] = useState<string | null>(null);

  const done = tasks.filter((t) => t.doneAt).length;
  const mine = tasks.filter((t) => t.ownerId === meId);
  const noOwner = tasks.filter((t) => !t.ownerId).length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const shown = tasks.filter((t) => filter === 'all' || (filter === 'mine' && t.ownerId === meId) || (filter === 'open' && !t.doneAt) || (filter === 'none' && !t.ownerId));
  const canCheck = (t: ProductionTaskDTO) => canManage || t.ownerId === meId;

  async function patch(t: ProductionTaskDTO, body: { done?: boolean; ownerId?: string | null }, optimistic: Partial<ProductionTaskDTO>) {
    setError(null);
    const before = tasks;
    onTasks(tasks.map((x) => (x.id === t.id ? { ...x, ...optimistic } : x)));
    try {
      const { task } = await apiFetch<{ task: ProductionTaskDTO }>(`/api/production/tasks/${t.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      onTasks(before.map((x) => (x.id === task.id ? task : x)));
    } catch (err) {
      onTasks(before);
      setError(err instanceof Error ? err.message : 'Could not save that.');
    }
  }
  const toggle = (t: ProductionTaskDTO) => {
    if (!canCheck(t)) return;
    const me = people.find((p) => p.id === meId);
    patch(t, { done: !t.doneAt }, t.doneAt ? { doneAt: null, doneByName: null } : { doneAt: new Date().toISOString(), doneByName: me?.name ?? 'You' });
  };
  const assign = (t: ProductionTaskDTO, ownerId: string | null) =>
    patch(t, { ownerId }, { ownerId, ownerName: people.find((p) => p.id === ownerId)?.name ?? null });

  const filters: { value: Filter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'mine', label: 'Mine' },
    { value: 'open', label: 'Not done' },
    ...(canManage ? [{ value: 'none' as Filter, label: 'No owner' }] : []),
  ];
  const openTask = sheet?.kind === 'task' ? tasks.find((t) => t.id === sheet.id) : undefined;

  return (
    <section className="card space-y-4 p-4">
      <div className="space-y-2">
        <p className="eyebrow">Production checklist</p>
        <h2 className="font-display text-2xl font-semibold">{eventLabel}</h2>
        <div className="h-2.5 overflow-hidden rounded-full border border-line bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <span className="block h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm tabular-nums">
          <b>{done} of {tasks.length} done</b>
          <span className="flex flex-wrap gap-1.5">
            {mine.length > 0 && <span className="chip bg-surface-2 text-ink-soft">{mine.length} yours</span>}
            {canManage && noOwner > 0 && <span className="chip bg-warn/15 text-ink">{noOwner} need an owner</span>}
          </span>
        </div>
      </div>

      <p className="rounded-2xl bg-surface-2 px-3 py-2.5 text-[13px] text-ink-soft">
        {canManage
          ? 'Owners carry over from the last event of this type. Tap any task to change its owner. Each owner gets a reminder 30 minutes before the event starts.'
          : 'Check off your own tasks as you finish them. You’ll get a reminder 30 minutes before the event starts.'}
      </p>

      <PillTabs value={filter} onChange={setFilter} options={filters} />
      {error && <p className="text-sm font-semibold text-bad-ink">{error}</p>}

      {shown.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-soft">
          {tasks.length === 0 ? 'No tasks yet.' : filter === 'mine' ? 'Nothing is assigned to you on this event.' : 'Everything in this view is done.'}
        </p>
      ) : (
        GROUP_ORDER.map((g) => {
          const inView = shown.filter((t) => (t.zone ?? null) === g);
          if (!inView.length) return null;
          const all = tasks.filter((t) => (t.zone ?? null) === g);
          return (
            <div key={g ?? 'general'} className="space-y-1.5">
              <div className="flex items-center gap-2 px-0.5 py-1">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: zoneColor(g) }} />
                <b className="text-sm">{zoneName(g)}</b>
                <span className="text-xs tabular-nums text-ink-faint">{all.filter((t) => t.doneAt).length}/{all.length}</span>
                {g && hasMap && (
                  <button type="button" onClick={() => onMapZone(g as ZoneId)} className="ml-auto text-xs font-semibold text-accent-ink underline underline-offset-2">
                    On the map
                  </button>
                )}
              </div>
              {inView.map((t) => (
                <TaskRow key={t.id} task={t} people={people} canCheck={canCheck(t)} onToggle={() => toggle(t)} onOpen={() => setSheet({ kind: 'task', id: t.id })} />
              ))}
            </div>
          );
        })
      )}

      {canManage && (
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" className="btn-primary flex-1" onClick={() => setSheet({ kind: 'add' })}>
            <Plus width={18} height={18} /> Add a task for this event
          </button>
          {templates && (
            <button type="button" className="btn-ghost" onClick={() => setSheet({ kind: 'templates', tpl: 'service' })}>
              Edit templates
            </button>
          )}
        </div>
      )}

      {openTask && (
        <TaskSheet
          task={openTask}
          people={people}
          meId={meId}
          canManage={canManage}
          canCheck={canCheck(openTask)}
          hasMap={hasMap}
          onToggle={() => toggle(openTask)}
          onAssign={(id) => assign(openTask, id)}
          onMap={(z) => {
            setSheet(null);
            onMapZone(z);
          }}
          onRemove={async () => {
            await apiFetch(`/api/production/tasks/${openTask.id}`, { method: 'DELETE' });
            onTasks(tasks.filter((t) => t.id !== openTask.id));
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'add' && (
        <AddTaskSheet
          eventId={eventId}
          people={people}
          onAdded={(t) => {
            onTasks([...tasks, t]);
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'templates' && templates && (
        <TemplatesSheet templates={templates} kind={sheet.tpl} onKind={(tpl) => setSheet({ kind: 'templates', tpl })} onTemplates={onTemplates} onClose={() => setSheet(null)} />
      )}
    </section>
  );
}

function OwnerFace({ person, name, className }: { person?: PersonDTO; name: string; className?: string }) {
  return (
    <Avatar image={person?.image} alt={name} className={cn('grid shrink-0 place-items-center rounded-full bg-surface-2 font-bold text-ink-soft', className ?? 'h-[22px] w-[22px] text-[11px]')}>
      {name.slice(0, 1).toUpperCase()}
    </Avatar>
  );
}

function TaskRow({ task, people, canCheck, onToggle, onOpen }: { task: ProductionTaskDTO; people: PersonDTO[]; canCheck: boolean; onToggle: () => void; onOpen: () => void }) {
  const owner = people.find((p) => p.id === task.ownerId);
  const done = !!task.doneAt;
  const color = zoneColor(task.zone);
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface py-2 pl-2 pr-3">
      <button
        type="button"
        onClick={onToggle}
        disabled={!canCheck}
        aria-pressed={done}
        aria-label={`${done ? 'Mark not done' : 'Mark done'}: ${task.title}`}
        title={canCheck ? undefined : `Only ${task.ownerName ?? 'the owner'} or a leader can check this off`}
        className={cn('grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px] border-2 transition active:scale-90', !canCheck && !done && 'cursor-not-allowed border-dashed !border-line')}
        style={done ? { background: 'rgb(94 112 72)', borderColor: 'rgb(94 112 72)' } : { borderColor: color }}
      >
        {done && <Check width={16} height={16} className="text-white" strokeWidth={3} />}
      </button>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 py-0.5 text-left">
        <span className={cn('block text-[14.5px] font-semibold', done && 'text-ink-soft line-through decoration-ink-faint')}>
          {task.title}
          {task.oneOff && <span className="ml-1.5 text-[11px] font-bold text-warn-ink no-underline">This event only</span>}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-soft">
          {task.ownerName ? (
            <>
              <OwnerFace person={owner} name={task.ownerName} />
              {task.ownerName}
            </>
          ) : (
            <span className="font-semibold text-warn-ink">No owner</span>
          )}
          {done && task.doneByName && task.doneAt && (
            <span className="font-semibold text-accent-ink">· Done by {task.doneByName} at {timeLabel(task.doneAt)}</span>
          )}
        </span>
      </button>
    </div>
  );
}

function TaskSheet({
  task,
  people,
  meId,
  canManage,
  canCheck,
  hasMap,
  onToggle,
  onAssign,
  onMap,
  onRemove,
  onClose,
}: {
  task: ProductionTaskDTO;
  people: PersonDTO[];
  meId: string;
  canManage: boolean;
  canCheck: boolean;
  hasMap: boolean;
  onToggle: () => void;
  onAssign: (id: string | null) => void;
  onMap: (z: ZoneId) => void;
  onRemove: () => Promise<void>;
  onClose: () => void;
}) {
  const [removing, setRemoving] = useState(false);
  const done = !!task.doneAt;
  const zone = task.zone && (ZONE_IDS as string[]).includes(task.zone) ? (task.zone as ZoneId) : null;
  return (
    <Modal open onClose={onClose} title={task.title}>
      <div className="space-y-4">
        <p className="eyebrow inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: zoneColor(task.zone) }} />
          {zoneName(task.zone)}
          {task.oneOff && ' · this event only'}
        </p>
        {task.notes && <p className="text-[15px] leading-relaxed">{task.notes}</p>}
        <div className="flex flex-wrap gap-2">
          {canCheck ? (
            <button type="button" className={done ? 'btn-ghost' : 'btn-primary'} onClick={onToggle}>
              <Check width={18} height={18} /> {done ? 'Mark not done' : 'Mark done'}
            </button>
          ) : (
            <p className="text-sm text-ink-soft">Only {task.ownerName ?? 'the owner'} or a leader can check this off.</p>
          )}
          {zone && hasMap && (
            <button type="button" className="btn-ghost" onClick={() => onMap(zone)}>
              See it on the stage map
            </button>
          )}
        </div>
        {done && task.doneByName && task.doneAt && <p className="text-sm text-ink-soft">Done by {task.doneByName} at {timeLabel(task.doneAt)}.</p>}

        <section className="space-y-2 border-t border-line pt-3">
          <p className="eyebrow">Owner</p>
          {canManage ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                {people.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onAssign(p.id)}
                    aria-pressed={task.ownerId === p.id}
                    className={cn('row-press inline-flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-[13px] font-semibold', task.ownerId === p.id ? 'border-accent bg-accent-soft' : 'border-line bg-surface')}
                  >
                    <OwnerFace person={p} name={p.name} />
                    {p.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => onAssign(null)}
                  aria-pressed={!task.ownerId}
                  className={cn('row-press rounded-full border px-3 py-1 text-[13px] font-semibold', !task.ownerId ? 'border-accent bg-accent-soft' : 'border-line bg-surface')}
                >
                  No owner
                </button>
              </div>
              <p className="text-xs text-ink-faint">
                {task.ownerName ? `${task.ownerName} gets a reminder 30 minutes before the event starts. ` : ''}
                {task.oneOff ? 'This task is only on this event.' : 'The next event of this type starts with whoever owns it now.'}
              </p>
            </>
          ) : (
            <p className="text-sm">{task.ownerName ? `${task.ownerName}${task.ownerId === meId ? ' (you)' : ''}` : 'Nobody yet. A leader will assign it.'}</p>
          )}
        </section>

        {canManage && (
          <button
            type="button"
            disabled={removing}
            onClick={async () => {
              setRemoving(true);
              try {
                await onRemove();
              } catch {
                setRemoving(false);
              }
            }}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-bad-ink"
          >
            <Trash width={16} height={16} /> {removing ? 'Removing…' : 'Remove from this event'}
          </button>
        )}
      </div>
    </Modal>
  );
}

const fieldClass = 'w-full rounded-2xl border border-line bg-surface px-3 py-3 text-[15px]';

function ZoneSelect({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  return (
    <select id={id} className={fieldClass} value={value} onChange={(e) => onChange(e.target.value)}>
      {ZONES.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
      <option value="">General</option>
    </select>
  );
}

function AddTaskSheet({ eventId, people, onAdded, onClose }: { eventId: string; people: PersonDTO[]; onAdded: (t: ProductionTaskDTO) => void; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [zone, setZone] = useState<string>('instruments');
  const [ownerId, setOwnerId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError('Write the task first.');
    setBusy(true);
    try {
      const { task } = await apiFetch<{ task: ProductionTaskDTO }>(`/api/production/events/${eventId}/tasks`, {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), zone: zone || null, ownerId: ownerId || null }),
      });
      onAdded(task);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the task.');
      setBusy(false);
    }
  }
  return (
    <Modal open onClose={onClose} title="Add a task">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-ink-soft">This adds it to this event only. To add it every time, edit the template instead.</p>
        <label className="block space-y-1.5">
          <span className="label">Task</span>
          <input className={fieldClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Set up the guest drummer’s kit" autoFocus maxLength={200} />
        </label>
        <label className="block space-y-1.5" htmlFor="add-task-zone">
          <span className="label">Where it goes</span>
          <ZoneSelect id="add-task-zone" value={zone} onChange={setZone} />
        </label>
        <label className="block space-y-1.5">
          <span className="label">Owner</span>
          <select className={fieldClass} value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            <option value="">No owner yet</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        {error && <p className="text-sm font-semibold text-bad-ink">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>{busy ? 'Adding…' : 'Add task'}</button>
      </form>
    </Modal>
  );
}

function TemplatesSheet({
  templates,
  kind,
  onKind,
  onTemplates,
  onClose,
}: {
  templates: TemplateDTO[];
  kind: TemplateDTO['kind'];
  onKind: (k: TemplateDTO['kind']) => void;
  onTemplates: (t: TemplateDTO[]) => void;
  onClose: () => void;
}) {
  const tpl = templates.find((t) => t.kind === kind);
  const [title, setTitle] = useState('');
  const [zone, setZone] = useState<string>('instruments');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { templates: next } = await apiFetch<{ templates: TemplateDTO[] }>(`/api/production/templates/${kind}/tasks`, {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), zone: zone || null }),
      });
      onTemplates(next);
      setTitle('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add it.');
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    const { templates: next } = await apiFetch<{ templates: TemplateDTO[] }>(`/api/production/template-tasks/${id}`, { method: 'DELETE' });
    onTemplates(next);
  }

  return (
    <Modal open onClose={onClose} title="Checklist templates">
      <div className="space-y-4">
        <PillTabs value={kind} onChange={onKind} options={templates.map((t) => ({ value: t.kind, label: t.name }))} />
        <p className="rounded-2xl bg-surface-2 px-3 py-2.5 text-[13px] text-ink-soft">
          {kind === 'other'
            ? 'Other events start with a blank checklist. Add tasks to each one, or add them here to start every Other event with them.'
            : kind === 'encounter_night'
              ? 'Starts as a copy of the Service list. Edit it once Encounter Night has its own setup.'
              : 'New Service checklists start with these tasks. Changes here don’t touch checklists that already exist.'}
        </p>
        {kind === 'other' && (
          <button type="button" className="btn-ghost w-full" disabled title="Coming later">
            Create a stage map · coming later
          </button>
        )}
        {GROUP_ORDER.map((g) => {
          const list = (tpl?.tasks ?? []).filter((t) => (t.zone ?? null) === g);
          if (!list.length) return null;
          return (
            <div key={g ?? 'general'} className="space-y-1.5">
              <p className="flex items-center gap-2 text-sm font-bold">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: zoneColor(g) }} />
                {zoneName(g)}
              </p>
              {list.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 rounded-xl border border-line py-2 pl-3 pr-2 text-sm">
                  <span>{t.title}</span>
                  <button type="button" onClick={() => remove(t.id)} className="row-press grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-soft" aria-label={`Remove ${t.title}`}>
                    <Trash width={14} height={14} />
                  </button>
                </div>
              ))}
            </div>
          );
        })}
        <form onSubmit={add} className="space-y-3 border-t border-line pt-4">
          <label className="block space-y-1.5">
            <span className="label">Add a task to every {tpl?.name ?? 'event'}</span>
            <input className={fieldClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tape down the cable runs" maxLength={200} />
          </label>
          <label className="block space-y-1.5" htmlFor="tpl-zone">
            <span className="label">Where it goes</span>
            <ZoneSelect id="tpl-zone" value={zone} onChange={setZone} />
          </label>
          {error && <p className="text-sm font-semibold text-bad-ink">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={busy || !title.trim()}>{busy ? 'Adding…' : 'Add to template'}</button>
        </form>
      </div>
    </Modal>
  );
}
