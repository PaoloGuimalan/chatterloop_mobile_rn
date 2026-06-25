/* CreateGroupChatModal — port of
 * webapp/src/app/widgets/modals/CreateGroupChatModal.tsx.
 *
 * Collects a group name, a privacy flag, and a set of members (via the
 * shared ContactPicker), then fires CreateGroupChatRequest. On success
 * the parent refreshes the conversation list. */

import React, { useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

import type { AppState } from '../../../redux/store';
import { useTheme } from '../../../reusables/design/ThemeProvider';
import { Btn, CLIcon, Field, IconBtn } from '../../../reusables/design/primitives';
import { radii } from '../../../reusables/design/tokens';
import {
  ContactPicker,
  ContactPickerItem,
} from '../../../reusables/design/ContactPicker';
import { CreateGroupChatRequest } from '../../../reusables/hooks/requests';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Fired after a successful create so the list can refresh. */
  onCreated: () => void;
}

function memberName(c: ContactPickerItem): string {
  const middle =
    c.middleName && c.middleName !== 'N/A' ? ` ${c.middleName}` : '';
  return `${c.firstName}${middle} ${c.lastName}`.trim();
}

export default function CreateGroupChatModal({
  visible,
  onClose,
  onCreated,
}: Props) {
  const { palette } = useTheme();
  const firstName = useSelector(
    (s: AppState) => s.authentication.user.fullName.firstName,
  );

  const [name, setName] = useState(`${firstName}'s Group Chat`);
  const [isPrivate, setIsPrivate] = useState(true);
  const [members, setMembers] = useState<ContactPickerItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName(`${firstName}'s Group Chat`);
    setIsPrivate(true);
    setMembers([]);
  };

  const onCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const ok = await CreateGroupChatRequest({
      groupName: name.trim(),
      privacy: isPrivate,
      otherUsers: members.map(m => m.id),
    });
    setSaving(false);
    if (ok) {
      reset();
      onCreated();
      onClose();
    }
  };

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
        <View style={[styles.header, { borderBottomColor: palette.border }]}>
          <IconBtn n="close" iconSize={22} color={palette.text} onPress={onClose} />
          <View style={styles.headerTitleWrap}>
            <CLIcon n="group" size={20} color={palette.brand} />
            <Text style={[styles.headerTitle, { color: palette.text }]}>
              Create Group Chat
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Field
            label="Name of Group Chat"
            value={name}
            onChangeText={setName}
            placeholder="Type the group chat's name"
          />

          <View style={styles.privacyRow}>
            <View style={styles.flex1}>
              <Text style={[styles.label, { color: palette.text2 }]}>Privacy</Text>
              <Text style={[styles.privacyHint, { color: palette.text3 }]}>
                Group Chat is {isPrivate ? 'Private' : 'Public'}
              </Text>
            </View>
            <Switch
              value={isPrivate}
              onValueChange={setIsPrivate}
              trackColor={{ false: palette.border2, true: palette.brand }}
              thumbColor="#fff"
            />
          </View>

          <View>
            <Text style={[styles.label, { color: palette.text2 }]}>
              Members ({members.length})
            </Text>
            <View style={styles.chipsRow}>
              {members.map(m => (
                <View
                  key={m.id}
                  style={[styles.chip, { backgroundColor: palette.brandSoft }]}
                >
                  {m.profile && m.profile !== 'none' ? (
                    <Image source={{ uri: m.profile }} style={styles.chipAvatar} />
                  ) : null}
                  <Text
                    numberOfLines={1}
                    style={[styles.chipText, { color: palette.brand }]}
                  >
                    {memberName(m)}
                  </Text>
                  <Pressable
                    hitSlop={6}
                    onPress={() =>
                      setMembers(prev => prev.filter(x => x.id !== m.id))
                    }
                  >
                    <CLIcon n="close" size={15} color={palette.brand} />
                  </Pressable>
                </View>
              ))}
            </View>
            <Btn
              label="Add people"
              iconL="person-add"
              variant="outline"
              onPress={() => setPickerOpen(true)}
              style={styles.addBtn}
            />
          </View>
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: palette.border }]}>
          <Btn
            label={saving ? 'Creating…' : 'Create'}
            block
            disabled={saving || !name.trim()}
            onPress={onCreate}
            style={styles.flex1}
          />
          <Btn label="Cancel" variant="outline" onPress={onClose} />
        </View>

        <ContactPicker
          visible={pickerOpen}
          onClose={() => setPickerOpen(false)}
          mode="multi"
          value={members}
          onChange={setMembers}
          title="Add people"
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex1: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  headerTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  body: { padding: 16, gap: 20 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  privacyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  privacyHint: { fontSize: 13 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 4,
    paddingRight: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
    maxWidth: 180,
  },
  chipAvatar: { width: 22, height: 22, borderRadius: radii.pill },
  chipText: { fontSize: 12.5, fontWeight: '600', flexShrink: 1 },
  addBtn: { alignSelf: 'flex-start' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
  },
});
