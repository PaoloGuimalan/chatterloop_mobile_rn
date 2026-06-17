/* CreateServerModal — scoped port of
 * webapp/src/app/widgets/modals/CreateServerModal.tsx.
 *
 * Three fields: server name (defaults to "<FirstName>'s Server"),
 * privacy toggle, and a ContactPicker-driven member multi-select.
 * Submits via CreateServerRequest; parent passes onCreated which
 * fires on success so the Servers list can refetch. */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

import type { AppState } from '../../../redux/store';
import { useTheme } from '../../../reusables/design/ThemeProvider';
import { CLIcon, IconBtn } from '../../../reusables/design/primitives';
import {
  ContactPicker,
  ContactPickerItem,
} from '../../../reusables/design/ContactPicker';
import { radii } from '../../../reusables/design/tokens';
import { CreateServerRequest } from '../../../reusables/hooks/requests';

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}

function defaultName(firstName: string | undefined): string {
  const f = (firstName ?? '').trim();
  return f ? `${f}'s Server` : 'New Server';
}

export function CreateServerModal({ visible, onClose, onCreated }: Props) {
  const { palette } = useTheme();
  const me = useSelector((s: AppState) => s.authentication.user);

  const [name, setName] = useState(() => defaultName(me?.fullName?.firstName));
  const [isPrivate, setIsPrivate] = useState(true);
  const [members, setMembers] = useState<ContactPickerItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = useCallback(() => {
    setName(defaultName(me?.fullName?.firstName));
    setIsPrivate(true);
    setMembers([]);
  }, [me?.fullName?.firstName]);

  const onSubmit = useCallback(async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    const ok = await CreateServerRequest({
      groupName: name.trim(),
      privacy: isPrivate,
      otherUsers: members.map(m => m.id),
    });
    setSaving(false);
    if (ok) {
      onCreated();
      reset();
      onClose();
    }
  }, [isPrivate, members, name, onClose, onCreated, reset, saving]);

  const canSubmit = name.trim().length > 0 && !saving;

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
          <IconBtn
            n="close"
            iconSize={22}
            color={palette.text}
            onPress={onClose}
          />
          <Text style={[styles.headerTitle, { color: palette.text }]}>
            New server
          </Text>
          <Pressable
            disabled={!canSubmit}
            onPress={onSubmit}
            style={({ pressed }) => [
              styles.saveBtn,
              {
                backgroundColor: palette.brand,
                opacity: !canSubmit ? 0.5 : pressed ? 0.85 : 1,
              },
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>Create</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.body}>
          <Text style={[styles.fieldLabel, { color: palette.text3 }]}>
            NAME
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Server name"
            placeholderTextColor={palette.text3}
            style={[
              styles.input,
              {
                color: palette.text,
                backgroundColor: palette.input,
                borderColor: palette.border,
              },
            ]}
          />

          <View style={styles.privacyRow}>
            <View style={styles.privacyCopy}>
              <Text style={[styles.privacyTitle, { color: palette.text }]}>
                Private
              </Text>
              <Text
                style={[styles.privacyHint, { color: palette.text3 }]}
                numberOfLines={2}
              >
                Only invited members can find and join this server.
              </Text>
            </View>
            <Switch
              value={isPrivate}
              onValueChange={setIsPrivate}
              trackColor={{ false: palette.border2, true: palette.brand }}
              thumbColor="#fff"
            />
          </View>

          <Text style={[styles.fieldLabel, { color: palette.text3 }]}>
            MEMBERS
          </Text>
          <Pressable
            onPress={() => setPickerOpen(true)}
            disabled={saving}
            style={({ pressed }) => [
              styles.membersRow,
              {
                backgroundColor: palette.input,
                borderColor: palette.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            {members.length === 0 ? (
              <Text style={[styles.membersPlaceholder, { color: palette.text3 }]}>
                Add contacts
              </Text>
            ) : (
              <View style={styles.memberChipRow}>
                {members.map(c => (
                  <View
                    key={c.id}
                    style={[
                      styles.memberChip,
                      { backgroundColor: palette.brandSoft },
                    ]}
                  >
                    <Text style={[styles.memberChipText, { color: palette.brand }]}>
                      {c.firstName}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            <CLIcon n="chevron-right" size={18} color={palette.text3} />
          </Pressable>
        </View>

        <ContactPicker
          mode="multi"
          visible={pickerOpen}
          value={members}
          onChange={setMembers}
          onClose={() => setPickerOpen(false)}
          title="Pick members"
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { padding: 16, gap: 6 },

  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 10,
    gap: 8,
    borderBottomWidth: 1,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  saveBtn: {
    paddingHorizontal: 16,
    height: 32,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },

  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    paddingVertical: 8,
  },
  privacyCopy: { flex: 1, gap: 2 },
  privacyTitle: { fontSize: 14, fontWeight: '700' },
  privacyHint: { fontSize: 12, lineHeight: 16 },

  membersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
  membersPlaceholder: { flex: 1, fontSize: 14 },
  memberChipRow: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  memberChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  memberChipText: { fontSize: 11, fontWeight: '700' },
});
