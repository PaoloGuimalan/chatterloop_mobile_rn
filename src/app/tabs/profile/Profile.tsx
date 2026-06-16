/* eslint-disable react-native/no-inline-styles */
/* Profile screen — scoped port of
 * webapp/src/app/tabs/profile/user/Profile.tsx (874 lines).
 *
 * Covers the visible parts: cover photo + overlapping avatar banner,
 * name + handle + verified badge, basic nav row (Settings / Contacts /
 * Servers / Pages), and a post grid below populated by GetPostRequest
 * scoped to the current user.
 *
 * Out of scope (TODOs):
 *   - Cover / avatar editor (depends on react-native-image-picker +
 *     UploadMediaRequest).
 *   - Diary card.
 *   - Follower / following counts (need the dedicated endpoint).
 *   - Archive view toggle. */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';

import type { AppState } from '../../../redux/store';
import { useTheme } from '../../../reusables/design/ThemeProvider';
import { Btn, CLIcon } from '../../../reusables/design/primitives';
import { radii } from '../../../reusables/design/tokens';
import {
  AuthCheck,
  CreatePostRequest,
  FeedPost,
  GetPostRequest,
  LogoutRequest,
} from '../../../reusables/hooks/requests';
import { pickImages } from '../../../reusables/hooks/imagePicker';
import {
  CLEAR_PENDING_CALL_ALERTS,
  SET_ALERTS,
  SET_CALLS_LIST,
  SET_CLEAR_ALERTS,
  SET_CONTACTS_LIST_OVERRIDE,
  SET_CONVERSATION_SETUP,
  SET_MESSAGES_LIST_OVERRIDE,
  SET_MINIMIZED_CONVERSATION_OVERRIDE,
  SET_NOTIFICATIONS_LIST_OVERRIDE,
} from '../../../redux/types';
import { CloseSSENotifications } from '../../../reusables/hooks/sse';
import {
  contactsliststate,
  conversationsetupstate,
} from '../../../redux/actions/states';

const RANGE = 12;

