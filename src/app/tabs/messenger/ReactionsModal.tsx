/* ReactionsModal — port of
 * webapp/src/app/widgets/modals/Conversation/ReactionsModal.tsx.
 *
 * Lists who reacted to a message and with what emoji. The native
 * message-reaction payload only carries { userID, emoji } (see
 * MessageReaction in Conversation.tsx), so we resolve display names and
 * avatars from the redux contactslist and the authenticated user. Users
 * we can't resolve fall back to a generic label — the emoji still
 * shows, matching the webapp's intent. */

import React, { useMemo } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';

import type { AppState } from '../../../redux/store';
import { useTheme } from '../../../reusables/design/ThemeProvider';
import { CLIcon, IconBtn } from '../../../reusables/design/primitives';
import { radii } from '../../../reusables/design/tokens';
import { IContact, PaginationProp } from '../../../reusables/vars/interfaces';
import type { MessageReaction } from './Conversation';

interface ResolvedUser {
  name: string;
  profile?: string;
  username?: string;
}

interface Props {
  visible: boolean;
  reactions: MessageReaction[];
  onClose: () => void;
}

export default function ReactionsModal({ visible, reactions, onClose }: Props) {
  const { palette } = useTheme();
  const navigation = useNavigation<any>();
  const contacts = useSelector(
    (s: AppState) => s.contactslist as PaginationProp<IContact>,
  );
  const auth = useSelector((s: AppState) => s.authentication.user);

  const openProfile = (username?: string) => {
    if (!username) return;
    onClose();
    navigation.navigate('UserProfile', { userID: username });
  };

  // userID -> { name, profile } lookup built from the contact graph plus
  // the viewer themselves.
  const directory = useMemo(() => {
    const map = new Map<string, ResolvedUser>();
    const me = auth.userID;
    map.set(me, {
      name: 'You',
      profile:
        auth.profile && auth.profile !== 'none' ? auth.profile : undefined,
      username: auth.username,
    });
    (contacts.results ?? []).forEach(c => {
      if (c.type !== 'single' || !c.involved_user || !c.action_by) return;
      const u = c.action_by.id === me ? c.involved_user : c.action_by;
      const middle =
        u.middle_name && u.middle_name !== 'N/A' ? ` ${u.middle_name}` : '';
      map.set(u.id, {
        name: `${u.first_name}${middle} ${u.last_name}`.trim(),
        profile: u.profile && u.profile !== 'none' ? u.profile : undefined,
        username: u.username ?? undefined,
      });
    });
    return map;
  }, [contacts.results, auth]);

  const rows = useMemo(
    () =>
      reactions.map((r, i) => ({
        key: `${r.userID}-${i}`,
        emoji: r.emoji,
        ...(directory.get(r.userID) ?? { name: 'Someone' }),
      })),
    [reactions, directory],
  );

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable
          onPress={() => {}}
          style={[
            styles.card,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: palette.text }]}>
              Reactions
            </Text>
            <IconBtn
              n="close"
              iconSize={20}
              color={palette.text2}
              onPress={onClose}
            />
          </View>
          <FlatList
            data={rows}
            keyExtractor={r => r.key}
            style={styles.list}
            renderItem={({ item }) => (
              <Pressable
                style={styles.row}
                disabled={!item.username}
                onPress={() => openProfile(item.username)}
              >
                {item.profile ? (
                  <Image source={{ uri: item.profile }} style={styles.avatar} />
                ) : (
                  <View
                    style={[
                      styles.avatar,
                      styles.avatarFallback,
                      { backgroundColor: palette.brandSoft },
                    ]}
                  >
                    <Text style={[styles.avatarInitial, { color: palette.brand }]}>
                      {item.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text
                  numberOfLines={1}
                  style={[styles.name, { color: palette.text }]}
                >
                  {item.name}
                </Text>
                <Text style={styles.emoji}>{item.emoji}</Text>
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <CLIcon n="mood" size={26} color={palette.text3} />
                <Text style={[styles.emptyText, { color: palette.text3 }]}>
                  No reactions yet
                </Text>
              </View>
            }
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    maxHeight: 360,
    borderWidth: 1,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 8,
  },
  title: { flex: 1, fontSize: 14, fontWeight: '700' },
  list: { paddingHorizontal: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  avatar: { width: 34, height: 34, borderRadius: radii.pill },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 13, fontWeight: '700' },
  name: { flex: 1, fontSize: 14 },
  emoji: { fontSize: 18 },
  empty: { alignItems: 'center', gap: 6, paddingVertical: 28 },
  emptyText: { fontSize: 13, fontWeight: '600' },
});
