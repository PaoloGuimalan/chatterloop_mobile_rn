/* Feed tab — ports webapp/src/app/tabs/feed/Feed.tsx.
 *
 * Scope of this port:
 *   - Compose card (avatar + tap-to-open NewPostModal + Photo + Post)
 *   - FlatList of simplified post cards (author + caption + first media +
 *     reaction/comment counts)
 *   - Tap heart to toggle reaction with the highest-priority emoji;
 *     long-press to open an emoji picker popover
 *   - Empty state ("you're all caught up")
 *   - Pull-to-refresh
 *
 * Out of scope (TODOs):
 *   - Lazy pagination — webapp uses IntersectionObserver; replace with
 *     onEndReached + per-screen GetFeedRequest call when needed.
 *   - Comment screens (the comment count is read-only here).
 *   - The web "feature card" empty banners (Diary / Map / Extension).
 *   - View-cache telemetry — webapp uses IndexedDB; not ported. */

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSelector } from "react-redux";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";

import type { AppState } from "../../../redux/store";
import { useTheme } from "../../../reusables/design/ThemeProvider";
import { Btn, CLIcon } from "../../../reusables/design/primitives";
import { ReactionPopover } from "../../../reusables/design/ReactionPopover";
import { radii } from "../../../reusables/design/tokens";
import { timeSince } from "../../../reusables/hooks/reusable";
import {
  FeedPost,
  GetFeedRequest,
} from "../../../reusables/hooks/requests";
import { useFeedReactions } from "../../../reusables/hooks/useFeedReactions";

const RANGE = 20;

function countByType(
  counts: { count_type: string; count: number }[] | undefined,
  type: string,
): number {
  if (!counts) return 0;
  const entry = counts.find((c) => c.count_type === type);
  return entry?.count ?? 0;
}

function firstImageURI(post: FeedPost): string | undefined {
  const ref = post.references?.find((r) =>
    (r.reference_media_type ?? "").includes("image"),
  );
  return ref?.reference;
}

function authorName(author: FeedPost["user"]): string {
  const middle =
    author.middle_name && author.middle_name !== "N/A"
      ? ` ${author.middle_name}`
      : "";
  return `${author.first_name}${middle} ${author.last_name}`.trim();
}

