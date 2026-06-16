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
 *   - Voice / video call buttons (depends on MediaSoup port).
 *   - Server / group / channel variants beyond what's covered by the
 *     route params shape. */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSelector } from 'react-redux';

import type { AppState } from '../../../redux/store';
import { useTheme } from '../../../reusables/design/ThemeProvider';
import { CLIcon, IconBtn } from '../../../reusables/design/primitives';
import { radii } from '../../../reusables/design/tokens';
import { timeSince } from '../../../reusables/hooks/reusable';
import {
  InitConversationRequest,
  IsTypingBroadcastRequest,
  SeenMessageRequest,
  SendFilesRequest,
  SendMessageRequest,
  ThreadMessage,
} from '../../../reusables/hooks/requests';
import { pickImages } from '../../../reusables/hooks/imagePicker';
import { generateUUID } from '../../../reusables/hooks/uuid';

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

interface DisplayMessage {
  id: string;
  /** Server-assigned MongoDB ObjectID — monotonic, lexically sortable.
   *  Undefined for optimistic-pending bubbles (they have no _id yet). */
  _id?: string;
  /** True for the locally-authored side of the bubble (right-aligned). */
  isOwn: boolean;
  content: string;
  messageType: string;
  /** Display time string ("Just now", "5 minutes ago", etc.). */
  timeLabel: string;
  /** True while the optimistic bubble is in flight. */
  pending?: boolean;
  pendingID?: string;
  /** Renderable image source for image-typed bubbles. Local data URL
   *  while the bubble is optimistic; persisted URL once SSE reloads. */
  imageURI?: string;
}

