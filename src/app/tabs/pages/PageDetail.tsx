/* eslint-disable react-native/no-inline-styles */
/* Page detail — scoped port of webapp/src/app/tabs/profile/user/RealmProfile.tsx.
 *
 * Webapp version mixes the realm banner with a full post composer +
 * cover/avatar editor + lazy-paged feed. This first pass keeps just:
 *
 *   - Cover photo + avatar banner
 *   - Realm name with verified badge
 *   - Follow / Unfollow toggle (optimistic — webapp also optimistic)
 *   - Read-only post list (GetPostRequest with archive=false)
 *
 * Composer, cover/avatar editing, reactions, comments, and lazy paging
 * are deferred — they share infrastructure with the unported Feed
 * composer and post detail flows. */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState as RNAppState,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSelector } from 'react-redux';

import type { AppState } from '../../../redux/store';
import { useTheme } from '../../../reusables/design/ThemeProvider';
import { Btn, CLIcon, IconBtn } from '../../../reusables/design/primitives';
import { ReactionPopover } from '../../../reusables/design/ReactionPopover';
import { radii } from '../../../reusables/design/tokens';
import { timeSince } from '../../../reusables/hooks/reusable';
import {
  FeedPost,
  FollowRealmRequest,
  GetPostRequest,
  GetProfileInfoRequest,
  UnfollowRealmRequest,
} from '../../../reusables/hooks/requests';
import { useFeedReactions } from '../../../reusables/hooks/useFeedReactions';
import { persistViewPost } from '../../../reusables/hooks/viewcache';

interface PageDetailParams {
  realmID: string;
  slug: string;
  name: string;
  profile?: string;
  cover?: string;
  description?: string;
  isVerified?: boolean;
  isFollowing?: boolean;
}

const RANGE = 20;

function countByType(
  counts: { count_type: string; count: number }[] | undefined,
  type: string,
): number {
  if (!counts) return 0;
  return counts.find(c => c.count_type === type)?.count ?? 0;
}

function firstImageURI(post: FeedPost): string | undefined {
  const ref = post.references?.find(r =>
    (r.reference_media_type ?? '').includes('image'),
  );
  return ref?.reference;
}

function authorName(author: FeedPost['user']): string {
  const middle =
    author.middle_name && author.middle_name !== 'N/A'
      ? ` ${author.middle_name}`
      : '';
  return `${author.first_name}${middle} ${author.last_name}`.trim();
}

