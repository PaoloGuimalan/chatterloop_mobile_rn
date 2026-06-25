/* PostOptionsSheet — bottom-sheet port of
 * webapp/src/app/tabs/profile/user/PostOptions.tsx.
 *
 * Surfaces Save / Unsave, Archive / Unarchive, and Delete for a post.
 * Save/Unsave show for any non-archived post; Archive/Unarchive and
 * Delete only show for the viewer's own posts (matches the webapp's
 * ownership gates). The sheet owns the request calls and reports the
 * applied change back through onChanged so the parent list can update
 * in place without a refetch. */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTheme } from '../../../../reusables/design/ThemeProvider';
import { CLIcon } from '../../../../reusables/design/primitives';
import { radii } from '../../../../reusables/design/tokens';
import {
  DeletePostRequest,
  FeedPost,
  SavePostRequest,
  UnsavePostRequest,
  UpdatePostRequest,
} from '../../../../reusables/hooks/requests';

export type PostChange =
  | 'saved'
  | 'unsaved'
  | 'archived'
  | 'unarchived'
  | 'deleted';

interface Props {
  /** When non-null the sheet is open and targets this post. */
  target: FeedPost | null;
  /** Authenticated userID — gates owner-only actions. */
  me: string;
  onClose: () => void;
  onChanged: (change: PostChange, post: FeedPost) => void;
}

export default function PostOptionsSheet({
  target,
  me,
  onClose,
  onChanged,
}: Props) {
  const { palette } = useTheme();
  const [busy, setBusy] = useState(false);

  const toggleSave = useCallback(async () => {
    if (!target) return;
    setBusy(true);
    const wasSaved = !!target.is_saved;
    const ok = wasSaved
      ? await UnsavePostRequest(target.post_id)
      : await SavePostRequest(target.post_id);
    setBusy(false);
    if (ok) {
      onChanged(wasSaved ? 'unsaved' : 'saved', target);
      onClose();
    }
  }, [target, onChanged, onClose]);

  const toggleArchive = useCallback(async () => {
    if (!target) return;
    setBusy(true);
    const nextArchived = !target.is_archived;
    const ok = await UpdatePostRequest(target.post_id, {
      is_archived: nextArchived,
    });
    setBusy(false);
    if (ok) {
      onChanged(nextArchived ? 'archived' : 'unarchived', target);
      onClose();
    }
  }, [target, onChanged, onClose]);

  const confirmDelete = useCallback(() => {
    if (!target) return;
    Alert.alert('Delete post?', "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          const ok = await DeletePostRequest([target.post_id]);
          setBusy(false);
          if (ok) {
            onChanged('deleted', target);
            onClose();
          }
        },
      },
    ]);
  }, [target, onChanged, onClose]);

  if (!target) return null;
  const isOwn = target.user?.id === me;

  return (
    <Modal
      transparent
      visible
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable
          onPress={() => {}}
          style={[
            styles.sheet,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: palette.border2 }]} />

          {busy ? (
            <View style={styles.busyRow}>
              <ActivityIndicator color={palette.brand} />
            </View>
          ) : null}

          {!target.is_archived ? (
            <ActionRow
              icon={target.is_saved ? 'bookmark-remove' : 'bookmark-add'}
              label={target.is_saved ? 'Unsave' : 'Save'}
              palette={palette}
              disabled={busy}
              onPress={toggleSave}
            />
          ) : null}

          {isOwn ? (
            <ActionRow
              icon={target.is_archived ? 'unarchive' : 'archive'}
              label={target.is_archived ? 'Unarchive' : 'Archive'}
              palette={palette}
              disabled={busy}
              onPress={toggleArchive}
            />
          ) : null}

          {isOwn ? (
            <ActionRow
              icon="delete"
              label="Delete"
              destructive
              palette={palette}
              disabled={busy}
              onPress={confirmDelete}
            />
          ) : null}

          <ActionRow
            icon="close"
            label="Cancel"
            palette={palette}
            disabled={busy}
            onPress={onClose}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ActionRow({
  icon,
  label,
  destructive,
  disabled,
  palette,
  onPress,
}: {
  icon: string;
  label: string;
  destructive?: boolean;
  disabled?: boolean;
  palette: ReturnType<typeof useTheme>['palette'];
  onPress: () => void;
}) {
  const color = destructive ? palette.pink : palette.text;
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionRow,
        { opacity: disabled ? 0.5 : pressed ? 0.65 : 1 },
      ]}
    >
      <CLIcon n={icon} size={20} color={color} />
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
    paddingTop: 8,
    paddingBottom: 24,
    paddingHorizontal: 8,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 999,
    marginBottom: 8,
  },
  busyRow: { paddingVertical: 6, alignItems: 'center' },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  actionLabel: { fontSize: 15, fontWeight: '600' },
});
