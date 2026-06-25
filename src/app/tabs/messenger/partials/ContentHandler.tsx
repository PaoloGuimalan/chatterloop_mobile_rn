/* eslint-disable react-native/no-inline-styles */
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
 *   - MessageOptions has been replaced by MessageActionsSheet — an
 *     Instagram-style floating menu shown via Conversation.tsx when
 *     `onLongPressMessage` fires.
 *   - ReplyingToPreview ships as RepliedPreview below — a stacked
 *     mini-bubble above the reply showing the quoted sender + snippet,
 *     matching the Messenger pattern.
 *   - Full emoji picker (webapp uses emoji-picker-react). The
 *     MessageActionsSheet ships 6 quick reactions wired to
 *     ReactToMessageRequest; a long-tail picker for arbitrary emoji
 *     can land later if needed.
 *   - ReactionsModal listing who reacted with what — display of the
 *     reaction pill is implemented; tap-to-inspect comes next cycle.
 *   - urlify + mention highlighting. Plain Text for v1.
 *
 * The component is a pure renderer — Conversation.tsx still owns
 * viewport tracking (seen-on-view), the directory lookup, and theme. */

import React, { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../../../reusables/design/ThemeProvider';
import { CLIcon } from '../../../../reusables/design/primitives';
import { radii } from '../../../../reusables/design/tokens';
import type { DisplayMessage } from '../Conversation';
import ReactionsModal from '../ReactionsModal';

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
  /** Tap on an image bubble — opens the in-app lightbox. Non-image
   *  media (video / audio / file) still hands off to the device via
   *  the onOpenMedia path. */
  onOpenImage: (uri: string) => void;
  /** Tap on a video / audio / file bubble. Conversation.tsx wires this
   *  to Linking.openURL until we install react-native-video for
   *  in-app playback. */
  onOpenMedia: (uri?: string) => void;
  /** Long-press a bubble → open the floating action sheet. Conversation
   *  owns the sheet state so it can render the modal at the screen root. */
  onLongPressMessage: (cnvs: DisplayMessage) => void;
}

