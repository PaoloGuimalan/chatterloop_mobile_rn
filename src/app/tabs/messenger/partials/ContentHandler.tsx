/* ContentHandler — native port of
 * webapp/src/app/tabs/messenger/partials/ContentHandler.tsx.
 *
 * Renders a single conversation bubble. Webapp branches on six message
 * shapes (deleted, text, image, video, audio, notif, file/other) and
 * wraps each with the same surrounding concerns:
 *
 *   - "replied to your message" / "{name}'s message" label
 *   - sender name above the bubble in group/server chats (when not own)
 *   - reply-to preview row
 *   - the bubble / media itself
 *   - reactions pill row below
 *   - "Seen by" / "Seen" row on the newest message
 *
 * Mobile parity notes — features whose UI/data layer haven't shipped
 * yet on native are skipped here with TODO markers rather than faked:
 *
 *   - MessageOptions hover dropdown (reply / delete / copy / forward)
 *   - EmojiPickerHandler + ReactionsModal for adding/inspecting
 *     reactions. Display of existing reactions IS shown — just no
 *     add/remove affordance.
 *   - ReplyingToPreview component. We render the metadata label
 *     ("replied to your message") but not the quoted bubble preview.
 *   - urlify + mention highlighting. Plain Text for v1.
 *
 * The component is a pure renderer — Conversation.tsx still owns
 * viewport tracking (seen-on-view), the directory lookup, and theme. */

import React, { useMemo } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTheme } from '../../../../reusables/design/ThemeProvider';
import { CLIcon } from '../../../../reusables/design/primitives';
import { radii } from '../../../../reusables/design/tokens';
import type { DisplayMessage } from '../Conversation';

interface Props {
  cnvs: DisplayMessage;
  /** Index in the (inverted) FlatList — webapp uses `i === 0` to
   *  trigger the seen-by row, which means "newest visible message".
   *  Same semantics on native. */
  i: number;
  conversationType: 'single' | 'group' | 'server';
  /** Current authenticated user's ID. */
  me: string;
  /** Resolves a userID to a display first-name. Falls back to
   *  "Someone" inside the resolver when there's no match. */
  memberName: (userID: string) => string;
  /** Tap handler for any media bubble (image/video/audio/file).
   *  Conversation.tsx wires this to Linking.openURL. */
  onOpenMedia: (uri?: string) => void;
}

