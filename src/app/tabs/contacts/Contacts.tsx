/* eslint-disable react-native/no-inline-styles */
/* eslint-disable @typescript-eslint/no-shadow */
/* Contacts tab — ports webapp/src/app/tabs/feed/Contacts.tsx.
 *
 * Reads `state.contactslist` which is fed both by an initial
 * ContactsListInitRequest on mount AND by the SSE "contactslist" event
 * in sse.ts. Online dots come from the `activeuserslist` slice (SSE
 * "active_users" updates).
 *
 * Out of scope (TODOs):
 *   - Remove/unfriend from this screen — DeclineContactRequest is
 *     ported and wired in Notifications. We intentionally surface
 *     unfriend on the other user's profile instead of here.
 *   - Group / server contact rows. Webapp only renders the `single`
 *     variant here; mirroring that exactly. */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import type { AppState } from '../../../redux/store';
import { useTheme } from '../../../reusables/design/ThemeProvider';
import { CLIcon, IconBtn } from '../../../reusables/design/primitives';
import { radii } from '../../../reusables/design/tokens';
import { isUserOnline } from '../../../reusables/hooks/reusable';
import { ContactsListInitRequest } from '../../../reusables/hooks/requests';
import { IContact, PaginationProp } from '../../../reusables/vars/interfaces';

interface ContactRowData {
  id: string;
  username: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  profile: string;
  isBadged?: boolean;
  connectionID: string;
}

export default function Contacts() {
  const dispatch = useDispatch();
  const navigation = useNavigation<any>();
  const { palette } = useTheme();

  const contacts = useSelector(
    (s: AppState) => s.contactslist as PaginationProp<IContact>,
  );
  const authentication = useSelector((s: AppState) => s.authentication);
  const activeuserslist = useSelector(
    (s: AppState) =>
      s.activeuserslist as unknown as {
        _id: string;
        sessionStatus?: boolean;
      }[],
  );

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const range = 50;

  useEffect(() => {
    ContactsListInitRequest(1, range, false, dispatch, setIsLoading);
  }, [dispatch]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    ContactsListInitRequest(1, range, true, dispatch, v => {
      setRefreshing(v);
      setIsLoading(v);
    });
  }, [dispatch]);

  const me = authentication.user.userID;
  const rows: ContactRowData[] = useMemo(() => {
    return (contacts.results ?? []).flatMap(c => {
      if (c.type !== 'single') return [];
      if (!c.involved_user || !c.action_by) return [];
      const selfActed = c.action_by.id === me;
      const u = selfActed ? c.involved_user : c.action_by;
      return [
        {
          id: u.id,
          username: u.username,
          firstName: u.first_name,
          middleName: u.middle_name,
          lastName: u.last_name,
          profile: u.profile,
          isBadged: u.is_badged,
          connectionID: c.connection_id,
        },
      ];
    });
  }, [contacts.results, me]);

  const renderItem = useCallback(
    ({ item }: { item: ContactRowData }) => {
      const online = isUserOnline(activeuserslist, item.id);
      const middle =
        item.middleName && item.middleName !== 'N/A'
          ? ` ${item.middleName}`
          : '';
      const name = `${item.firstName}${middle} ${item.lastName}`;
      const hasProfile = item.profile && item.profile !== 'none';

      return (
        <View style={styles.row}>
          <View style={styles.avatarWrap}>
            {hasProfile ? (
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
                  {item.firstName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {online ? (
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
            <View style={styles.nameRow}>
              <Text
                numberOfLines={1}
                style={[styles.name, { color: palette.text }]}
              >
                {name}
              </Text>
              {item.isBadged ? (
                <CLIcon n="verified" size={15} color={palette.brand} />
              ) : null}
            </View>
            <Text style={[styles.status, { color: palette.text3 }]}>
              {online ? 'Active now' : `@${item.username}`}
            </Text>
          </View>
          <View style={styles.actions}>
            <IconBtn
              n="forum"
              iconSize={20}
              color={palette.brand}
              style={{ backgroundColor: palette.surface2 }}
              onPress={() => {
                // For 1:1 contacts the connection_id doubles as the
                // conversationID, mirroring the webapp's navigateToConversation.
                const middle =
                  item.middleName && item.middleName !== 'N/A'
                    ? ` ${item.middleName}`
                    : '';
                navigation.navigate('Conversation', {
                  conversationID: item.connectionID,
                  type: 'single',
                  title: `${item.firstName}${middle} ${item.lastName}`,
                  profile: hasProfile ? item.profile : undefined,
                  receivers: [item.id],
                });
              }}
            />
            {/* <IconBtn
              n="person_remove"
              iconSize={20}
              color={palette.pink}
              style={{ backgroundColor: palette.surface2 }}
              // TODO(remove): wire DeclineContactRequest once backend re-adds, do not continue this, we focus on unfriend button displayed on their profiles.
            /> */}
          </View>
        </View>
      );
    },
    [activeuserslist, palette, navigation],
  );

  const showInitialLoader = isLoading && !refreshing;

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.screen, { backgroundColor: palette.bg }]}
    >
      <View style={styles.titleBar}>
        <View
          style={[styles.titleIcon, { backgroundColor: palette.greenSoft }]}
        >
          <CLIcon n="contacts" size={18} color={palette.green} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.titleText, { color: palette.text }]}>
            Contacts
          </Text>
          <Text style={[styles.subtitleText, { color: palette.text3 }]}>
            Manage your connections.
          </Text>
        </View>
        <View
          style={[styles.countPill, { backgroundColor: palette.greenSoft }]}
        >
          <Text style={[styles.countText, { color: palette.green }]}>
            {rows.length}
          </Text>
        </View>
      </View>

      {showInitialLoader ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={palette.brand} />
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.center}>
          <CLIcon n="contacts" size={42} color={palette.text3} />
          <Text style={[styles.emptyText, { color: palette.text3 }]}>
            No contacts
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={item => item.id}
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
    </SafeAreaView>
  );
}

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
  },
  subtitleText: { fontSize: 12, marginTop: 2 },
  countPill: {
    minWidth: 28,
    height: 24,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { fontSize: 12, fontWeight: '700' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: { fontSize: 14, fontWeight: '600' },
  listContent: { paddingHorizontal: 8, paddingVertical: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  name: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  status: { fontSize: 12, marginTop: 2 },
  actions: {
    flexDirection: 'row',
    gap: 6,
  },
});
