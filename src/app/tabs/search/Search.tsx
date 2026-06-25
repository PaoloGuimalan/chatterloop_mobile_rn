/* Search — scoped port of webapp/src/app/tabs/search/Search.tsx.
 *
 * People search with a 450ms debounce. Connection actions mirror the
 * webapp (Add / Accept / Decline / Remove). The webapp's "Profile"
 * buttons (and avatar/name taps) open a user's profile page; native has
 * no standalone user-profile route, so for accomplished connections we
 * surface "Message" instead — navigating to the Conversation thread
 * (connection_id doubles as the conversationID, same as Contacts). */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';

import type { AppState } from '../../../redux/store';
import { useTheme } from '../../../reusables/design/ThemeProvider';
import { Btn, CLIcon, IconBtn } from '../../../reusables/design/primitives';
import { radii } from '../../../reusables/design/tokens';
import {
  AcceptContactRequest,
  ContactRequest,
  DeclineContactRequest,
  SearchRequest,
  UserSearchResult,
} from '../../../reusables/hooks/requests';

type Tone = 'green' | 'gold' | 'grey';

function badge(result: UserSearchResult): { label: string; tone: Tone } {
  if (!result.has_connection) return { label: 'New', tone: 'grey' };
  if (result.connection_accomplished)
    return { label: 'Connected', tone: 'green' };
  return {
    label: result.is_action_by_user ? 'Request sent' : 'Request received',
    tone: 'gold',
  };
}

