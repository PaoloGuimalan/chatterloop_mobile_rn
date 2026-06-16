/* Comments screen — scoped port of
 * webapp/src/app/widgets/items/PostComment.tsx.
 *
 * Scrollable thread of top-level comments for a single post + sticky
 * composer at the bottom. Each comment can be tapped "Reply" to expand
 * an inline child thread (loaded lazily via GetCommentsRequest with
 * parent_id) and a nested composer. Reply nesting is one level deep
 * here — replies to replies still appear under the original root. */

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
import { radii } from '../../../reusables/design/tokens';
import { timeSince } from '../../../reusables/hooks/reusable';
import {
  GetCommentsRequest,
  PostComment,
  SaveCommentRequest,
} from '../../../reusables/hooks/requests';
import { pickImages } from '../../../reusables/hooks/imagePicker';

interface CommentsParams {
  post_id: string;
  /** Optional initial count so we can show it in the header
   *  before the first page lands. */
  initialCount?: number;
}

const RANGE = 20;

function authorName(u: PostComment['user']): string {
  const middle =
    u.middle_name && u.middle_name !== 'N/A' ? ` ${u.middle_name}` : '';
  return `${u.first_name}${middle} ${u.last_name}`.trim();
}

// --------------------------------------------------------------------------
// CommentRow — owns its own reply-thread state so each row can independently
// load children, show its composer, and post a reply without dragging the
// parent screen's state into a per-row shape.
// --------------------------------------------------------------------------