export default function Profile() {
  const { palette } = useTheme();
  const dispatch = useDispatch();
  const nav = useNavigation<any>();
  const authentication = useSelector((s: AppState) => s.authentication);
  const user = authentication.user;

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingTarget, setUploadingTarget] = useState<
    null | 'cover_photo' | 'profile'
  >(null);
  const alerts = useSelector((s: AppState) => s.alerts);

  const clearStates = () => {
    dispatch({
      type: SET_CONVERSATION_SETUP,
      payload: { conversationsetup: conversationsetupstate },
    });
    dispatch({
      type: SET_MESSAGES_LIST_OVERRIDE,
      payload: { messageslist: [] },
    });
    dispatch({
      type: SET_CLEAR_ALERTS,
      payload: { alerts: [] },
    });
    dispatch({
      type: SET_CALLS_LIST,
      payload: { callslist: [] },
    });
    dispatch({
      type: CLEAR_PENDING_CALL_ALERTS,
      payload: { clearstate: [] },
    });
    dispatch({
      type: SET_CONTACTS_LIST_OVERRIDE,
      payload: { contactslist: contactsliststate },
    });
    dispatch({
      type: SET_MINIMIZED_CONVERSATION_OVERRIDE,
      payload: { conversations: [] },
    });
    dispatch({
      type: SET_NOTIFICATIONS_LIST_OVERRIDE,
      payload: { notficationslist: { list: [], totalunread: 0 } },
    });
  };

  const editPhoto = useCallback(
    async (target: 'cover_photo' | 'profile') => {
      if (uploadingTarget) return;
      const picked = await pickImages({
        selectionLimit: 1,
        mediaType: 'photo',
      });
      if (picked.length === 0) return;
      const p = picked[0];
      setUploadingTarget(target);
      const ok = await CreatePostRequest({
        caption: '',
        references: [
          {
            id: 1,
            name: p.name,
            reference: p.base,
            caption: '',
            referenceMediaType: 'image',
          },
        ],
        fileType: 'media',
        contentType: target,
      });
      if (ok) {
        // Backend updates the user's profile/coverphoto on a successful
        // post of this contentType. AuthCheck re-decodes the token and
        // dispatches the new URLs into redux.
        await AuthCheck(dispatch);
        dispatch({
          type: SET_ALERTS,
          payload: {
            alerts: {
              id: alerts.length,
              type: 'success',
              content:
                target === 'cover_photo'
                  ? 'Cover photo updated'
                  : 'Profile photo updated',
            },
          },
        });
      } else {
        dispatch({
          type: SET_ALERTS,
          payload: {
            alerts: {
              id: alerts.length,
              type: 'error',
              content: "Couldn't save your photo. Try again.",
            },
          },
        });
      }
      setUploadingTarget(null);
    },
    [alerts.length, dispatch, uploadingTarget],
  );

  const load = useCallback(
    async (silent: boolean) => {
      if (!user.userID) return;
      if (!silent) setIsLoading(true);
      const response = await GetPostRequest({
        current_user_id: user.userID,
        userID: user.userID,
        page: 1,
        range: RANGE,
      });
      setPosts(response.results ?? []);
      setIsLoading(false);
      setRefreshing(false);
    },
    [user.userID],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  const hasAvatar = user?.profile && user.profile !== 'none';
  const hasCover =
    user?.coverphoto && user.coverphoto !== 'none' && user.coverphoto !== '';
  const fullName = [
    user?.fullName?.firstName,
    user?.fullName?.middleName && user?.fullName?.middleName !== 'N/A'
      ? user.fullName.middleName
      : null,
    user?.fullName?.lastName,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  // Three-column grid: dynamic tile size based on viewport so the grid
  // stays edge-to-edge on phones of varying widths.
  const screenW = Dimensions.get('window').width;
  const tileSize = Math.floor((screenW - 32 - 2 * 4) / 3);

  const renderPost = useCallback(
    ({ item }: { item: FeedPost }) => {
      const imageRef = item.references?.find(r =>
        (r.reference_media_type ?? '').includes('image'),
      );
      const commentCount =
        item.activity_counts?.find(c => c.count_type === 'comment')?.count ?? 0;
      const openComments = () =>
        nav.navigate('Comments', {
          post_id: item.post_id,
          initialCount: commentCount,
        });
      if (imageRef) {
        return (
          <Pressable
            onPress={openComments}
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
      // Caption-only post: render the first words as a "text card".
      return (
        <Pressable
          onPress={openComments}
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

  const ListHeader = (
    <View>
      <Pressable
        onPress={() => editPhoto('cover_photo')}
        disabled={!!uploadingTarget}
        style={[
          styles.cover,
          { backgroundColor: hasCover ? 'transparent' : palette.brand },
        ]}
      >
        {hasCover ? (
          <Image
            source={{ uri: user.coverphoto }}
            style={StyleSheet.absoluteFill as never}
            resizeMode="cover"
          />
        ) : null}
        <View style={styles.coverEditBadge}>
          {uploadingTarget === 'cover_photo' ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <CLIcon n="photo-camera" size={14} color="#fff" />
          )}
        </View>
      </Pressable>

      <View style={styles.bannerWrap}>
        <Pressable
          onPress={() => editPhoto('profile')}
          disabled={!!uploadingTarget}
          style={[
            styles.avatarWrap,
            { borderColor: palette.bg, backgroundColor: palette.brand300 },
          ]}
        >
          {hasAvatar ? (
            <Image source={{ uri: user.profile }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <CLIcon n="person" size={48} color="#fff" />
            </View>
          )}
          <View style={styles.avatarEditBadge}>
            {uploadingTarget === 'profile' ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <CLIcon n="photo-camera" size={14} color="#fff" />
            )}
          </View>
        </Pressable>

        <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>
          {fullName || 'Your name'}
        </Text>
        {user?.username ? (
          <Text style={[styles.handle, { color: palette.text2 }]}>
            @{user.username}
          </Text>
        ) : null}
        {user?.email ? (
          <Text style={[styles.email, { color: palette.text3 }]}>
            {user.email}
          </Text>
        ) : null}

        <View style={styles.actionsRow}>
          <Btn
            label="Settings"
            iconL="settings"
            variant="outline"
            size="sm"
            onPress={() => nav.navigate('Settings')}
          />
          <Btn
            label="Servers"
            iconL="dns"
            variant="outline"
            size="sm"
            onPress={() => nav.navigate('Servers')}
          />
        </View>
        <View style={styles.actionsRow}>
          <Btn
            label="Pages"
            iconL="auto-stories"
            variant="outline"
            size="sm"
            onPress={() => nav.navigate('Pages')}
          />
          <Btn
            label="Diary"
            iconL="book"
            variant="outline"
            size="sm"
            onPress={() => nav.navigate('Diary')}
          />
        </View>

        <Pressable
          onPress={() => {
            clearStates();
            CloseSSENotifications();
            LogoutRequest(dispatch);
          }}
          style={styles.logoutBtn}
        >
          <Text style={[styles.logoutText, { color: palette.pink }]}>
            Log out
          </Text>
        </Pressable>
      </View>

      <Text style={[styles.sectionLabel, { color: palette.text3 }]}>POSTS</Text>
    </View>
  );

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.screen, { backgroundColor: palette.bg }]}
    >
      {isLoading && !refreshing ? (
        <ScrollView contentContainerStyle={styles.singleColumn}>
          {ListHeader}
          <View style={styles.center}>
            <ActivityIndicator color={palette.brand} />
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p, i) => p.post_id ?? `post-${i}`}
          renderItem={renderPost}
          numColumns={3}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={
            <View
              style={[
                styles.empty,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                },
              ]}
            >
              <CLIcon n="article" size={28} color={palette.text3} />
              <Text style={[styles.emptyText, { color: palette.text3 }]}>
                No posts yet
              </Text>
            </View>
          }
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
  singleColumn: { paddingBottom: 32 },
  listContent: { paddingHorizontal: 16, paddingBottom: 32, gap: 4 },
  columnWrapper: { gap: 4 },
  center: { padding: 40, alignItems: 'center' },

  cover: { width: '100%', height: 140, overflow: 'hidden' },
  coverEditBadge: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerWrap: {
    alignItems: 'center',
    paddingHorizontal: 22,
    marginTop: -48,
    gap: 2,
  },
  avatarWrap: {
    width: 96,
    height: 96,
    borderRadius: radii.pill,
    borderWidth: 4,
    overflow: 'hidden',
  },
  avatar: { width: '100%', height: '100%' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },

  name: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginTop: 10,
  },
  handle: { fontSize: 14 },
  email: { fontSize: 12.5, marginTop: 1 },

  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },

  logoutBtn: { marginTop: 22, marginBottom: 8 },
  logoutText: { fontSize: 13, fontWeight: '700' },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    paddingHorizontal: 4,
    marginTop: 18,
    marginBottom: 8,
  },

  tile: {
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  tileText: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  tileTextContent: { fontSize: 11, lineHeight: 14, textAlign: 'center' },

  empty: {
    marginTop: 4,
    marginHorizontal: 0,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: { fontSize: 13, fontWeight: '600' },
});
