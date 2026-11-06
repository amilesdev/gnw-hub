'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CHAT_TYPING_PING_MS,
  CHAT_TYPING_TTL_MS,
  CHAT_VIEWING_HEARTBEAT_MS,
  type ChatAttachmentDTO,
  type ChatDetailDTO,
  type ChatMessageDTO,
  type ChatMessagesPageDTO,
} from '@/lib/chat/types';
import { apiFetch } from '@/lib/api-client';
import { Modal } from '@/components/shared/Modal';
import { ArrowDown, BellOff, ChevronLeft, MoreHorizontal, Pin, Search, X } from '@/components/shared/Icons';
import { useChat, useChatSignals } from './ChatProvider';
import { ChatMessages, TypingIndicator, splitAttachments, type ClientMessage } from './ChatMessages';
import { ChatComposer, snippet, type OutgoingMessage } from './ChatComposer';
import { ChatSettingsSheet } from './ChatSettingsSheet';
import { ChatSearch } from './ChatSearch';
import { MessageMenu } from './MessageMenu';
import { EmojiPicker, rememberEmoji } from './EmojiPicker';
import { MediaViewer } from './MediaViewer';
import { newClientNonce } from './format';
import { useVisualViewportBox } from './viewport';

const NEAR_BOTTOM_PX = 120;
const LOAD_OLDER_PX = 240;
const LOAD_NEWER_PX = 240;
const HIGHLIGHT_MS = 1800;

/**
 * One chat or topic, full screen over the tab bar (like any messaging app).
 *
 * The DB is the truth and realtime is only a nudge: a ping, a reconnect or the
 * app coming back to the front all run the same catch-up — fetch everything
 * after the newest message we hold. An `update` ping (edit, delete, reaction,
 * pin) refetches just that message. Sends are optimistic and idempotent (a
 * client nonce), so a flaky network can retry without double-posting.
 *
 * Jumping to a message that isn't loaded (a search hit, an old reply's
 * original) swaps in the page around it, and the view is then "detached" from
 * the live end (`hasNewer`): scrolling down loads newer pages, catch-up waits,
 * and "Jump to latest" (or sending) reattaches.
 *
 * Layout: the layer is sized to the *visual* viewport, so when the iOS keyboard
 * opens the composer rides on top of it instead of being covered.
 */
