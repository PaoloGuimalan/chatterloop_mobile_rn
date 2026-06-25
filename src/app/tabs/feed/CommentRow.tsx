/* CommentRow — a single comment with its reply thread.
 *
 * Originally lived inline in Comments.tsx; extracted so PostDetail
 * can render the same row layout. Owns its own reply-thread state
 * (children list, pagination, composer) so the parent screen doesn't
 * have to track per-row state. */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { useTheme } from '../../../reusables/design/ThemeProvider';
import { CLIcon } from '../../../reusables/design/primitives';
import { radii } from '../../../reusables/design/tokens';
import { timeSince } from '../../../reusables/hooks/reusable';
import {
  GetCommentsRequest,
  PostComment,
  SaveCommentRequest,
} from '../../../reusables/hooks/requests';
import { pickImages } from '../../../reusables/hooks/imagePicker';

const RANGE = 20;

function authorName(u: PostComment['user']): string {
  const middle =
    u.middle_name && u.middle_name !== 'N/A' ? ` ${u.middle_name}` : '';
  return `${u.first_name}${middle} ${u.last_name}`.trim();
}

export function CommentRow({
  comment,
  post_id,
  authAvailable,
}: {
  comment: PostComment;
  post_id: string;
  authAvailable: boolean;
}) {
  const { palette } = useTheme();
  const navigation = useNavigation<any>();
  const openProfile = useCallback(
    (username?: string) => {
      // Guard against an empty handle so we never push a dead profile.
      if (!username) return;
      navigation.navigate('UserProfile', { userID: username });
    },
    [navigation],
  );
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
      <Pressable onPress={() => openProfile(comment.user.username)}>
        {renderAvatar(comment.user, 36)}
      </Pressable>
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
              onPress={() => openProfile(comment.user.username)}
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
                  <Pressable onPress={() => openProfile(child.user.username)}>
                    {renderAvatar(child.user, 28)}
                  </Pressable>
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
                          onPress={() => openProfile(child.user.username)}
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

const styles = StyleSheet.create({
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
  replyAttachBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
