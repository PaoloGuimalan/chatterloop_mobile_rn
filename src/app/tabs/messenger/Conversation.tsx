/* eslint-disable react-native/no-inline-styles */
/* Conversation thread — scoped port of
 * webapp/src/app/tabs/messenger/Conversation.tsx (2369 lines).
 *
 * Covers:
 *   - Inverted FlatList of message bubbles (own = brand right, other
 *     = surface left); image bubbles render alongside text bubbles
 *   - Composer with text + image attachment button. Optimistic pending
 *     bubbles for both kinds; SSE reload replaces them by pendingID
 *   - Load-older on scroll-up; scroll-to-bottom CTA when SSE lands a
 *     new message while the user is reading history
 *   - Typing broadcast + "is typing…" indicator
 *
 * Deferred (TODOs):
 *   - Mentions, replies, reactions, emoji picker for chat.
 *   - Active call UI / media transport (signaling is wired via
 *     CallRequest + EndCallRequest; MediaSoup transport is the cycle
 *     after that).
 *   - Server / group / channel variants beyond what's covered by the
 *     route params shape. */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';

import type { AppState } from '../../../redux/store';
import {
  REMOVE_REJECTED_CALL_LIST,
  SET_ALERTS,
} from '../../../redux/types';
import { useTheme } from '../../../reusables/design/ThemeProvider';
import { CLIcon, IconBtn } from '../../../reusables/design/primitives';
import { radii } from '../../../reusables/design/tokens';
import { timeSince } from '../../../reusables/hooks/reusable';
import {
  CallRequest,
  EndCallRequest,
  InitConversationRequest,
  IsTypingBroadcastRequest,
  SeenMessageRequest,
  SendFilesRequest,
  SendMessageRequest,
  ThreadMessage,
} from '../../../reusables/hooks/requests';
import { pickImages } from '../../../reusables/hooks/imagePicker';
import { generateUUID } from '../../../reusables/hooks/uuid';
import { ConversationInfoModal } from './ConversationInfoModal';
import ContentHandler from './partials/ContentHandler';
import type {
  IContact,
  PaginationProp,
} from '../../../reusables/vars/interfaces';

interface ConversationParams {
  conversationID: string;
  type: 'single' | 'group' | 'server';
  /** Display name in the header. */
  title: string;
  /** Avatar URI for the header (undefined → initial-letter fallback). */
  profile?: string;
  /** User IDs the message should be delivered to. */
  receivers: string[];
}

const RANGE = 20;

export interface ReplyedMessage {
  sender: string;
  content?: string;
  messageType?: string;
}

export interface MessageReaction {
  userID: string;
  emoji: string;
}

export interface DisplayMessage {
  id: string;
  /** Server-assigned MongoDB ObjectID — monotonic, lexically sortable.
   *  Undefined for optimistic-pending bubbles (they have no _id yet). */
  _id?: string;
  conversationID: string;
  messageID: string;
  /** Raw sender userID — kept so the ContentHandler can pivot on
   *  own/other without relying on `isOwn` alone. */
  sender: string;
  /** True for the locally-authored side of the bubble (right-aligned). */
  isOwn: boolean;
  content: string;
  messageType: string;
  /** Display time string ("Just now", "5 minutes ago", etc.). */
  timeLabel: string;
  seeners: string[];
  /** Tombstone — webapp renders a dashed "Message deleted" bubble for
   *  these instead of the regular text bubble. */
  isDeleted?: boolean;
  /** Reply context — passthrough from the server payload. */
  isReply?: boolean;
  replyedmessage?: ReplyedMessage[];
  /** Reactions list — passthrough. ContentHandler renders a pill row
   *  when populated. */
  reactions?: MessageReaction[];
  /** True while the optimistic bubble is in flight. */
  pending?: boolean;
  pendingID?: string;
  /** Renderable image source for image-typed bubbles. Local data URL
   *  while the bubble is optimistic; persisted URL once SSE reloads. */
  imageURI?: string;
  /** Resolved URL/data for non-text bubbles. Falls back from
   *  `references[0].reference` to `content` if it looks like a URL. */
  mediaURI?: string;
  /** Coarse media bucket used to pick the bubble renderer. */
  mediaKind?: 'image' | 'video' | 'audio' | 'file';
  /** Display name shown on file/video/audio cards. */
  fileName?: string;
}

