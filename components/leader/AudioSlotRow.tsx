'use client';

import { useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Upload, Check, Trash } from '@/components/shared/Icons';

/**
 * One audio slot in the leader editors (SG-C8): a vocal part or the band
 * arrangement. Filled: the file name, Replace, and a trash that confirms.
 * Empty: Upload, then "Uploading {n}%" with a thin progress bar.
 */
export function AudioSlotRow({
  label,
  url,
  songTitle,
  onUpload,
  onClear,
}: {
  label: string;
  url: string | null;
  songTitle: string;
  /** Uploads the file and saves it; reports 0–100 as it goes. */
  onUpload: (file: File, onProgress: (pct: number) => void) => Promise<void>;
  onClear: () => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);
  const busy = progress !== null || clearing;

  async function pick(file: File) {
    setProgress(0);
    try {
      await onUpload(file, setProgress);
    } finally {
      setProgress(null);
    }
  }

  async function clear() {
    setClearing(true);
    try {
      await onClear();
      setConfirming(false);
    } finally {
      setClearing(false);
    }
  }

  return (
    <div>
      <div className="flex min-h-11 items-center gap-2">
        <span className="min-w-20 shrink-0 pr-1 text-[15px] font-semibold">{label}</span>
        {url && progress === null ? (
          <>
            <span className="inline-flex min-w-0 flex-1 items-center gap-1 text-[13px] text-ink-soft">
              <Check width={14} height={14} className="shrink-0 text-good-ink" />
              <span className="truncate">{decodeURIComponent(url.split('/').pop() ?? 'uploaded')}</span>
            </span>
            <button type="button" className="btn-ghost btn-sm shrink-0" disabled={busy} onClick={() => fileRef.current?.click()}>
              Replace
            </button>
            <button
              type="button"
              className="btn-icon -mr-2 text-bad-ink"
              disabled={busy}
              onClick={() => setConfirming(true)}
              aria-label={`Remove ${label} audio`}
            >
              <Trash width={18} height={18} />
            </button>
          </>
        ) : progress !== null ? (
          <span className="ml-auto text-[13px] font-bold tabular-nums text-accent-ink">Uploading {progress}%</span>
        ) : (
          <button type="button" className="btn-ghost btn-sm ml-auto" disabled={busy} onClick={() => fileRef.current?.click()}>
            <Upload width={16} height={16} /> Upload
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          // Explicit extensions alongside `audio/*` — iOS Safari greys out
          // files it can't MIME-classify as audio, so extension matching is
          // what actually lets you pick .m4a/.wav/.flac/etc. on a phone.
          accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.oga,.webm,.flac,.mp4"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void pick(f);
            e.target.value = '';
          }}
        />
      </div>
      {progress !== null && (
        <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-track" aria-hidden>
          <div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${progress}%` }} />
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        title={`Remove ${label} audio?`}
        message={`This deletes the ${label} audio for “${songTitle}” for everyone.`}
        confirmLabel="Remove"
        busy={clearing}
        onConfirm={clear}
        onClose={() => setConfirming(false)}
      />
    </div>
  );
}

/** Editor group (SG-6): a card with an eyebrow title. */
export function EditorGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-3 p-4">
      <p className="eyebrow">{title}</p>
      {children}
    </section>
  );
}
