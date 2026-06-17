/* PostDetail — full single-post view + inline comments thread.
 *
 * Entry points: Profile post grid taps, PageDetail comment-count tap,
 * Feed comment-count tap. Renders the full post card (author, caption,
 * full-width media, reaction row) as the FlatList header, then the
 * top-level comments below, with a sticky composer at the bottom.
 *
 * Re-uses CommentRow from Comments.tsx for the per-row reply/attachment
 * UI. The reaction handling is shared via useFeedReactions so the heart
 * stays consistent with the rest of the app. */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { ReactionPopover } from '../../../reusables/design/ReactionPopover';
import { radii } from '../../../reusables/design/tokens';
import { timeSince } from '../../../reusables/hooks/reusable';
import {
  FeedPost,
  GetCommentsRequest,
  GetPostPreviewRequest,
  PostComment,
  SaveCommentRequest,
} from '../../../reusables/hooks/requests';
import { pickImages } from '../../../reusables/hooks/imagePicker';
import { useFeedReactions } from '../../../reusables/hooks/useFeedReactions';
import { CommentRow } from './CommentRow';

interface PostDetailParams {
  post_id: string;
  /** Optional fully-hydrated post — when passed (e.g. from Feed) we
   *  skip the initial preview fetch and render immediately. */
  post?: FeedPost;
}

const RANGE = 20;

function authorName(u: FeedPost['user']): string {
  const middle =
    u.middle_name && u.middle_name !== 'N/A' ? ` ${u.middle_name}` : '';
  return `${u.first_name}${middle} ${u.last_name}`.trim();
}

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