function classifyMediaKind(
  messageType: string,
  referenceMediaType?: string,
): DisplayMessage['mediaKind'] {
  // text and notif have no media bucket; the renderer falls through to
  // the text bubble below.
  if (messageType === 'text' || messageType === 'notif') return undefined;
  const haystack = `${messageType} ${referenceMediaType ?? ''}`.toLowerCase();
  if (haystack.includes('image')) return 'image';
  if (haystack.includes('video')) return 'video';
  if (haystack.includes('audio')) return 'audio';
  return 'file';
}

type ThreadRef = NonNullable<ThreadMessage['references']>[number];

function deriveFileName(
  m: ThreadMessage,
  firstRef: ThreadRef | undefined,
  kind: DisplayMessage['mediaKind'],
): string | undefined {
  // Prefer an explicit name on the reference; otherwise pull the last
  // path segment off whatever URL we have. Falls back to a sensible
  // kind-keyed label so the bubble always reads something useful.
  const explicit = (firstRef as { name?: string } | undefined)?.name;
  if (explicit) return explicit;
  const url = firstRef?.reference ?? m.content;
  if (url && !url.startsWith('data:')) {
    const cleaned = url.split('?')[0];
    const tail = cleaned.split('/').pop();
    if (tail) return tail;
  }
  if (kind === 'video') return 'Video';
  if (kind === 'audio') return 'Audio';
  if (kind === 'file') return 'File';
  return undefined;
}

function toDisplay(m: ThreadMessage, authUserID: string): DisplayMessage {
  const d = m.messageDate;
  const timeLabel =
    typeof d === 'string'
      ? timeSince(d)
      : d?.time
      ? `${d.date} · ${d.time}`
      : timeSince(d?.date ?? '');
  // For non-text messages the server returns the persisted URL in
  // `references[0].reference`; optimistic bubbles may carry a data URL
  // (or remote URL on confirmed-but-pre-reload server response) in
  // `content` instead. mediaKind is the bucket the renderer switches
  // on; imageURI is kept as a back-compat alias for the image branch.
  const firstRef = m.references?.[0];
  const mediaKind = classifyMediaKind(
    m.messageType,
    firstRef?.referenceMediaType,
  );
  let mediaURI: string | undefined;
  if (mediaKind) {
    const candidate = firstRef?.reference ?? m.content;
    if (candidate) mediaURI = candidate;
  }
  const fileName =
    mediaKind && mediaKind !== 'image'
      ? deriveFileName(m, firstRef, mediaKind)
      : undefined;
  const sender = m.sender ?? m.userID;
  // Passthrough fields the backend may decorate onto messages once
  // reply/reactions land; cast off the index signature here so the
  // ContentHandler can read them with proper types downstream.
  const passthrough = m as unknown as {
    isReply?: boolean;
    replyedmessage?: ReplyedMessage[];
    reactions?: MessageReaction[];
  };
  return {
    id: m._id ?? m.pendingID ?? `${m.conversationID}-${m.userID}-${timeLabel}`,
    _id: m._id,
    conversationID: m.conversationID,
    messageID: m.messageID,
    sender,
    isOwn: m.userID === authUserID || m.sender === authUserID,
    content: m.content,
    messageType: m.messageType,
    timeLabel,
    seeners: m.seeners,
    isDeleted: m.isDeleted === true,
    isReply: passthrough.isReply === true,
    replyedmessage: passthrough.replyedmessage,
    reactions: passthrough.reactions,
    pendingID: m.pendingID,
    imageURI: mediaKind === 'image' ? mediaURI : undefined,
    mediaURI,
    mediaKind,
    fileName,
  };
}

/** Sort newest-first. Pending bubbles (no `_id` yet) are always newest;
 *  server-confirmed messages compare by their ObjectID (lexically
 *  monotonic). Mirrors the webapp's `b._id.localeCompare(a._id)`.
 *  The inverted FlatList renders index 0 at the bottom — newest at
 *  index 0 means newest at the bottom of the viewport. */
