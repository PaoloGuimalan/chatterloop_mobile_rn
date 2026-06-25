/* Messages tab (list view) — ports the list pane of
 * webapp/src/app/tabs/feed/Messages.tsx.
 *
 * Scope of this port:
 *   - Render the conversation list (single + group + server variants)
 *   - Reflect live typing state and unread counts
 *   - Initial fetch via InitConversationListRequest; SSE keeps the slice
 *     fresh (sse.ts dispatches SET_MESSAGES_LIST_OVERRIDE on
 *     "messages_list" events)
 *
 * Out of scope (TODOs):
 *   - Search / segment tabs / compose menu / create-group / create-server */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import type { AppState } from '../../../redux/store';
import { useTheme } from '../../../reusables/design/ThemeProvider';
import { CLIcon, IconBtn } from '../../../reusables/design/primitives';
import { radii } from '../../../reusables/design/tokens';
import CreateGroupChatModal from './CreateGroupChatModal';
import { isUserOnline, timeSince } from '../../../reusables/hooks/reusable';
import { InitConversationListRequest } from '../../../reusables/hooks/requests';
import {
  SET_MESSAGES_LIST,
  SET_PREVIEW_PARTICIPANTS_BULK,
} from '../../../redux/types';

// ---- types & helpers -------------------------------------------------------

interface ConvoUser {
  _id: string;
  /** Username/handle — the payload carries this as `userID` (the webapp
   *  reads `userdetails.userID` for profile deep-links). */
  userID?: string;
  profile?: string;
  fullname: { firstName: string; middleName?: string; lastName: string };
}

interface Convo {
  conversationID: string;
  conversationType: 'single' | 'group' | 'server';
  unread?: number;
  isDeleted?: boolean;
  sender?: string;
  messageType?: string;
  content?: string;
  messageDate?: { date: string; time?: string } | string;
  users?: ConvoUser[];
  groupdetails?: { groupID?: string; groupName: string; profile?: string };
  serverdetails?: { serverID?: string; serverName: string; profile?: string };
  voice_participants?: unknown[];
}

interface TypingEntry {
  conversationID: string;
}

interface PreviewParticipant {
  channelID?: string;
}

const TYPE_CHECKER: Record<string, string> = {
  video: 'a video',
  audio: 'an audio',
  image: 'a photo',
  any: 'a file',
};

function lastMessagePreview(c: Convo, authUserID: string): string {
  const prefix = c.sender === authUserID ? 'you: ' : '';
  if (c.isDeleted) return `${prefix}[Deleted message]`;
  if (c.messageType === 'text' || c.messageType === 'notif') {
    return `${prefix}${c.content || ''}`;
  }
  const t = c.messageType ?? '';
  if (!t.includes('image') && !t.includes('video') && !t.includes('audio')) {
    return `${prefix}Sent ${TYPE_CHECKER.any}`;
  }
  return `${prefix}Sent ${TYPE_CHECKER[t.split('/')[0]]}`;
}

function timestampLabel(c: Convo): string {
  const d = c.messageDate;
  if (!d) return '';
  if (typeof d === 'string') return timeSince(d);
  if (d.time) return `${d.date} · ${d.time}`;
  return timeSince(d.date);
}

// ---- Row component ---------------------------------------------------------

interface RowProps {
  imgSrc?: string;
  imgFallback?: number;
  title: string;
  titleColor?: string;
  titleIcon?: string;
  subtitle: string;
  subtitleColor?: string;
  time: string;
  unread: number;
  showOnline?: boolean;
  showCall?: boolean;
  onPress: () => void;
}

