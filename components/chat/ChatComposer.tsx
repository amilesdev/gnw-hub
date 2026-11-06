'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CHAT_MAX_ATTACHMENTS,
  CHAT_TEXT_MAX,
  mediaLabel,
  type ChatAttachmentInput,
  type ChatGifInput,
  type ChatGifResultDTO,
  type ChatMediaKind,
  type ChatMemberDTO,
} from '@/lib/chat/types';
import { ArrowUp, Check, FileText, Pencil, Plus, X } from '@/components/shared/Icons';
import { ChatAvatar } from './ChatAvatar';
import { ReplyThumb, type ClientMessage } from './ChatMessages';
import { GifPicker } from './GifPicker';
import { mediaKindOf, mediaProblem, prepareMedia, putWithProgress, signUploads } from './media';

const MAX_HEIGHT_PX = 132; // ~5 lines, then it scrolls

/**
 * What the composer hands the thread to send. `previews` are local blob URLs
 * for the optimistic bubble (a GIF's is its GIPHY URL).
 */
export type OutgoingMessage = {
  text: string;
  mentionIds: string[];
  mentionsAll: boolean;
  attachments: ChatAttachmentInput[];
  /** A GIF/sticker, sent as a message of its own. */
  gif?: ChatGifInput;
  previews: {
    kind: ChatMediaKind;
    url: string;
    posterUrl: string | null;
    width: number | null;
    height: number | null;
    name?: string | null;
    sizeBytes?: number | null;
  }[];
};

type Draft = {
  key: string;
  kind: ChatMediaKind;
  /** The picked file's name (shown on a PDF's tile). */
  name: string;
  previewUrl: string;
  posterUrl: string | null;
  status: 'working' | 'done' | 'error';
  progress: number;
  error?: string;
  input?: ChatAttachmentInput;
};

/**
 * Composer: text with an @mention picker, photos/videos (uploaded as soon as
 * they're picked, so Send is instant), a reply bar, and edit mode. On a desktop
 * keyboard Enter sends and Shift+Enter breaks a line; on phones Return is a line
 * break and the button sends (the iOS habit). The send button never steals
 * focus, so the keyboard stays up. 16px text — smaller makes iOS zoom.
 */
