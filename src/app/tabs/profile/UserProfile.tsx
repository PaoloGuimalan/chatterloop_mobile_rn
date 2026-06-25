/* UserProfile — other-user profile viewer.
 *
 * Mirrors the webapp's ProfileContainer flow: fetch GetProfileInfo for a
 * username, then render the `type === 'user'` branch (the webapp reuses
 * its Profile component for this). Pages resolve to PageDetail instead —
 * if the looked-up handle turns out to be a realm/page we redirect there.
 *
 * Shows the cover + avatar banner, name/handle/verified badge, a
 * connection action (Add / Accept / Decline / Message) derived from the
 * profile's `connection` block (same semantics as Search), and a
 * three-column post grid (GetPostRequest scoped to the user). */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';

import type { AppState } from '../../../redux/store';
import { useTheme } from '../../../reusables/design/ThemeProvider';
import { Btn, CLIcon, IconBtn } from '../../../reusables/design/primitives';
import { radii } from '../../../reusables/design/tokens';
import {
  AcceptContactRequest,
  ContactRequest,
  DeclineContactRequest,
  FeedPost,
  GetPostRequest,
  GetProfileInfoRequest,
} from '../../../reusables/hooks/requests';

const RANGE = 12;

interface UserProfileInfo {
  type?: string;
  id: string;
  userID: string;
  username: string;
  fullname: { firstName: string; middleName: string; lastName: string };
  profile: string;
  coverphoto: string;
  email: string;
  isVerified?: boolean;
  isBadged?: boolean;
  connection: {
    connection_id: string | null;
    is_connection_present: boolean | null;
    is_connection_handshaked: boolean | null;
    is_user_connection_initiator: boolean | null;
  };
  // realm fallbacks (when the handle resolves to a page)
  slug?: string | null;
  name?: string;
  description?: string | null;
  cover_photo?: string | null;
  is_verified?: boolean;
  is_follower?: boolean;
}

