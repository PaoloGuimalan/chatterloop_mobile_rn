/* Blocked accounts section — scoped port of
 * webapp/src/app/tabs/settings/section/BlockedAccounts.tsx.
 *
 * Lists accounts the user has blocked and lets them unblock inline.
 * Data comes from ListBlockedUsersRequest (GET /api/user/blocks); the
 * Unblock action calls UnblockUserRequest and drops the row on success. */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import type { AppState } from '../../../../redux/store';
import { useTheme } from '../../../../reusables/design/ThemeProvider';
import { CLIcon } from '../../../../reusables/design/primitives';
import { radii } from '../../../../reusables/design/tokens';
import {
  BlockedAccount,
  ListBlockedUsersRequest,
  UnblockUserRequest,
} from '../../../../reusables/hooks/requests';

export default function BlockedAccounts() {
  const { palette } = useTheme();
  const dispatch = useDispatch();
  const alerts = useSelector((s: AppState) => s.alerts);

  const [isLoading, setIsLoading] = useState(true);
  const [accounts, setAccounts] = useState<BlockedAccount[]>([]);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setIsLoading(true);
    ListBlockedUsersRequest()
      .then(data => {
        setAccounts(data);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const unblock = useCallback(
    (id: string) => {
      setUnblockingId(id);
      UnblockUserRequest(id, dispatch, alerts, () =>
        setUnblockingId(null),
      ).then(success => {
        if (success) {
          setAccounts(prev => prev.filter(acc => acc.id !== id));
        }
      });
    },
    [dispatch, alerts],
  );

  const renderItem = useCallback(
    ({ item }: { item: BlockedAccount }) => {
      const hasAvatar = item.profile && item.profile !== 'none';
      const busy = unblockingId === item.id;
      return (
        <View
          style={[
            styles.row,
            { backgroundColor: palette.surface2, borderColor: palette.border },
          ]}
        >
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
                {item.first_name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.body}>
            <Text
              numberOfLines={1}
              style={[styles.name, { color: palette.text }]}
            >
              {item.first_name} {item.last_name}
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.username, { color: palette.text2 }]}
            >
              @{item.username}
            </Text>
          </View>
          <Pressable
            disabled={busy}
            onPress={() => unblock(item.id)}
            style={({ pressed }) => [
              styles.unblockBtn,
              {
                backgroundColor: palette.surface,
                opacity: busy ? 0.65 : pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text style={[styles.unblockText, { color: palette.text }]}>
              {busy ? 'Unblocking…' : 'Unblock'}
            </Text>
          </Pressable>
        </View>
      );
    },
    [palette, unblockingId, unblock],
  );

  return (
    <View style={styles.screen}>
      <Text style={[styles.heading, { color: palette.text }]}>
        Blocked Accounts
      </Text>
      <Text style={[styles.intro, { color: palette.text2 }]}>
        Accounts you've blocked can't contact you, see your posts, or find your
        profile in search.
      </Text>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={palette.brand} />
        </View>
      ) : accounts.length === 0 ? (
        <View style={styles.center}>
          <CLIcon n="block" size={32} color={palette.text3} />
          <Text style={[styles.emptyText, { color: palette.text3 }]}>
            You haven't blocked anyone.
          </Text>
        </View>
      ) : (
        <FlatList
          data={accounts}
          keyExtractor={acc => acc.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16 },
  heading: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  intro: { fontSize: 14, marginBottom: 16, lineHeight: 19 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText: { fontSize: 13, fontWeight: '600' },
  listContent: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderWidth: 1,
    borderRadius: radii.md,
  },
  avatar: { width: 38, height: 38, borderRadius: radii.pill },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 15, fontWeight: '700' },
  body: { flex: 1, minWidth: 0 },
  name: { fontSize: 13, fontWeight: '600' },
  username: { fontSize: 12, marginTop: 1 },
  unblockBtn: {
    minWidth: 84,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  unblockText: { fontSize: 12, fontWeight: '600' },
});
