/* Archived messages section — scoped port of
 * webapp/src/app/tabs/settings/section/ArchivedMessages.tsx.
 *
 * Reuses the same row pattern as the Messages tab: render whatever
 * `ManualInitConversationListRequest` (`/m/archives`) returns and let
 * the user tap into the Conversation thread.
 *
 * Out of scope (matches the rest of the in-progress Settings shell):
 *   - Lazy pagination (webapp uses IntersectionObserver).
 *   - Group / server-channel variants get a simplified renderer (no
 *     icon/color flair) — the webapp's variants share the Messages tab
 *     code we already simplified for the main list. */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';

import type { AppState } from '../../../../redux/store';
import { useTheme } from '../../../../reusables/design/ThemeProvider';
import { CLIcon } from '../../../../reusables/design/primitives';
import { radii } from '../../../../reusables/design/tokens';
import {
  ArchivedConvo,
  ManualInitConversationListRequest,
} from '../../../../reusables/hooks/requests';
import { isUserOnline, timeSince } from '../../../../reusables/hooks/reusable';

const RANGE = 10;

const TYPE_CHECKER: Record<string, string> = {
  video: 'a video',
  audio: 'an audio',
  image: 'a photo',
  any: 'a file',
};

function lastMessagePreview(c: ArchivedConvo, authUserID: string): string {
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

function timestampLabel(c: ArchivedConvo): string {
  const d = c.messageDate;
  if (!d) return '';
  if (typeof d === 'string') return timeSince(d);
  if (d.time) return `${d.date} · ${d.time}`;
  return timeSince(d.date);
}

interface DisplayRow {
  key: string;
  convoID: string;
  title: string;
  subtitle: string;
  time: string;
  profile?: string;
  showOnline: boolean;
  type: 'single' | 'group' | 'server';
  receivers: string[];
  titleColor?: string;
  titleIcon?: string;
}

export default function ArchivedMessages() {
  const { palette } = useTheme();
  const navigation = useNavigation<any>();
  const authentication = useSelector((s: AppState) => s.authentication);
  const activeuserslist = useSelector(
    (s: AppState) =>
      s.activeuserslist as unknown as {
        _id: string;
        sessionStatus?: boolean;
      }[],
  );

  const [rows, setRows] = useState<DisplayRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const me = authentication.user.userID;

  const buildRows = useCallback(
    (archives: ArchivedConvo[]): DisplayRow[] => {
      return archives.flatMap((c, i): DisplayRow[] => {
        const subtitle = lastMessagePreview(c, me);
        const time = timestampLabel(c);

        if (c.conversationType === 'single' && c.users) {
          const other = c.users.find(u => u._id !== me);
          if (!other) return [];
          const middle =
            other.fullname.middleName && other.fullname.middleName !== 'N/A'
              ? ` ${other.fullname.middleName}`
              : '';
          return [
            {
              key: `${c.conversationID}-${i}`,
              convoID: c.conversationID,
              title: `${other.fullname.firstName}${middle} ${other.fullname.lastName}`,
              subtitle,
              time,
              profile:
                other.profile && other.profile !== 'none'
                  ? other.profile
                  : undefined,
              showOnline: isUserOnline(activeuserslist, other._id),
              type: 'single',
              receivers: c.users.map(u => u._id),
            },
          ];
        }

        if (c.conversationType === 'group' && c.groupdetails) {
          return [
            {
              key: `${c.conversationID}-${i}`,
              convoID: c.conversationID,
              title: c.groupdetails.groupName,
              subtitle,
              time,
              profile:
                c.groupdetails.profile && c.groupdetails.profile !== 'N/A'
                  ? c.groupdetails.profile
                  : undefined,
              showOnline: false,
              type: 'group',
              receivers: c.users?.map(u => u._id) ?? [],
              titleColor: palette.brand,
              titleIcon: 'group',
            },
          ];
        }

        if (
          c.conversationType === 'server' &&
          c.serverdetails &&
          c.groupdetails
        ) {
          return [
            {
              key: `${c.conversationID}-${i}`,
              convoID: c.conversationID,
              title: `${c.serverdetails.serverName} · ${c.groupdetails.groupName}`,
              subtitle,
              time,
              profile:
                c.serverdetails.profile && c.serverdetails.profile !== 'N/A'
                  ? c.serverdetails.profile
                  : undefined,
              showOnline: false,
              type: 'server',
              receivers: c.users?.map(u => u._id) ?? [],
              titleColor: palette.gold,
              titleIcon: 'dns',
            },
          ];
        }

        return [];
      });
    },
    [activeuserslist, me, palette.brand, palette.gold],
  );

  const load = useCallback(
    async (silent: boolean) => {
      if (!silent) setIsLoading(true);
      const result = await ManualInitConversationListRequest(1, RANGE);
      setRows(buildRows(result.archives));
      setIsLoading(false);
      setRefreshing(false);
    },
    [buildRows],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  const renderItem = useCallback(
    ({ item }: { item: DisplayRow }) => {
      const hasAvatar = !!item.profile;
      const initial = item.title.charAt(0).toUpperCase();
      return (
        <Pressable
          onPress={() =>
            navigation.navigate('Conversation', {
              conversationID: item.convoID,
              type: item.type,
              title: item.title,
              profile: item.profile,
              receivers: item.receivers,
            })
          }
          style={({ pressed }) => [
            styles.row,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <View style={styles.avatarWrap}>
            {hasAvatar ? (
              <Image source={{ uri: item.profile }} style={styles.avatar} />
            ) : (
              <View
                style={[
                  styles.avatar,
                  styles.avatarFallback,
                  { backgroundColor: palette.brandSoft },
                ]}
              >
                <Text style={[styles.avatarInitial, { color: palette.brand }]}>
                  {initial}
                </Text>
              </View>
            )}
            {item.showOnline ? (
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
            <View style={styles.titleRow}>
              <Text
                numberOfLines={1}
                style={[
                  styles.title,
                  { color: item.titleColor ?? palette.text },
                ]}
              >
                {item.title}
              </Text>
              {item.titleIcon ? (
                <CLIcon
                  n={item.titleIcon}
                  size={15}
                  color={item.titleColor ?? palette.text}
                />
              ) : null}
            </View>
            <Text
              numberOfLines={1}
              style={[styles.subtitle, { color: palette.text2 }]}
            >
              {item.subtitle}
            </Text>
          </View>
          <Text style={[styles.time, { color: palette.text3 }]}>
            {item.time}
          </Text>
        </Pressable>
      );
    },
    [palette, navigation],
  );

  return (
    <View style={styles.screen}>
      <Text style={[styles.heading, { color: palette.text }]}>Archives</Text>

      {isLoading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={palette.brand} />
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.center}>
          <CLIcon n="inventory-2" size={32} color={palette.text3} />
          <Text style={[styles.emptyText, { color: palette.text3 }]}>
            No archived conversations
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={r => r.key}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={palette.brand}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16 },
  heading: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: { fontSize: 13, fontWeight: '600' },
  listContent: { gap: 8 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderRadius: radii.md,
  },
  avatarWrap: { position: 'relative' },
  avatar: { width: 44, height: 44, borderRadius: radii.pill },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 16, fontWeight: '700' },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 11,
    height: 11,
    borderRadius: radii.pill,
    borderWidth: 2,
  },
  body: { flex: 1, minWidth: 0 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  title: { flex: 1, fontSize: 14, fontWeight: '700' },
  subtitle: { fontSize: 12.5, marginTop: 2 },
  time: { fontSize: 11, alignSelf: 'flex-start' },
});