function ContentHandler({
  cnvs,
  i,
  conversationType,
  me,
  memberName,
  onOpenMedia,
}: Props) {
  const { palette } = useTheme();

  // ---- shared bits used by every branch ------------------------------------

  const isOwn = cnvs.sender === me;
  const showSenderLabel =
    !isOwn && (conversationType === 'group' || conversationType === 'server');

  const showSeenBy = useMemo(() => {
    if (i !== 0) return false;
    return (
      cnvs.seeners.filter(s => s !== cnvs.sender && s !== me).length > 0
    );
  }, [cnvs.seeners, cnvs.sender, i, me]);

  const seenByNames = useMemo(() => {
    return cnvs.seeners
      .filter(s => s !== cnvs.sender && s !== me)
      .map(s => memberName(s));
  }, [cnvs.seeners, cnvs.sender, me, memberName]);

  const replyLabel = useMemo(() => {
    if (!cnvs.isReply) return null;
    const replied = cnvs.replyedmessage?.[0];
    if (!replied) return 'replied to a message';
    return replied.sender === me
      ? 'replied to your message'
      : `replied to ${memberName(replied.sender)}`;
  }, [cnvs.isReply, cnvs.replyedmessage, me, memberName]);

  const reactionsBucket = useMemo(() => {
    const list = cnvs.reactions ?? [];
    if (list.length === 0) return null;
    // Webapp shows raw emojis inline (no aggregation by emoji); we do
    // the same so a re-sync from the server is order-preserving.
    return list;
  }, [cnvs.reactions]);

  // ---- 1) Notif — full-width centered system message -----------------------

  if (cnvs.messageType === 'notif') {
    return (
      <View style={styles.notifRow}>
        <Text style={[styles.notifText, { color: palette.text3 }]}>
          {cnvs.content}
        </Text>
      </View>
    );
  }

  // ---- shared bubble shell -------------------------------------------------

  const ownAlign = isOwn ? styles.rowOwn : styles.rowOther;

  // ---- 2) Deleted — dashed tombstone bubble --------------------------------

  if (cnvs.isDeleted) {
    return (
      <View style={[styles.row, ownAlign]}>
        {replyLabel ? (
          <Text style={[styles.replyLabel, { color: palette.text3 }]}>
            {replyLabel}
          </Text>
        ) : null}
        {showSenderLabel ? (
          <Text style={[styles.senderLabel, { color: palette.text3 }]}>
            {memberName(cnvs.sender)}
          </Text>
        ) : null}
        <View
          style={[
            styles.bubble,
            styles.deletedBubble,
            { borderColor: palette.border2 },
          ]}
        >
          <Text style={[styles.deletedText, { color: palette.text3 }]}>
            Message deleted
          </Text>
          <Text style={[styles.timeText, { color: palette.text3 }]}>
            {cnvs.timeLabel}
          </Text>
        </View>
        {showSeenBy ? (
          <SeenRow
            isOwn={isOwn}
            conversationType={conversationType}
            names={seenByNames}
            palette={palette}
          />
        ) : null}
      </View>
    );
  }

  // ---- 3) Bubble body picked per messageType -------------------------------

  let body: React.ReactNode;
  let bubbleVariant: 'text' | 'image' | 'mediacard' = 'text';

  if (cnvs.messageType === 'text') {
    bubbleVariant = 'text';
    body = (
      <Text
        style={[
          styles.bubbleText,
          {
            color: isOwn ? '#fff' : palette.text,
            opacity: cnvs.pending ? 0.7 : 1,
          },
        ]}
      >
        {cnvs.content}
      </Text>
    );
  } else if (cnvs.mediaKind === 'image' && cnvs.imageURI) {
    bubbleVariant = 'image';
    body = (
      <Pressable
        onPress={() => onOpenMedia(cnvs.imageURI)}
        style={({ pressed }) => [
          styles.imageBubble,
          {
            backgroundColor: palette.surface2,
            opacity: cnvs.pending ? 0.7 : pressed ? 0.85 : 1,
          },
        ]}
      >
        <Image
          source={{ uri: cnvs.imageURI }}
          style={styles.imageBubbleImg}
          resizeMode="cover"
        />
      </Pressable>
    );
  } else if (
    (cnvs.mediaKind === 'video' ||
      cnvs.mediaKind === 'audio' ||
      cnvs.mediaKind === 'file') &&
    cnvs.mediaURI
  ) {
    bubbleVariant = 'mediacard';
    const icon =
      cnvs.mediaKind === 'video'
        ? 'movie'
        : cnvs.mediaKind === 'audio'
        ? 'audiotrack'
        : 'insert-drive-file';
    const actionLabel =
      cnvs.mediaKind === 'video'
        ? 'Tap to play'
        : cnvs.mediaKind === 'audio'
        ? 'Tap to listen'
        : 'Tap to open';
    body = (
      <Pressable
        onPress={() => onOpenMedia(cnvs.mediaURI)}
        disabled={cnvs.pending}
        style={({ pressed }) => [
          styles.mediaCard,
          isOwn
            ? { backgroundColor: palette.brand }
            : {
                backgroundColor: palette.surface,
                borderColor: palette.border,
                borderWidth: 1,
              },
          {
            opacity: cnvs.pending ? 0.7 : pressed ? 0.85 : 1,
          },
        ]}
      >
        <View
          style={[
            styles.mediaIconWrap,
            {
              backgroundColor: isOwn
                ? 'rgba(255,255,255,0.18)'
                : palette.surface2,
            },
          ]}
        >
          <CLIcon
            n={icon}
            size={20}
            color={isOwn ? '#fff' : palette.text2}
          />
        </View>
        <View style={styles.mediaCopy}>
          <Text
            numberOfLines={1}
            style={[
              styles.mediaName,
              { color: isOwn ? '#fff' : palette.text },
            ]}
          >
            {cnvs.fileName ?? 'Attachment'}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              styles.mediaHint,
              {
                color: isOwn ? 'rgba(255,255,255,0.75)' : palette.text3,
              },
            ]}
          >
            {actionLabel}
          </Text>
        </View>
        <CLIcon
          n="open-in-new"
          size={14}
          color={isOwn ? 'rgba(255,255,255,0.85)' : palette.text3}
        />
      </Pressable>
    );
  } else {
    // Unknown / falling through — render as a text bubble that surfaces
    // the raw messageType so debug regressions don't go silent.
    bubbleVariant = 'text';
    body = (
      <Text
        style={[
          styles.bubbleText,
          {
            color: isOwn ? '#fff' : palette.text,
            opacity: cnvs.pending ? 0.7 : 1,
          },
        ]}
      >
        Sent {cnvs.messageType}
      </Text>
    );
  }

  const bubbleWrapStyle =
    bubbleVariant === 'text'
      ? [
          styles.bubble,
          isOwn
            ? { backgroundColor: palette.brand }
            : {
                backgroundColor: palette.surface,
                borderColor: palette.border,
                borderWidth: 1,
              },
        ]
      : null;

  return (
    <View style={[styles.row, ownAlign]}>
      {replyLabel ? (
        <Text style={[styles.replyLabel, { color: palette.text3 }]}>
          {replyLabel}
        </Text>
      ) : null}
      {showSenderLabel ? (
        <Text style={[styles.senderLabel, { color: palette.text3 }]}>
          {memberName(cnvs.sender)}
        </Text>
      ) : null}
      {/* TODO(reply-preview): port ReplyingToPreview once the reply
          flow has a composer on mobile. */}
      {bubbleWrapStyle ? <View style={bubbleWrapStyle}>{body}</View> : body}
      <View style={styles.metaRow}>
        <Text style={[styles.timeText, { color: palette.text3 }]}>
          {cnvs.pending ? 'Sending…' : cnvs.timeLabel}
        </Text>
        {reactionsBucket ? (
          <View
            style={[
              styles.reactionPill,
              {
                backgroundColor: palette.surface2,
                borderColor: palette.border,
              },
            ]}
          >
            {/* TODO(reactions): wire EmojiPickerHandler + ReactionsModal
                once the message-reaction endpoint is ported. Display
                ships now; add/remove comes with the wiring. */}
            <Text style={[styles.reactionText, { color: palette.text }]}>
              {reactionsBucket
                .slice(0, 4)
                .map(r => r.emoji)
                .join('')}
            </Text>
            {reactionsBucket.length > 4 ? (
              <Text style={[styles.reactionOverflow, { color: palette.text3 }]}>
                +{reactionsBucket.length - 4}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
      {showSeenBy ? (
        <SeenRow
          isOwn={isOwn}
          conversationType={conversationType}
          names={seenByNames}
          palette={palette}
        />
      ) : null}
    </View>
  );
}

// ---- subcomponents ---------------------------------------------------------

function SeenRow({
  isOwn,
  conversationType,
  names,
  palette,
}: {
  isOwn: boolean;
  conversationType: 'single' | 'group' | 'server';
  names: string[];
  palette: ReturnType<typeof useTheme>['palette'];
}) {
  const justify = isOwn ? 'flex-end' : 'flex-start';
  // Direct messages just say "Seen"; group/server enumerate the names.
  if (conversationType === 'single') {
    return (
      <View style={[styles.seenRow, { justifyContent: justify }]}>
        <Text style={[styles.seenText, { color: palette.text3 }]}>Seen</Text>
      </View>
    );
  }
  return (
    <View style={[styles.seenRow, { justifyContent: justify }]}>
      <Text style={[styles.seenText, { color: palette.text3 }]}>Seen by </Text>
      {names.map((n, idx) => (
        <Text
          key={`${n}-${idx}`}
          style={[styles.seenText, { color: palette.text3 }]}
        >
          {n}
          {idx < names.length - 1 ? ', ' : ''}
        </Text>
      ))}
    </View>
  );
}

// ---- styles ---------------------------------------------------------------

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 4,
    maxWidth: '78%',
  },
  rowOwn: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  rowOther: { alignSelf: 'flex-start', alignItems: 'flex-start' },

  bubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.md,
  },
  bubbleText: { fontSize: 14, lineHeight: 19 },

  deletedBubble: {
    borderWidth: 1,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
    gap: 3,
  },
  deletedText: { fontSize: 13, fontStyle: 'italic' },

  imageBubble: {
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  imageBubbleImg: { width: 220, height: 220 },

  mediaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  mediaIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaCopy: { flex: 1, gap: 2 },
  mediaName: { fontSize: 13.5, fontWeight: '700' },
  mediaHint: { fontSize: 11.5, fontWeight: '600' },

  replyLabel: { fontSize: 11, fontStyle: 'italic' },
  senderLabel: { fontSize: 11, fontWeight: '600', marginLeft: 4 },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  timeText: { fontSize: 10.5 },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderRadius: radii.pill,
  },
  reactionText: { fontSize: 12 },
  reactionOverflow: { fontSize: 10, fontWeight: '700' },

  notifRow: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  notifText: {
    fontSize: 11.5,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: 20,
  },

  seenRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 4,
    marginTop: 2,
  },
  seenText: { fontSize: 10 },
});

export default ContentHandler;