function toDisplay(
  m: ThreadMessage,
  authUserID: string,
): DisplayMessage {
  const d = m.messageDate;
  const timeLabel =
    typeof d === 'string'
      ? timeSince(d)
      : d?.time
        ? `${d.date} · ${d.time}`
        : timeSince(d?.date ?? '');
  // For image messages the server returns the persisted URL in
  // `references[0].reference`; older/optimistic shapes may carry it
  // in `content` as a data URL.
  const firstRef = m.references?.[0];
  const imageURI =
    m.messageType === 'image' || firstRef?.referenceMediaType === 'image'
      ? firstRef?.reference ?? (m.content?.startsWith('data:') ? m.content : undefined)
      : undefined;
  return {
    id: m._id ?? m.pendingID ?? `${m.conversationID}-${m.userID}-${timeLabel}`,
    _id: m._id,
    isOwn: m.userID === authUserID || m.sender === authUserID,
    content: m.isDeleted ? '[Deleted message]' : m.content,
    messageType: m.messageType,
    timeLabel,
    pendingID: m.pendingID,
    imageURI,
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
  const authentication = useSelector((s: AppState) => s.authentication);
  const me = authentication.user.userID;
  const istypinglist = useSelector(
    (s: AppState) =>
      s.istypinglist as unknown as {
        conversationID: string;
        userID?: string;
      }[],
  );

  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [attaching, setAttaching] = useState(false);
  // Pagination state. `page` is the latest page we've successfully fetched
  // (1-indexed). `total` is the server's reported message count — once
  // we've loaded enough messages to cover it, we stop firing onEndReached.
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  // True between the first non-empty keystroke and the next time the
  // draft empties out. Gates the typing broadcast so we don't hit the
  // endpoint on every keystroke — matches the webapp behavior.
  const isAlreadyTypingRef = useRef(false);
  const inputRef = useRef<TextInput>(null);
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
      const next = result.messages.map((m) => toDisplay(m, me));
      // Drop any pending bubble we're locally tracking that the server
      // has now confirmed (matched by pendingID).
      setMessages((prev) => {
        const confirmedPendingIDs = new Set(
          next.map((m) => m.pendingID).filter(Boolean),
        );
        const stillPending = prev.filter(
          (m) => m.pending && !confirmedPendingIDs.has(m.pendingID),
        );
        // Preserve any older history already paged in (entries with _id
        // not represented in the page-1 fetch).
        const fetchedIDs = new Set(next.map((m) => m._id).filter(Boolean));
        const olderHistory = prev.filter(
          (m) => !m.pending && m._id && !fetchedIDs.has(m._id),
        );
        return sortNewestFirst([...stillPending, ...next, ...olderHistory]);
      });
      setTotal(result.total);
      setPage(1);

      // Mark non-own page-1 messages as seen. Backend filters to actually
      // unread ones — we send the candidate set, it returns confirmed
      // seen IDs (we don't track unread locally yet).
      const candidateIDs = result.messages
        .filter((m) => m.userID !== me && m.sender !== me)
        .map((m) => m._id)
        .filter(Boolean);
      if (candidateIDs.length > 0) {
        SeenMessageRequest({
          conversationID: params.conversationID,
          range: RANGE,
          receivers: params.receivers,
          messageIDs: candidateIDs,
        });
      }
    }
    setIsLoading(false);
  }, [me, params.conversationID, params.receivers]);

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
      const older = result.messages.map((m) => toDisplay(m, me));
      // Dedup by id then sort. Sorting again is cheap and immune to any
      // page-boundary race where SSE landed a brand-new message between
      // the page+1 request firing and the response arriving.
      setMessages((prev) => {
        const known = new Set(prev.map((m) => m.id));
        const fresh = older.filter((m) => !known.has(m.id));
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
      isOwn: true,
      content: text,
      messageType: 'text',
      timeLabel: 'Just now',
      pending: true,
      pendingID,
    };
    // Inverted FlatList renders index 0 at the bottom — put new
    // messages at the top of the array. sortNewestFirst keeps pending
    // bubbles ahead of any in-flight SSE arrivals from the other party.
    setMessages((prev) => sortNewestFirst([optimistic, ...prev]));
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
      setMessages((prev) => prev.filter((m) => m.pendingID !== pendingID));
    }
    setSending(false);
    // SSE reload will replace the optimistic bubble with the
    // server-confirmed version (matched on pendingID).
    isAlreadyTypingRef.current = false;
  }, [draft, params, sending]);

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
    const optimistic: DisplayMessage[] = files.map((f) => ({
      id: f.pendingID,
      isOwn: true,
      content: f.reference,
      messageType: 'image',
      timeLabel: 'Just now',
      pending: true,
      pendingID: f.pendingID,
      imageURI: f.reference,
    }));
    setMessages((prev) => sortNewestFirst([...optimistic, ...prev]));
    const ok = await SendFilesRequest({
      conversationID: params.conversationID,
      receivers: params.receivers,
      files,
      conversationType: params.type,
    });
    if (!ok) {
      const pendingSet = new Set(files.map((f) => f.pendingID));
      setMessages((prev) =>
        prev.filter((m) => !m.pendingID || !pendingSet.has(m.pendingID)),
      );
    }
    setAttaching(false);
  }, [attaching, params.conversationID, params.receivers, params.type]);

  const onChangeDraft = useCallback(
    (text: string) => {
      if (text !== '' && !isAlreadyTypingRef.current) {
        isAlreadyTypingRef.current = true;
        IsTypingBroadcastRequest({
          conversationID: params.conversationID,
          receivers: params.receivers,
        });
      } else if (text === '') {
        // Reset so the next keystroke re-broadcasts.
        isAlreadyTypingRef.current = false;
      }
      setDraft(text);
    },
    [params.conversationID, params.receivers],
  );

  // Someone else typing in this conversation? Webapp's istyping_broadcast
  // payload is `{ conversationID, userID }` — filter to entries that
  // aren't us and that belong to this thread.
  const othersTyping = istypinglist.some(
    t => t.conversationID === params.conversationID && t.userID !== me,
  );

  const renderItem = useCallback(
    ({ item }: { item: DisplayMessage }) => {
      const isText = item.messageType === 'text' || item.messageType === 'notif';
      const isImage = item.messageType === 'image' && item.imageURI;
      return (
        <View
          style={[
            styles.row,
            item.isOwn ? styles.rowOwn : styles.rowOther,
          ]}
        >
          {isImage ? (
            <View
              style={[
                styles.imageBubble,
                { backgroundColor: palette.surface2, opacity: item.pending ? 0.7 : 1 },
              ]}
            >
              <Image
                source={{ uri: item.imageURI }}
                style={styles.imageBubbleImg}
                resizeMode="cover"
              />
            </View>
          ) : (
            <View
              style={[
                styles.bubble,
                item.isOwn
                  ? { backgroundColor: palette.brand }
                  : {
                      backgroundColor: palette.surface,
                      borderColor: palette.border,
                      borderWidth: 1,
                    },
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  {
                    color: item.isOwn ? '#fff' : palette.text,
                    opacity: item.pending ? 0.7 : 1,
                  },
                ]}
              >
                {isText ? item.content : `Sent ${item.messageType}`}
              </Text>
            </View>
          )}
          <View style={styles.bubbleMeta}>
            <Text style={[styles.timeText, { color: palette.text3 }]}>
              {item.pending ? 'Sending…' : item.timeLabel}
            </Text>
          </View>
        </View>
      );
    },
    [palette],
  );

  const hasAvatar = params.profile && params.profile !== 'none';
  const initial = params.title.charAt(0).toUpperCase();

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.screen, { backgroundColor: palette.bg }]}
    >
      <View
        style={[styles.headerBar, { borderBottomColor: palette.border }]}
      >
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
        <IconBtn
          n="call"
          iconSize={20}
          color={palette.text2}
          // TODO(call): wire to voice call once MediaSoup UI is ported.
        />
        <IconBtn
          n="info-outline"
          iconSize={20}
          color={palette.text2}
          // TODO(info): open ConversationInfoModal once ported.
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
              keyExtractor={(m) => m.id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              inverted
              onEndReached={loadOlder}
              onEndReachedThreshold={0.25}
              // Inverted list: offset 0 == newest at the bottom of the
              // viewport. Treat anything within 80px as "near bottom" so
              // small momentum/keyboard overshoot doesn't trip the CTA.
              onScroll={(e) => {
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

        <View
          style={[styles.composer, { borderTopColor: palette.border }]}
        >
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

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
  row: { marginVertical: 2 },
  rowOwn: { alignItems: 'flex-end' },
  rowOther: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radii.md,
  },
  bubbleText: { fontSize: 14, lineHeight: 19 },
  bubbleMeta: { marginTop: 2 },
  timeText: { fontSize: 10.5 },

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
  imageBubble: {
    maxWidth: '70%',
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  imageBubbleImg: {
    width: 220,
    height: 220,
  },
});