export function ChatComposer({
  chatId,
  meId,
  members,
  canMentionAll,
  placeholder,
  bottomPad,
  replyTo,
  onCancelReply,
  editing,
  onCancelEdit,
  onSaveEdit,
  onSend,
  onTyping,
  onFocusInput,
  onHeight,
}: {
  chatId: string;
  meId: string;
  members: ChatMemberDTO[];
  canMentionAll: boolean;
  placeholder: string;
  bottomPad: string;
  replyTo: ClientMessage | null;
  onCancelReply: () => void;
  editing: ClientMessage | null;
  onCancelEdit: () => void;
  onSaveEdit: (text: string) => void;
  onSend: (m: OutgoingMessage) => void;
  /** Called on every keystroke of a new message: is there text in the box? (The thread throttles it.) */
  onTyping: (typing: boolean) => void;
  /** The text box got focus (a tap on it): the thread drops to the newest messages. */
  onFocusInput: () => void;
  /** The composer floats over the messages; this reports how much of them it covers. */
  onHeight: (px: number) => void;
}) {
  const [text, setText] = useState('');
  const [caret, setCaret] = useState(0);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [gifsOpen, setGifsOpen] = useState(false);
  const picked = useRef(new Map<string, string>()); // userId → name inserted as @Name
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const finePointer = useRef(false);
  /**
   * Set just before we focus the box ourselves for a reply or an edit: that
   * message may be far up the chat, so the focus shouldn't drop to the newest.
   */
  const quietFocus = useRef(false);
  function focusQuietly() {
    quietFocus.current = true;
    ref.current?.focus();
    quietFocus.current = false;
  }
  const rootRef = useRef<HTMLDivElement>(null);
  const onHeightRef = useRef(onHeight);
  onHeightRef.current = onHeight;

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => onHeightRef.current(Math.round(el.getBoundingClientRect().height)));
    ro.observe(el);
    return () => {
      ro.disconnect();
      onHeightRef.current(0);
    };
  }, []);

  useEffect(() => {
    finePointer.current = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }, []);

  // Entering edit mode loads the message's text; leaving it clears the box.
  const editingId = editing?.id ?? null;
  useEffect(() => {
    if (editing) {
      setText(editing.text ?? '');
      window.setTimeout(focusQuietly, 0);
    } else {
      setText('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the message id only
  }, [editingId]);

  useEffect(() => {
    if (replyTo) focusQuietly();
  }, [replyTo]);

  // Auto-grow: reset, then fit the content up to the cap.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [text]);

  // ── @mentions ──────────────────────────────────────────────────────────────
  const query = mentionQuery(text, caret);
  const suggestions = useMemo(() => {
    if (!query) return [];
    const q = query.query.toLowerCase();
    const people = members
      .filter((m) => m.userId !== meId)
      .filter((m) => !q || m.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(q)) || m.name.toLowerCase().startsWith(q))
      .slice(0, 6)
      .map((m) => ({ id: m.userId, name: m.name, image: m.image }));
    const all = canMentionAll && 'all'.startsWith(q) ? [{ id: '@all', name: 'all', image: null }] : [];
    return [...all, ...people];
  }, [query, members, meId, canMentionAll]);

  function pickMention(s: { id: string; name: string }) {
    if (!query) return;
    const insert = `@${s.name} `;
    const next = text.slice(0, query.start) + insert + text.slice(caret);
    if (s.id !== '@all') picked.current.set(s.id, s.name);
    setText(next);
    const pos = query.start + insert.length;
    setCaret(pos);
    window.setTimeout(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(pos, pos);
    }, 0);
  }

  // ── attachments ────────────────────────────────────────────────────────────
  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const room = CHAT_MAX_ATTACHMENTS - drafts.length;
    const files = [...list];
    if (files.length > room) setNotice(`Up to ${CHAT_MAX_ATTACHMENTS} files per message.`);
    for (const file of files.slice(0, Math.max(0, room))) {
      const problem = mediaProblem(file);
      if (problem) {
        setNotice(problem);
        continue;
      }
      const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const kind = mediaKindOf(file)!;
      setDrafts((d) => [
        ...d,
        { key, kind, name: file.name, previewUrl: URL.createObjectURL(file), posterUrl: null, status: 'working', progress: 0 },
      ]);
      void upload(key, file);
    }
  }

  async function upload(key: string, original: File) {
    const patch = (p: Partial<Draft>) => setDrafts((d) => d.map((x) => (x.key === key ? { ...x, ...p } : x)));
    try {
      const media = await prepareMedia(original);
      const posterUrl = media.poster ? URL.createObjectURL(media.poster) : null;
      if (media.kind === 'image') patch({ previewUrl: URL.createObjectURL(media.file), posterUrl });
      else patch({ posterUrl });
      const files = media.poster ? [media.file, media.poster] : [media.file];
      const [main, poster] = await signUploads(chatId, files);
      if (media.poster && poster) await putWithProgress(poster.signedUrl, media.poster, () => {});
      await putWithProgress(main.signedUrl, media.file, (p) => patch({ progress: p }));
      patch({
        status: 'done',
        progress: 1,
        input: {
          kind: media.kind,
          path: main.path,
          name: media.kind === 'file' ? media.file.name : null,
          posterPath: poster?.path ?? null,
          width: media.width,
          height: media.height,
          durationSec: media.durationSec,
          sizeBytes: media.file.size,
        },
      });
    } catch (e) {
      patch({ status: 'error', error: e instanceof Error ? e.message : 'Upload failed.' });
    }
  }

  // ── send / save ────────────────────────────────────────────────────────────
  const uploading = drafts.some((d) => d.status === 'working');
  const failed = drafts.some((d) => d.status === 'error');
  const ready = drafts.filter((d) => d.status === 'done');
  const canSend = editing
    ? text.trim().length > 0 || (editing.attachments.length > 0 && text.trim() !== (editing.text ?? ''))
    : (text.trim().length > 0 || ready.length > 0) && !uploading && !failed;
  // Send shows once there's anything to send (disabled while uploads finish).
  const showSend = !!editing || text.trim().length > 0 || drafts.length > 0;

  function submit() {
    if (!canSend) return;
    const t = text.trim();
    if (editing) {
      onSaveEdit(t);
      return;
    }
    const mentionIds = [...picked.current.entries()].filter(([, name]) => t.includes(`@${name}`)).map(([id]) => id);
    onSend({
      text: t,
      mentionIds,
      mentionsAll: canMentionAll && /(^|\s)@all\b/i.test(t),
      attachments: ready.map((d) => d.input!),
      previews: ready.map((d) => ({
        kind: d.kind,
        url: d.previewUrl,
        posterUrl: d.posterUrl,
        width: d.input?.width ?? null,
        height: d.input?.height ?? null,
        name: d.input?.name ?? null,
        sizeBytes: d.input?.sizeBytes ?? null,
      })),
    });
    setText('');
    setDrafts([]);
    picked.current.clear();
    setNotice(null);
    ref.current?.focus();
  }

  /** A GIF/sticker goes straight out as its own message; whatever's typed stays in the box. */
  function sendGif(g: ChatGifResultDTO) {
    const url = `https://media.giphy.com/media/${g.id}/${g.file}`;
    onSend({
      text: '',
      mentionIds: [],
      mentionsAll: false,
      attachments: [],
      gif: { kind: g.kind, id: g.id, file: g.file, width: g.width, height: g.height, title: g.title || null },
      previews: [{ kind: g.kind, url, posterUrl: g.previewUrl, width: g.width, height: g.height, name: g.title || null }],
    });
  }

  const replyName = replyTo ? (replyTo.author?.name ?? replyTo.importedAuthorName ?? 'Former member') : '';
  const replyMedia = replyTo?.attachments[0];
  const replyThumb = replyMedia ? (replyMedia.kind === 'image' ? replyMedia.url : replyMedia.posterUrl) : null;

  const hasTray = !!(replyTo || editing || drafts.length || notice);

  return (
    // Floats over the bottom of the messages (they scroll on underneath the
    // glass); the thread pads its scroller by our measured height.
    <div
      ref={rootRef}
      className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] pt-6"
      style={{
        paddingBottom: bottomPad,
        // A soft fade so messages don't read straight through the controls.
        background: 'linear-gradient(to top, rgb(var(--chat-canvas) / 0.75) 30%, rgb(var(--chat-canvas) / 0))',
      }}
    >
      {/* @mention suggestions float above the composer */}
      {suggestions.length > 0 && (
        <ul className="pointer-events-auto absolute inset-x-3 bottom-full mb-2 overflow-hidden rounded-2xl border border-line bg-surface shadow-card-lg">
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickMention(s)}
                className="row-press flex w-full items-center gap-3 px-3 py-2.5 text-left"
              >
                {s.id === '@all' ? (
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-unread text-sm font-bold text-white">@</span>
                ) : (
                  <ChatAvatar name={s.name} image={s.image} size={32} />
                )}
                <span className="font-semibold">{s.id === '@all' ? '@all' : s.name}</span>
                {s.id === '@all' && <span className="text-xs text-ink-faint">Notifies everyone, even if muted</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {hasTray && (
      <div className="glass pointer-events-auto mx-3 mb-2 animate-rise overflow-hidden rounded-[22px] pb-2">
      {(replyTo || editing) && (
        <div className="flex items-center gap-2 px-4 pt-2 text-sm">
          <span className="text-accent-ink">{editing ? <Pencil width={16} height={16} /> : '↩'}</span>
          <span className="min-w-0 flex-1 truncate">
            {editing ? (
              <span className="font-semibold">Editing message</span>
            ) : (
              <>
                <span className="font-semibold">Replying to {replyName.split(' ')[0]}</span>
                <span className="text-ink-soft"> · {snippet(replyTo!)}</span>
              </>
            )}
          </span>
          {!editing && replyThumb && <ReplyThumb url={replyThumb} video={replyMedia?.kind === 'video'} size={34} />}
          <button
            type="button"
            aria-label={editing ? 'Cancel editing' : 'Cancel reply'}
            onClick={editing ? onCancelEdit : onCancelReply}
            className="row-press grid h-7 w-7 place-items-center rounded-full text-ink-faint"
          >
            <X width={15} height={15} />
          </button>
        </div>
      )}

      {drafts.length > 0 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-3 pt-2">
          {drafts.map((d) => (
            <div key={d.key} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-surface-2">
              {d.kind === 'file' ? (
                <span className="flex h-full w-full flex-col items-center justify-center gap-1 px-1.5 text-ink-soft">
                  <FileText width={24} height={24} />
                  <span className="line-clamp-2 text-center text-[10px] font-semibold leading-tight [overflow-wrap:anywhere]">{d.name}</span>
                </span>
              ) : d.kind === 'image' || d.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- local blob preview
                <img src={d.kind === 'image' ? d.previewUrl : d.posterUrl!} alt="" className="h-full w-full object-cover" />
              ) : (
                <video src={d.previewUrl} muted playsInline preload="metadata" className="h-full w-full object-cover" />
              )}
              {d.kind === 'video' && (
                <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] font-bold text-white">VIDEO</span>
              )}
              {d.status === 'working' && (
                <span className="absolute inset-0 grid place-items-center bg-black/35">
                  <ProgressRing value={d.progress} />
                </span>
              )}
              {d.status === 'error' && (
                <span className="absolute inset-0 grid place-items-center bg-bad/70 px-1 text-center text-[10px] font-bold text-white">
                  {d.error ?? 'Failed'}
                </span>
              )}
              {d.status === 'done' && (
                <span className="absolute bottom-1 right-1 grid h-5 w-5 place-items-center rounded-full bg-good text-white">
                  <Check width={12} height={12} />
                </span>
              )}
              <button
                type="button"
                aria-label="Remove"
                onClick={() => setDrafts((all) => all.filter((x) => x.key !== d.key))}
                className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white"
              >
                <X width={13} height={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {notice && (
        <p role="alert" className="flex items-center justify-between gap-2 px-4 pt-2 text-xs font-semibold text-bad-ink">
          {notice}
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="text-ink-faint">
            <X width={13} height={13} />
          </button>
        </p>
      )}
      </div>
      )}

      <div className="pointer-events-auto flex items-end gap-2 px-3">
        {!editing && (
          <>
            <button
              type="button"
              aria-label="Add photos, videos or PDFs"
              onClick={() => fileRef.current?.click()}
              disabled={drafts.length >= CHAT_MAX_ATTACHMENTS}
              className="glass grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink transition active:scale-90 disabled:opacity-40"
            >
              <Plus width={22} height={22} />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*,application/pdf,.pdf"
              multiple
              hidden
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              aria-label="Send a GIF or sticker"
              onClick={() => setGifsOpen(true)}
              className="glass grid h-11 w-11 shrink-0 place-items-center rounded-full text-[13px] font-extrabold tracking-wide text-ink transition active:scale-90"
            >
              GIF
            </button>
            {gifsOpen && <GifPicker onPick={sendGif} onClose={() => setGifsOpen(false)} />}
          </>
        )}
        {/* The whole pill is the tap target for the text box (like iMessage). */}
        <div
          className="glass flex min-h-11 min-w-0 flex-1 cursor-text items-end rounded-[22px] py-[5px] pl-4 pr-[5px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) ref.current?.focus();
          }}
        >
          <textarea
            ref={ref}
            rows={1}
            value={text}
            maxLength={CHAT_TEXT_MAX}
            placeholder={editing ? 'Edit your message' : placeholder}
            aria-label="Message"
            onFocus={() => {
              if (!quietFocus.current) onFocusInput();
            }}
            onChange={(e) => {
              setText(e.target.value);
              setCaret(e.target.selectionStart ?? e.target.value.length);
              if (!editing) onTyping(e.target.value.trim().length > 0);
            }}
            onSelect={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                if (editing) onCancelEdit();
                else if (replyTo) onCancelReply();
              }
              if (e.key === 'Enter' && !e.shiftKey && finePointer.current && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (suggestions.length) pickMention(suggestions[0]);
                else submit();
              }
            }}
            className="no-scrollbar max-h-[132px] min-h-8 min-w-0 flex-1 resize-none bg-transparent py-[5px] text-base leading-snug text-ink outline-none placeholder:text-ink-faint"
          />
          {/* Send pops in once there's something to send. */}
          {showSend && (
            <button
              key="send"
              type="button"
              aria-label={editing ? 'Save edit' : 'Send'}
              disabled={!canSend}
              // Keep focus in the textarea (and the keyboard up) when tapping send.
              onPointerDown={(e) => e.preventDefault()}
              onMouseDown={(e) => e.preventDefault()}
              onClick={submit}
              className="ml-2 grid h-8 w-8 shrink-0 animate-send-in place-items-center rounded-full bg-accent text-accent-fg shadow-pop transition-[transform,opacity] active:scale-90 disabled:opacity-50"
            >
              {editing ? <Check width={18} height={18} /> : <ArrowUp width={18} height={18} strokeWidth={2.75} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** The "@query" being typed at the caret, if any (names have spaces, so a single space is allowed). */
function mentionQuery(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf('@');
  if (at < 0 || (at > 0 && !/\s/.test(before[at - 1]))) return null;
  const query = before.slice(at + 1);
  if (query.length > 30 || /\n|\s{2}/.test(query) || (query.match(/\s/g)?.length ?? 0) > 2) return null;
  return { start: at, query };
}

export function snippet(m: Pick<ClientMessage, 'text' | 'attachments' | 'deleted'>): string {
  if (m.deleted) return 'Message deleted';
  const t = (m.text ?? '').replace(/\s+/g, ' ').trim();
  if (t) return t.length > 80 ? `${t.slice(0, 79)}…` : t;
  const file = m.attachments.find((a) => a.kind === 'file');
  if (file) return file.name ?? 'PDF';
  const giphy = m.attachments.find((a) => a.kind === 'gif' || a.kind === 'sticker');
  if (giphy) return mediaLabel(giphy.kind);
  return mediaLabel(m.attachments.some((a) => a.kind === 'video') ? 'video' : 'image');
}

function ProgressRing({ value }: { value: number }) {
  const r = 14;
  const c = 2 * Math.PI * r;
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" aria-label={`Uploading ${Math.round(value * 100)}%`}>
      <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="3" />
      <circle
        cx="18"
        cy="18"
        r={r}
        fill="none"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.max(0.04, value))}
        transform="rotate(-90 18 18)"
      />
    </svg>
  );
}