export default function Feed() {
  const { palette } = useTheme();
  const navigation = useNavigation<any>();
  const authentication = useSelector((s: AppState) => s.authentication);

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const {
    sortedEmojis,
    popoverPostId,
    setPopoverPostId,
    onTapReaction,
    onLongPressReaction,
    onPickFromPopover,
  } = useFeedReactions(posts, setPosts);

  const load = useCallback(
    async (silent: boolean) => {
      if (!authentication.user.userID) return;
      if (!silent) setIsLoading(true);
      const response = await GetFeedRequest({
        current_user_id: authentication.user.userID,
        page: 1,
        range: RANGE,
      });
      setPosts(response.results ?? []);
      setIsLoading(false);
      setRefreshing(false);
    },
    [authentication.user.userID],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  const openComposer = useCallback(() => {
    navigation.navigate("NewPost", {
      // After a successful post the modal calls this and pops — silent
      // refresh so the new post lands at the top without a spinner flash.
      onPosted: () => load(true),
    });
  }, [load, navigation]);

  const renderItem = useCallback(
    ({ item }: { item: FeedPost }) => {
      const name = authorName(item.user);
      const hasProfile = item.user.profile && item.user.profile !== "none";
      const imageURI = firstImageURI(item);
      const likes = countByType(item.activity_counts, "like");
      const comments = countByType(item.activity_counts, "comment");

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
                <Text style={{ color: palette.brand, fontWeight: "700" }}>
                  {item.user.first_name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.postHeaderText}>
              <View style={styles.nameRow}>
                <Text
                  numberOfLines={1}
                  style={[styles.postAuthor, { color: palette.text }]}
                >
                  {name}
                </Text>
                {item.user.is_badged ? (
                  <CLIcon n="verified" size={14} color={palette.brand} />
                ) : null}
              </View>
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
                styles.postActionGroup,
                styles.postActionPressable,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <CLIcon
                n={item.user_reaction ? "favorite" : "favorite-border"}
                size={20}
                color={item.user_reaction ? palette.pink : palette.text2}
              />
              <Text style={[styles.postActionLabel, { color: palette.text2 }]}>
                {likes}
              </Text>
            </Pressable>
            <Pressable
              onPress={() =>
                navigation.navigate('Comments', {
                  post_id: item.post_id,
                  initialCount: comments,
                })
              }
              hitSlop={8}
              style={({ pressed }) => [
                styles.postActionGroup,
                styles.postActionPressable,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <CLIcon
                n="chat-bubble-outline"
                size={18}
                color={palette.text2}
              />
              <Text style={[styles.postActionLabel, { color: palette.text2 }]}>
                {comments}
              </Text>
            </Pressable>
            <View style={[styles.postActionGroup, { marginLeft: "auto" }]}>
              <CLIcon n="share" size={18} color={palette.text2} />
            </View>
          </View>
        </View>
      );
    },
    [navigation, onLongPressReaction, onTapReaction, palette],
  );

  const me = authentication.user;
  const meHasProfile = me?.profile && me.profile !== "none";
  const meInitial = me?.fullName?.firstName?.charAt(0)?.toUpperCase() ?? "?";

  const ListHeader = (
    <View
      style={[
        styles.composeCard,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      <View style={styles.composeRow}>
        {meHasProfile ? (
          <Image source={{ uri: me.profile }} style={styles.composeAvatar} />
        ) : (
          <View
            style={[
              styles.composeAvatar,
              styles.avatarFallback,
              { backgroundColor: palette.brandSoft },
            ]}
          >
            <Text style={{ color: palette.brand, fontWeight: "700" }}>
              {meInitial}
            </Text>
          </View>
        )}
        <Pressable
          onPress={openComposer}
          style={({ pressed }) => [
            styles.composeInput,
            {
              backgroundColor: palette.input,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text style={[styles.composePlaceholder, { color: palette.text3 }]}>
            Share something with your loop…
          </Text>
        </Pressable>
      </View>
      <View style={[styles.composeFooter, { borderTopColor: palette.border }]}>
        <Pressable
          onPress={openComposer}
          style={({ pressed }) => [
            styles.composeIconBtn,
            { opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <CLIcon n="image" size={20} color={palette.green} />
          <Text style={[styles.composeIconLabel, { color: palette.text2 }]}>
            Photo
          </Text>
        </Pressable>
        <Btn size="sm" label="Post" onPress={openComposer} />
      </View>
    </View>
  );

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.screen, { backgroundColor: palette.bg }]}
    >
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
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View
                style={[
                  styles.emptyCard,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                  },
                ]}
              >
                <Text style={[styles.emptyHeadline, { color: palette.text }]}>
                  You're all caught up!
                </Text>
                <Text style={[styles.emptyAccent, { color: palette.brand }]}>
                  Link · Share · Explore
                </Text>
                <Text style={[styles.emptyBody, { color: palette.text2 }]}>
                  A new way of connection. A more visible and interactable way
                  of social media.
                </Text>
              </View>
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
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { padding: 12, gap: 8 },

  composeCard: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 12,
    gap: 10,
  },
  composeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  composeAvatar: { width: 42, height: 42, borderRadius: radii.pill },
  composeInput: {
    flex: 1,
    height: 42,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    justifyContent: "center",
  },
  composePlaceholder: { fontSize: 14 },
  composeFooter: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 6,
  },
  composeIconBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: radii.sm,
  },
  composeIconLabel: { fontSize: 13, fontWeight: "600" },

  postCard: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 12,
    gap: 10,
  },
  postHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  postAvatar: { width: 42, height: 42, borderRadius: radii.pill },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  postHeaderText: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  postAuthor: { fontSize: 14, fontWeight: "700", flexShrink: 1 },
  postMeta: { fontSize: 11.5, marginTop: 1 },
  postCaption: { fontSize: 14, lineHeight: 20 },
  postMedia: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: radii.sm,
  },
  postActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  postActionGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  postActionPressable: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginHorizontal: -4,
  },
  postActionLabel: { fontSize: 12.5, fontWeight: "600" },

  empty: { paddingTop: 8 },
  emptyCard: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 20,
    alignItems: "center",
    gap: 6,
  },
  emptyHeadline: { fontSize: 18, fontWeight: "800" },
  emptyAccent: { fontSize: 12.5, fontWeight: "700", letterSpacing: 0.4 },
  emptyBody: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginTop: 4,
  },
});
