/* useFeedReactions — shared reaction handling for any list of FeedPost.
 *
 * Originally lived inline in Feed.tsx. PageDetail (and any future post
 * list — Profile grid, saved posts, etc.) need the same optimistic
 * toggle + emoji-popover semantics, so the logic is extracted here.
 *
 * Caller owns the `posts` state; this hook only writes back through
 * the provided setter. Pair with the <ReactionPopover/> component to
 * render the long-press emoji menu. */

import { useCallback, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';

import type { AppState } from '../../redux/store';
import {
  EmojiInfo,
  FeedPost,
  ReactionSaveRequest,
} from './requests';

interface ReactionHooks {
  /** First emoji in priority order; default for plain heart taps. */
  defaultEmojiId: number | null;
  /** Sorted emoji catalog, ready to render in a popover row. */
  sortedEmojis: EmojiInfo[];
  /** Currently-active popover target post_id, or null if hidden. */
  popoverPostId: string | null;
  setPopoverPostId: (id: string | null) => void;
  /** Tap the heart on a post card. Toggles user_reaction with the
   *  default emoji (or clears it if it matches the existing reaction). */
  onTapReaction: (post: FeedPost) => void;
  /** Long-press handler — opens the popover for this post. */
  onLongPressReaction: (post: FeedPost) => void;
  /** Called from the popover when the user picks an emoji. */
  onPickFromPopover: (emojiId: number) => void;
}

export function useFeedReactions(
  posts: FeedPost[],
  setPosts: React.Dispatch<React.SetStateAction<FeedPost[]>>,
): ReactionHooks {
  const emojilist = useSelector(
    (s: AppState) => s.emojilist as EmojiInfo[],
  );

  const sortedEmojis = useMemo(
    () => [...emojilist].sort((a, b) => a.priority - b.priority),
    [emojilist],
  );
  const defaultEmojiId = sortedEmojis[0]?.emoji_id ?? null;

  const [popoverPostId, setPopoverPostId] = useState<string | null>(null);

  const applyReaction = useCallback(
    async (postId: string, targetEmojiId: number | null) => {
      const prevPosts = posts;
      const idx = posts.findIndex((p) => p.post_id === postId);
      if (idx < 0) return;
      const current = posts[idx];
      const currentEmoji = current.user_reaction
        ? Number(current.user_reaction)
        : null;

      let method: 'POST' | 'PUT' | 'DELETE';
      let nextEmoji: number | null;
      if (targetEmojiId === null) {
        if (currentEmoji === null) return;
        method = 'DELETE';
        nextEmoji = null;
      } else if (currentEmoji === null) {
        method = 'POST';
        nextEmoji = targetEmojiId;
      } else if (currentEmoji === targetEmojiId) {
        method = 'DELETE';
        nextEmoji = null;
      } else {
        method = 'PUT';
        nextEmoji = targetEmojiId;
      }

      setPosts((arr) =>
        arr.map((p, i) => {
          if (i !== idx) return p;
          const delta =
            method === 'POST' ? 1 : method === 'DELETE' ? -1 : 0;
          const nextCounts =
            delta === 0
              ? p.activity_counts
              : (p.activity_counts ?? []).map((c) =>
                  c.count_type === 'like'
                    ? { ...c, count: Math.max(0, c.count + delta) }
                    : c,
                );
          const hasLike = (p.activity_counts ?? []).some(
            (c) => c.count_type === 'like',
          );
          const seededCounts =
            method === 'POST' && !hasLike
              ? [
                  ...(p.activity_counts ?? []),
                  { count_type: 'like', count: 1 },
                ]
              : nextCounts;
          return {
            ...p,
            user_reaction: nextEmoji,
            activity_counts: seededCounts,
          };
        }),
      );

      const emojiForRequest =
        method === 'DELETE'
          ? (currentEmoji ?? targetEmojiId ?? 0)
          : (targetEmojiId ?? 0);
      const ok = await ReactionSaveRequest({
        post_id: postId,
        emoji_id: emojiForRequest,
        method,
      });
      if (!ok) {
        setPosts(prevPosts);
      }
    },
    [posts, setPosts],
  );

  const onTapReaction = useCallback(
    (post: FeedPost) => {
      const currentEmoji = post.user_reaction
        ? Number(post.user_reaction)
        : null;
      if (currentEmoji === null && defaultEmojiId === null) return;
      applyReaction(post.post_id, currentEmoji ?? defaultEmojiId);
    },
    [applyReaction, defaultEmojiId],
  );

  const onLongPressReaction = useCallback((post: FeedPost) => {
    setPopoverPostId(post.post_id);
  }, []);

  const onPickFromPopover = useCallback(
    (emojiId: number) => {
      if (!popoverPostId) return;
      applyReaction(popoverPostId, emojiId);
      setPopoverPostId(null);
    },
    [applyReaction, popoverPostId],
  );

  return {
    defaultEmojiId,
    sortedEmojis,
    popoverPostId,
    setPopoverPostId,
    onTapReaction,
    onLongPressReaction,
    onPickFromPopover,
  };
}
