/* ConversationInfoModal — slim port of
 * webapp/src/app/widgets/modals/Conversation/ConversationInfoModal.tsx.
 *
 * Shows the conversation's avatar/title/kind plus a member roster. The
 * webapp version also surfaces shared media/files browsing and an
 * add-member flow; those depend on InitConversationRequest returning
 * conversation metadata + a separate files endpoint that the native
 * port hasn't wired yet, so v1 stays display-only.
 *
 * Member names are resolved against the redux `contactslist` slice
 * keyed by the receiver IDs the screen already has on hand — when a
 * receiver isn't in your contacts (rare on group chats), the row
 * falls back to "Member" so the modal still renders cleanly. */

import React, { useMemo } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

import type { AppState } from '../../../redux/store';
import { useTheme } from '../../../reusables/design/ThemeProvider';
import { CLIcon, IconBtn } from '../../../reusables/design/primitives';
import { radii } from '../../../reusables/design/tokens';
import type {
  IContact,
  PaginationProp,
} from '../../../reusables/vars/interfaces';

interface ResolvedMember {
  id: string;
  name: string;
  username: string | null;
  profile: string | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  profile?: string;
  type: 'single' | 'group' | 'server';
  conversationID: string;
  /** User IDs the screen was given — what we'll resolve names for. */
  receivers: string[];
}

function kindLabel(type: Props['type']): string {
  if (type === 'group') return 'Group chat';
  if (type === 'server') return 'Server channel';
  return 'Direct message';
}

export function ConversationInfoModal({
  visible,
  onClose,
  title,
  profile,
  type,
  conversationID,
  receivers,
}: Props) {
  const { palette } = useTheme();
  const contacts = useSelector(
    (s: AppState) => s.contactslist as PaginationProp<IContact>,
  );
  const me = useSelector((s: AppState) => s.authentication.user.userID);

  // Build a userID→display lookup from the contacts list. The contact
  // record stores the "other party" under either `action_by` or
  // `involved_user` depending on who initiated the request; we index
  // both so a name lookup always works regardless of direction.
  const directory = useMemo(() => {
    const map = new Map<string, ResolvedMember>();
    for (const c of contacts.results ?? []) {
      if (c.type !== 'single') continue;
      for (const side of [c.action_by, c.involved_user]) {
        if (!side?.id || side.id === me) continue;
        if (map.has(side.id)) continue;
        const middle =
          side.middle_name && side.middle_name !== 'N/A'
            ? ` ${side.middle_name}`
            : '';
        map.set(side.id, {
          id: side.id,
          name: `${side.first_name}${middle} ${side.last_name}`.trim(),
          username: side.username ?? null,
          profile: side.profile && side.profile !== 'none' ? side.profile : null,
        });
      }
    }
    return map;
  }, [contacts.results, me]);

  const members = useMemo<ResolvedMember[]>(() => {
    return receivers.map(
      (id) =>
        directory.get(id) ?? {
          id,
          name: 'Member',
          username: null,
          profile: null,
        },
    );
  }, [directory, receivers]);

  const hasAvatar = profile && profile !== 'none' && profile !== 'N/A';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        edges={['top']}
        style={[styles.screen, { backgroundColor: palette.bg }]}
      >
        <View style={[styles.headerBar, { borderBottomColor: palette.border }]}>
          <Text style={[styles.headerTitle, { color: palette.text }]}>
            Conversation
          </Text>
          <IconBtn
            n="close"
            iconSize={22}
            color={palette.text}
            onPress={onClose}
          />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.bannerWrap}>
            {hasAvatar ? (
              <Image source={{ uri: profile }} style={styles.bannerAvatar} />
            ) : (
              <View
                style={[
                  styles.bannerAvatar,
                  styles.avatarFallback,
                  { backgroundColor: palette.brandSoft },
                ]}
              >
                <Text style={[styles.bannerInitial, { color: palette.brand }]}>
                  {title.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text
              numberOfLines={1}
              style={[styles.bannerName, { color: palette.text }]}
            >
              {title}
            </Text>
            <View
              style={[styles.kindChip, { backgroundColor: palette.surface2 }]}
            >
              <CLIcon
                n={type === 'server' ? 'tag' : type === 'group' ? 'group' : 'person'}
                size={12}
                color={palette.text2}
              />
              <Text style={[styles.kindText, { color: palette.text2 }]}>
                {kindLabel(type)}
              </Text>
            </View>
            <Text
              numberOfLines={1}
              style={[styles.cidText, { color: palette.text3 }]}
            >
              {conversationID}
            </Text>
          </View>

          <Text style={[styles.sectionLabel, { color: palette.text3 }]}>
            MEMBERS · {members.length}
          </Text>
          {members.length === 0 ? (
            <View
              style={[
                styles.empty,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                },
              ]}
            >
              <CLIcon n="people-outline" size={28} color={palette.text3} />
              <Text style={[styles.emptyText, { color: palette.text3 }]}>
                No other participants
              </Text>
            </View>
          ) : (
            <View style={styles.memberList}>
              {members.map((m) => (
                <View
                  key={m.id}
                  style={[
                    styles.memberRow,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  {m.profile ? (
                    <Image
                      source={{ uri: m.profile }}
                      style={styles.memberAvatar}
                    />
                  ) : (
                    <View
                      style={[
                        styles.memberAvatar,
                        styles.avatarFallback,
                        { backgroundColor: palette.brandSoft },
                      ]}
                    >
                      <Text
                        style={[styles.memberInitial, { color: palette.brand }]}
                      >
                        {m.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.memberCopy}>
                    <Text
                      numberOfLines={1}
                      style={[styles.memberName, { color: palette.text }]}
                    >
                      {m.name}
                    </Text>
                    {m.username ? (
                      <Text
                        numberOfLines={1}
                        style={[styles.memberHandle, { color: palette.text3 }]}
                      >
                        @{m.username}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          )}

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.doneBtn,
              {
                backgroundColor: palette.brand,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '800' },

  scroll: { padding: 16, gap: 12, paddingBottom: 32 },

  bannerWrap: { alignItems: 'center', gap: 8, paddingVertical: 12 },
  bannerAvatar: { width: 88, height: 88, borderRadius: radii.pill },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  bannerInitial: { fontSize: 32, fontWeight: '800' },
  bannerName: { fontSize: 17, fontWeight: '700' },
  kindChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    height: 22,
    borderRadius: radii.pill,
  },
  kindText: { fontSize: 11, fontWeight: '700' },
  cidText: { fontSize: 10, fontWeight: '600', marginTop: 4 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 6,
    marginLeft: 4,
  },

  memberList: { gap: 6 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    height: 56,
    borderWidth: 1,
    borderRadius: radii.sm,
  },
  memberAvatar: { width: 36, height: 36, borderRadius: radii.pill },
  memberInitial: { fontSize: 14, fontWeight: '800' },
  memberCopy: { flex: 1, gap: 1 },
  memberName: { fontSize: 14, fontWeight: '600' },
  memberHandle: { fontSize: 11.5 },

  empty: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: { fontSize: 13, fontWeight: '600' },

  doneBtn: {
    marginTop: 8,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