export default function Search() {
  const { palette } = useTheme();
  const dispatch = useDispatch();
  const navigation = useNavigation<any>();
  const alerts = useSelector((s: AppState) => s.alerts);

  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<UserSearchResult[]>([]);

  const normalizedQuery = useMemo(() => query.trim(), [query]);
  const latest = useRef(0);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (!normalizedQuery) {
        setResults([]);
        setIsLoading(false);
        return;
      }
      const ticket = ++latest.current;
      setIsLoading(true);
      SearchRequest(
        { searchdata: normalizedQuery },
        dispatch,
        v => {
          // ignore the result of a superseded keystroke
          if (ticket === latest.current) setIsLoading(v);
        },
        alerts,
        r => {
          if (ticket === latest.current) setResults(r);
        },
      );
    }, 450);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedQuery]);

  const openConversation = useCallback(
    (result: UserSearchResult, name: string) => {
      if (!result.connection_id) return;
      navigation.navigate('Conversation', {
        conversationID: result.connection_id,
        type: 'single',
        title: name,
        profile: result.profile !== 'none' ? result.profile : undefined,
        receivers: [result.id],
        username: result.username,
      });
    },
    [navigation],
  );

  const addContact = useCallback(
    (result: UserSearchResult) => {
      setBusy(true);
      ContactRequest({ addUsername: result.id }, dispatch, alerts, setBusy);
    },
    [dispatch, alerts],
  );

  const acceptContact = useCallback(
    (result: UserSearchResult) => {
      setBusy(true);
      AcceptContactRequest(
        {
          connection_id: result.connection_id ?? result.id,
          to_user_id: result.id,
        },
        dispatch,
        alerts,
        setBusy,
      );
    },
    [dispatch, alerts],
  );

  const declineContact = useCallback(
    (result: UserSearchResult, action: 'decline' | 'remove') => {
      setBusy(true);
      DeclineContactRequest(
        {
          connection_id: result.connection_id ?? result.id,
          to_user_id: result.id,
          action,
        },
        dispatch,
        alerts,
        setBusy,
      );
    },
    [dispatch, alerts],
  );

  const renderActions = useCallback(
    (result: UserSearchResult, name: string) => {
      if (!result.has_connection) {
        return (
          <Btn
            label="Add"
            iconL="person-add"
            variant="soft"
            size="sm"
            disabled={busy}
            onPress={() => addContact(result)}
          />
        );
      }
      if (result.connection_accomplished) {
        return (
          <Btn
            label="Message"
            iconL="forum"
            variant="outline"
            size="sm"
            onPress={() => openConversation(result, name)}
          />
        );
      }
      if (result.is_action_by_user) {
        // outgoing request still pending — allow cancel
        return (
          <Btn
            label="Cancel"
            variant="outline"
            size="sm"
            disabled={busy}
            onPress={() => declineContact(result, 'remove')}
          />
        );
      }
      // incoming request — accept or decline
      return (
        <View style={styles.actionGroup}>
          <IconBtn
            n="person-add-alt-1"
            iconSize={18}
            color={palette.green}
            style={{ backgroundColor: palette.surface2 }}
            onPress={() => acceptContact(result)}
          />
          <IconBtn
            n="person-remove"
            iconSize={18}
            color={palette.pink}
            style={{ backgroundColor: palette.surface2 }}
            onPress={() => declineContact(result, 'decline')}
          />
        </View>
      );
    },
    [busy, palette, addContact, acceptContact, declineContact, openConversation],
  );

  const renderItem = useCallback(
    ({ item }: { item: UserSearchResult }) => {
      const middle =
        item.middle_name && item.middle_name !== 'N/A'
          ? ` ${item.middle_name} `
          : ' ';
      const name = `${item.first_name}${middle}${item.last_name}`.trim();
      const hasAvatar = item.profile && item.profile !== 'none';
      const b = badge(item);
      const toneColor = {
        green: palette.green,
        gold: palette.gold,
        grey: palette.text3,
      }[b.tone];
      const toneSoft = {
        green: palette.greenSoft,
        gold: palette.goldSoft,
        grey: palette.surface2,
      }[b.tone];

      return (
        <View
          style={[
            styles.row,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <Pressable
            style={styles.rowMain}
            onPress={() =>
              navigation.navigate('UserProfile', { userID: item.username })
            }
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
            <View style={styles.nameRow}>
              <Text
                numberOfLines={1}
                style={[styles.name, { color: palette.text }]}
              >
                {name}
              </Text>
              <View style={[styles.badge, { backgroundColor: toneSoft }]}>
                <Text style={[styles.badgeText, { color: toneColor }]}>
                  {b.label}
                </Text>
              </View>
            </View>
            <Text
              numberOfLines={1}
              style={[styles.username, { color: palette.text2 }]}
            >
              @{item.username}
            </Text>
          </View>
          </Pressable>
          <View style={styles.actionsWrap}>{renderActions(item, name)}</View>
        </View>
      );
    },
    [palette, renderActions, navigation],
  );

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.screen, { backgroundColor: palette.bg }]}
    >
      <View style={styles.header}>
        <IconBtn n="arrow-back" iconSize={22} onPress={() => navigation.goBack()} />
        <Text style={[styles.headerTitle, { color: palette.text }]}>
          Search people
        </Text>
      </View>

      <View style={styles.searchWrap}>
        <View
          style={[
            styles.searchBox,
            { backgroundColor: palette.input, borderColor: palette.border },
          ]}
        >
          <CLIcon n="search" size={20} color={palette.text3} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search users by name or username"
            placeholderTextColor={palette.text3}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.searchInput, { color: palette.text }]}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <CLIcon n="close" size={18} color={palette.text3} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {!normalizedQuery ? (
        <View style={styles.center}>
          <View style={[styles.bigIcon, { backgroundColor: palette.brandSoft }]}>
            <CLIcon n="manage-search" size={34} color={palette.brand} />
          </View>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>
            Search users only
          </Text>
          <Text style={[styles.emptyBody, { color: palette.text2 }]}>
            Start typing a name or username to find people.
          </Text>
        </View>
      ) : isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={palette.brand} />
        </View>
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={r => r.id}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.center}>
          <View
            style={[
              styles.bigIcon,
              styles.bigIconBordered,
              { backgroundColor: palette.surface2, borderColor: palette.border },
            ]}
          >
            <CLIcon n="search-off" size={34} color={palette.text2} />
          </View>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>
            No users found
          </Text>
          <Text style={[styles.emptyBody, { color: palette.text2 }]}>
            Try a different name or username.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
  searchWrap: { paddingHorizontal: 16, paddingVertical: 8 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: radii.md,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
  },
  bigIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigIconBordered: { borderWidth: 1 },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptyBody: { fontSize: 14, textAlign: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderRadius: radii.md,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: radii.pill },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 18, fontWeight: '700' },
  body: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 15, fontWeight: '800', flexShrink: 1 },
  badge: {
    paddingHorizontal: 8,
    height: 20,
    borderRadius: radii.pill,
    justifyContent: 'center',
  },
  badgeText: { fontSize: 10.5, fontWeight: '700' },
  username: { fontSize: 13, marginTop: 3 },
  actionsWrap: { alignItems: 'flex-end' },
  actionGroup: { flexDirection: 'row', gap: 6 },
});
