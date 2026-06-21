/* ServerInfoModal — slim port of
 * webapp/src/app/widgets/modals/Servers/ServerInfoModal.tsx.
 *
 * Shows server avatar + name + privacy chip + member roster. The
 * webapp's add-member flow is skipped for v1; the server admin can
 * still add members via CreateChannelModal's picker. Member rows are
 * display-only — the native port doesn't yet have a per-username
 * profile screen, so tapping is a no-op (same as the rest of the app). */

import React from 'react';
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

import { useTheme } from '../../../reusables/design/ThemeProvider';
import { CLIcon, IconBtn } from '../../../reusables/design/primitives';
import { radii } from '../../../reusables/design/tokens';
import { ServerDetails, ServerMember } from '../../../reusables/hooks/requests';

interface Props {
  visible: boolean;
  onClose: () => void;
  details: ServerDetails;
}

function memberName(m: ServerMember): string {
  const fn = m.fullname?.firstName ?? '';
  const mn = m.fullname?.middleName;
  const ln = m.fullname?.lastName ?? '';
  const middle = mn && mn !== 'N/A' ? ` ${mn}` : '';
  return `${fn}${middle} ${ln}`.trim() || 'Member';
}

function memberInitial(m: ServerMember): string {
  return (m.fullname?.firstName ?? '?').charAt(0).toUpperCase();
}

export function ServerInfoModal({ visible, onClose, details }: Props) {
  const { palette } = useTheme();
  const members = details.usersWithInfo ?? [];
  const hasAvatar = details.profile && details.profile !== 'N/A';

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
          <Text style={[styles.headerTitle, { color: palette.text }]}>Server</Text>
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
              <Image
                source={{ uri: details.profile }}
                style={styles.bannerAvatar}
              />
            ) : (
              <View
                style={[
                  styles.bannerAvatar,
                  styles.avatarFallback,
                  { backgroundColor: palette.goldSoft },
                ]}
              >
                <Text style={[styles.bannerInitial, { color: palette.gold }]}>
                  {details.serverName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={[styles.bannerName, { color: palette.text }]}>
              {details.serverName}
            </Text>
            <View style={styles.chipRow}>
              {details.privacy ? (
                <View
                  style={[
                    styles.chip,
                    { backgroundColor: palette.surface2 },
                  ]}
                >
                  <CLIcon n="lock" size={12} color={palette.text2} />
                  <Text style={[styles.chipText, { color: palette.text2 }]}>
                    Private
                  </Text>
                </View>
              ) : null}
              {details.is_admin ? (
                <View
                  style={[
                    styles.chip,
                    { backgroundColor: palette.brandSoft },
                  ]}
                >
                  <CLIcon n="shield" size={12} color={palette.brand} />
                  <Text style={[styles.chipText, { color: palette.brand }]}>
                    Admin
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <Text style={[styles.sectionLabel, { color: palette.text3 }]}>
            MEMBERS · {members.length}
          </Text>
          {members.length === 0 ? (
            <View
              style={[
                styles.empty,
                { backgroundColor: palette.surface, borderColor: palette.border },
              ]}
            >
              <CLIcon n="people-outline" size={28} color={palette.text3} />
              <Text style={[styles.emptyText, { color: palette.text3 }]}>
                No members yet
              </Text>
            </View>
          ) : (
            <View style={styles.memberList}>
              {members.map((m) => {
                const profile = m.profile && m.profile !== 'none' ? m.profile : null;
                return (
                  <View
                    key={m._id}
                    style={[
                      styles.memberRow,
                      {
                        backgroundColor: palette.surface,
                        borderColor: palette.border,
                      },
                    ]}
                  >
                    {profile ? (
                      <Image
                        source={{ uri: profile }}
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
                          {memberInitial(m)}
                        </Text>
                      </View>
                    )}
                    <Text
                      numberOfLines={1}
                      style={[styles.memberName, { color: palette.text }]}
                    >
                      {memberName(m)}
                    </Text>
                  </View>
                );
              })}
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

  bannerWrap: { alignItems: 'center', gap: 10, paddingVertical: 12 },
  bannerAvatar: { width: 88, height: 88, borderRadius: radii.md },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  bannerInitial: { fontSize: 32, fontWeight: '800' },
  bannerName: { fontSize: 17, fontWeight: '700' },
  chipRow: { flexDirection: 'row', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    height: 22,
    borderRadius: radii.pill,
  },
  chipText: { fontSize: 11, fontWeight: '700' },

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
    height: 52,
    borderWidth: 1,
    borderRadius: radii.sm,
  },
  memberAvatar: { width: 36, height: 36, borderRadius: radii.pill },
  memberInitial: { fontSize: 14, fontWeight: '800' },
  memberName: { flex: 1, fontSize: 14, fontWeight: '600' },

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
