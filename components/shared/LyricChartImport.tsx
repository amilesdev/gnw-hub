'use client';

import { useEffect, useState } from 'react';
import type { LyricChart, SongDTO } from '@/lib/setlist-serialize';
import { LyricChartPreview } from './LyricChartPreview';
import { ConfirmDialog } from './ConfirmDialog';
import { apiFetch } from '@/lib/api-client';

/**
 * Lyric chart import for a single saved song. Paste a Google Doc URL, pull +
 * parse it via the service account, and persist the structured chart onto the
 * song.
 *
 * Shown to leaders in the Setlist / Library editors, and — as the whole of the
 * administrative-assistant grant (lib/access.ts → canEditLyricCharts) — inside
 * the song card itself. Pass `embedded` there: the card's Lyrics section already
 * supplies the heading and renders the chart, so the panel drops both and shows
 * only the controls.
 */
export function LyricChartImport({
  song,
  onChanged,
  embedded = false,
}: {
  song: SongDTO;
  onChanged: (song: SongDTO) => void;
  embedded?: boolean;
}) {
  const [url, setUrl] = useState(song.lyricDocUrl ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmReimport, setConfirmReimport] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [serviceEmail, setServiceEmail] = useState<string | null>(null);

  const chart = song.lyricChart;

  useEffect(() => {
    apiFetch<{ serviceAccountEmail: string | null }>('/api/parse-lyric-doc')
      .then(({ serviceAccountEmail }) => setServiceEmail(serviceAccountEmail))
      .catch(() => {});
  }, []);

  async function pull() {
    setBusy(true);
    setError(null);
    setConfirmReimport(false);
    try {
      const { chart: parsed } = await apiFetch<{ success: true; chart: LyricChart }>('/api/parse-lyric-doc', {
        method: 'POST',
        body: JSON.stringify({ docUrl: url.trim() }),
      });
      const { song: updated } = await apiFetch<{ song: SongDTO }>(`/api/songs/${song.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ lyricChart: parsed, lyricDocUrl: url.trim() }),
      });
      onChanged({ ...song, ...updated, lyricChart: parsed });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not import the chart.');
    } finally {
      setBusy(false);
    }
  }

  async function clearChart() {
    setBusy(true);
    setError(null);
    try {
      const { song: updated } = await apiFetch<{ song: SongDTO }>(`/api/songs/${song.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ lyricChart: null, lyricDocUrl: null }),
      });
      onChanged({ ...song, ...updated, lyricChart: null });
      setUrl('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove the chart.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={embedded ? 'space-y-2.5 rounded-3xl border border-line bg-surface p-4' : 'card space-y-3 p-4'}>
      {!embedded && <p className="eyebrow">Lyric chart</p>}

      <div className="space-y-2.5">
        <input
          className="field text-base"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://docs.google.com/document/d/…"
          aria-label="Google Doc link"
          inputMode="url"
          disabled={busy}
        />
        <div className="flex items-center gap-2">
          {chart ? (
            <button
              type="button"
              className="btn-ghost btn-sm"
              disabled={busy || !url.trim()}
              onClick={() => setConfirmReimport(true)}
            >
              {busy ? 'Importing…' : 'Re-import'}
            </button>
          ) : (
            <button type="button" className="btn-ghost btn-sm" disabled={busy || !url.trim()} onClick={pull}>
              {busy ? 'Importing…' : 'Pull Chart'}
            </button>
          )}
          {chart && (
            <button type="button" className="btn-danger-text btn-sm" disabled={busy} onClick={() => setConfirmRemove(true)}>
              Remove
            </button>
          )}
        </div>
      </div>

      {error && <p role="alert" className="text-[13px] font-semibold text-bad-ink">{error}</p>}

      {serviceEmail && (
        <p className="text-xs leading-4 text-ink-faint">
          Share the doc with: <span className="selectable break-all font-semibold text-ink-soft">{serviceEmail}</span>
        </p>
      )}

      {chart && !embedded && (
        <div className="rounded-2xl bg-surface-2 p-3">
          <LyricChartPreview chart={chart} />
        </div>
      )}

      <ConfirmDialog
        open={confirmReimport}
        title="Replace the current chart?"
        message="The chart is re-imported from the Google Doc, replacing what's here now."
        confirmLabel="Re-import"
        destructive={false}
        busy={busy}
        onConfirm={async () => {
          await pull();
          setConfirmReimport(false);
        }}
        onClose={() => setConfirmReimport(false)}
      />
      <ConfirmDialog
        open={confirmRemove}
        title="Remove lyric chart?"
        message="The imported chart is removed from this song. You can import it again later."
        confirmLabel="Remove"
        busy={busy}
        onConfirm={async () => {
          await clearChart();
          setConfirmRemove(false);
        }}
        onClose={() => setConfirmRemove(false)}
      />
    </div>
  );
}