export default function PostDetail() {
  const { palette } = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { post_id, post: seedPost } = route.params as PostDetailParams;
  const authentication = useSelector((s: AppState) => s.authentication);

  // Single-element posts array so useFeedReactions can keep its
  // signature `(posts, setPosts) => …`. Tap/long-press act on this
  // one entry; the optimistic count + user_reaction updates flow
  // through here and re-render the header card.
  const [posts, setPosts] = useState<FeedPost[]>(seedPost ? [seedPost] : []);
  const [postLoading, setPostLoading] = useState(!seedPost);
  const post = posts[0];

  const {
    sortedEmojis,
    popoverPostId,
    setPopoverPostId,
    onTapReaction,
    onLongPressReaction,
    onPickFromPopover,
  } = useFeedReactions(posts, setPosts);

  // Comments thread state — mirrors the Comments screen's pattern.
  const [comments, setComments] = useState<PostComment[]>([]);
  const [page, setPage] = useState(1);
  const [next, setNext] = useState<string | null>(null);
  const [isCommentsLoading, setIsCommentsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<string | null>(null);
  const [pickingAttachment, setPickingAttachment] = useState(false);

  useEffect(() => {
    if (seedPost) return;
    GetPostPreviewRequest(post_id).then(p => {
      if (p) setPosts([p]);
      setPostLoading(false);
    });
  }, [post_id, seedPost]);

  const loadComments = useCallback(
    async (p: number, append: boolean) => {
      const result = await GetCommentsRequest(post_id, null, p, RANGE);
      setComments(prev => {
        const combined = append ? [...prev, ...result.results] : result.results;
        const seen = new Set<string>();
        return combined.filter(c => {
          if (seen.has(c.comment_id)) return false;
          seen.add(c.comment_id);
          return true;
        });
      });
      setNext(result.next);
      setIsCommentsLoading(false);
      setLoadingMore(false);
    },
    [post_id],
  );

  useEffect(() => {
    loadComments(1, false);
  }, [loadComments]);

  const onEndReached = useCallback(() => {
    if (loadingMore || !next) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    loadComments(nextPage, true);
  }, [loadComments, loadingMore, next, page]);

  const onPickAttachment = useCallback(async () => {
    if (pickingAttachment || sending) return;
    setPickingAttachment(true);
    const picked = await pickImages({ selectionLimit: 1, mediaType: 'photo' });
    setPickingAttachment(false);
    if (picked.length === 0) return;
    setAttachment(picked[0].base);
  }, [pickingAttachment, sending]);

  const onSend = useCallback(async () => {
    const text = draft.trim();
    if ((!text && !attachment) || sending) return;
    setSending(true);
    const saved = await SaveCommentRequest(post_id, null, text, attachment);
    setSending(false);
    if (saved) {
      setComments(prev => {
        if (prev.some(c => c.comment_id === saved.comment_id)) return prev;
        return [saved, ...prev];
      });
      // Bump the post's comment count in-place so the header reflects
      // the addition without a refetch.
      setPosts(prev =>
        prev.map(p => {
          const counts = p.activity_counts ?? [];
          const hasComment = counts.some(c => c.count_type === 'comment');
          const nextCounts = hasComment
            ? counts.map(c =>
                c.count_type === 'comment' ? { ...c, count: c.count + 1 } : c,
              )
            : [...counts, { count_type: 'comment', count: 1 }];
          return { ...p, activity_counts: nextCounts };
        }),
      );
      setDraft('');
      setAttachment(null);
    }
  }, [attachment, draft, post_id, sending]);

  const renderComment = useCallback(
    ({ item }: { item: PostComment }) => (
      <CommentRow
        comment={item}
        post_id={post_id}
        authAvailable={authentication.auth === true}
      />
    ),
    [authentication.auth, post_id],
  );

  const hasProfile = post?.user.profile && post.user.profile !== 'none';
  const imageURI = post ? firstImageURI(post) : undefined;
  const likes = post ? countByType(post.activity_counts, 'like') : 0;
  const commentsCount = post
    ? countByType(post.activity_counts, 'comment')
    : 0;

  const PostCard = post ? (
    <View style={styles.postCardWrap}>
      <View
        style={[
          styles.postCard,
          { backgroundColor: palette.surface, borderColor: palette.border },
        ]}
      >
        <View style={styles.postHeader}>
          {hasProfile ? (
            <Image
              source={{ uri: post.user.profile }}
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
              <Text style={[styles.postAvatarInitial, { color: palette.brand }]}>
                {post.user.first_name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.postHeaderText}>
            <View style={styles.nameRow}>
              <Text
                numberOfLines={1}
                style={[styles.postAuthor, { color: palette.text }]}
              >
                {authorName(post.user)}
              </Text>
              {post.user.is_badged ? (
                <CLIcon n="verified" size={14} color={palette.brand} />
              ) : null}
            </View>
            <Text style={[styles.postMeta, { color: palette.text3 }]}>
              @{post.user.username} · {timeSince(post.date_posted)}
            </Text>
          </View>
        </View>

        {post.caption ? (
          <Text style={[styles.postCaption, { color: palette.text }]}>
            {post.caption}
          </Text>
        ) : null}

        {imageURI ? (
          <Image
            source={{ uri: imageURI }}
            style={[styles.postMedia, { backgroundColor: palette.surface2 }]}
            resizeMode="cover"
          />
        ) : null}

        <View style={[styles.postActions, { borderTopColor: palette.border }]}>
          <Pressable
            onPress={() => onTapReaction(post)}
            onLongPress={() => onLongPressReaction(post)}
            hitSlop={8}
            style={({ pressed }) => [
              styles.postActionGroup,
              styles.postActionPressable,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <CLIcon
              n={post.user_reaction ? 'favorite' : 'favorite-border'}
              size={22}
              color={post.user_reaction ? palette.pink : palette.text2}
            />
            <Text style={[styles.postActionLabel, { color: palette.text2 }]}>
              {likes}
            </Text>
          </Pressable>
          <View style={[styles.postActionGroup, styles.postActionPressable]}>
            <CLIcon n="chat-bubble-outline" size={20} color={palette.text2} />
            <Text style={[styles.postActionLabel, { color: palette.text2 }]}>
              {commentsCount}
            </Text>
          </View>
        </View>
      </View>
      <Text style={[styles.commentsHeading, { color: palette.text3 }]}>
        COMMENTS
      </Text>
    </View>
  ) : null;

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.screen, { backgroundColor: palette.bg }]}
    >
      <View style={[styles.headerBar, { borderBottomColor: palette.border }]}>
        <IconBtn
          n="arrow-back"
          iconSize={22}
          color={palette.text}
          onPress={() => nav.goBack()}
        />
        <Text style={[styles.headerTitle, { color: palette.text }]}>Post</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.body}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        {postLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={palette.brand} />
          </View>
        ) : !post ? (
          <View style={styles.center}>
            <CLIcon n="error-outline" size={28} color={palette.text3} />
            <Text style={[styles.emptyText, { color: palette.text3 }]}>
              Post not found
            </Text>
          </View>
        ) : (
          <FlatList
            data={comments}
            keyExtractor={c => c.comment_id}
            renderItem={renderComment}
            contentContainerStyle={styles.listContent}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.4}
            ListHeaderComponent={PostCard}
            ListEmptyComponent={
              !isCommentsLoading ? (
                <View style={styles.empty}>
                  <CLIcon
                    n="chat-bubble-outline"
                    size={28}
                    color={palette.text3}
                  />
                  <Text style={[styles.emptyText, { color: palette.text3 }]}>
                    No comments yet
                  </Text>
                </View>
              ) : (
                <View style={styles.empty}>
                  <ActivityIndicator color={palette.text3} />
                </View>
              )
            }
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.footerLoading}>
                  <ActivityIndicator color={palette.text3} />
                </View>
              ) : null
            }
          />
        )}

        {authentication.auth && post ? (
          <View
            style={[
              styles.composerWrap,
              { borderTopColor: palette.border, backgroundColor: palette.bg },
            ]}
          >
            {attachment ? (
              <View style={styles.composerThumbRow}>
                <View style={styles.composerThumbWrap}>
                  <Image
                    source={{ uri: attachment }}
                    style={[
                      styles.composerThumb,
                      { backgroundColor: palette.surface2 },
                    ]}
                  />
                  <Pressable
                    hitSlop={8}
                    onPress={() => setAttachment(null)}
                    style={({ pressed }) => [
                      styles.composerThumbRemove,
                      { opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <CLIcon n="close" size={14} color="#fff" />
                  </Pressable>
                </View>
              </View>
            ) : null}
            <View style={styles.composer}>
              <Pressable
                disabled={pickingAttachment || sending}
                onPress={onPickAttachment}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.composerAttachBtn,
                  {
                    opacity:
                      pickingAttachment || sending
                        ? 0.5
                        : pressed
                          ? 0.6
                          : 1,
                  },
                ]}
              >
                {pickingAttachment ? (
                  <ActivityIndicator color={palette.text2} size="small" />
                ) : (
                  <CLIcon n="image" size={22} color={palette.green} />
                )}
              </Pressable>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Write a comment…"
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
                disabled={(!draft.trim() && !attachment) || sending}
                onPress={onSend}
                style={({ pressed }) => [
                  styles.sendBtn,
                  {
                    backgroundColor: palette.brand,
                    opacity:
                      (!draft.trim() && !attachment) || sending
                        ? 0.5
                        : pressed
                          ? 0.8
                          : 1,
                  },
                ]}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <CLIcon n="send" size={20} color="#fff" />
                )}
              </Pressable>
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>

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
  body: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  emptyText: { fontSize: 13, fontWeight: '600' },

  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 10,
    gap: 8,
    borderBottomWidth: 1,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },

  postCardWrap: { gap: 10, marginBottom: 8 },
  postCard: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 14,
    gap: 10,
  },
  postHeader: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  postAvatar: { width: 40, height: 40, borderRadius: radii.pill },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  postAvatarInitial: { fontSize: 15, fontWeight: '800' },
  postHeaderText: { flex: 1, minWidth: 0, gap: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  postAuthor: { flexShrink: 1, fontSize: 14, fontWeight: '700' },
  postMeta: { fontSize: 11.5 },
  postCaption: { fontSize: 14.5, lineHeight: 21 },
  postMedia: {
    width: '100%',
    aspectRatio: 1.4,
    borderRadius: radii.sm,
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  postActionGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  postActionPressable: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginHorizontal: -4,
  },
  postActionLabel: { fontSize: 13, fontWeight: '600' },

  commentsHeading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 4,
    marginLeft: 4,
  },

  listContent: { padding: 14, gap: 12, paddingBottom: 32 },
  empty: { paddingTop: 60, alignItems: 'center', gap: 6 },
  footerLoading: { paddingVertical: 14, alignItems: 'center' },

  composerWrap: { borderTopWidth: 1 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
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
  composerAttachBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerThumbRow: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 2,
  },
  composerThumbWrap: {
    position: 'relative',
    width: 80,
    height: 80,
  },
  composerThumb: {
    width: '100%',
    height: '100%',
    borderRadius: radii.sm,
  },
  composerThumbRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
