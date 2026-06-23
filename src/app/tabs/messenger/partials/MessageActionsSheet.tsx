/* MessageActionsSheet — Instagram-style floating context menu.
 *
 * Replaces the basic Alert.alert action sheet that ContentHandler used
 * to call. When the user long-presses a message:
 *
 *   - The screen dims behind a translucent scrim.
 *   - A quick-reactions row floats at the top (display-only for now —
 *     wires once the message-reaction endpoint lands).
 *   - The pressed message preview sits in the middle.
 *   - The action list (Reply / Delete) sits below in a card.
 *
 * Tap-outside or hardware back closes without selecting. The
 * destructive Delete tap chains into a confirm dialog before firing.
 *
 * Pure presentational — Conversation.tsx owns the state machine (which
 * message is being acted on, the underlying request calls). The sheet
 * just emits intents through its callbacks. */

import React, { useCallback } from 'react';
import {
  Alert,
  Image,
  Modal,
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
  /** When non-null, the sheet is open and targets this message. */
  target: DisplayMessage | null;
  /** Current authenticated userID — determines which actions show. */
  me: string;
  onClose: () => void;
  onReply: (cnvs: DisplayMessage) => void;
  onDelete: (cnvs: DisplayMessage) => void;
}

const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '😡', '👍'];

function previewLine(m: DisplayMessage): string {
  if (m.messageType === 'text') return m.content;
  if (m.mediaKind === 'image') return 'Photo';
  if (m.mediaKind === 'video') return 'Video';
  if (m.mediaKind === 'audio') return 'Audio';
  if (m.mediaKind === 'file') return m.fileName ?? 'File';
  return m.content || `Sent ${m.messageType}`;
}

export default function MessageActionsSheet({
  target,
  me,
  onClose,
  onReply,
  onDelete,
}: Props) {
  const { palette } = useTheme();

  const handleReply = useCallback(() => {
    if (!target) return;
    onReply(target);
    onClose();
  }, [onClose, onReply, target]);

  const handleDelete = useCallback(() => {
    if (!target) return;
    Alert.alert('Delete message?', "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          onDelete(target);
          onClose();
        },
      },
    ]);
  }, [onClose, onDelete, target]);

  if (!target) return null;
  const isOwn = target.sender === me;
  const previewImage =
    target.mediaKind === 'image' && target.imageURI ? target.imageURI : null;

  return (
    <Modal
      transparent
      visible
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.scrim} onPress={onClose}>
        {/* Stop propagation so taps inside the card don't dismiss. */}
        <Pressable
          onPress={() => {}}
          style={[styles.sheetWrap, isOwn ? styles.alignOwn : styles.alignOther]}
        >
          {/* Quick reactions row — display-only placeholder. */}
          <View
            style={[
              styles.reactionsRow,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
              },
            ]}
          >
            {QUICK_REACTIONS.map((e, idx) => (
              <Pressable
                key={`${e}-${idx}`}
                onPress={onClose}
                style={({ pressed }) => [
                  styles.reactionBtn,
                  { opacity: pressed ? 0.55 : 1 },
                ]}
              >
                <Text style={styles.reactionEmoji}>{e}</Text>
              </Pressable>
            ))}
          </View>

          {/* The pressed message preview — image thumbnail or text/media
              bubble. Mirrors the lifted-bubble feel of Instagram. */}
          {previewImage ? (
            <Image
              source={{ uri: previewImage }}
              style={[
                styles.previewImage,
                { backgroundColor: palette.surface2 },
              ]}
              resizeMode="cover"
            />
          ) : (
            <View
              style={[
                styles.previewBubble,
                isOwn
                  ? { backgroundColor: palette.brand }
                  : {
                      backgroundColor: palette.surface,
                      borderColor: palette.border,
                      borderWidth: 1,
                    },
              ]}
            >
              <Text
                numberOfLines={4}
                style={[
                  styles.previewText,
                  { color: isOwn ? '#fff' : palette.text },
                ]}
              >
                {previewLine(target)}
              </Text>
            </View>
          )}

          {/* Action list. */}
          <View
            style={[
              styles.actionList,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
              },
            ]}
          >
            <ActionRow
              icon="reply"
              label="Reply"
              palette={palette}
              onPress={handleReply}
            />
            {isOwn ? (
              <>
                <View
                  style={[
                    styles.actionDivider,
                    { backgroundColor: palette.border },
                  ]}
                />
                <ActionRow
                  icon="delete"
                  label="Delete"
                  destructive
                  palette={palette}
                  onPress={handleDelete}
                />
              </>
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ActionRow({
  icon,
  label,
  destructive,
  palette,
  onPress,
}: {
  icon: string;
  label: string;
  destructive?: boolean;
  palette: ReturnType<typeof useTheme>['palette'];
  onPress: () => void;
}) {
  const color = destructive ? palette.pink : palette.text;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionRow,
        { opacity: pressed ? 0.65 : 1 },
      ]}
    >
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
      <CLIcon n={icon} size={18} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sheetWrap: {
    gap: 12,
    maxWidth: 340,
  },
  alignOwn: { alignSelf: 'flex-end' },
  alignOther: { alignSelf: 'flex-start' },

  reactionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    gap: 4,
  },
  reactionBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionEmoji: { fontSize: 22 },

  previewBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.md,
    maxWidth: 320,
  },
  previewText: { fontSize: 14, lineHeight: 19 },
  previewImage: {
    width: 220,
    height: 220,
    borderRadius: radii.md,
  },

  actionList: {
    borderWidth: 1,
    borderRadius: radii.md,
    overflow: 'hidden',
    minWidth: 220,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  actionLabel: { fontSize: 14.5, fontWeight: '600' },
  actionDivider: { height: StyleSheet.hairlineWidth },
});