export function ChatThread({
  base,
  me,
  initialDetail,
  initialPage,
  initialFocusId,
  initialPins,
}: {
  base: '/home' | '/dashboard';
  me: { id: string; name: string; image: string | null };
  initialDetail: ChatDetailDTO;
  initialPage: ChatMessagesPageDTO;
  /** Opened on this message (a search hit from elsewhere): initialPage is the page around it. */
  initialFocusId?: string;
  initialPins: ChatMessageDTO[];
}) {
  const router = useRouter();
  const { refreshUnread } = useChat();
  const [detail, setDetail] = useState(initialDetail);
  const [messages, setMessages] = useState<ClientMessage[]>(initialPage.messages);
  const [hasOlder, setHasOlder] = useState(initialPage.hasMore);
  const [hasNewer, setHasNewer] = useState(!!initialPage.hasNewer);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchMounted, setSearchMounted] = useState(false);
  /** Fetching the page around a jump target (shows "Finding message…"). */
  const [jumping, setJumping] = useState(false);
  const [newBelow, setNewBelow] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pins, setPins] = useState(initialPins);
  const [pinsOpen, setPinsOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<ClientMessage | null>(null);
  const [editing, setEditing] = useState<ClientMessage | null>(null);
  /** Long-pressed message + its bubble element (the menu lifts a copy of it). */
  const [actionFor, setActionFor] = useState<{ id: string; el: HTMLElement } | null>(null);
  /** The full emoji picker, open for this message id. */
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  /** Who's typing here → when that fades if not refreshed. */
  const [typing, setTyping] = useState<Map<string, number>>(new Map());
  const [viewer, setViewer] = useState<{ items: ChatAttachmentDTO[]; start: number } | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const chatId = detail.id;

  const scroller = useRef<HTMLDivElement>(null);
  /** At the live end: scrolled to the bottom AND holding the newest messages. */
  const atBottom = useRef(!initialFocusId);
  const prependAdjust = useRef<{ height: number; top: number } | null>(null);
  const stickToBottom = useRef(!initialFocusId);
  const catchingUp = useRef<Promise<void> | null>(null);
  const olderLoading = useRef(false);
  const newerLoading = useRef(false);
  const hasOlderRef = useRef(hasOlder);
  hasOlderRef.current = hasOlder;
  const hasNewerRef = useRef(hasNewer);
  hasNewerRef.current = hasNewer;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  // What each unsent message was, so "Tap to retry" can resend it exactly.
  const outbox = useRef(new Map<string, Record<string, unknown>>());

  const box = useVisualViewportBox();
  const memberNames = useMemo(() => new Map(detail.members.map((m) => [m.userId, m.name])), [detail.members]);

  const flash = useCallback((msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice((n) => (n === msg ? null : n)), 3500);
  }, []);

  // ── scrolling ──────────────────────────────────────────────────────────────
  const scrollToBottom = useCallback((smooth = false) => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    setNewBelow(0);
  }, []);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (prependAdjust.current) {
      // Older messages went in above: keep the reader's place.
      el.scrollTop = prependAdjust.current.top + (el.scrollHeight - prependAdjust.current.height);
      prependAdjust.current = null;
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
      stickToBottom.current = false;
    }
  }, [messages]);

  // Keyboard open/close changes the box — stay pinned if we were at the bottom.
  useLayoutEffect(() => {
    if (atBottom.current && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [box?.height]);

  // ── read marks + "I'm looking" heartbeat ───────────────────────────────────
  const markRead = useCallback(
    (viewing: boolean) => {
      const url = `/api/chat/${chatId}/read`;
      const body = JSON.stringify({ viewing });
      if (!viewing && navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }));
      } else {
        void fetch(url, { method: 'POST', body, keepalive: true }).then(refreshUnread, () => {});
      }
    },
    [chatId, refreshUnread],
  );

  useEffect(() => {
    if (detail.archived) return;
    let timer: number | null = null;
    const start = () => {
      markRead(true);
      timer = window.setInterval(() => markRead(true), CHAT_VIEWING_HEARTBEAT_MS);
    };
    const stop = () => {
      if (timer) window.clearInterval(timer);
      timer = null;
      markRead(false);
    };
    const onVis = () => (document.visibilityState === 'visible' ? start() : stop());
    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', stop);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', stop);
      stop();
    };
  }, [detail.archived, markRead]);

  // ── fetching ───────────────────────────────────────────────────────────────
  const loadLatest = useCallback(async () => {
    const page = await apiFetch<ChatMessagesPageDTO>(`/api/chat/${chatId}/messages`);
    stickToBottom.current = atBottom.current;
    setMessages((prev) => mergeIncoming(prev.filter((m) => m.pending || m.failed), page.messages));
    setHasOlder(page.hasMore);
    hasOlderRef.current = page.hasMore;
    setHasNewer(false);
    hasNewerRef.current = false;
  }, [chatId]);

  const catchUp = useCallback(async () => {
    // Detached (reading back from a jump): new messages wait for "Jump to latest".
    if (hasNewerRef.current) return;
    // One catch-up at a time; a ping during one just waits for it.
    if (catchingUp.current) return catchingUp.current;
    const run = (async () => {
      try {
        const lastId = lastConfirmed(messagesRef.current)?.id;
        if (!lastId) return void (await loadLatest());
        const page = await apiFetch<ChatMessagesPageDTO>(`/api/chat/${chatId}/messages?after=${encodeURIComponent(lastId)}`);
        if (page.hasMore) return void (await loadLatest());
        if (page.messages.length === 0) return;
        const fromOthers = page.messages.filter((m) => m.author?.id !== me.id).length;
        // Whoever just sent is done typing (their "typing" doesn't linger under their message).
        stopTyping(page.messages.map((m) => m.author?.id ?? ''));
        stickToBottom.current = atBottom.current;
        if (!atBottom.current && fromOthers) setNewBelow((n) => n + fromOthers);
        setMessages((prev) => mergeIncoming(prev, page.messages));
        if (document.visibilityState === 'visible') markRead(true);
      } catch {
        /* offline — the next ping/resume retries */
      } finally {
        catchingUp.current = null;
      }
    })();
    catchingUp.current = run;
    return run;
  }, [chatId, loadLatest, markRead, me.id]);

  const reloadDetail = useCallback(async () => {
    try {
      const { chat } = await apiFetch<{ chat: ChatDetailDTO }>(`/api/chat/${chatId}`);
      setDetail(chat);
    } catch {
      // Removed from the chat, or it was archived away from us.
      router.replace(`${base}/chat`);
    }
  }, [base, chatId, router]);

  const reloadPins = useCallback(async () => {
    try {
      setPins((await apiFetch<{ pins: ChatMessageDTO[] }>(`/api/chat/${chatId}/pins`)).pins);
    } catch {
      /* keep what's shown */
    }
  }, [chatId]);

  const replace = useCallback((m: ChatMessageDTO) => {
    setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
  }, []);

  const refreshMessage = useCallback(
    async (messageId: string) => {
      try {
        const { message } = await apiFetch<{ message: ChatMessageDTO }>(`/api/chat/${chatId}/messages/${messageId}`);
        replace(message);
      } catch {
        /* gone or offline */
      }
    },
    [chatId, replace],
  );

  useChatSignals((s) => {
    if (s.kind === 'resync') {
      void catchUp();
      void reloadDetail();
      void reloadPins();
    } else if (s.kind === 'message' && s.chatId === chatId) {
      void catchUp();
    } else if (s.kind === 'update' && s.chatId === chatId && s.messageId) {
      void refreshMessage(s.messageId);
      void reloadPins();
    } else if (s.kind === 'chats' && (s.chatId === chatId || s.chatId === detail.rootId)) {
      void reloadDetail();
    } else if (s.kind === 'typing' && s.chatId === chatId && s.userId && s.userId !== me.id) {
      const who = s.userId;
      if (s.typing) setTyping((prev) => new Map(prev).set(who, Date.now() + CHAT_TYPING_TTL_MS));
      else stopTyping([who]);
    }
  });

  // ── typing ─────────────────────────────────────────────────────────────────
  function stopTyping(ids: string[]) {
    setTyping((prev) => {
      if (!ids.some((id) => prev.has(id))) return prev;
      const next = new Map(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }

  // Fade out anyone whose "typing" stopped being refreshed (closed the app, lost signal).
  useEffect(() => {
    if (typing.size === 0) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setTyping((prev) => {
        const next = new Map([...prev].filter(([, until]) => until > now));
        return next.size === prev.size ? prev : next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [typing.size]);

  const typingNames = useMemo(
    () =>
      [...typing.keys()]
        .map((id) => detail.members.find((m) => m.userId === id)?.name.split(' ')[0])
        .filter((n): n is string => !!n),
    [typing, detail.members],
  );

  // The indicator appearing shouldn't push the newest message out of view.
  useLayoutEffect(() => {
    if (atBottom.current && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [typingNames.length]);

  /** Tell the people looking at this chat that I'm typing — at most every few seconds, plus once when I stop. */
  const typingSentAt = useRef(0);
  const announceTyping = useCallback(
    (on: boolean) => {
      if (detail.archived) return;
      if (on) {
        if (Date.now() - typingSentAt.current < CHAT_TYPING_PING_MS) return;
        typingSentAt.current = Date.now();
      } else {
        if (!typingSentAt.current) return; // never announced
        typingSentAt.current = 0;
      }
      void fetch(`/api/chat/${chatId}/typing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ typing: on }),
        keepalive: true,
      }).catch(() => {});
    },
    [chatId, detail.archived],
  );

  // Leaving mid-sentence: say so, rather than leaving "typing…" up for others.
  useEffect(() => () => announceTyping(false), [announceTyping]);

  const loadOlder = useCallback(async () => {
    const first = messagesRef.current.find((m) => !m.pending && !m.failed);
    if (!first || olderLoading.current || !hasOlderRef.current) return;
    olderLoading.current = true;
    setLoadingOlder(true);
    try {
      const page = await apiFetch<ChatMessagesPageDTO>(`/api/chat/${chatId}/messages?before=${encodeURIComponent(first.id)}`);
      const el = scroller.current;
      if (el) prependAdjust.current = { height: el.scrollHeight, top: el.scrollTop };
      setMessages((prev) => mergeIncoming(prev, page.messages));
      setHasOlder(page.hasMore);
      hasOlderRef.current = page.hasMore;
    } catch {
      /* try again on the next scroll */
    } finally {
      olderLoading.current = false;
      setLoadingOlder(false);
    }
  }, [chatId]);

  /** Detached only: the next page below what's shown (the catch-up endpoint, from the newest one held). */
  const loadNewer = useCallback(async () => {
    const last = lastConfirmed(messagesRef.current);
    if (!last || newerLoading.current || !hasNewerRef.current) return;
    newerLoading.current = true;
    try {
      const page = await apiFetch<ChatMessagesPageDTO>(`/api/chat/${chatId}/messages?after=${encodeURIComponent(last.id)}`);
      setMessages((prev) => mergeIncoming(prev, page.messages));
      setHasNewer(page.hasMore);
      hasNewerRef.current = page.hasMore;
      // Reached the live end: back to normal, and this is now read.
      if (!page.hasMore && document.visibilityState === 'visible') markRead(true);
    } catch {
      /* try again on the next scroll */
    } finally {
      newerLoading.current = false;
    }
  }, [chatId, markRead]);

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    const nearEnd = el.scrollHeight - el.scrollTop - el.clientHeight;
    atBottom.current = nearEnd < NEAR_BOTTOM_PX && !hasNewerRef.current;
    if (atBottom.current && newBelow) setNewBelow(0);
    if (el.scrollTop < LOAD_OLDER_PX && hasOlder && !loadingOlder) void loadOlder();
    if (nearEnd < LOAD_NEWER_PX && hasNewerRef.current) void loadNewer();
  }

  const findEl = (messageId: string) =>
    scroller.current?.querySelector<HTMLElement>(`[data-mid="${CSS.escape(messageId)}"]`) ?? null;

  const highlight = useCallback((messageId: string) => {
    setHighlightId(messageId);
    window.setTimeout(() => setHighlightId((h) => (h === messageId ? null : h)), HIGHLIGHT_MS);
  }, []);

  /**
   * Scroll to a message (a reply's original, a pin, a search hit). If it isn't
   * loaded, swap in the page around it — the view is then detached from the
   * live end until it scrolls back down or jumps to latest.
   */
  async function jumpTo(messageId: string) {
    const here = findEl(messageId);
    if (here) {
      here.scrollIntoView({ block: 'center', behavior: 'smooth' });
      highlight(messageId);
      return;
    }
    setJumping(true);
    try {
      const page = await apiFetch<ChatMessagesPageDTO>(`/api/chat/${chatId}/messages?around=${encodeURIComponent(messageId)}`);
      setJumping(false);
      stickToBottom.current = false;
      prependAdjust.current = null;
      atBottom.current = false;
      setNewBelow(0);
      setMessages((prev) => mergeIncoming(prev.filter((m) => m.pending || m.failed), page.messages));
      setHasOlder(page.hasMore);
      hasOlderRef.current = page.hasMore;
      setHasNewer(!!page.hasNewer);
      hasNewerRef.current = !!page.hasNewer;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      findEl(messageId)?.scrollIntoView({ block: 'center' });
      highlight(messageId);
    } catch {
      setJumping(false);
      flash('That message isn’t available anymore.');
    }
  }

  /** Back to the newest messages (from a detached view, or the "new messages" pill). */
  function jumpToLatest() {
    if (!hasNewerRef.current) return scrollToBottom(true);
    atBottom.current = true;
    stickToBottom.current = true;
    setNewBelow(0);
    void loadLatest()
      .then(() => {
        if (document.visibilityState === 'visible') markRead(true);
      })
      .catch(() => flash('Couldn’t load the latest messages.'));
  }

  // Opened on a message (a search hit from another chat): centre it, then drop
  // ?m= so a reload or a later visit opens normally.
  useLayoutEffect(() => {
    if (!initialFocusId) return;
    findEl(initialFocusId)?.scrollIntoView({ block: 'center' });
    highlight(initialFocusId);
    const url = new URL(window.location.href);
    url.searchParams.delete('m');
    window.history.replaceState(window.history.state, '', url);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  // ── sending ────────────────────────────────────────────────────────────────
  async function post(nonce: string) {
    const body = outbox.current.get(nonce);
    if (!body) return;
    try {
      const { message } = await apiFetch<{ message: ChatMessageDTO }>(`/api/chat/${chatId}/messages`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      outbox.current.delete(nonce);
      setMessages((prev) => mergeIncoming(prev, [message]));
    } catch (e) {
      setMessages((prev) => prev.map((x) => (x.clientNonce === nonce ? { ...x, pending: false, failed: true } : x)));
      if (e instanceof Error && !/Request failed/.test(e.message)) flash(e.message);
    }
  }

  function send(out: OutgoingMessage) {
    const nonce = newClientNonce();
    const optimistic: ClientMessage = {
      id: `tmp-${nonce}`,
      chatId,
      author: { id: me.id, name: me.name, image: me.image },
      importedAuthorName: null,
      importedAuthorAvatar: null,
      text: out.text || null,
      createdAt: new Date().toISOString(),
      editedAt: null,
      deleted: false,
      replyToId: replyTo?.id ?? null,
      replyTo: replyTo
        ? {
            id: replyTo.id,
            authorName: replyTo.author?.name ?? replyTo.importedAuthorName,
            text: replyTo.text,
            deleted: replyTo.deleted,
            media: replyTo.attachments[0]?.kind ?? null,
            thumbUrl: replyTo.attachments[0]
              ? replyTo.attachments[0].kind === 'image'
                ? replyTo.attachments[0].url
                : replyTo.attachments[0].posterUrl
              : null,
          }
        : null,
      pinnedAt: null,
      pinnedByName: null,
      mentionsAll: out.mentionsAll,
      mentionIds: out.mentionIds,
      reactions: [],
      attachments: out.previews.map((p, i) => ({ id: `tmp-${nonce}-${i}`, durationSec: null, ...p })),
      clientNonce: nonce,
      pending: true,
    };
    outbox.current.set(nonce, {
      text: out.text || undefined,
      clientNonce: nonce,
      replyToId: replyTo?.id,
      mentionIds: out.mentionIds.length ? out.mentionIds : undefined,
      mentionsAll: out.mentionsAll || undefined,
      attachments: out.attachments.length ? out.attachments : undefined,
      gif: out.gif,
    });
    stickToBottom.current = true;
    atBottom.current = true;
    // The message itself ends my "typing" for everyone; the next one announces afresh.
    typingSentAt.current = 0;
    setNewBelow(0);
    setReplyTo(null);
    setMessages((prev) => [...prev, optimistic]);
    // Sending from a detached view goes back to the live end (unsent copies survive the reload).
    if (hasNewerRef.current) void loadLatest().catch(() => {});
    void post(nonce);
  }

  function retry(m: ClientMessage) {
    if (!m.clientNonce) return;
    setMessages((prev) => prev.map((x) => (x.clientNonce === m.clientNonce ? { ...x, pending: true, failed: false } : x)));
    void post(m.clientNonce);
  }

  // ── per-message actions ────────────────────────────────────────────────────
  async function act(m: ClientMessage, optimistic: Partial<ChatMessageDTO> | null, request: () => Promise<{ message: ChatMessageDTO | null }>) {
    const before = messagesRef.current.find((x) => x.id === m.id);
    if (optimistic) setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...optimistic } : x)));
    try {
      const { message } = await request();
      if (message) replace(message);
    } catch (e) {
      if (before) replace(before);
      flash(e instanceof Error ? e.message : 'That didn’t go through.');
    }
  }

  function toggleReaction(m: ClientMessage, emoji: string) {
    const existing = m.reactions.find((r) => r.emoji === emoji);
    const on = !existing?.mine;
    if (on) rememberEmoji(emoji);
    const reactions = on
      ? existing
        ? m.reactions.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, mine: true, names: [...r.names, me.name] } : r))
        : [...m.reactions, { emoji, count: 1, mine: true, names: [me.name] }]
      : m.reactions
          .map((r) => (r.emoji === emoji ? { ...r, count: r.count - 1, mine: false, names: r.names.filter((n) => n !== me.name) } : r))
          .filter((r) => r.count > 0);
    void act(m, { reactions }, () =>
      apiFetch(`/api/chat/${chatId}/messages/${m.id}/reactions`, { method: 'POST', body: JSON.stringify({ emoji, on }) }),
    );
  }

  function setPinned(m: ClientMessage, pinned: boolean) {
    void act(m, { pinnedAt: pinned ? new Date().toISOString() : null }, async () => {
      const r = await apiFetch<{ message: ChatMessageDTO }>(`/api/chat/${chatId}/messages/${m.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ pinned }),
      });
      void reloadPins();
      return r;
    });
  }

  function remove(m: ClientMessage) {
    void act(m, { deleted: true, text: null, attachments: [], reactions: [], pinnedAt: null }, async () => {
      const r = await apiFetch<{ message: ChatMessageDTO }>(`/api/chat/${chatId}/messages/${m.id}`, { method: 'DELETE' });
      if (m.pinnedAt) void reloadPins();
      return r;
    });
  }

  function saveEdit(text: string) {
    const m = editing;
    if (!m) return;
    setEditing(null);
    void act(m, { text: text || null, editedAt: new Date().toISOString() }, () =>
      apiFetch(`/api/chat/${chatId}/messages/${m.id}`, { method: 'PATCH', body: JSON.stringify({ text }) }),
    );
  }

  // ── render ─────────────────────────────────────────────────────────────────
  const keyboardOpen = box ? box.keyboard > 120 : false;
  // A topic, or the main chat of a chat that has topics, backs out to the
  // chat's page (Main chat + topics); a plain chat backs out to the list.
  const hasTopics = detail.topics.some((t) => !t.archived);
  const backHref = detail.parent || hasTopics ? `${base}/chat/${detail.rootId}/topics` : `${base}/chat`;
  const bottomPad = keyboardOpen ? '0.5rem' : 'max(1.75rem, env(safe-area-inset-bottom))';
  const topPin = pins[0];
  // Looked up live, so a reaction landing while the menu/picker is open shows in it.
  const actionMessage = actionFor ? messages.find((m) => m.id === actionFor.id) : undefined;
  const pickerMessage = pickerFor ? messages.find((m) => m.id === pickerFor) : undefined;

  return (
    <div
      className="fixed inset-x-0 z-[45] flex flex-col bg-chat-canvas"
      style={box ? { top: box.top, height: box.height } : { top: 0, bottom: 0 }}
    >
      {/* Header */}
      <header
        // glow-top continues the status strip down into the header (CMP-1).
        className="shrink-0 border-b border-line bg-glow-top/95 backdrop-blur"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}
      >
        <div className="flex items-center gap-2 px-3 pb-2">
          <Link
            href={backHref}
            replace
            className="btn-icon"
            aria-label={detail.parent || hasTopics ? `Back to ${detail.parent?.name ?? detail.name}` : 'Back to chats'}
          >
            <ChevronLeft width={22} height={22} />
          </Link>
          <button type="button" onClick={() => setSettingsOpen(true)} className="min-w-0 flex-1 text-left">
            <span className="flex items-center gap-1.5">
              <span className="truncate font-display text-lg font-semibold leading-tight">
                {detail.parent ? `# ${detail.name}` : detail.name}
              </span>
              {detail.muted && <BellOff width={14} height={14} className="shrink-0 text-ink-faint" aria-label="Muted" />}
            </span>
            <span className="block truncate text-[13px] leading-[18px] text-ink-faint">
              {detail.parent
                ? detail.parent.name
                : hasTopics
                  ? 'Main chat'
                  : `${detail.members.length} ${detail.members.length === 1 ? 'member' : 'members'}`}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchMounted(true);
              setSearchOpen(true);
            }}
            className="btn-icon"
            aria-label="Search messages"
          >
            <Search width={20} height={20} />
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="btn-icon"
            aria-label="Chat settings"
          >
            <MoreHorizontal width={20} height={20} />
          </button>
        </div>

        {topPin && (
          <button
            type="button"
            onClick={() => (pins.length > 1 ? setPinsOpen(true) : void jumpTo(topPin.id))}
            className="flex w-full items-center gap-2 border-t border-line px-4 py-2 text-left text-sm"
          >
            <Pin width={15} height={15} className="shrink-0 text-accent-ink" />
            <span className="min-w-0 flex-1 truncate">
              <span className="font-semibold">{topPin.author?.name.split(' ')[0] ?? topPin.importedAuthorName ?? 'Pinned'}: </span>
              <span className="text-ink-soft">{snippet(topPin)}</span>
            </span>
            {pins.length > 1 && <span className="shrink-0 text-xs font-semibold text-ink-faint">{pins.length} pinned</span>}
          </button>
        )}
      </header>

      {/* Messages */}
      <div ref={scroller} onScroll={onScroll} className="relative flex-1 overflow-y-auto overscroll-contain px-3 pb-3">
        {hasOlder ? (
          <p className="py-3 text-center text-xs text-ink-faint">{loadingOlder ? 'Loading earlier messages…' : ' '}</p>
        ) : (
          <p className="px-6 pb-2 pt-6 text-center text-xs text-ink-faint">
            {messages.length ? `This is the start of ${detail.parent ? `# ${detail.name}` : detail.name}.` : 'No messages yet — say hello!'}
          </p>
        )}
        <ChatMessages
          messages={messages}
          meId={me.id}
          memberNames={memberNames}
          highlightId={highlightId}
          onRetry={retry}
          onOpenActions={(m, el) => setActionFor({ id: m.id, el })}
          onToggleReaction={toggleReaction}
          onJumpTo={(id) => void jumpTo(id)}
          onOpenMedia={(m, i) => setViewer({ items: splitAttachments(m.attachments).media, start: i })}
        />
        {!hasNewer && <TypingIndicator names={typingNames} />}
      </div>

      {(newBelow > 0 || hasNewer || notice || jumping) && (
        <div
          className="pointer-events-none absolute inset-x-0 z-10 flex flex-col items-center gap-2"
          style={{ bottom: `calc(${bottomPad} + 4.5rem)` }}
        >
          {notice && (
            <p className="pointer-events-auto flex max-w-[90%] items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-app shadow-pop">
              {notice}
              <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
                <X width={14} height={14} />
              </button>
            </p>
          )}
          {jumping && (
            <p className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-app shadow-pop" role="status">
              Finding message…
            </p>
          )}
          {(newBelow > 0 || hasNewer) && !jumping && (
            <button
              type="button"
              onClick={jumpToLatest}
              className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-2 text-sm font-semibold text-accent-fg shadow-pop"
            >
              <ArrowDown width={16} height={16} />{' '}
              {hasNewer ? 'Jump to latest' : `${newBelow} new ${newBelow === 1 ? 'message' : 'messages'}`}
            </button>
          )}
        </div>
      )}

      {detail.archived ? (
        <p
          className="shrink-0 border-t border-line bg-app px-4 pt-3 text-center text-sm text-ink-faint"
          style={{ paddingBottom: 'max(1.75rem, env(safe-area-inset-bottom))' }}
        >
          This {detail.parent ? 'topic' : 'chat'} is archived — it’s read-only.
        </p>
      ) : (
        <ChatComposer
          chatId={chatId}
          meId={me.id}
          members={detail.members}
          canMentionAll={detail.can.mentionAll}
          placeholder={`Message ${detail.parent ? `# ${detail.name}` : detail.name}`}
          bottomPad={bottomPad}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          editing={editing}
          onCancelEdit={() => setEditing(null)}
          onSaveEdit={saveEdit}
          onSend={send}
          onTyping={announceTyping}
        />
      )}

      {actionMessage && actionFor && (
        <MessageMenu
          key={actionMessage.id}
          message={actionMessage}
          bubble={actionFor.el}
          meId={me.id}
          memberNames={memberNames}
          canModerate={detail.can.moderate}
          readOnly={detail.archived}
          onClose={() => setActionFor(null)}
          onReact={(e) => toggleReaction(actionMessage, e)}
          onMoreReactions={() => setPickerFor(actionMessage.id)}
          onReply={() => {
            setEditing(null);
            setReplyTo(actionMessage);
          }}
          onEdit={() => {
            setReplyTo(null);
            setEditing(actionMessage);
          }}
          onPin={(p) => setPinned(actionMessage, p)}
          onDelete={() => remove(actionMessage)}
          onCopied={() => flash('Copied')}
        />
      )}

      {pickerMessage && (
        <EmojiPicker
          selected={new Set(pickerMessage.reactions.filter((r) => r.mine).map((r) => r.emoji))}
          onPick={(e) => toggleReaction(pickerMessage, e)}
          onClose={() => setPickerFor(null)}
        />
      )}

      {pinsOpen && (
        <Modal open onClose={() => setPinsOpen(false)} title={`Pinned (${pins.length})`}>
          <ul className="divide-y divide-line">
            {pins.map((p) => (
              <li key={p.id} className="flex items-start gap-3 py-3">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
                    setPinsOpen(false);
                    void jumpTo(p.id);
                  }}
                >
                  <span className="block text-sm font-semibold">{p.author?.name ?? p.importedAuthorName ?? 'Former member'}</span>
                  <span className="line-clamp-3 text-sm text-ink-soft">{snippet(p)}</span>
                  {p.pinnedByName && <span className="mt-0.5 block text-xs text-ink-faint">Pinned by {p.pinnedByName.split(' ')[0]}</span>}
                </button>
                {!detail.archived && (
                  <button
                    type="button"
                    onClick={() => setPinned(p, false)}
                    className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-ink-faint"
                  >
                    Unpin
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Modal>
      )}

      {viewer && <MediaViewer items={viewer.items} start={viewer.start} onClose={() => setViewer(null)} />}

      {searchMounted && (
        <ChatSearch
          base={base}
          open={searchOpen}
          chat={{ id: detail.rootId, name: detail.parent?.name ?? detail.name }}
          hereId={chatId}
          onJumpHere={(id) => void jumpTo(id)}
          onClose={() => setSearchOpen(false)}
        />
      )}

      {settingsOpen && (
        <ChatSettingsSheet
          base={base}
          meId={me.id}
          detail={detail}
          onChange={setDetail}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

function lastConfirmed(list: ClientMessage[]): ClientMessage | undefined {
  for (let i = list.length - 1; i >= 0; i--) if (!list[i].pending && !list[i].failed) return list[i];
  return undefined;
}

/**
 * Fold server messages into what's shown: replace by id, swap an optimistic
 * copy for its confirmed message (matched on clientNonce), add the rest. Keeps
 * confirmed messages in time order with unsent ones after them.
 */
function mergeIncoming(prev: ClientMessage[], incoming: ChatMessageDTO[]): ClientMessage[] {
  const byId = new Map<string, ClientMessage>();
  const unsent: ClientMessage[] = [];
  for (const m of prev) {
    if (m.pending || m.failed) unsent.push(m);
    else byId.set(m.id, m);
  }
  const settled = new Set<string>();
  for (const m of incoming) {
    byId.set(m.id, m);
    if (m.clientNonce) settled.add(m.clientNonce);
  }
  const confirmed = [...byId.values()].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
  return [...confirmed, ...unsent.filter((m) => !m.clientNonce || !settled.has(m.clientNonce))];
}