function sortNewestFirst(arr: DisplayMessage[]): DisplayMessage[] {
  return [...arr].sort((a, b) => {
    if (a._id && b._id) return b._id.localeCompare(a._id);
    if (!a._id && !b._id) return 0; // both pending — keep insertion order
    return a._id ? 1 : -1; // pending (no _id) is newer
  });
}

export default function Conversation() {
  const { palette } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = route.params as ConversationParams;
  const dispatch = useDispatch();
  const alerts = useSelector((s: AppState) => s.alerts);
  const authentication = useSelector((s: AppState) => s.authentication);
  const me = authentication.user.userID;
  const istypinglist = useSelector(
    (s: AppState) =>
      s.istypinglist as unknown as {
        conversationID: string;
        userID?: string;
      }[],
  );
  const contactslist = useSelector(
    (s: AppState) => s.contactslist as PaginationProp<IContact>,
  );

  // userID → first-name resolver for the ContentHandler. We include
  // the current user so own-messages can look up "you" naturally, and
  // every contact from both directions (action_by / involved_user)
  // so direction of original request doesn't matter.
  const memberName = useCallback(
    (userID: string): string => {
      if (userID === me) {
        return authentication.user.fullName?.firstName ?? 'You';
      }
      for (const c of contactslist.results ?? []) {
        if (c.type !== 'single') continue;
        if (c.action_by?.id === userID) return c.action_by.first_name;
        if (c.involved_user?.id === userID) return c.involved_user.first_name;
      }
      return 'Someone';
    },
    [authentication.user.fullName?.firstName, contactslist.results, me],
  );

  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [dialing, setDialing] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  // Set when an outbound call is ringing. Drives the inline
  // OutgoingCallModal at the bottom of this screen.
  const [outgoing, setOutgoing] = useState<{
    callType: 'audio' | 'video';
    startedAt: number;
  } | null>(null);
  const rejectedcalls = useSelector(
    (s: AppState) => s.rejectedcalllist as string[],
  );
  // Pagination state. `page` is the latest page we've successfully fetched
  // (1-indexed). `total` is the server's reported message count — once
  // we've loaded enough messages to cover it, we stop firing onEndReached.
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  // Webapp pattern: stay "already typing" for 5s after a broadcast, then
  // reset. While reset, the next keystroke fires another broadcast.
  // Using state (not a ref) so the cooldown useEffect picks it up.
  const [isAlreadyTyping, setIsAlreadyTyping] = useState(false);
  const inputRef = useRef<TextInput>(null);
  // Seen-on-view tracking. We never re-send IDs the server has already
  // confirmed (alreadySeenRef), and the queue (unreadRef) is flushed
  // after a 2s quiet window so a quick scroll-through batches into a
  // single request instead of one per visible bubble.
  const alreadySeenRef = useRef<Set<string>>(new Set());
  const unreadRef = useRef<Set<string>>(new Set());
  const seenFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // FlatList ref + bottom-proximity tracking so we can flag "new messages"
  // when SSE lands a message while the user is scrolled up.
  const flatListRef = useRef<FlatList<DisplayMessage>>(null);
  const isNearBottomRef = useRef(true);
  const [hasUnseenNew, setHasUnseenNew] = useState(false);

  const load = useCallback(async () => {
    const result = await InitConversationRequest(
      params.conversationID,
      1,
      RANGE,
    );
    if (result) {
      const next = result.messages.map(m => toDisplay(m, me));
      // Drop any pending bubble we're locally tracking that the server
      // has now confirmed (matched by pendingID).
      setMessages(prev => {
        const confirmedPendingIDs = new Set(
          next.map(m => m.pendingID).filter(Boolean),
        );
        const stillPending = prev.filter(
          m => m.pending && !confirmedPendingIDs.has(m.pendingID),
        );
        // Preserve any older history already paged in (entries with _id
        // not represented in the page-1 fetch).
        const fetchedIDs = new Set(next.map(m => m._id).filter(Boolean));
        const olderHistory = prev.filter(
          m => !m.pending && m._id && !fetchedIDs.has(m._id),
        );
        return sortNewestFirst([...stillPending, ...next, ...olderHistory]);
      });
      setTotal(result.total);
      setPage(1);
    }
    setIsLoading(false);
  }, [me, params.conversationID]);

  // Reset per-conversation seen trackers when the route changes. Without
  // this, swapping into a new thread would re-use the prior thread's
  // "already seen" set and skip legitimately-unread messages.
  useEffect(() => {
    alreadySeenRef.current = new Set();
    unreadRef.current = new Set();
    if (seenFlushTimerRef.current) {
      clearTimeout(seenFlushTimerRef.current);
      seenFlushTimerRef.current = null;
    }
  }, [params.conversationID]);

  // Debounced flush — sends every queued unread ID, then marks them
  // as already-seen so they don't re-queue if the bubble re-enters
  // the viewport later. Cancels the prior timer on each new entry so
  // the request only fires after 2s of viewport quiet.
  const queueSeen = useCallback(
    (id: string) => {
      if (alreadySeenRef.current.has(id)) return;
      unreadRef.current.add(id);
      if (seenFlushTimerRef.current) clearTimeout(seenFlushTimerRef.current);
      seenFlushTimerRef.current = setTimeout(() => {
        const ids = Array.from(unreadRef.current);
        if (ids.length === 0) return;
        // Optimistically mark these as seen before the request returns
        // so concurrent viewport events don't re-queue them.
        ids.forEach(x => alreadySeenRef.current.add(x));
        unreadRef.current.clear();
        SeenMessageRequest({
          conversationID: params.conversationID,
          range: RANGE,
          receivers: params.receivers,
          messageIDs: ids,
        });
      }, 2000);
    },
    [params.conversationID, params.receivers],
  );

  const viewabilityConfigRef = useRef({
    itemVisiblePercentThreshold: 60,
    minimumViewTime: 250,
  });

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      viewableItems.forEach(token => {
        const item = token.item as DisplayMessage;
        console.log(item.seeners);
        if (!item || !item.messageID || item.isOwn || item.seeners.includes(me))
          return;
        queueSeen(item.messageID);
      });
    },
  );

  // Keep the latest closure reachable inside the ref so the FlatList
  // callback (which captures the ref ONCE) sees the freshest queueSeen.
  useEffect(() => {
    onViewableItemsChanged.current = ({ viewableItems }) => {
      viewableItems.forEach(token => {
        const item = token.item as DisplayMessage;
        if (!item || !item.messageID || item.isOwn || item.seeners.includes(me))
          return;
        queueSeen(item.messageID);
      });
    };
  }, [queueSeen, me]);

  const loadOlder = useCallback(async () => {
    if (loadingOlder) return;
    // Server reported total tells us when we've drained the history.
    if (total !== null && messages.length >= total) return;
    setLoadingOlder(true);
    const nextPage = page + 1;
    const result = await InitConversationRequest(
      params.conversationID,
      nextPage,
      RANGE,
    );
    if (result) {
      const older = result.messages.map(m => toDisplay(m, me));
      // Dedup by id then sort. Sorting again is cheap and immune to any
      // page-boundary race where SSE landed a brand-new message between
      // the page+1 request firing and the response arriving.
      setMessages(prev => {
        const known = new Set(prev.map(m => m.id));
        const fresh = older.filter(m => !known.has(m.id));
        return sortNewestFirst([...prev, ...fresh]);
      });
      setPage(nextPage);
      setTotal(result.total);
    }
    setLoadingOlder(false);
  }, [loadingOlder, total, messages.length, page, params.conversationID, me]);

  useEffect(() => {
    load();
  }, [load]);

  // SSE relay: sse.ts emits a DeviceEventEmitter event keyed by the
  // conversationID whenever a new message lands for it.
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      params.conversationID,
      ({ event }: { event: string }) => {
        if (event === 'reload' || event === 'reload_deleted_message') {
          load();
          // If the user has scrolled up to read history, surface a CTA
          // instead of silently dropping the new bubble at the top.
          if (!isNearBottomRef.current) setHasUnseenNew(true);
        }
      },
    );
    return () => sub.remove();
  }, [load, params.conversationID]);

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    setHasUnseenNew(false);
  }, []);

  const onSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;
    const pendingID = generateUUID();
    const optimistic: DisplayMessage = {
      id: pendingID,
      conversationID: params.conversationID,
      messageID: pendingID,
      sender: me,
      isOwn: true,
      content: text,
      messageType: 'text',
      timeLabel: 'Just now',
      seeners: [],
      pending: true,
      pendingID,
    };
    // Inverted FlatList renders index 0 at the bottom — put new
    // messages at the top of the array. sortNewestFirst keeps pending
    // bubbles ahead of any in-flight SSE arrivals from the other party.
    setMessages(prev => sortNewestFirst([optimistic, ...prev]));
    setDraft('');
    setSending(true);
    const ok = await SendMessageRequest({
      conversationID: params.conversationID,
      pendingID,
      receivers: params.receivers,
      content: text,
      messageType: 'text',
      conversationType: params.type,
    });
    if (!ok) {
      // Roll the bubble back if the request failed entirely.
      setMessages(prev => prev.filter(m => m.pendingID !== pendingID));
    }
    setSending(false);
    // SSE reload will replace the optimistic bubble with the
    // server-confirmed version (matched on pendingID).
    setIsAlreadyTyping(false);
  }, [draft, me, params, sending]);

  // 5-second typing cooldown — mirrors webapp. After the cooldown,
  // the next keystroke re-fires IsTypingBroadcastRequest so the other
  // party's indicator stays alive for the duration of long messages.
  useEffect(() => {
    if (!isAlreadyTyping) return;
    const t = setTimeout(() => setIsAlreadyTyping(false), 5000);
    return () => clearTimeout(t);
  }, [isAlreadyTyping]);

  const onAttachImages = useCallback(async () => {
    if (attaching) return;
    setAttaching(true);
    const picked = await pickImages({ selectionLimit: 0, mediaType: 'photo' });
    if (picked.length === 0) {
      setAttaching(false);
      return;
    }
    // One pendingID per file so each bubble can be matched back when
    // SSE reload replays the server's confirmed messages.
    const groupID = generateUUID();
    const files = picked.map((p, i) => ({
      conversationID: params.conversationID,
      pendingID: `${groupID}_${i}`,
      reference: p.base,
      referenceMediaType: p.type,
      type: p.type,
      name: p.name,
    }));
    const optimistic: DisplayMessage[] = files.map(f => ({
      id: f.pendingID,
      conversationID: params.conversationID,
      messageID: f.pendingID,
      sender: me,
      isOwn: true,
      content: f.reference,
      messageType: 'image',
      timeLabel: 'Just now',
      seeners: [],
      pending: true,
      pendingID: f.pendingID,
      imageURI: f.reference,
      mediaURI: f.reference,
      mediaKind: 'image',
    }));
    setMessages(prev => sortNewestFirst([...optimistic, ...prev]));
    const ok = await SendFilesRequest({
      conversationID: params.conversationID,
      receivers: params.receivers,
      files,
      conversationType: params.type,
    });
    if (!ok) {
      const pendingSet = new Set(files.map(f => f.pendingID));
      setMessages(prev =>
        prev.filter(m => !m.pendingID || !pendingSet.has(m.pendingID)),
      );
    }
    setAttaching(false);
  }, [attaching, me, params.conversationID, params.receivers, params.type]);

  const onStartCall = useCallback(async () => {
    if (dialing || outgoing) return;
    if (params.receivers.length === 0) {
      dispatch({
        type: SET_ALERTS,
        payload: {
          alerts: {
            id: alerts.length,
            type: 'warning',
            content: 'No one to call in this conversation.',
          },
        },
      });
      return;
    }
    setDialing(true);
    // v1 mobile only dials audio. Webapp surfaces audio/video as two
    // buttons; mobile gets video alongside the active-call UI cycle.
    //
    // Payload mirrors webapp Conversation.tsx exactly — the backend
    // keys are `recepients` (misspelled) and `caller`, and it relies
    // on `callDisplayName` + `displayImage` to populate the
    // receiver's incoming-call modal. Omitting any of these makes
    // the fan-out silently drop the request.
    const callerName = authentication.user.fullName.firstName;
    const ok = await CallRequest({
      callType: 'audio',
      callDisplayName:
        params.type === 'single'
          ? callerName
          : `${params.title} (Group)`,
      conversationType: params.type,
      conversationID: params.conversationID,
      caller: { name: callerName, userID: authentication.user.userID },
      recepients: params.receivers,
      displayImage:
        params.type === 'single' ? params.profile ?? 'none' : 'none',
    });
    setDialing(false);
    if (ok) {
      setOutgoing({ callType: 'audio', startedAt: Date.now() });
    } else {
      dispatch({
        type: SET_ALERTS,
        payload: {
          alerts: {
            id: alerts.length,
            type: 'error',
            content: 'Could not start the call.',
          },
        },
      });
    }
  }, [
    alerts.length,
    authentication.user.fullName.firstName,
    authentication.user.userID,
    dialing,
    dispatch,
    outgoing,
    params.conversationID,
    params.profile,
    params.receivers,
    params.title,
    params.type,
  ]);

  // Cancel an in-progress outbound ring. Fires EndCallRequest so the
  // backend stops fan-out and any receiver modal dismisses too.
  const onCancelCall = useCallback(() => {
    if (!outgoing) return;
    setOutgoing(null);
    EndCallRequest({
      conversationID: params.conversationID,
      conversationType: params.type,
      recepients: params.receivers,
    });
  }, [outgoing, params.conversationID, params.receivers, params.type]);

  // Watch for a declined ring: when our conversationID lands in
  // rejectedcalllist, dismiss the ringing modal and surface a toast.
  // Then drop the entry so a re-dial doesn't auto-dismiss.
  useEffect(() => {
    if (!outgoing) return;
    if (!rejectedcalls.includes(params.conversationID)) return;
    setOutgoing(null);
    dispatch({
      type: REMOVE_REJECTED_CALL_LIST,
      payload: { callID: params.conversationID },
    });
    dispatch({
      type: SET_ALERTS,
      payload: {
        alerts: {
          id: alerts.length,
          type: 'info',
          content: `${params.title} declined the call.`,
        },
      },
    });
  }, [
    alerts.length,
    dispatch,
    outgoing,
    params.conversationID,
    params.title,
    rejectedcalls,
  ]);

  // Bail out cleanly if the user navigates away while ringing — fire
  // EndCallRequest so the receiver's modal dismisses. Track via a ref
  // so the unmount cleanup sees the current value without re-firing
  // the effect on every ringing-state change. Also stash the metadata
  // we'll need at unmount time, so the cleanup doesn't have to read
  // stale closures of conversationType / receivers.
  const outgoingRef = useRef(outgoing);
  useEffect(() => {
    outgoingRef.current = outgoing;
  }, [outgoing]);
  const endCallMetaRef = useRef({
    conversationID: params.conversationID,
    conversationType: params.type,
    recepients: params.receivers,
  });
  useEffect(() => {
    endCallMetaRef.current = {
      conversationID: params.conversationID,
      conversationType: params.type,
      recepients: params.receivers,
    };
  }, [params.conversationID, params.receivers, params.type]);
  useEffect(() => {
    return () => {
      if (outgoingRef.current) {
        EndCallRequest(endCallMetaRef.current);
      }
    };
  }, []);

  const onChangeDraft = useCallback(
    (text: string) => {
      // Fire only when transitioning from "not typing" → "typing". The
      // 5s cooldown effect flips isAlreadyTyping back to false, at
      // which point continued typing re-fires the broadcast so the
      // receiver's indicator stays alive past the auto-clear window.
      if (text !== '' && !isAlreadyTyping) {
        setIsAlreadyTyping(true);
        IsTypingBroadcastRequest({
          conversationID: params.conversationID,
          receivers: params.receivers,
        });
      }
      setDraft(text);
    },
    [isAlreadyTyping, params.conversationID, params.receivers],
  );

  // Someone else typing in this conversation? Webapp's istyping_broadcast
  // payload is `{ conversationID, userID }` — filter to entries that
  // aren't us and that belong to this thread.
  const othersTyping = istypinglist.some(
    t => t.conversationID === params.conversationID && t.userID !== me,
  );

  const openMedia = useCallback((uri?: string) => {
    if (!uri || uri.startsWith('data:')) return;
    Linking.openURL(uri).catch(err =>
      console.log('[Conversation.openMedia]', err),
    );
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: DisplayMessage; index: number }) => {
      return (
        <ContentHandler
          cnvs={item}
          i={index}
          conversationType={params.type}
          me={me}
          memberName={memberName}
          onOpenMedia={openMedia}
        />
      );
    },
    [me, memberName, openMedia, params.type],
  );

  const hasAvatar = params.profile && params.profile !== 'none';
  const initial = params.title.charAt(0).toUpperCase();

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.screen, { backgroundColor: palette.bg }]}
    >
      <View style={[styles.headerBar, { borderBottomColor: palette.border }]}>
        <IconBtn
          n="arrow-back"
          iconSize={22}
          color={palette.text}
          onPress={() => navigation.goBack()}
        />
        {hasAvatar ? (
          <Image source={{ uri: params.profile }} style={styles.headerAvatar} />
        ) : (
          <View
            style={[
              styles.headerAvatar,
              styles.avatarFallback,
              { backgroundColor: palette.brandSoft },
            ]}
          >
            <Text style={[styles.headerInitial, { color: palette.brand }]}>
              {initial}
            </Text>
          </View>
        )}
        <View style={styles.headerCopy}>
          <Text
            numberOfLines={1}
            style={[styles.headerTitle, { color: palette.text }]}
          >
            {params.title}
          </Text>
          <Text style={[styles.headerSub, { color: palette.text3 }]}>
            {params.type === 'group'
              ? 'Group chat'
              : params.type === 'server'
              ? 'Server channel'
              : 'Direct message'}
          </Text>
        </View>
        {params.type === 'server' ? null : (
          <IconBtn
            n="call"
            iconSize={20}
            color={dialing ? palette.text3 : palette.text2}
            onPress={onStartCall}
          />
        )}
        <IconBtn
          n="info-outline"
          iconSize={20}
          color={palette.text2}
          onPress={() => setInfoOpen(true)}
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.body}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={palette.brand} />
          </View>
        ) : (
          <View style={styles.listWrap}>
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={m => m.messageID}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              inverted
              onEndReached={loadOlder}
              onEndReachedThreshold={0.25}
              // Mark messages as seen only when they actually appear
              // in the viewport (≥60% visible for ≥250ms). The wrapper
              // ref dereferences the latest closure so queueSeen stays
              // current without breaking FlatList's "callback must not
              // change" rule.
              viewabilityConfig={viewabilityConfigRef.current}
              onViewableItemsChanged={info => {
                onViewableItemsChanged.current(info);
              }}
              // Inverted list: offset 0 == newest at the bottom of the
              // viewport. Treat anything within 80px as "near bottom" so
              // small momentum/keyboard overshoot doesn't trip the CTA.
              onScroll={e => {
                const y = e.nativeEvent.contentOffset.y;
                const near = y < 80;
                isNearBottomRef.current = near;
                if (near && hasUnseenNew) setHasUnseenNew(false);
              }}
              scrollEventThrottle={64}
              // Inverted list: the "footer" renders visually at the TOP,
              // which is exactly where the older-message spinner belongs.
              ListFooterComponent={
                loadingOlder ? (
                  <View style={styles.olderSpinner}>
                    <ActivityIndicator color={palette.text3} />
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <View style={[styles.empty, { transform: [{ scaleY: -1 }] }]}>
                  <CLIcon
                    n="chat-bubble-outline"
                    size={32}
                    color={palette.text3}
                  />
                  <Text style={[styles.emptyText, { color: palette.text3 }]}>
                    No messages yet
                  </Text>
                </View>
              }
            />
            {hasUnseenNew ? (
              <Pressable
                onPress={scrollToBottom}
                style={({ pressed }) => [
                  styles.newMsgCTA,
                  {
                    backgroundColor: palette.brand,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <CLIcon n="arrow-downward" size={16} color="#fff" />
                <Text style={styles.newMsgCTAText}>New messages</Text>
              </Pressable>
            ) : null}
          </View>
        )}

        {othersTyping ? (
          <View style={styles.typingBar}>
            <Text style={[styles.typingText, { color: palette.text3 }]}>
              {params.type === 'single' ? 'is typing…' : 'someone is typing…'}
            </Text>
          </View>
        ) : null}

        <View style={[styles.composer, { borderTopColor: palette.border }]}>
          <Pressable
            disabled={attaching}
            onPress={onAttachImages}
            style={({ pressed }) => [
              styles.attachBtn,
              {
                backgroundColor: palette.surface2,
                opacity: attaching ? 0.5 : pressed ? 0.7 : 1,
              },
            ]}
          >
            {attaching ? (
              <ActivityIndicator size="small" color={palette.brand} />
            ) : (
              <CLIcon n="image" size={20} color={palette.green} />
            )}
          </Pressable>
          <TextInput
            ref={inputRef}
            value={draft}
            onChangeText={onChangeDraft}
            placeholder="Write a message"
            placeholderTextColor={palette.text3}
            multiline
            style={[
              styles.composerInput,
              {
                backgroundColor: palette.input,
                color: palette.text,
              },
            ]}
          />
          <Pressable
            disabled={!draft.trim() || sending}
            onPress={onSend}
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor: palette.brand,
                opacity: !draft.trim() || sending ? 0.5 : pressed ? 0.8 : 1,
              },
            ]}
          >
            <CLIcon n="send" size={20} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <ConversationInfoModal
        visible={infoOpen}
        onClose={() => setInfoOpen(false)}
        title={params.title}
        profile={params.profile}
        type={params.type}
        conversationID={params.conversationID}
        receivers={params.receivers}
      />

      {outgoing ? (
        <View style={styles.outgoingScrim}>
          <View
            style={[
              styles.outgoingCard,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
              },
            ]}
          >
            <Text style={[styles.outgoingKicker, { color: palette.text3 }]}>
              CALLING · {outgoing.callType === 'video' ? 'VIDEO' : 'AUDIO'}
            </Text>
            {params.profile ? (
              <Image
                source={{ uri: params.profile }}
                style={styles.outgoingAvatar}
              />
            ) : (
              <View
                style={[
                  styles.outgoingAvatar,
                  styles.outgoingAvatarFallback,
                  { backgroundColor: palette.brandSoft },
                ]}
              >
                <Text
                  style={[styles.outgoingInitial, { color: palette.brand }]}
                >
                  {params.title.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={[styles.outgoingName, { color: palette.text }]}>
              {params.title}
            </Text>
            <Text style={[styles.outgoingSub, { color: palette.text3 }]}>
              Ringing…
            </Text>
            <Pressable
              onPress={onCancelCall}
              style={({ pressed }) => [
                styles.outgoingCancel,
                {
                  backgroundColor: palette.pink,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <CLIcon n="call-end" size={26} color="#fff" />
              <Text style={styles.outgoingCancelLabel}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  outgoingScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  outgoingCard: {
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  outgoingKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  outgoingAvatar: {
    width: 96,
    height: 96,
    borderRadius: radii.pill,
    marginTop: 6,
  },
  outgoingAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  outgoingInitial: { fontSize: 36, fontWeight: '800' },
  outgoingName: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginTop: 8,
  },
  outgoingSub: { fontSize: 13, fontWeight: '600' },
  outgoingCancel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    height: 48,
    borderRadius: radii.pill,
    marginTop: 14,
  },
  outgoingCancelLabel: { color: '#fff', fontSize: 13, fontWeight: '800' },

  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 10,
    gap: 8,
    borderBottomWidth: 1,
  },
  headerAvatar: { width: 36, height: 36, borderRadius: radii.pill },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  headerInitial: { fontSize: 15, fontWeight: '800' },
  headerCopy: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  headerSub: { fontSize: 11, marginTop: 1 },

  listContent: { padding: 12, gap: 4 },

  empty: {
    flex: 1,
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: { fontSize: 13, fontWeight: '600' },
  olderSpinner: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  typingBar: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  typingText: { fontSize: 12, fontStyle: 'italic' },
  listWrap: { flex: 1 },
  newMsgCTA: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 32,
    borderRadius: radii.pill,
  },
  newMsgCTAText: { color: '#fff', fontSize: 12.5, fontWeight: '700' },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
    borderTopWidth: 1,
  },
  composerInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    borderRadius: radii.md,
    fontSize: 14,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