export default function PageDetail() {
  const { palette } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = route.params as PageDetailParams;
  const authentication = useSelector((s: AppState) => s.authentication);

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Route params carry only an *optimistic* hint (e.g. "tab === followed"
  // in Pages.tsx). The source of truth is the server's `is_follower` on
  // the realm profile object — fetched on mount below.
  const [following, setFollowing] = useState<boolean>(!!params.isFollowing);
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    GetProfileInfoRequest(params.slug).then(info => {
      if (cancelled || !info) return;
      setFollowing(!!info.is_follower);
    });
    return () => {
      cancelled = true;
    };
  }, [params.slug]);

  const {
    sortedEmojis,
    popoverPostId,
    setPopoverPostId,
    onTapReaction,
    onLongPressReaction,
    onPickFromPopover,
  } = useFeedReactions(posts, setPosts);

  // Per-post view session timestamps — same pattern as Feed.tsx. The
  // next GetPostRequest will ship the accumulated viewcache and drain
  // it.
  const viewStartRef = useRef<Map<string, number>>(new Map());

  const closeViewSession = useCallback(
    (post: FeedPost) => {
      const started = viewStartRef.current.get(post.post_id);
      if (!started) return;
      viewStartRef.current.delete(post.post_id);
      const duration = (Date.now() - started) / 1000;
      if (duration <= 0) return;
      persistViewPost(post.post_id, {
        user_id: authentication.user.userID,
        post_owner_id: post.user.id,
        duration,
        created_at: new Date(started).toISOString(),
      });
    },
    [authentication.user.userID],
  );

  const viewabilityConfigRef = useRef({
    itemVisiblePercentThreshold: 60,
    minimumViewTime: 250,
  });

  const onViewableItemsChanged = useRef(
    ({
      viewableItems,
      changed,
    }: {
      viewableItems: ViewToken[];
      changed: ViewToken[];
    }) => {
      const me = authentication.user.userID;
      changed.forEach(token => {
        const post = token.item as FeedPost;
        if (!post?.post_id) return;
        if (post.user.username === me) return;
        if (token.isViewable) {
          if (!viewStartRef.current.has(post.post_id)) {
            viewStartRef.current.set(post.post_id, Date.now());
          }
        } else {
          closeViewSession(post);
        }
      });
      viewableItems.forEach(token => {
        const post = token.item as FeedPost;
        if (!post?.post_id || post.user.username === me) return;
        if (!viewStartRef.current.has(post.post_id)) {
          viewStartRef.current.set(post.post_id, Date.now());
        }
      });
    },
  );

  useEffect(() => {
    onViewableItemsChanged.current = ({ viewableItems, changed }) => {
      const me = authentication.user.userID;
      changed.forEach(token => {
        const post = token.item as FeedPost;
        if (!post?.post_id || post.user.username === me) return;
        if (token.isViewable) {
          if (!viewStartRef.current.has(post.post_id)) {
            viewStartRef.current.set(post.post_id, Date.now());
          }
        } else {
          closeViewSession(post);
        }
      });
      viewableItems.forEach(token => {
        const post = token.item as FeedPost;
        if (!post?.post_id || post.user.username === me) return;
        if (!viewStartRef.current.has(post.post_id)) {
          viewStartRef.current.set(post.post_id, Date.now());
        }
      });
    };
  }, [authentication.user.userID, closeViewSession]);

  // Flush every open session when the screen tears down.
  useEffect(() => {
    const sessions = viewStartRef.current;
    return () => {
      const me = authentication.user.userID;
      sessions.forEach((started, postID) => {
        const duration = (Date.now() - started) / 1000;
        if (duration <= 0) return;
        persistViewPost(postID, {
          user_id: me,
          post_owner_id: '',
          duration,
          created_at: new Date(started).toISOString(),
        });
      });
      sessions.clear();
    };
  }, [authentication.user.userID]);

  // Same flush on OS background/inactive transitions so we don't lose
  // durations for posts visible at suspend time.
  useEffect(() => {
    const sub = RNAppState.addEventListener('change', state => {
      if (state !== 'background' && state !== 'inactive') return;
      const me = authentication.user.userID;
      const sessions = viewStartRef.current;
      sessions.forEach((started, postID) => {
        const duration = (Date.now() - started) / 1000;
        if (duration <= 0) return;
        persistViewPost(postID, {
          user_id: me,
          post_owner_id: '',
          duration,
          created_at: new Date(started).toISOString(),
        });
      });
      sessions.clear();
    });
    return () => sub.remove();
  }, [authentication.user.userID]);

  const load = useCallback(
    async (silent: boolean) => {
      if (!silent) setIsLoading(true);
      const response = await GetPostRequest({
        current_user_id: authentication.user.userID,
        userID: params.realmID,
        page: 1,
        range: RANGE,
        archive: false,
      });
      setPosts(response.results ?? []);
      setIsLoading(false);
      setRefreshing(false);
    },
    [authentication.user.userID, params.realmID],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  const openComposer = useCallback(() => {
    navigation.navigate('NewPost', {
      realm_id: params.realmID,
      realm_name: params.name,
      // Silent refresh so the new post lands at the top without a
      // spinner flash on the page feed.
      onPosted: () => load(true),
    });
  }, [load, navigation, params.name, params.realmID]);

  const onToggleFollow = useCallback(async () => {
    if (followBusy) return;
    setFollowBusy(true);
    // Optimistic flip — revert on failure.
    const willFollow = !following;
    setFollowing(willFollow);
    const action = willFollow ? FollowRealmRequest : UnfollowRealmRequest;
    const ok = await action({ realm_id: params.realmID });
    if (!ok) setFollowing(!willFollow);
    setFollowBusy(false);
  }, [followBusy, following, params.realmID]);

  const renderItem = useCallback(
    ({ item }: { item: FeedPost }) => {
      const name = authorName(item.user);
      const hasProfile = item.user.profile && item.user.profile !== 'none';
      const imageURI = firstImageURI(item);
      const likes = countByType(item.activity_counts, 'like');
      const comments = countByType(item.activity_counts, 'comment');

      return (
        <View
          style={[
            styles.postCard,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <View style={styles.postHeader}>
            {hasProfile ? (
              <Image
                source={{ uri: item.user.profile }}
                style={styles.postAvatar}
              />
            ) : (
              <View
                style={[
                  styles.postAvatar,
                  styles.avatarFallback,
                  { backgroundColor: palette.brandSoft },
                ]}
              >
                <Text
                  style={[styles.fallbackInitial, { color: palette.brand }]}
                >
                  {item.user.first_name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.postHeaderText}>
              <Text
                numberOfLines={1}
                style={[styles.postAuthor, { color: palette.text }]}
              >
                {name}
              </Text>
              <Text style={[styles.postMeta, { color: palette.text3 }]}>
                @{item.user.username} · {timeSince(item.date_posted)}
              </Text>
            </View>
          </View>
          {item.caption ? (
            <Text style={[styles.postCaption, { color: palette.text }]}>
              {item.caption}
            </Text>
          ) : null}
          {imageURI ? (
            <Image
              source={{ uri: imageURI }}
              style={[styles.postMedia, { backgroundColor: palette.surface2 }]}
              resizeMode="cover"
            />
          ) : null}
          <View
            style={[styles.postActions, { borderTopColor: palette.border }]}
          >
            <Pressable
              onPress={() => onTapReaction(item)}
              onLongPress={() => onLongPressReaction(item)}
              hitSlop={8}
              style={({ pressed }) => [
                styles.actionGroup,
                styles.actionPressable,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <CLIcon
                n={item.user_reaction ? 'favorite' : 'favorite-border'}
                size={20}
                color={item.user_reaction ? palette.pink : palette.text2}
              />
              <Text style={[styles.actionLabel, { color: palette.text2 }]}>
                {likes}
              </Text>
            </Pressable>
            <Pressable
              onPress={() =>
                navigation.navigate('PostDetail', {
                  post_id: item.post_id,
                  post: item,
                })
              }
              hitSlop={8}
              style={({ pressed }) => [
                styles.actionGroup,
                styles.actionPressable,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <CLIcon n="chat-bubble-outline" size={18} color={palette.text2} />
              <Text style={[styles.actionLabel, { color: palette.text2 }]}>
                {comments}
              </Text>
            </Pressable>
          </View>
        </View>
      );
    },
    [navigation, onLongPressReaction, onTapReaction, palette],
  );

  const hasAvatar = params.profile && params.profile !== 'none';
  const hasCover = params.cover && params.cover !== 'none';
  const initial = params.name.charAt(0).toUpperCase();

  const ListHeader = (
    <View>
      <View
        style={[
          styles.cover,
          { backgroundColor: hasCover ? 'transparent' : palette.surface2 },
        ]}
      >
        {hasCover ? (
          <Image
            source={{ uri: params.cover }}
            style={StyleSheet.absoluteFill as never}
            resizeMode="cover"
          />
        ) : null}
      </View>
      <View
        style={[
          styles.banner,
          { backgroundColor: palette.surface, borderColor: palette.border },
        ]}
      >
        <View
          style={[styles.bannerAvatarWrap, { borderColor: palette.surface }]}
        >
          {hasAvatar ? (
            <Image
              source={{ uri: params.profile }}
              style={styles.bannerAvatar}
            />
          ) : (
            <View
              style={[
                styles.bannerAvatar,
                styles.avatarFallback,
                { backgroundColor: palette.brandSoft },
              ]}
            >
              <Text style={[styles.bannerInitial, { color: palette.brand }]}>
                {initial}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.bannerCopy}>
          <View style={styles.bannerNameRow}>
            <Text
              numberOfLines={1}
              style={[styles.bannerName, { color: palette.text }]}
            >
              {params.name}
            </Text>
            {params.isVerified ? (
              <CLIcon n="verified" size={16} color={palette.brand} />
            ) : null}
          </View>
          {params.description ? (
            <Text
              numberOfLines={3}
              style={[styles.bannerDesc, { color: palette.text2 }]}
            >
              {params.description}
            </Text>
          ) : null}
        </View>
        <Btn
          size="sm"
          variant={following ? 'outline' : 'primary'}
          label={following ? 'Following' : 'Follow'}
          iconL={following ? 'check' : 'add'}
          disabled={followBusy}
          onPress={onToggleFollow}
          style={styles.followBtn}
        />
      </View>
      {following ? (
        <Pressable
          onPress={openComposer}
          style={({ pressed }) => [
            styles.pageComposer,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <CLIcon n="edit" size={16} color={palette.brand} />
          <Text style={[styles.pageComposerText, { color: palette.text2 }]}>
            Write a post on {params.name}…
          </Text>
        </Pressable>
      ) : null}
      <Text style={[styles.sectionLabel, { color: palette.text3 }]}>POSTS</Text>
    </View>
  );

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.screen, { backgroundColor: palette.bg }]}
    >
      <View style={styles.headerBar}>
        <IconBtn
          n="arrow-back"
          iconSize={22}
          color={palette.text}
          onPress={() => navigation.goBack()}
        />
        <Text
          numberOfLines={1}
          style={[styles.headerTitle, { color: palette.text }]}
        >
          {params.name}
        </Text>
      </View>

      {isLoading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={palette.brand} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p, i) => p.post_id ?? `post-${i}`}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          viewabilityConfig={viewabilityConfigRef.current}
          onViewableItemsChanged={info => onViewableItemsChanged.current(info)}
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
              <CLIcon n="article" size={32} color={palette.text3} />
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

      <ReactionPopover
        visible={popoverPostId !== null}
        emojis={sortedEmojis}
        onClose={() => setPopoverPostId(null)}
        onPick={onPickFromPopover}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 10,
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
    flex: 1,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 12, gap: 8 },

  cover: {
    width: '100%',
    height: 120,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  banner: {
    marginTop: -34,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 14,
    paddingTop: 38,
    alignItems: 'center',
    gap: 8,
  },
  bannerAvatarWrap: {
    position: 'absolute',
    top: -34,
    width: 76,
    height: 76,
    borderRadius: radii.pill,
    borderWidth: 3,
    overflow: 'hidden',
  },
  bannerAvatar: { width: '100%', height: '100%' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  bannerInitial: { fontSize: 28, fontWeight: '800' },
  fallbackInitial: { fontWeight: '700' },
  bannerCopy: { alignItems: 'center', gap: 4 },
  bannerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  bannerName: { fontSize: 17, fontWeight: '800' },
  bannerDesc: { fontSize: 12.5, textAlign: 'center', lineHeight: 17 },
  followBtn: { marginTop: 6, minWidth: 130 },

  pageComposer: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pageComposerText: { flex: 1, fontSize: 13, fontWeight: '600' },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 16,
    marginLeft: 4,
  },

  postCard: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 12,
    gap: 10,
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  postAvatar: { width: 40, height: 40, borderRadius: radii.pill },
  postHeaderText: { flex: 1, minWidth: 0 },
  postAuthor: { fontSize: 14, fontWeight: '700' },
  postMeta: { fontSize: 11.5, marginTop: 1 },
  postCaption: { fontSize: 14, lineHeight: 20 },
  postMedia: { width: '100%', aspectRatio: 4 / 3, borderRadius: radii.sm },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  actionGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionPressable: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginHorizontal: -4,
  },
  actionLabel: { fontSize: 12.5, fontWeight: '600' },

  empty: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  emptyText: { fontSize: 13, fontWeight: '600' },
});