function MessageRow({
  imgSrc,
  imgFallback,
  title,
  titleColor,
  titleIcon,
  subtitle,
  subtitleColor,
  time,
  unread,
  showOnline,
  showCall,
  onPress,
}: RowProps) {
  const { palette } = useTheme();
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={styles.row}>
      <View style={styles.avatarWrap}>
        {imgSrc ? (
          <Image source={{ uri: imgSrc }} style={styles.avatar} />
        ) : imgFallback ? (
          <Image source={imgFallback as never} style={styles.avatar} />
        ) : (
          <View
            style={[
              styles.avatar,
              styles.avatarFallback,
              { backgroundColor: palette.brandSoft },
            ]}
          >
            <Text style={[styles.avatarInitial, { color: palette.brand }]}>
              {title.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        {showOnline ? (
          <View
            style={[
              styles.onlineDot,
              {
                backgroundColor: palette.online,
                borderColor: palette.surface,
              },
            ]}
          />
        ) : null}
      </View>
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <View style={styles.titleWrap}>
            <Text
              numberOfLines={1}
              style={[styles.title, { color: titleColor ?? palette.text }]}
            >
              {title}
            </Text>
            {titleIcon ? (
              <CLIcon
                n={titleIcon}
                size={15}
                color={titleColor ?? palette.text}
              />
            ) : null}
          </View>
          <Text style={[styles.time, { color: palette.text3 }]}>{time}</Text>
        </View>
        <Text
          numberOfLines={1}
          style={[styles.subtitle, { color: subtitleColor ?? palette.text2 }]}
        >
          {subtitle}
        </Text>
      </View>
      <View style={styles.right}>
        {unread > 0 ? (
          <View style={[styles.unreadPill, { backgroundColor: palette.brand }]}>
            <Text style={styles.unreadText}>{unread}</Text>
          </View>
        ) : null}
        {showCall ? <CLIcon n="call" size={16} color={palette.green} /> : null}
      </View>
    </TouchableOpacity>
  );
}

// ---- Screen ----------------------------------------------------------------

export default function Messages() {
  const dispatch = useDispatch();
  const navigation = useNavigation<any>();
  const { palette } = useTheme();

  const messageslist = useSelector(
    (s: AppState) => s.messageslist as unknown as Convo[],
  );
  const authentication = useSelector((s: AppState) => s.authentication);
  const istypinglist = useSelector(
    (s: AppState) => s.istypinglist as unknown as TypingEntry[],
  );
  const activeuserslist = useSelector(
    (s: AppState) =>
      s.activeuserslist as unknown as {
        _id: string;
        sessionStatus?: boolean;
      }[],
  );
  const previewparticipants = useSelector(
    (s: AppState) => s.previewparticipants as unknown as PreviewParticipant[],
  );

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const range = 20;

  const loadFirstPage = useCallback(
    async (silent: boolean) => {
      if (!silent) setIsLoading(true);
      const response = await InitConversationListRequest(1, range);
      if (response) {
        dispatch({
          type: SET_PREVIEW_PARTICIPANTS_BULK,
          payload: {
            participants: response.conversationslist
              .map((c: Convo) => c.voice_participants ?? [])
              .flat(),
          },
        });
        dispatch({
          type: SET_MESSAGES_LIST,
          payload: { messageslist: response.conversationslist },
        });
        setHasMore(Boolean(response.next));
      } else {
        setHasMore(false);
      }
      setPage(1);
      setIsLoading(false);
      setRefreshing(false);
    },
    [dispatch],
  );

  useEffect(() => {
    loadFirstPage(false);
  }, [loadFirstPage]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadFirstPage(true);
  }, [loadFirstPage]);

  // Append the next page on scroll-bottom. Dedupes by conversationID
  // so an in-flight SSE override mid-paginate can't cause duplicate
  // rows. messageslist read fresh from redux so the appended array
  // always builds off the latest state, not a stale closure.
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || isLoading || refreshing) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    const response = await InitConversationListRequest(nextPage, range);
    if (response) {
      const incoming: Convo[] = response.conversationslist ?? [];
      const seen = new Set(messageslist.map(c => c.conversationID));
      const fresh = incoming.filter(c => !seen.has(c.conversationID));
      if (fresh.length > 0) {
        dispatch({
          type: SET_PREVIEW_PARTICIPANTS_BULK,
          payload: {
            participants: fresh
              .map(c => c.voice_participants ?? [])
              .flat(),
          },
        });
        dispatch({
          type: SET_MESSAGES_LIST,
          payload: { messageslist: [...messageslist, ...fresh] },
        });
      }
      setHasMore(Boolean(response.next));
      setPage(nextPage);
    } else {
      setHasMore(false);
    }
    setLoadingMore(false);
  }, [
    dispatch,
    hasMore,
    isLoading,
    loadingMore,
    messageslist,
    page,
    refreshing,
  ]);

  const me = authentication.user.userID;
  const onOpenConversation = useCallback(
    (c: Convo) => {
      // Build the route params from whichever variant this row is.
      if (c.conversationType === 'single' && c.users) {
        const other = c.users.find(u => u._id !== me);
        if (!other) return;
        const middle =
          other.fullname.middleName && other.fullname.middleName !== 'N/A'
            ? ` ${other.fullname.middleName}`
            : '';
        navigation.navigate('Conversation', {
          conversationID: c.conversationID,
          type: 'single',
          title: `${other.fullname.firstName}${middle} ${other.fullname.lastName}`,
          profile:
            other.profile && other.profile !== 'none' ? other.profile : undefined,
          receivers: c.users.map(u => u._id),
          username: other.userID,
        });
        return;
      }
      if (c.conversationType === 'group' && c.groupdetails && c.users) {
        navigation.navigate('Conversation', {
          conversationID: c.conversationID,
          type: 'group',
          title: c.groupdetails.groupName,
          profile:
            c.groupdetails.profile && c.groupdetails.profile !== 'N/A'
              ? c.groupdetails.profile
              : undefined,
          receivers: c.users.map(u => u._id),
        });
        return;
      }
      if (
        c.conversationType === 'server' &&
        c.serverdetails &&
        c.groupdetails
      ) {
        navigation.navigate('Conversation', {
          conversationID: c.conversationID,
          type: 'server',
          title: `${c.serverdetails.serverName} · ${c.groupdetails.groupName}`,
          profile:
            c.serverdetails.profile && c.serverdetails.profile !== 'N/A'
              ? c.serverdetails.profile
              : undefined,
          receivers: c.users?.map(u => u._id) ?? [],
        });
      }
    },
    [me, navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: Convo }) => {
      const typingHere = istypinglist.some(
        t => t.conversationID === item.conversationID,
      );
      const callHere = previewparticipants.some(
        p => p.channelID === item.conversationID,
      );

      if (item.conversationType === 'single' && item.users) {
        const other = item.users.find(u => u._id !== me);
        if (!other) return null;
        const middle =
          other.fullname.middleName && other.fullname.middleName !== 'N/A'
            ? ` ${other.fullname.middleName}`
            : '';
        const name = `${other.fullname.firstName}${middle} ${other.fullname.lastName}`;
        return (
          <MessageRow
            imgSrc={
              other.profile && other.profile !== 'none'
                ? other.profile
                : undefined
            }
            title={name}
            subtitle={typingHere ? 'is typing…' : lastMessagePreview(item, me)}
            subtitleColor={typingHere ? palette.brand : undefined}
            time={timestampLabel(item)}
            unread={item.unread ?? 0}
            showOnline={isUserOnline(activeuserslist, other._id)}
            showCall={callHere}
            onPress={() => onOpenConversation(item)}
          />
        );
      }

      if (item.conversationType === 'group' && item.groupdetails) {
        const img =
          item.groupdetails.profile && item.groupdetails.profile !== 'N/A'
            ? item.groupdetails.profile
            : undefined;
        return (
          <MessageRow
            imgSrc={img}
            title={item.groupdetails.groupName}
            titleColor={palette.brand}
            titleIcon="group"
            subtitle={
              typingHere ? 'someone is typing…' : lastMessagePreview(item, me)
            }
            subtitleColor={typingHere ? palette.brand : undefined}
            time={timestampLabel(item)}
            unread={item.unread ?? 0}
            showCall={callHere}
            onPress={() => onOpenConversation(item)}
          />
        );
      }

      if (
        item.conversationType === 'server' &&
        item.serverdetails &&
        item.groupdetails
      ) {
        const img =
          item.serverdetails.profile && item.serverdetails.profile !== 'N/A'
            ? item.serverdetails.profile
            : undefined;
        return (
          <MessageRow
            imgSrc={img}
            title={`${item.serverdetails.serverName} · ${item.groupdetails.groupName}`}
            titleColor={palette.gold}
            titleIcon="dns"
            subtitle={
              typingHere ? 'someone is typing…' : lastMessagePreview(item, me)
            }
            subtitleColor={typingHere ? palette.brand : undefined}
            time={timestampLabel(item)}
            unread={item.unread ?? 0}
            onPress={() => onOpenConversation(item)}
          />
        );
      }

      return null;
    },
    [
      me,
      activeuserslist,
      istypinglist,
      previewparticipants,
      palette,
      onOpenConversation,
    ],
  );

  const showInitialLoader = isLoading && !refreshing;

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.screen, { backgroundColor: palette.bg }]}
    >
      <View style={styles.titleBar}>
        <View
          style={[styles.titleIcon, { backgroundColor: palette.brandSoft }]}
        >
          <CLIcon n="forum" size={18} color={palette.brand} />
        </View>
        <Text style={[styles.titleText, { color: palette.text }]}>
          Messages
        </Text>
        <IconBtn
          n="group-add"
          iconSize={22}
          color={palette.brand}
          onPress={() => setCreateGroupOpen(true)}
        />
      </View>

      {showInitialLoader ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={palette.brand} />
        </View>
      ) : messageslist.length === 0 ? (
        <View style={styles.center}>
          <CLIcon n="chat_bubble_outline" size={42} color={palette.text3} />
          <Text style={[styles.emptyText, { color: palette.text3 }]}>
            No conversations
          </Text>
        </View>
      ) : (
        <FlatList
          data={messageslist}
          keyExtractor={(c, i) => `${c.conversationID ?? 'convo'}-${i}`}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={palette.brand}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator color={palette.text3} />
              </View>
            ) : null
          }
        />
      )}

      <CreateGroupChatModal
        visible={createGroupOpen}
        onClose={() => setCreateGroupOpen(false)}
        onCreated={() => loadFirstPage(true)}
      />
    </SafeAreaView>
  );
}

// ---- Styles ----------------------------------------------------------------

const styles = StyleSheet.create({
  screen: { flex: 1 },
  titleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 10,
  },
  titleIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: { fontSize: 14, fontWeight: '600' },
  listContent: { paddingHorizontal: 8, paddingVertical: 4 },
  footerLoading: { paddingVertical: 16, alignItems: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: radii.md,
  },
  avatarWrap: { position: 'relative' },
  avatar: { width: 46, height: 46, borderRadius: radii.pill },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontWeight: '700', fontSize: 16 },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: radii.pill,
    borderWidth: 2,
  },
  body: { flex: 1, minWidth: 0 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
    minWidth: 0,
  },
  title: { flex: 1, fontSize: 14, fontWeight: '700' },
  time: { fontSize: 11 },
  subtitle: { fontSize: 12.5, marginTop: 2 },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  unreadPill: {
    minWidth: 18,
    height: 18,
    borderRadius: radii.pill,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