export default function UserProfile() {
  const { palette } = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const dispatch = useDispatch();
  const { userID: handle } = route.params as { userID: string };
  const me = useSelector((s: AppState) => s.authentication.user);
  const alerts = useSelector((s: AppState) => s.alerts);

  const [info, setInfo] = useState<UserProfileInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const fetchInfo = useCallback(async () => {
    const result = await GetProfileInfoRequest(handle);
    if (!result) {
      setNotFound(true);
      setLoading(false);
      return null;
    }
    const typed = result as unknown as UserProfileInfo;
    // A page handle landed here — hand off to the realm viewer instead.
    if (typed.type && typed.type !== 'user') {
      nav.replace('PageDetail', {
        realmID: typed.id,
        slug: typed.slug ?? handle,
        name: typed.name ?? '',
        profile: typed.profile,
        cover: typed.cover_photo ?? undefined,
        description: typed.description ?? undefined,
        isVerified: typed.is_verified,
        isFollowing: typed.is_follower,
      });
      return null;
    }
    setInfo(typed);
    setLoading(false);
    return typed;
  }, [handle, nav]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchInfo().then(typed => {
      if (cancelled || !typed) return;
      setPostsLoading(true);
      GetPostRequest({
        current_user_id: me.userID,
        userID: typed.username,
        page: 1,
        range: RANGE,
      }).then(res => {
        if (cancelled) return;
        setPosts(res.results ?? []);
        setPostsLoading(false);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [fetchInfo, me.userID]);

  const fullName = info
    ? [
        info.fullname.firstName,
        info.fullname.middleName && info.fullname.middleName !== 'N/A'
          ? info.fullname.middleName
          : null,
        info.fullname.lastName,
      ]
        .filter(Boolean)
        .join(' ')
        .trim()
    : '';

  const refreshConnection = useCallback(() => {
    setBusy(false);
    fetchInfo();
  }, [fetchInfo]);

  const onAdd = useCallback(() => {
    if (!info) return;
    setBusy(true);
    ContactRequest({ addUsername: info.userID }, dispatch, alerts, refreshConnection);
  }, [info, dispatch, alerts, refreshConnection]);

  const onAccept = useCallback(() => {
    if (!info?.connection.connection_id) return;
    setBusy(true);
    AcceptContactRequest(
      { connection_id: info.connection.connection_id, to_user_id: info.userID },
      dispatch,
      alerts,
      refreshConnection,
    );
  }, [info, dispatch, alerts, refreshConnection]);

  const onDecline = useCallback(
    (action: 'decline' | 'remove') => {
      if (!info?.connection.connection_id) return;
      setBusy(true);
      DeclineContactRequest(
        {
          connection_id: info.connection.connection_id,
          to_user_id: info.userID,
          action,
        },
        dispatch,
        alerts,
        refreshConnection,
      );
    },
    [info, dispatch, alerts, refreshConnection],
  );

  const onMessage = useCallback(() => {
    if (!info?.connection.connection_id) return;
    nav.navigate('Conversation', {
      conversationID: info.connection.connection_id,
      type: 'single',
      title: fullName,
      profile: info.profile !== 'none' ? info.profile : undefined,
      receivers: [info.userID],
    });
  }, [info, nav, fullName]);

  const screenW = Dimensions.get('window').width;
  const tileSize = Math.floor((screenW - 32 - 2 * 4) / 3);

  const renderPost = useCallback(
    ({ item }: { item: FeedPost }) => {
      const imageRef = item.references?.find(r =>
        (r.reference_media_type ?? '').includes('image'),
      );
      const open = () =>
        nav.navigate('PostDetail', { post_id: item.post_id, post: item });
      if (imageRef) {
        return (
          <Pressable
            onPress={open}
            style={({ pressed }) => [
              styles.tile,
              { width: tileSize, height: tileSize, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Image
              source={{ uri: imageRef.reference }}
              style={StyleSheet.absoluteFill as never}
              resizeMode="cover"
            />
          </Pressable>
        );
      }
      return (
        <Pressable
          onPress={open}
          style={({ pressed }) => [
            styles.tile,
            styles.tileText,
            {
              width: tileSize,
              height: tileSize,
              backgroundColor: palette.surface2,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text
            numberOfLines={5}
            style={[styles.tileTextContent, { color: palette.text2 }]}
          >
            {item.caption}
          </Text>
        </Pressable>
      );
    },
    [nav, palette, tileSize],
  );

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: palette.bg }]}>
        <Header onBack={() => nav.goBack()} title="Profile" palette={palette} />
        <View style={styles.center}>
          <ActivityIndicator color={palette.brand} />
        </View>
      </SafeAreaView>
    );
  }

  if (notFound || !info) {
    return (
      <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: palette.bg }]}>
        <Header onBack={() => nav.goBack()} title="Profile" palette={palette} />
        <View style={styles.center}>
          <CLIcon n="person-off" size={30} color={palette.text3} />
          <Text style={[styles.emptyText, { color: palette.text3 }]}>
            Profile not found
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const hasCover =
    info.coverphoto && info.coverphoto !== 'none' && info.coverphoto !== '';
  const hasAvatar = info.profile && info.profile !== 'none';
  const c = info.connection;
  const isSelf = info.userID === me.userID;

  const ListHeader = (
    <View>
      <View style={[styles.cover, { backgroundColor: hasCover ? 'transparent' : palette.brand }]}>
        {hasCover ? (
          <Image
            source={{ uri: info.coverphoto }}
            style={StyleSheet.absoluteFill as never}
            resizeMode="cover"
          />
        ) : null}
      </View>
      <View style={styles.bannerWrap}>
        <View style={[styles.avatarWrap, { borderColor: palette.bg, backgroundColor: palette.brand300 }]}>
          {hasAvatar ? (
            <Image source={{ uri: info.profile }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <CLIcon n="person" size={44} color="#fff" />
            </View>
          )}
        </View>

        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>
            {fullName || `@${info.username}`}
          </Text>
          {info.isBadged || info.isVerified ? (
            <CLIcon n="verified" size={18} color={palette.brand} />
          ) : null}
        </View>
        <Text style={[styles.handle, { color: palette.text2 }]}>@{info.username}</Text>

        {!isSelf ? (
          <View style={styles.actionsRow}>
            {c.is_connection_present && c.is_connection_handshaked ? (
              <>
                <Btn label="Message" iconL="forum" onPress={onMessage} />
                <Btn
                  label="Friends"
                  iconL="how-to-reg"
                  variant="outline"
                  disabled={busy}
                  onPress={() => onDecline('remove')}
                />
              </>
            ) : c.is_connection_present && !c.is_connection_handshaked ? (
              c.is_user_connection_initiator ? (
                <Btn
                  label="Requested"
                  variant="outline"
                  disabled={busy}
                  onPress={() => onDecline('remove')}
                />
              ) : (
                <>
                  <Btn label="Accept" iconL="check" disabled={busy} onPress={onAccept} />
                  <Btn
                    label="Decline"
                    variant="outline"
                    disabled={busy}
                    onPress={() => onDecline('decline')}
                  />
                </>
              )
            ) : (
              <Btn label="Add" iconL="person-add" variant="soft" disabled={busy} onPress={onAdd} />
            )}
          </View>
        ) : null}
      </View>

      <Text style={[styles.sectionLabel, { color: palette.text3 }]}>POSTS</Text>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: palette.bg }]}>
      <Header onBack={() => nav.goBack()} title={fullName || 'Profile'} palette={palette} />
      <FlatList
        data={posts}
        keyExtractor={(p, i) => p.post_id ?? `post-${i}`}
        renderItem={renderPost}
        numColumns={3}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          postsLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={palette.brand} />
            </View>
          ) : (
            <View style={[styles.empty, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <CLIcon n="article" size={28} color={palette.text3} />
              <Text style={[styles.emptyText, { color: palette.text3 }]}>No posts yet</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

function Header({
  onBack,
  title,
  palette,
}: {
  onBack: () => void;
  title: string;
  palette: ReturnType<typeof useTheme>['palette'];
}) {
  return (
    <View style={[styles.headerBar, { borderBottomColor: palette.border }]}>
      <IconBtn n="arrow-back" iconSize={22} color={palette.text} onPress={onBack} />
      <Text numberOfLines={1} style={[styles.headerTitle, { color: palette.text }]}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 40 },
  emptyText: { fontSize: 13, fontWeight: '600' },

  listContent: { paddingHorizontal: 16, paddingBottom: 32, gap: 4 },
  columnWrapper: { gap: 4 },

  cover: { width: '100%', height: 130, overflow: 'hidden' },
  bannerWrap: { alignItems: 'center', paddingHorizontal: 22, marginTop: -44, gap: 2 },
  avatarWrap: {
    width: 92,
    height: 92,
    borderRadius: radii.pill,
    borderWidth: 4,
    overflow: 'hidden',
  },
  avatar: { width: '100%', height: '100%' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  name: { fontSize: 21, fontWeight: '800', letterSpacing: -0.4, flexShrink: 1 },
  handle: { fontSize: 14 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap', justifyContent: 'center' },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    paddingHorizontal: 4,
    marginTop: 18,
    marginBottom: 8,
  },

  tile: { borderRadius: radii.sm, overflow: 'hidden' },
  tileText: { alignItems: 'center', justifyContent: 'center', padding: 8 },
  tileTextContent: { fontSize: 11, lineHeight: 14, textAlign: 'center' },

  empty: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
});