function ContentHandler({
  cnvs,
  i,
  conversationType,
  me,
  memberName,
  onOpenImage,
  onOpenMedia,
  onLongPressMessage,
}: Props) {
  const { palette } = useTheme();
  const [reactionsOpen, setReactionsOpen] = useState(false);

  // Long-press → floating action sheet. Notif and pending bubbles
  // intentionally have no actions — they can't be replied to or
  // deleted before they hit the server. Deleted tombstones also
  // shouldn't be re-acted on.
  const isOwn = cnvs.sender === me;
  const onLongPress = useCallback(() => {
    if (cnvs.messageType === 'notif' || cnvs.pending || cnvs.isDeleted) return;
    onLongPressMessage(cnvs);
  }, [cnvs, onLongPressMessage]);

  // ---- shared bits used by every branch ------------------------------------

  const showSenderLabel =
    !isOwn && (conversationType === 'group' || conversationType === 'server');

  const showSeenBy = useMemo(() => {
    if (i !== 0) return false;
    return cnvs.seeners.filter(s => s !== cnvs.sender && s !== me).length > 0;
  }, [cnvs.seeners, cnvs.sender, i, me]);

  const seenByNames = useMemo(() => {
    return cnvs.seeners
      .filter(s => s !== cnvs.sender && s !== me)
      .map(s => memberName(s));
  }, [cnvs.seeners, cnvs.sender, me, memberName]);

  const repliedTo = useMemo(() => {
    if (!cnvs.isReply) return null;
    return cnvs.replyedmessage?.[0] ?? null;
  }, [cnvs.isReply, cnvs.replyedmessage]);

  // Tint the quoted preview by the QUOTED author — replying to your
  // own message paints brand; replying to someone else's stays neutral
  // surface. Same idea Messenger uses to keep author identity visible
  // at a glance even on the smaller quoted card.
  const repliedToIsOwn = repliedTo?.sender === me;

  const replyLabel = useMemo(() => {
    if (!repliedTo) return null;
    return repliedToIsOwn
      ? 'replied to your message'
      : `replied to ${memberName(repliedTo.sender)}`;
  }, [memberName, repliedTo, repliedToIsOwn]);

  // Classify the quoted message so RepliedPreview can render a real
  // thumbnail / icon row instead of just a "Photo"/"Video" placeholder.
  // Media URLs come on the `content` field of the replyedmessage entry
  // (matches webapp's CachedImage src={cnvs.content} pattern). The
  // server may pack a filename suffix after "%%%" on file uploads to
  // GCS — strip that before using as an Image source.
  const repliedMedia = useMemo<{
    kind: 'text' | 'image' | 'video' | 'audio' | 'file' | 'deleted';
    snippet: string;
    uri?: string;
    fileName?: string;
  } | null>(() => {
    if (!repliedTo) return null;
    // Deleted wins over kind classification — even if the backend
    // still ships the old content / messageType, we shouldn't render
    // the stale media. Show the tombstone state instead.
    if (repliedTo.isDeleted) {
      return { kind: 'deleted', snippet: 'Original message deleted' };
    }
    const t = (repliedTo.messageType ?? '').toLowerCase();
    const raw = repliedTo.content ?? '';
    if (t === 'text' || t === 'notif' || t === '') {
      return { kind: 'text', snippet: raw };
    }
    // Split storage URLs like ".../file?token###...%%%filename.ext"
    // into the bare URL + the trailing filename the server appended.
    const [rawUri, filenameSuffix] = raw.split('%%%');
    const uri = rawUri?.replace('###', '%23%23%23') || undefined;
    const fileName =
      filenameSuffix ||
      (uri ? uri.split('?')[0].split('/').pop() || undefined : undefined);
    if (t.includes('image')) {
      return { kind: 'image', snippet: 'Photo', uri, fileName };
    }
    if (t.includes('video')) {
      return { kind: 'video', snippet: 'Video', uri, fileName };
    }
    if (t.includes('audio')) {
      return { kind: 'audio', snippet: 'Audio', uri, fileName };
    }
    return {
      kind: 'file',
      snippet: fileName ?? 'Attachment',
      uri,
      fileName,
    };
  }, [repliedTo]);

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
        {repliedTo ? (
          <RepliedPreview
            label={replyLabel}
            media={repliedMedia}
            isOwn={isOwn}
            repliedToIsOwn={repliedToIsOwn}
            palette={palette}
          />
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
    const imageUri = cnvs.imageURI;
    body = (
      <Pressable
        onPress={() => onOpenImage(imageUri)}
        onLongPress={onLongPress}
        delayLongPress={350}
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
        onLongPress={onLongPress}
        delayLongPress={350}
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
          <CLIcon n={icon} size={20} color={isOwn ? '#fff' : palette.text2} />
        </View>
        <View style={styles.mediaCopy}>
          <Text
            numberOfLines={1}
            style={[styles.mediaName, { color: isOwn ? '#fff' : palette.text }]}
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
      {repliedTo ? (
        <RepliedPreview
          label={replyLabel}
          media={repliedMedia}
          isOwn={isOwn}
          repliedToIsOwn={repliedToIsOwn}
          palette={palette}
        />
      ) : null}
      {showSenderLabel ? (
        <Text style={[styles.senderLabel, { color: palette.text3 }]}>
          {memberName(cnvs.sender)}
        </Text>
      ) : null}
      {bubbleWrapStyle ? (
        <Pressable
          onLongPress={onLongPress}
          delayLongPress={350}
          style={({ pressed }) => [
            ...bubbleWrapStyle,
            { opacity: cnvs.pending ? 0.7 : pressed ? 0.92 : 1 },
          ]}
        >
          {body}
        </Pressable>
      ) : (
        body
      )}
      <View style={styles.metaRow}>
        <Text style={[styles.timeText, { color: palette.text3 }]}>
          {cnvs.pending ? 'Sending…' : cnvs.timeLabel}
        </Text>
        {reactionsBucket ? (
          <Pressable
            onPress={() => setReactionsOpen(true)}
            style={({ pressed }) => [
              styles.reactionPill,
              {
                backgroundColor: palette.surface2,
                borderColor: palette.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            {/* Tap to inspect who reacted with what. Add/remove is driven
                from the long-press action sheet's quick-reactions row. */}
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
          </Pressable>
        ) : null}
      </View>

      {reactionsBucket ? (
        <ReactionsModal
          visible={reactionsOpen}
          reactions={reactionsBucket}
          onClose={() => setReactionsOpen(false)}
        />
      ) : null}
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

function RepliedPreview({
  label,
  media,
  isOwn,
  repliedToIsOwn,
  palette,
}: {
  label: string | null;
  /** Classified shape of the quoted message — see `repliedMedia` above
   *  for the producer. `null` means "no reply context". */
  media: {
    kind: 'text' | 'image' | 'video' | 'audio' | 'file' | 'deleted';
    snippet: string;
    uri?: string;
    fileName?: string;
  } | null;
  /** Alignment of the reply itself — right when the current user is
   *  the replier, left otherwise. */
  isOwn: boolean;
  /** Author of the QUOTED message — drives the tint. Replying to your
   *  own message uses the brand soft fill; replying to someone else's
   *  stays on neutral surface. */
  repliedToIsOwn: boolean;
  palette: ReturnType<typeof useTheme>['palette'];
}) {
  if (!media) return null;

  // Deleted-original branch: dashed tombstone bubble. Mirrors the
  // main deleted-message render so users instantly recognize the
  // state. No tint / no accent stripe — the dashed border + italic
  // copy carry the signal on its own.
  if (media.kind === 'deleted') {
    return (
      <View style={[styles.repliedWrap, isOwn ? styles.repliedAlignOwn : null]}>
        {label ? (
          <Text style={[styles.replyLabel, { color: palette.text3 }]}>
            {label}
          </Text>
        ) : null}
        <View
          style={[
            styles.repliedBubble,
            styles.repliedDeleted,
            { borderColor: palette.border2 },
          ]}
        >
          <Text style={[styles.repliedDeletedText, { color: palette.text3 }]}>
            {media.snippet}
          </Text>
        </View>
      </View>
    );
  }

  // Media replies (image / video / audio / file) drop the bubble
  // container entirely and render the same visual as the actual
  // message — just at reduced opacity to telegraph "quoted". Without
  // a tap-to-jump affordance, showing the real attachment is the
  // clearest cue for "this is what I'm replying to."
  if (media.kind === 'image' && media.uri) {
    return (
      <View
        style={[styles.repliedMediaWrap, isOwn ? styles.repliedAlignOwn : null]}
      >
        {label ? (
          <Text style={[styles.replyLabel, { color: palette.text3 }]}>
            {label}
          </Text>
        ) : null}
        <Image
          source={{ uri: media.uri }}
          style={[
            styles.repliedFullImage,
            { backgroundColor: palette.surface2 },
          ]}
          resizeMode="cover"
        />
      </View>
    );
  }

  if (
    media.kind === 'video' ||
    media.kind === 'audio' ||
    media.kind === 'file'
  ) {
    const icon =
      media.kind === 'video'
        ? 'movie'
        : media.kind === 'audio'
        ? 'audiotrack'
        : 'insert-drive-file';
    const kindLabel =
      media.kind === 'video'
        ? 'Video'
        : media.kind === 'audio'
        ? 'Audio'
        : 'Attachment';
    return (
      <View
        style={[styles.repliedMediaWrap, isOwn ? styles.repliedAlignOwn : null]}
      >
        {label ? (
          <Text style={[styles.replyLabel, { color: palette.text3 }]}>
            {label}
          </Text>
        ) : null}
        <View style={styles.repliedMediaFlat}>
          <CLIcon n={icon} size={18} color={palette.text2} />
          <Text
            numberOfLines={1}
            style={[styles.repliedMediaName, { color: palette.text2 }]}
          >
            {media.fileName ? `${kindLabel} · ${media.fileName}` : kindLabel}
          </Text>
        </View>
      </View>
    );
  }

  // Text / fallback branch — keep the bordered bubble since text
  // needs a container to read as a quote.
  const snippetColor = repliedToIsOwn ? palette.brand : palette.text2;
  const accentColor = repliedToIsOwn ? palette.brand : palette.text3;
  const surfaceStyle = repliedToIsOwn
    ? {
        backgroundColor: palette.brandSoft,
        borderColor: palette.brand,
      }
    : {
        backgroundColor: palette.surface2,
        borderColor: palette.border,
      };
  return (
    <View style={[styles.repliedWrap, isOwn ? styles.repliedAlignOwn : null]}>
      {label ? (
        <Text style={[styles.replyLabel, { color: palette.text3 }]}>
          {label}
        </Text>
      ) : null}
      <View style={[styles.repliedBubble, surfaceStyle]}>
        <View
          style={[styles.repliedAccent, { backgroundColor: accentColor }]}
        />
        <Text
          numberOfLines={2}
          style={[styles.repliedSnippet, { color: snippetColor }]}
        >
          {media.snippet || ' '}
        </Text>
      </View>
    </View>
  );
}

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

  repliedWrap: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    gap: 2,
    // The quoted bubble sits "above and slightly behind" the actual
    // reply — Messenger achieves this with a negative margin so the
    // reply bubble overlaps the quoted card by a few px. Same idea
    // here with marginBottom: -6 on the wrap.
    marginBottom: -6,
  },
  repliedAlignOwn: { alignSelf: 'flex-end' },
  repliedBubble: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    paddingLeft: 0,
    gap: 8,
    maxWidth: 260,
    minHeight: 32,
  },
  repliedAccent: {
    width: 3,
    borderTopLeftRadius: radii.sm,
    borderBottomLeftRadius: radii.sm,
  },
  repliedSnippet: { flex: 1, fontSize: 12, lineHeight: 16 },
  repliedDeleted: {
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
    paddingLeft: 10,
  },
  repliedDeletedText: {
    flex: 1,
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 16,
  },

  // Container for media replies — no border / no background, just an
  // alignment wrap + a reduced opacity so the actual media reads as
  // a quote of the original message instead of a fresh attachment.
  repliedMediaWrap: {
    alignSelf: 'flex-start',
    gap: 2,
    marginBottom: -6,
    opacity: 0.65,
  },
  repliedFullImage: {
    width: 220,
    height: 220,
    borderRadius: radii.md,
  },
  repliedMediaFlat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 260,
  },
  repliedMediaName: { flex: 1, fontSize: 12, fontWeight: '600' },

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
