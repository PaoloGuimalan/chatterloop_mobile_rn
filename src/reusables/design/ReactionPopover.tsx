/* ReactionPopover — render-prop modal companion to useFeedReactions.
 *
 * Sits at the bottom of any screen that hosts a post list with the
 * hook, and renders a centered emoji-row popover whenever the hook's
 * popoverPostId is non-null. */

import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTheme } from './ThemeProvider';
import { radii } from './tokens';
import type { EmojiInfo } from '../hooks/requests';

interface Props {
  visible: boolean;
  emojis: EmojiInfo[];
  onClose: () => void;
  onPick: (emojiId: number) => void;
}

export function ReactionPopover({ visible, emojis, onClose, onPick }: Props) {
  const { palette } = useTheme();
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
            },
          ]}
        >
          {emojis.length === 0 ? (
            <Text style={[styles.empty, { color: palette.text3 }]}>
              No emojis available
            </Text>
          ) : (
            emojis.map((e) => (
              <Pressable
                key={e.emoji_id}
                onPress={() => onPick(e.emoji_id)}
                style={({ pressed }) => [
                  styles.emojiBtn,
                  {
                    backgroundColor: pressed
                      ? palette.surface2
                      : 'transparent',
                  },
                ]}
              >
                <Text style={styles.emojiChar}>{e.emoji_content}</Text>
              </Pressable>
            ))
          )}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  emojiBtn: {
    width: 42,
    height: 42,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiChar: { fontSize: 22 },
  empty: { fontSize: 12, paddingHorizontal: 12, paddingVertical: 8 },
});