function CommentRow({
  comment,
  post_id,
  authAvailable,
}: {
  comment: PostComment;
  post_id: string;
  authAvailable: boolean;
}) {
  const { palette } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<PostComment[]>([]);
  const [childCount, setChildCount] = useState<number | null>(null);
  const [childPage, setChildPage] = useState(1);
  const [childNext, setChildNext] = useState<string | null>(null);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [loadingMoreChildren, setLoadingMoreChildren] = useState(false);
  const [replyDraft, setReplyDraft] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [replyAttachment, setReplyAttachment] = useState<string | null>(null);
  const [pickingReplyAttachment, setPickingReplyAttachment] = useState(false);

  const onPickReplyAttachment = useCallback(async () => {
    if (pickingReplyAttachment || sendingReply) return;
    setPickingReplyAttachment(true);
    const picked = await pickImages({ selectionLimit: 1, mediaType: 'photo' });
    setPickingReplyAttachment(false);
    if (picked.length === 0) return;
    setReplyAttachment(picked[0].base);
  }, [pickingReplyAttachment, sendingReply]);

  const loadChildren = useCallback(
    async (p: number, append: boolean) => {
      const result = await GetCommentsRequest(post_id, comment.comment_id, p, RANGE);
      setChildren((prev) => {
        const combined = append ? [...prev, ...result.results] : result.results;
        const seen = new Set<string>();
        return combined.filter((c) => {
          if (seen.has(c.comment_id)) return false;
          seen.add(c.comment_id);
          return true;
        });
      });
      setChildCount(result.count);
      setChildNext(result.next);
      setLoadingChildren(false);
      setLoadingMoreChildren(false);
    },
    [comment.comment_id, post_id],
  );

  const onToggleReplies = useCallback(() => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (children.length === 0 && !loadingChildren) {
      setLoadingChildren(true);
      loadChildren(1, false);
    }
  }, [children.length, expanded, loadChildren, loadingChildren]);

  const onLoadMoreChildren = useCallback(() => {
    if (loadingMoreChildren || !childNext) return;
    setLoadingMoreChildren(true);
    const next = childPage + 1;
    setChildPage(next);
    loadChildren(next, true);
  }, [childNext, childPage, loadChildren, loadingMoreChildren]);

  const onSendReply = useCallback(async () => {
    const text = replyDraft.trim();
    if ((!text && !replyAttachment) || sendingReply) return;
    setSendingReply(true);
    const saved = await SaveCommentRequest(
      post_id,
      comment.comment_id,
      text,
      replyAttachment,
    );
    setSendingReply(false);
    if (saved) {
      setChildren((prev) => {
        if (prev.some((c) => c.comment_id === saved.comment_id)) return prev;
        return [saved, ...prev];
      });
      setChildCount((c) => (c == null ? 1 : c + 1));
      setReplyDraft('');
      setReplyAttachment(null);
    }
  }, [
    comment.comment_id,
    post_id,
    replyAttachment,
    replyDraft,
    sendingReply,
  ]);

  const renderAvatar = (user: PostComment['user'], size: number) => {
    const hasProfile = user.profile && user.profile !== 'none';
    if (hasProfile) {
      return (
        <Image
          source={{ uri: user.profile }}
          style={[
            { width: size, height: size, borderRadius: radii.pill },
            { backgroundColor: palette.brandSoft },
          ]}
        />
      );
    }
    return (
      <View
        style={[
          { width: size, height: size, borderRadius: radii.pill },
          styles.avatarFallback,
          { backgroundColor: palette.brandSoft },
        ]}
      >
        <Text style={[styles.avatarInitial, { color: palette.brand }]}>
          {user.first_name.charAt(0).toUpperCase()}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.commentRow}>
      {renderAvatar(comment.user, 36)}
      <View style={styles.commentBody}>
        <View
          style={[
            styles.commentBubble,
            {
              backgroundColor: palette.surface2,
              borderColor: palette.border,
            },
          ]}
        >
          <View style={styles.commentHead}>
            <Text
              numberOfLines={1}
              style={[styles.commentAuthor, { color: palette.text }]}
            >
              {authorName(comment.user)}
            </Text>
            {comment.user.is_badged ? (
              <CLIcon n="verified" size={12} color={palette.brand} />
            ) : null}
          </View>
          {comment.text ? (
            <Text style={[styles.commentText, { color: palette.text }]}>
              {comment.text}
            </Text>
          ) : null}
          {comment.attachment ? (
            <Image
              source={{ uri: comment.attachment }}
              style={[
                styles.commentAttachment,
                { backgroundColor: palette.surface },
              ]}
              resizeMode="cover"
            />
          ) : null}
        </View>
        <View style={styles.commentMetaRow}>
          <Text style={[styles.commentMeta, { color: palette.text3 }]}>
            @{comment.user.username} · {timeSince(comment.created_at)}
          </Text>
          <Pressable
            hitSlop={6}
            onPress={onToggleReplies}
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={[styles.replyToggle, { color: palette.brand }]}>
              {expanded
                ? 'Hide replies'
                : childCount != null && childCount > 0
                  ? `View ${childCount} repl${childCount === 1 ? 'y' : 'ies'}`
                  : 'Reply'}
            </Text>
          </Pressable>
        </View>

        {expanded ? (
          <View style={styles.replyThread}>
            {loadingChildren ? (
              <View style={styles.replyLoading}>
                <ActivityIndicator color={palette.text3} size="small" />
              </View>
            ) : (
              children.map((child) => (
                <View key={child.comment_id} style={styles.replyRow}>
                  {renderAvatar(child.user, 28)}
                  <View style={styles.replyBody}>
                    <View
                      style={[
                        styles.replyBubble,
                        {
                          backgroundColor: palette.surface,
                          borderColor: palette.border,
                        },
                      ]}
                    >
                      <View style={styles.commentHead}>
                        <Text
                          numberOfLines={1}
                          style={[styles.replyAuthor, { color: palette.text }]}
                        >
                          {authorName(child.user)}
                        </Text>
                        {child.user.is_badged ? (
                          <CLIcon n="verified" size={11} color={palette.brand} />
                        ) : null}
                      </View>
                      {child.text ? (
                        <Text style={[styles.replyText, { color: palette.text }]}>
                          {child.text}
                        </Text>
                      ) : null}
                      {child.attachment ? (
                        <Image
                          source={{ uri: child.attachment }}
                          style={[
                            styles.replyAttachment,
                            { backgroundColor: palette.surface2 },
                          ]}
                          resizeMode="cover"
                        />
                      ) : null}
                    </View>
                    <Text style={[styles.commentMeta, { color: palette.text3 }]}>
                      @{child.user.username} · {timeSince(child.created_at)}
                    </Text>
                  </View>
                </View>
              ))
            )}
            {childNext ? (
              <Pressable
                onPress={onLoadMoreChildren}
                disabled={loadingMoreChildren}
                style={({ pressed }) => [
                  styles.loadMoreBtn,
                  { opacity: loadingMoreChildren ? 0.5 : pressed ? 0.6 : 1 },
                ]}
              >
                {loadingMoreChildren ? (
                  <ActivityIndicator color={palette.text3} size="small" />
                ) : (
                  <Text style={[styles.loadMoreText, { color: palette.text3 }]}>
                    Load more replies
                  </Text>
                )}
              </Pressable>
            ) : null}

            {authAvailable ? (
              <View style={styles.replyComposerWrap}>
                {replyAttachment ? (
                  <View style={styles.replyThumbWrap}>
                    <Image
                      source={{ uri: replyAttachment }}
                      style={[
                        styles.replyThumb,
                        { backgroundColor: palette.surface2 },
                      ]}
                    />
                    <Pressable
                      hitSlop={8}
                      onPress={() => setReplyAttachment(null)}
                      style={({ pressed }) => [
                        styles.replyThumbRemove,
                        { opacity: pressed ? 0.7 : 1 },
                      ]}
                    >
                      <CLIcon n="close" size={12} color="#fff" />
                    </Pressable>
                  </View>
                ) : null}
                <View
                  style={[
                    styles.replyComposer,
                    {
                      backgroundColor: palette.input,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  <Pressable
                    disabled={pickingReplyAttachment || sendingReply}
                    onPress={onPickReplyAttachment}
                    hitSlop={6}
                    style={({ pressed }) => [
                      styles.replyAttachBtn,
                      {
                        opacity:
                          pickingReplyAttachment || sendingReply
                            ? 0.5
                            : pressed
                              ? 0.6
                              : 1,
                      },
                    ]}
                  >
                    {pickingReplyAttachment ? (
                      <ActivityIndicator color={palette.text2} size="small" />
                    ) : (
                      <CLIcon n="image" size={18} color={palette.green} />
                    )}
                  </Pressable>
                  <TextInput
                    value={replyDraft}
                    onChangeText={setReplyDraft}
                    placeholder="Write a reply…"
                    placeholderTextColor={palette.text3}
                    multiline
                    style={[styles.replyComposerInput, { color: palette.text }]}
                  />
                  <Pressable
                    disabled={
                      (!replyDraft.trim() && !replyAttachment) || sendingReply
                    }
                    onPress={onSendReply}
                    style={({ pressed }) => [
                      styles.replySendBtn,
                      {
                        backgroundColor: palette.brand,
                        opacity:
                          (!replyDraft.trim() && !replyAttachment) ||
                          sendingReply
                            ? 0.5
                            : pressed
                              ? 0.8
                              : 1,
                      },
                    ]}
                  >
                    {sendingReply ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <CLIcon n="send" size={16} color="#fff" />
                    )}
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

// --------------------------------------------------------------------------
// Comments screen
// --------------------------------------------------------------------------

export default function Comments() {
  const { palette } = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { post_id, initialCount } = route.params as CommentsParams;
  const authentication = useSelector((s: AppState) => s.authentication);

  const [comments, setComments] = useState<PostComment[]>([]);
  const [count, setCount] = useState<number>(initialCount ?? 0);
  const [page, setPage] = useState(1);
  const [next, setNext] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<string | null>(null);
  const [pickingAttachment, setPickingAttachment] = useState(false);

  const onPickAttachment = useCallback(async () => {
    if (pickingAttachment || sending) return;
    setPickingAttachment(true);
    const picked = await pickImages({ selectionLimit: 1, mediaType: 'photo' });
    setPickingAttachment(false);
    if (picked.length === 0) return;
    setAttachment(picked[0].base);
  }, [pickingAttachment, sending]);

  const load = useCallback(
    async (p: number, append: boolean) => {
      const result = await GetCommentsRequest(post_id, null, p, RANGE);
      setComments((prev) => {
        const combined = append ? [...prev, ...result.results] : result.results;
        const seen = new Set<string>();
        return combined.filter((c) => {
          if (seen.has(c.comment_id)) return false;
          seen.add(c.comment_id);
          return true;
        });
      });
      setCount(result.count);
      setNext(result.next);
      setIsLoading(false);
      setLoadingMore(false);
    },
    [post_id],
  );

  useEffect(() => {
    load(1, false);
  }, [load]);

  const onEndReached = useCallback(() => {
    if (loadingMore || !next) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    load(nextPage, true);
  }, [load, loadingMore, next, page]);

  const onSend = useCallback(async () => {
    const text = draft.trim();
    if ((!text && !attachment) || sending) return;
    setSending(true);
    const saved = await SaveCommentRequest(post_id, null, text, attachment);
    setSending(false);
    if (saved) {
      setComments((prev) => {
        if (prev.some((c) => c.comment_id === saved.comment_id)) return prev;
        return [saved, ...prev];
      });
      setCount((c) => c + 1);
      setDraft('');
      setAttachment(null);
    }
  }, [attachment, draft, post_id, sending]);

  const renderItem = useCallback(
    ({ item }: { item: PostComment }) => (
      <CommentRow
        comment={item}
        post_id={post_id}
        authAvailable={authentication.auth === true}
      />
    ),
    [authentication.auth, post_id],
  );

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
        <Text style={[styles.headerTitle, { color: palette.text }]}>
          Comments
        </Text>
        <Text style={[styles.headerCount, { color: palette.text3 }]}>
          {count}
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.body}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={palette.brand} />
          </View>
        ) : (
          <FlatList
            data={comments}
            keyExtractor={(c) => c.comment_id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.4}
            ListEmptyComponent={
              <View style={styles.empty}>
                <CLIcon
                  n="chat-bubble-outline"
                  size={32}
                  color={palette.text3}
                />
                <Text style={[styles.emptyText, { color: palette.text3 }]}>
                  No comments yet
                </Text>
              </View>
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

        {authentication.auth ? (
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

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
  headerCount: {
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 8,
  },

  listContent: { padding: 14, gap: 12 },
  commentRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 14, fontWeight: '800' },
  commentBody: { flex: 1, gap: 4 },
  commentBubble: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  commentHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentAuthor: { fontSize: 13, fontWeight: '700' },
  commentText: { fontSize: 14, lineHeight: 19 },
  commentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingLeft: 2,
  },
  commentMeta: { fontSize: 11 },
  replyToggle: { fontSize: 11, fontWeight: '700' },

  replyThread: {
    marginTop: 6,
    gap: 8,
    paddingLeft: 6,
  },
  replyLoading: { paddingVertical: 8, alignItems: 'flex-start' },
  replyRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  replyBody: { flex: 1, gap: 3 },
  replyBubble: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
  },
  replyAuthor: { fontSize: 12, fontWeight: '700' },
  replyText: { fontSize: 13, lineHeight: 18 },

  loadMoreBtn: { paddingVertical: 6, alignItems: 'flex-start' },
  loadMoreText: { fontSize: 11.5, fontWeight: '700' },

  replyComposer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 4,
  },
  replyComposerInput: {
    flex: 1,
    minHeight: 28,
    maxHeight: 100,
    fontSize: 13,
    padding: 0,
    paddingTop: 4,
    paddingBottom: 4,
  },
  replySendBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },

  empty: { paddingTop: 60, alignItems: 'center', gap: 6 },
  emptyText: { fontSize: 13, fontWeight: '600' },
  footerLoading: { paddingVertical: 14, alignItems: 'center' },

  composerWrap: {
    borderTopWidth: 1,
  },
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

  commentAttachment: {
    width: '100%',
    aspectRatio: 1.6,
    borderRadius: radii.sm,
    marginTop: 2,
  },
  replyAttachment: {
    width: '100%',
    aspectRatio: 1.6,
    borderRadius: radii.sm,
    marginTop: 2,
  },

  replyComposerWrap: { gap: 6, marginTop: 4 },
  replyThumbWrap: {
    position: 'relative',
    width: 64,
    height: 64,
    alignSelf: 'flex-start',
  },
  replyThumb: {
    width: '100%',
    height: '100%',
    borderRadius: radii.sm,
  },
  replyThumbRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyAttachBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
