'use client';

import { useEffect, useState } from 'react';
import type { PollResultsDTO } from '@/lib/serialize';
import { apiFetch } from '@/lib/api-client';
import { pollResultsToCsv, pollCsvFilename } from '@/lib/poll-csv';
import { PollForm } from './PollForm';
import { PollResults } from '@/components/shared/PollResults';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { ChevronDown, ChevronRight, Trash, Upload } from '@/components/shared/Icons';

function formatEnds(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function download(r: PollResultsDTO) {
  const blob = new Blob([pollResultsToCsv(r)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = pollCsvFilename(r);
  a.click();
  URL.revokeObjectURL(url);
}

/** Leader's Polls surface: create a poll, review results live, and download the
 *  distribution once a poll has ended. */
export function PollsManager({ creating, onCreatingChange }: { creating: boolean; onCreatingChange: (v: boolean) => void }) {
  const [polls, setPolls] = useState<PollResultsDTO[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<PollResultsDTO | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const data = await apiFetch<{ polls: PollResultsDTO[] }>('/api/polls');
      setPolls(data.polls);
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function remove() {
    if (!confirming) return;
    setBusy(true);
    try {
      await apiFetch(`/api/polls/${confirming.id}`, { method: 'DELETE' });
      setConfirming(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 pb-2">
      <h2 className="eyebrow">Polls</h2>

      {loaded && polls.length === 0 ? (
        <div className="card p-5 text-center text-sm text-ink-faint">No polls yet. Tap “Add Poll” to ask the team.</div>
      ) : (
        polls.map((p) => {
          const open = openId === p.id;
          return (
            <div key={p.id} className="card overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : p.id)}
                className="row-press flex w-full items-center gap-3 px-4 py-3.5 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.question}</span>
                  <span className="block text-xs text-ink-faint">
                    {p.ended ? 'Ended' : 'Active'} · {formatEnds(p.endsAt)} · {p.totalVoters} voted
                  </span>
                </span>
                <span className={`chip ${p.ended ? 'bg-surface-2 text-ink-faint' : 'bg-accent/15 text-accent-ink'}`}>
                  {p.ended ? 'Ended' : 'Live'}
                </span>
                {open ? (
                  <ChevronDown width={18} height={18} className="text-ink-faint" />
                ) : (
                  <ChevronRight width={18} height={18} className="text-ink-faint" />
                )}
              </button>

              {open && (
                <div className="space-y-3 border-t border-line px-4 py-4">
                  <PollResults results={p} />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => download(p)}
                      disabled={!p.ended}
                      className="btn-ghost flex-1 !py-2 text-sm disabled:opacity-40"
                      title={p.ended ? 'Download results' : 'Available once the poll ends'}
                    >
                      <Upload width={16} height={16} /> Download
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(p)}
                      className="btn-ghost !py-2 text-sm text-bad"
                    >
                      <Trash width={16} height={16} /> Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}

      {creating && (
        <PollForm onClose={() => onCreatingChange(false)} onSaved={() => { onCreatingChange(false); refresh(); }} />
      )}

      <ConfirmDialog
        open={!!confirming}
        title="Delete poll?"
        message="This removes the poll and all its votes for everyone."
        busy={busy}
        onConfirm={remove}
        onClose={() => setConfirming(null)}
      />
    </section>
  );
}
