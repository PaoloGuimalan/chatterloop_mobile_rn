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
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';

import type { AppState } from '../../../redux/store';
import { useTheme } from '../../../reusables/design/ThemeProvider';
import { Btn, CLIcon, IconBtn } from '../../../reusables/design/primitives';
import { radii } from '../../../reusables/design/tokens';
import {
  AcceptContactRequest,
  AuthCheck,
  ContactRequest,
  CreatePostRequest,
  DeclineContactRequest,
  DiaryPreview,
  FeedPost,
  GetDiaryTotalRequest,
  GetPostRequest,
  GetProfileInfoRequest,
  GetSavedPostsRequest,
  LogoutRequest,
  SavedPost,
} from '../../../reusables/hooks/requests';
import PostOptionsSheet, { PostChange } from './user/PostOptionsSheet';
import { timeSince } from '../../../reusables/hooks/reusable';
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

/** Other-user profile payload (the `type === 'user'` branch of
 *  GetProfileInfo). Page handles are redirected to PageDetail. */
interface VisitorInfo {
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
  slug?: string | null;
  name?: string;
  description?: string | null;
  cover_photo?: string | null;
  is_verified?: boolean;
  is_follower?: boolean;
}

export default function Profile() {
  const { palette } = useTheme();
  const dispatch = useDispatch();
  const nav = useNavigation<any>();
  const authentication = useSelector((s: AppState) => s.authentication);
  const user = authentication.user;
  const route = useRoute<any>();

  // Unified profile: when a `userID` (handle) param is present and isn't
  // our own, we render the visitor view (other user's banner + posts +
  // connection actions) with all owner-only controls filtered out —
  // mirroring the webapp, which reuses one Profile component for both.
  const viewedHandle: string | undefined = route.params?.userID;
  const isOwner = !viewedHandle || viewedHandle === user.username;
  const isVisitor = !isOwner;

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Visitor-only: fetched profile + connection state.
  const [otherInfo, setOtherInfo] = useState<VisitorInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [connBusy, setConnBusy] = useState(false);

  // Profile post sections — mirrors the webapp's Posts / Saved / Archives
  // tabs (PostsContainer / SavesContainer / ArchivesContainer).
  type Segment = 'posts' | 'saved' | 'archived';
  const [segment, setSegment] = useState<Segment>('posts');
  const [saved, setSaved] = useState<SavedPost[]>([]);
  const [savedLoaded, setSavedLoaded] = useState(false);
  const [archived, setArchived] = useState<FeedPost[]>([]);
  const [archivedLoaded, setArchivedLoaded] = useState(false);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [optionsTarget, setOptionsTarget] = useState<FeedPost | null>(null);
  const [uploadingTarget, setUploadingTarget] = useState<
    null | 'cover_photo' | 'profile'
  >(null);
  const [diary, setDiary] = useState<DiaryPreview | null>(null);
  const [diaryLoading, setDiaryLoading] = useState(true);
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

  const loadVisitor = useCallback(
    async (silent: boolean) => {
      if (!viewedHandle) return;
      if (!silent) setIsLoading(true);
      const result = await GetProfileInfoRequest(viewedHandle);
      if (!result) {
        setNotFound(true);
        setIsLoading(false);
        setRefreshing(false);
        return;
      }
      const typed = result as unknown as VisitorInfo;
      // A page handle landed here — hand off to the realm viewer.
      if (typed.type && typed.type !== 'user') {
        nav.replace('PageDetail', {
          realmID: typed.id,
          slug: typed.slug ?? viewedHandle,
          name: typed.name ?? '',
          profile: typed.profile,
          cover: typed.cover_photo ?? undefined,
          description: typed.description ?? undefined,
          isVerified: typed.is_verified,
          isFollowing: typed.is_follower,
        });
        return;
      }
      setOtherInfo(typed);
      const postsResponse = await GetPostRequest({
        current_user_id: user.userID,
        userID: typed.userID,
        page: 1,
        range: RANGE,
      });
      setPosts(postsResponse.results ?? []);
      setIsLoading(false);
      setRefreshing(false);
    },
    [viewedHandle, user.userID, nav],
  );

  const load = useCallback(
    async (silent: boolean) => {
      if (isVisitor) {
        await loadVisitor(silent);
        return;
      }
      if (!user.userID) return;
      if (!silent) setIsLoading(true);
      setDiaryLoading(true);
      // Fetch posts and the diary summary in parallel — they don't
      // depend on each other, and the summary endpoint is cheap.
      const [postsResponse, diaryResponse] = await Promise.all([
        GetPostRequest({
          current_user_id: user.userID,
          userID: user.username,
          page: 1,
          range: RANGE,
        }),
        GetDiaryTotalRequest(user.username),
      ]);
      setPosts(postsResponse.results ?? []);
      setDiary(diaryResponse);
      setDiaryLoading(false);
      setIsLoading(false);
      setRefreshing(false);
    },
    [isVisitor, loadVisitor, user.userID, user.username],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  // Connection actions (visitor mode) — mirror Search's semantics and
  // refresh the profile so the button state reflects the new edge.
  const refreshConnection = useCallback(() => {
    setConnBusy(false);
    loadVisitor(true);
  }, [loadVisitor]);

  const onAddContact = useCallback(() => {
    if (!otherInfo) return;
    setConnBusy(true);
    ContactRequest(
      { addUsername: otherInfo.userID },
      dispatch,
      alerts,
      refreshConnection,
    );
  }, [otherInfo, dispatch, alerts, refreshConnection]);

  const onAcceptContact = useCallback(() => {
    if (!otherInfo?.connection.connection_id) return;
    setConnBusy(true);
    AcceptContactRequest(
      {
        connection_id: otherInfo.connection.connection_id,
        to_user_id: otherInfo.userID,
      },
      dispatch,
      alerts,
      refreshConnection,
    );
  }, [otherInfo, dispatch, alerts, refreshConnection]);

  const onDeclineContact = useCallback(
    (action: 'decline' | 'remove') => {
      if (!otherInfo?.connection.connection_id) return;
      setConnBusy(true);
      DeclineContactRequest(
        {
          connection_id: otherInfo.connection.connection_id,
          to_user_id: otherInfo.userID,
          action,
        },
        dispatch,
        alerts,
        refreshConnection,
      );
    },
    [otherInfo, dispatch, alerts, refreshConnection],
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  const loadSaved = useCallback(async () => {
    setSectionLoading(true);
    const response = await GetSavedPostsRequest({ page: 1, range: 20 });
    setSaved(response.results ?? []);
    setSavedLoaded(true);
    setSectionLoading(false);
  }, []);

  const loadArchived = useCallback(async () => {
    if (!user.userID) return;
    setSectionLoading(true);
    const response = await GetPostRequest({
      current_user_id: user.userID,
      userID: user.username,
      page: 1,
      range: RANGE,
      archive: true,
    });
    setArchived(response.results ?? []);
    setArchivedLoaded(true);
    setSectionLoading(false);
  }, [user.userID, user.username]);

  // Lazily fetch a section the first time it's opened.
  const onSelectSegment = useCallback(
    (next: Segment) => {
      setSegment(next);
      if (next === 'saved' && !savedLoaded) loadSaved();
      if (next === 'archived' && !archivedLoaded) loadArchived();
    },
    [savedLoaded, archivedLoaded, loadSaved, loadArchived],
  );

  // Apply a post-options change to whichever section list holds it.
  const onPostChanged = useCallback((change: PostChange, post: FeedPost) => {
    const id = post.post_id;
    if (change === 'deleted') {
      setPosts(prev => prev.filter(p => p.post_id !== id));
      setArchived(prev => prev.filter(p => p.post_id !== id));
      setSaved(prev => prev.filter(s => s.post.post_id !== id));
      return;
    }
    if (change === 'archived') {
      // Leaves the Posts grid, joins Archives.
      setPosts(prev => prev.filter(p => p.post_id !== id));
      setArchived(prev =>
        prev.some(p => p.post_id === id)
          ? prev
          : [{ ...post, is_archived: true }, ...prev],
      );
      return;
    }
    if (change === 'unarchived') {
      setArchived(prev => prev.filter(p => p.post_id !== id));
      setPosts(prev =>
        prev.some(p => p.post_id === id)
          ? prev
          : [{ ...post, is_archived: false }, ...prev],
      );
      return;
    }
    if (change === 'unsaved') {
      setSaved(prev => prev.filter(s => s.post.post_id !== id));
    }
    const isSaved = change === 'saved';
    setPosts(prev =>
      prev.map(p => (p.post_id === id ? { ...p, is_saved: isSaved } : p)),
    );
  }, []);

  // Banner fields come from redux (owner) or the fetched profile (visitor).
  const ownerFullName = [
    user?.fullName?.firstName,
    user?.fullName?.middleName && user?.fullName?.middleName !== 'N/A'
      ? user.fullName.middleName
      : null,
    user?.fullName?.lastName,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
  const visitorFullName = otherInfo
    ? [
        otherInfo.fullname.firstName,
        otherInfo.fullname.middleName && otherInfo.fullname.middleName !== 'N/A'
          ? otherInfo.fullname.middleName
          : null,
        otherInfo.fullname.lastName,
      ]
        .filter(Boolean)
        .join(' ')
        .trim()
    : '';

  const display = isVisitor
    ? {
        fullName: visitorFullName,
        username: otherInfo?.username ?? viewedHandle ?? '',
        email: otherInfo?.email ?? '',
        profile:
          otherInfo?.profile && otherInfo.profile !== 'none'
            ? otherInfo.profile
            : null,
        coverphoto:
          otherInfo?.coverphoto &&
          otherInfo.coverphoto !== 'none' &&
          otherInfo.coverphoto !== ''
            ? otherInfo.coverphoto
            : null,
        // `isVerified` is just email verification (true for everyone) —
        // the blue badge is gated on `isBadged`, matching Feed/Search.
        badged: !!otherInfo?.isBadged,
      }
    : {
        fullName: ownerFullName,
        username: user?.username ?? '',
        email: user?.email ?? '',
        profile: user?.profile && user.profile !== 'none' ? user.profile : null,
        coverphoto:
          user?.coverphoto &&
          user.coverphoto !== 'none' &&
          user.coverphoto !== ''
            ? user.coverphoto
            : null,
        badged: false,
      };
  const hasAvatar = !!display.profile;
  const hasCover = !!display.coverphoto;
  const fullName = display.fullName;
  const conn = otherInfo?.connection;

  const onMessage = useCallback(() => {
    if (!otherInfo?.connection.connection_id) return;
    nav.navigate('Conversation', {
      conversationID: otherInfo.connection.connection_id,
      type: 'single',
      title: visitorFullName,
      profile:
        otherInfo.profile && otherInfo.profile !== 'none'
          ? otherInfo.profile
          : undefined,
      receivers: [otherInfo.userID],
      username: otherInfo.username,
    });
  }, [otherInfo, nav, visitorFullName]);

  // Three-column grid: dynamic tile size based on viewport so the grid
  // stays edge-to-edge on phones of varying widths.
  const screenW = Dimensions.get('window').width;
  const tileSize = Math.floor((screenW - 32 - 2 * 4) / 3);

  const renderPost = useCallback(
    ({ item }: { item: FeedPost }) => {
      const imageRef = item.references?.find(r =>
        (r.reference_media_type ?? '').includes('image'),
      );
      const openComments = () =>
        nav.navigate('PostDetail', {
          post_id: item.post_id,
          post: item,
        });
      // Long-press surfaces the post options (save / archive / delete),
      // mirroring the webapp's PostOptions affordance on each tile.
      const openOptions = () => setOptionsTarget(item);
      if (imageRef) {
        return (
          <Pressable
            onPress={openComments}
            onLongPress={openOptions}
            style={({ pressed }) => [
              styles.tile,
              {
                width: tileSize,
                height: tileSize,
                opacity: pressed ? 0.85 : 1,
              },
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
          onLongPress={openOptions}
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

  const renderSavedRow = useCallback(
    ({ item }: { item: SavedPost }) => {
      const p = item.post;
      const author = p.user;
      const middle =
        author.middle_name && author.middle_name !== 'N/A'
          ? ` ${author.middle_name}`
          : '';
      const name = `${author.first_name}${middle} ${author.last_name}`.trim();
      const authorHasAvatar = author.profile && author.profile !== 'none';
      return (
        <Pressable
          onPress={() => nav.navigate('PostDetail', { post_id: p.post_id })}
          style={({ pressed }) => [
            styles.savedRow,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          {authorHasAvatar ? (
            <Image
              source={{ uri: author.profile }}
              style={styles.savedAvatar}
            />
          ) : (
            <View
              style={[
                styles.savedAvatar,
                styles.avatarFallback,
                { backgroundColor: palette.brandSoft },
              ]}
            >
              <Text style={[styles.savedInitial, { color: palette.brand }]}>
                {author.first_name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.savedBody}>
            <Text
              numberOfLines={1}
              style={[styles.savedName, { color: palette.text }]}
            >
              {name}
            </Text>
            <Text
              numberOfLines={2}
              style={[styles.savedCaption, { color: palette.text2 }]}
            >
              {p.caption || 'Media post'}
            </Text>
          </View>
          <CLIcon n="bookmark" size={18} color={palette.brand} />
        </Pressable>
      );
    },
    [nav, palette],
  );

  const coverImage = hasCover ? (
    <Image
      source={{ uri: display.coverphoto as string }}
      style={StyleSheet.absoluteFill as never}
      resizeMode="cover"
    />
  ) : null;
  const avatarImage = hasAvatar ? (
    <Image source={{ uri: display.profile as string }} style={styles.avatar} />
  ) : (
    <View style={[styles.avatar, styles.avatarFallback]}>
      <CLIcon n="person" size={48} color="#fff" />
    </View>
  );

  const ListHeader = (
    <View>
      {isOwner ? (
        <Pressable
          onPress={() => editPhoto('cover_photo')}
          disabled={!!uploadingTarget}
          style={[
            styles.cover,
            { backgroundColor: hasCover ? 'transparent' : palette.brand },
          ]}
        >
          {coverImage}
          <View style={styles.coverEditBadge}>
            {uploadingTarget === 'cover_photo' ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <CLIcon n="photo-camera" size={14} color="#fff" />
            )}
          </View>
        </Pressable>
      ) : (
        <View
          style={[
            styles.cover,
            { backgroundColor: hasCover ? 'transparent' : palette.brand },
          ]}
        >
          {coverImage}
        </View>
      )}

      <View style={styles.bannerWrap}>
        {isOwner ? (
          <Pressable
            onPress={() => editPhoto('profile')}
            disabled={!!uploadingTarget}
            style={[
              styles.avatarWrap,
              { borderColor: palette.bg, backgroundColor: palette.brand300 },
            ]}
          >
            {avatarImage}
            <View style={styles.avatarEditBadge}>
              {uploadingTarget === 'profile' ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <CLIcon n="photo-camera" size={14} color="#fff" />
              )}
            </View>
          </Pressable>
        ) : (
          <View
            style={[
              styles.avatarWrap,
              { borderColor: palette.bg, backgroundColor: palette.brand300 },
            ]}
          >
            {avatarImage}
          </View>
        )}

        <View style={styles.nameRow}>
          <Text
            style={[styles.name, { color: palette.text }]}
            numberOfLines={1}
          >
            {fullName || (isOwner ? 'Your name' : `@${display.username}`)}
          </Text>
          {display.badged ? (
            <CLIcon n="verified" size={18} color={palette.brand} />
          ) : null}
        </View>
        {display.username ? (
          <Text style={[styles.handle, { color: palette.text2 }]}>
            @{display.username}
          </Text>
        ) : null}
        {display.email ? (
          <Text style={[styles.email, { color: palette.text3 }]}>
            {display.email}
          </Text>
        ) : null}

        {isVisitor ? (
          <View style={styles.actionsRow}>
            {conn?.is_connection_present && conn?.is_connection_handshaked ? (
              <>
                <Btn
                  label="Message"
                  iconL="forum"
                  size="sm"
                  onPress={onMessage}
                />
                <Btn
                  label="Friends"
                  iconL="how-to-reg"
                  variant="outline"
                  size="sm"
                  disabled={connBusy}
                  onPress={() => onDeclineContact('remove')}
                />
              </>
            ) : conn?.is_connection_present &&
              !conn?.is_connection_handshaked ? (
              conn?.is_user_connection_initiator ? (
                <Btn
                  label="Requested"
                  variant="outline"
                  size="sm"
                  disabled={connBusy}
                  onPress={() => onDeclineContact('remove')}
                />
              ) : (
                <>
                  <Btn
                    label="Accept"
                    iconL="check"
                    size="sm"
                    disabled={connBusy}
                    onPress={onAcceptContact}
                  />
                  <Btn
                    label="Decline"
                    variant="outline"
                    size="sm"
                    disabled={connBusy}
                    onPress={() => onDeclineContact('decline')}
                  />
                </>
              )
            ) : (
              <Btn
                label="Add"
                iconL="person-add"
                variant="soft"
                size="sm"
                disabled={connBusy}
                onPress={onAddContact}
              />
            )}
          </View>
        ) : null}

        {isOwner ? (
          <>
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
            </View>

            <Pressable
              onPress={() => nav.navigate('Diary')}
              style={({ pressed }) => [
                styles.diaryCard,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.diaryIcon,
                  { backgroundColor: palette.brandSoft },
                ]}
              >
                <CLIcon n="book" size={20} color={palette.brand} />
              </View>
              <View style={styles.diaryBody}>
                <Text style={[styles.diaryHead, { color: palette.text }]}>
                  Diary
                </Text>
                {diaryLoading ? (
                  <Text style={[styles.diarySub, { color: palette.text3 }]}>
                    Loading…
                  </Text>
                ) : !diary || diary.total_entries === 0 ? (
                  <Text style={[styles.diarySub, { color: palette.text3 }]}>
                    No entries yet · tap to start journaling
                  </Text>
                ) : (
                  <>
                    <Text style={[styles.diarySub, { color: palette.text2 }]}>
                      {diary.total_entries}{' '}
                      {diary.total_entries === 1 ? 'entry' : 'entries'}
                      {diary.latest_entry
                        ? ` · last ${timeSince(diary.latest_entry)}`
                        : ''}
                    </Text>
                    {diary.top_tags.length > 0 ? (
                      <View style={styles.diaryTagRow}>
                        {diary.top_tags.slice(0, 4).map(t => (
                          <View
                            key={t.id}
                            style={[
                              styles.diaryTag,
                              { backgroundColor: palette.brandSoft },
                            ]}
                          >
                            <Text
                              style={[
                                styles.diaryTagText,
                                { color: palette.brand },
                              ]}
                            >
                              {t.name}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </>
                )}
              </View>
              <CLIcon n="chevron-right" size={18} color={palette.text3} />
            </Pressable>

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
          </>
        ) : null}
      </View>

      {isOwner ? (
        <View style={styles.segmentRow}>
          {(
            [
              { key: 'posts', icon: 'grid-view', label: 'Posts' },
              { key: 'saved', icon: 'bookmark', label: 'Saved' },
              { key: 'archived', icon: 'inventory-2', label: 'Archived' },
            ] as { key: Segment; icon: string; label: string }[]
          ).map(seg => {
            const active = segment === seg.key;
            return (
              <Pressable
                key={seg.key}
                onPress={() => onSelectSegment(seg.key)}
                style={[
                  styles.segmentBtn,
                  {
                    backgroundColor: active ? palette.brandSoft : 'transparent',
                  },
                ]}
              >
                <CLIcon
                  n={seg.icon}
                  size={17}
                  color={active ? palette.brand : palette.text3}
                />
                <Text
                  style={[
                    styles.segmentLabel,
                    { color: active ? palette.brand : palette.text3 },
                  ]}
                >
                  {seg.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Text style={[styles.sectionLabel, { color: palette.text3 }]}>
          POSTS
        </Text>
      )}
    </View>
  );

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.screen, { backgroundColor: palette.bg }]}
    >
      {viewedHandle ? (
        <View style={[styles.headerBar, { borderBottomColor: palette.border }]}>
          <IconBtn
            n="arrow-back"
            iconSize={22}
            color={palette.text}
            onPress={() => nav.goBack()}
          />
          <Text
            numberOfLines={1}
            style={[styles.headerTitle, { color: palette.text }]}
          >
            {fullName || 'Profile'}
          </Text>
        </View>
      ) : null}

      {isVisitor && notFound ? (
        <View style={styles.center}>
          <CLIcon n="person-off" size={30} color={palette.text3} />
          <Text style={[styles.emptyText, { color: palette.text3 }]}>
            Profile not found
          </Text>
        </View>
      ) : isLoading && !refreshing ? (
        <ScrollView contentContainerStyle={styles.singleColumn}>
          {ListHeader}
          <View style={styles.center}>
            <ActivityIndicator color={palette.brand} />
          </View>
        </ScrollView>
      ) : (
        (() => {
          const gridMode = segment !== 'saved';
          const data = (
            segment === 'posts'
              ? posts
              : segment === 'archived'
              ? archived
              : saved
          ) as ReadonlyArray<FeedPost | SavedPost>;
          const emptyCopy =
            segment === 'saved'
              ? 'No saved posts'
              : segment === 'archived'
              ? 'No archived posts'
              : 'No posts yet';
          return (
            <FlatList
              key={gridMode ? 'grid' : 'list'}
              data={data as any[]}
              keyExtractor={(item: any, i) =>
                (gridMode ? item.post_id : item.id) ?? `row-${i}`
              }
              renderItem={(gridMode ? renderPost : renderSavedRow) as any}
              numColumns={gridMode ? 3 : 1}
              columnWrapperStyle={gridMode ? styles.columnWrapper : undefined}
              contentContainerStyle={
                gridMode ? styles.listContent : styles.savedListContent
              }
              ListHeaderComponent={ListHeader}
              ListEmptyComponent={
                sectionLoading ? (
                  <View style={styles.center}>
                    <ActivityIndicator color={palette.brand} />
                  </View>
                ) : (
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
                      {emptyCopy}
                    </Text>
                  </View>
                )
              }
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={palette.brand}
                />
              }
            />
          );
        })()
      )}

      <PostOptionsSheet
        target={optionsTarget}
        me={user.userID}
        onClose={() => setOptionsTarget(null)}
        onChanged={onPostChanged}
      />
    </SafeAreaView>
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
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
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
    flexShrink: 1,
  },
  handle: { fontSize: 14 },
  email: { fontSize: 12.5, marginTop: 1 },

  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },

  diaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 14,
  },
  diaryIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diaryBody: { flex: 1, gap: 3 },
  diaryHead: { fontSize: 14, fontWeight: '700' },
  diarySub: { fontSize: 12 },
  diaryTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  diaryTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  diaryTagText: { fontSize: 11, fontWeight: '700' },

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

  segmentRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 18,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: radii.md,
  },
  segmentLabel: { fontSize: 12.5, fontWeight: '700' },

  savedListContent: { paddingHorizontal: 16, paddingBottom: 32, gap: 8 },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderRadius: radii.md,
  },
  savedAvatar: { width: 42, height: 42, borderRadius: radii.pill },
  savedInitial: { fontSize: 15, fontWeight: '700' },
  savedBody: { flex: 1, minWidth: 0, gap: 2 },
  savedName: { fontSize: 14, fontWeight: '700' },
  savedCaption: { fontSize: 12.5, lineHeight: 17 },

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
