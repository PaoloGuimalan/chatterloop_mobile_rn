/* CreateChannelModal — scoped port of
 * webapp/src/app/widgets/modals/Servers/CreateChannelModal.tsx.
 *
 * Adds a channel to an existing server. Type chooser is constrained to
 * text/voice/location (matches webapp); voice/location are accepted by
 * the backend but the native port only fully wires text channels. */

import React, { useCallback, useMemo, useState } from 'react';
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

import { useTheme } from '../../../reusables/design/ThemeProvider';
import { CLIcon, IconBtn } from '../../../reusables/design/primitives';
import {
  ContactPicker,
  ContactPickerItem,
} from '../../../reusables/design/ContactPicker';
import { radii } from '../../../reusables/design/tokens';
import {
  CreateChannelRequest,
  ServerMember,
} from '../../../reusables/hooks/requests';

type ChannelKind = 'text' | 'voice' | 'location';

const KIND_META: Record<
  ChannelKind,
  { label: string; icon: string; hint: string }
> = {
  text: { label: 'Text', icon: 'tag', hint: 'Send messages and share files.' },
  voice: {
    label: 'Voice',
    icon: 'volume-up',
    hint: 'Hop on a live voice call (coming soon on mobile).',
  },
  location: {
    label: 'Location',
    icon: 'near-me',
    hint: 'Live location sharing (coming soon on mobile).',
  },
};

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
  serverID: string;
  /** The server's roster — passed in so the ContactPicker only
   *  surfaces existing members instead of all of the user's contacts.
   *  Matches webapp's `servermemberslist` prop. */
  serverMembers: ServerMember[];
}

export function CreateChannelModal({
  visible,
  onClose,
  onCreated,
  serverID,
  serverMembers,
}: Props) {
  const { palette } = useTheme();

  const [name, setName] = useState('');
  const [kind, setKind] = useState<ChannelKind>('text');
  const [isPrivate, setIsPrivate] = useState(false);
  const [members, setMembers] = useState<ContactPickerItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // The picker reads contactslist from redux by default. The webapp
  // narrows here to existing server members; the native ContactPicker
  // doesn't yet accept a source override, so we just render the
  // chip-summary inline and let the user pick from the global list.
  // (Filtering at submit time is the simpler correct path — see
  // memberIDs below.)
  const serverMemberIDs = useMemo(
    () => new Set(serverMembers.map(m => m._id)),
    [serverMembers],
  );

  const reset = useCallback(() => {
    setName('');
    setKind('text');
    setIsPrivate(false);
    setMembers([]);
  }, []);

  const onSubmit = useCallback(async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    // Only forward picks that are already on the server roster — the
    // backend would reject foreign IDs anyway, and this matches the
    // webapp where the picker is scoped to servermemberslist.
    const filtered = members
      .map(m => m.id)
      .filter(id => serverMemberIDs.has(id));
    const ok = await CreateChannelRequest({
      serverID,
      groupName: name.trim(),
      privacy: isPrivate,
      type: kind,
      otherUsers: filtered,
    });
    setSaving(false);
    if (ok) {
      onCreated();
      reset();
      onClose();
    }
  }, [
    isPrivate,
    kind,
    members,
    name,
    onClose,
    onCreated,
    reset,
    saving,
    serverID,
    serverMemberIDs,
  ]);

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
            New channel
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
            placeholder="general"
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

          <Text style={[styles.fieldLabel, { color: palette.text3 }]}>
            TYPE
          </Text>
          <View style={styles.kindRow}>
            {(Object.keys(KIND_META) as ChannelKind[]).map(key => {
              const meta = KIND_META[key];
              const active = kind === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setKind(key)}
                  style={({ pressed }) => [
                    styles.kindOption,
                    {
                      borderColor: active ? palette.brand : palette.border,
                      backgroundColor: active
                        ? palette.brandSoft
                        : palette.input,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <CLIcon
                    n={meta.icon}
                    size={18}
                    color={active ? palette.brand : palette.text2}
                  />
                  <Text
                    style={[
                      styles.kindLabel,
                      { color: active ? palette.brand : palette.text },
                    ]}
                  >
                    {meta.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.kindHint, { color: palette.text3 }]}>
            {KIND_META[kind].hint}
          </Text>

          <View style={styles.privacyRow}>
            <View style={styles.privacyCopy}>
              <Text style={[styles.privacyTitle, { color: palette.text }]}>
                Private
              </Text>
              <Text
                style={[styles.privacyHint, { color: palette.text3 }]}
                numberOfLines={2}
              >
                Only invited members can see and access this channel.
              </Text>
            </View>
            <Switch
              value={isPrivate}
              onValueChange={setIsPrivate}
              trackColor={{ false: palette.border2, true: palette.brand }}
              thumbColor="#fff"
            />
          </View>

          {isPrivate ? (
            <>
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
                  <Text
                    style={[
                      styles.membersPlaceholder,
                      { color: palette.text3 },
                    ]}
                  >
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
                        <Text
                          style={[
                            styles.memberChipText,
                            { color: palette.brand },
                          ]}
                        >
                          {c.firstName}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
                <CLIcon
                  n="chevron-right"
                  size={18}
                  color={palette.text3}
                />
              </Pressable>
            </>
          ) : null}
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

  kindRow: { flexDirection: 'row', gap: 8 },
  kindOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingVertical: 10,
  },
  kindLabel: { fontSize: 13, fontWeight: '700' },
  kindHint: { fontSize: 11.5, lineHeight: 16, marginTop: 4 },

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
