/* Comments screen — scoped port of
 * webapp/src/app/widgets/items/PostComment.tsx.
 *
 * Scrollable thread of top-level comments for a single post + sticky
 * composer at the bottom. Each row's reply thread + attachment UI is
 * encapsulated in CommentRow (shared with PostDetail). */

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
import {
  GetCommentsRequest,
  PostComment,
  SaveCommentRequest,
} from '../../../reusables/hooks/requests';
import { pickImages } from '../../../reusables/hooks/imagePicker';
import { CommentRow } from './CommentRow';

interface CommentsParams {
  post_id: string;
  /** Optional initial count so we can show it in the header
   *  before the first page lands. */
  initialCount?: number;
}

const RANGE = 20;

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
});
