'use client';

import { useEffect, useState } from 'react';
import type { LyricChart, SongDTO } from '@/lib/setlist-serialize';
import { LyricChartPreview } from '@/components/shared/LyricChartPreview';
import { FileText } from '@/components/shared/Icons';
import { apiFetch } from '@/lib/api-client';

/**
 * Leader-side lyric chart import for a single saved song. Paste a Google Doc
 * URL, pull + parse it via the service account, and persist the structured
 * chart onto the song. Shows a live preview once imported.
 */
export function LyricChartImport({
  song,
  onChanged,
}: {
  song: SongDTO;
  onChanged: (song: SongDTO) => void;
}) {
  const [url, setUrl] = useState(song.lyricDocUrl ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmReimport, setConfirmReimport] = useState(false);
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
    <div className="space-y-2.5 rounded-2xl bg-surface-2/50 p-3">
      <div className="flex items-center gap-2">
        <FileText width={15} height={15} className="text-ink-soft" />
        <p className="label !mb-0">Lyric chart</p>
      </div>

      <div className="space-y-2">
        <input
          className="field !py-2.5 text-sm"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://docs.google.com/document/d/…"
          inputMode="url"
          disabled={busy}
        />
        <div className="flex items-center gap-2">
          {chart ? (
            confirmReimport ? (
              <span className="flex items-center gap-2 text-xs text-ink-soft">
                Replace the current chart?
                <button type="button" className="font-semibold text-accent-ink dark:text-accent-on" disabled={busy} onClick={pull}>
                  Yes
                </button>
                <button type="button" className="font-semibold text-ink-faint" onClick={() => setConfirmReimport(false)}>
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="btn-ghost !px-3 !py-1.5 text-xs"
                disabled={busy || !url.trim()}
                onClick={() => setConfirmReimport(true)}
              >
                {busy ? 'Importing…' : 'Re-import'}
              </button>
            )
          ) : (
            <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" disabled={busy || !url.trim()} onClick={pull}>
              {busy ? 'Importing…' : 'Pull Chart'}
            </button>
          )}
          {chart && !confirmReimport && (
            <button type="button" className="text-xs font-semibold text-bad" disabled={busy} onClick={clearChart}>
              Remove
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-xs font-semibold text-bad">{error}</p>}

      {serviceEmail && (
        <p className="text-[11px] leading-snug text-ink-faint">
          Share the doc with: <span className="break-all font-semibold text-ink-soft">{serviceEmail}</span>
        </p>
      )}

      {chart && (
        <div className="rounded-xl bg-surface p-3">
          <LyricChartPreview chart={chart} />
        </div>
      )}
    </div>
  );
}
