/* CreatePageModal — scoped port of
 * webapp/src/app/tabs/pages/partials/CreatePage.tsx.
 *
 * Fields:
 *   - name (required)
 *   - description
 *   - email (required for verification)
 *   - slug (required, the realm's URL handle)
 *   - profile photo (required, image picker)
 *   - cover photo (required, image picker)
 *   - admins (optional ContactPicker multi-select)
 *
 * Submits via CreatePageRequest (FormData multipart). */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
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
import { CreatePageRequest } from '../../../reusables/hooks/requests';
import { pickImages, PickedMedia } from '../../../reusables/hooks/imagePicker';

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}

function fileFromPicked(p: PickedMedia, fallbackName: string) {
  return {
    uri: p.uri ?? '',
    type: p.mime ?? 'image/jpeg',
    name: p.name || fallbackName,
  };
}

export function CreatePageModal({ visible, onClose, onCreated }: Props) {
  const { palette } = useTheme();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [slug, setSlug] = useState('');
  const [profile, setProfile] = useState<PickedMedia | null>(null);
  const [cover, setCover] = useState<PickedMedia | null>(null);
  const [admins, setAdmins] = useState<ContactPickerItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickingTarget, setPickingTarget] = useState<
    null | 'profile' | 'cover'
  >(null);
  const [saving, setSaving] = useState(false);

  const reset = useCallback(() => {
    setName('');
    setDescription('');
    setEmail('');
    setSlug('');
    setProfile(null);
    setCover(null);
    setAdmins([]);
  }, []);

  const pickImage = useCallback(
    async (target: 'profile' | 'cover') => {
      if (pickingTarget || saving) return;
      setPickingTarget(target);
      const picked = await pickImages({ selectionLimit: 1, mediaType: 'photo' });
      setPickingTarget(null);
      if (picked.length === 0) return;
      // Need the raw uri for multipart upload — pickImages now
      // exposes it. If it's missing for some reason (unusual asset
      // provider), bail rather than send an unusable ref.
      if (!picked[0].uri) return;
      if (target === 'profile') setProfile(picked[0]);
      else setCover(picked[0]);
    },
    [pickingTarget, saving],
  );

  const canSubmit =
    name.trim().length > 0 &&
    slug.trim().length > 0 &&
    email.trim().length > 0 &&
    !!profile &&
    !!cover &&
    !saving;

  const onSubmit = useCallback(async () => {
    if (!canSubmit || !profile || !cover) return;
    setSaving(true);
    const ok = await CreatePageRequest({
      pageName: name.trim(),
      pageDescription: description.trim(),
      email: email.trim(),
      slug: slug.trim(),
      otherUsers: admins.map(a => a.id),
      profile: fileFromPicked(profile, 'profile.jpg'),
      cover_photo: fileFromPicked(cover, 'cover.jpg'),
    });
    setSaving(false);
    if (ok) {
      onCreated();
      reset();
      onClose();
    }
  }, [
    admins,
    canSubmit,
    cover,
    description,
    email,
    name,
    onClose,
    onCreated,
    profile,
    reset,
    slug,
  ]);

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
            New page
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

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.body}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
        >
          <ScrollView contentContainerStyle={styles.scroll}>
            {/* Cover banner with overlapping profile avatar — both are
                tappable and render the picked image when present. */}
            <Pressable
              onPress={() => pickImage('cover')}
              disabled={!!pickingTarget || saving}
              style={[
                styles.coverSlot,
                { backgroundColor: palette.surface2 },
              ]}
            >
              {cover?.uri ? (
                <Image
                  source={{ uri: cover.uri }}
                  style={StyleSheet.absoluteFill as never}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.coverEmpty}>
                  <CLIcon n="add-photo-alternate" size={22} color={palette.text2} />
                  <Text style={[styles.coverHint, { color: palette.text2 }]}>
                    Add cover photo
                  </Text>
                </View>
              )}
              {pickingTarget === 'cover' ? (
                <View style={styles.busyOverlay}>
                  <ActivityIndicator color="#fff" />
                </View>
              ) : null}
            </Pressable>

            <Pressable
              onPress={() => pickImage('profile')}
              disabled={!!pickingTarget || saving}
              style={[
                styles.profileSlot,
                {
                  borderColor: palette.bg,
                  backgroundColor: palette.brandSoft,
                },
              ]}
            >
              {profile?.uri ? (
                <Image
                  source={{ uri: profile.uri }}
                  style={styles.profileImg}
                  resizeMode="cover"
                />
              ) : (
                <CLIcon
                  n="add-a-photo"
                  size={24}
                  color={palette.brand}
                />
              )}
              {pickingTarget === 'profile' ? (
                <View style={[styles.busyOverlay, styles.profileBusy]}>
                  <ActivityIndicator color="#fff" size="small" />
                </View>
              ) : null}
            </Pressable>

            <View style={styles.fields}>
              <Text style={[styles.fieldLabel, { color: palette.text3 }]}>
                NAME
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your page's name"
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
                SLUG
              </Text>
              <TextInput
                value={slug}
                onChangeText={t =>
                  setSlug(t.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase())
                }
                placeholder="url-handle"
                placeholderTextColor={palette.text3}
                autoCapitalize="none"
                style={[
                  styles.input,
                  {
                    color: palette.text,
                    backgroundColor: palette.input,
                    borderColor: palette.border,
                  },
                ]}
              />
              <Text style={[styles.fieldHint, { color: palette.text3 }]}>
                Used in the page's URL — lowercase letters, numbers,
                dashes, underscores only.
              </Text>

              <Text style={[styles.fieldLabel, { color: palette.text3 }]}>
                EMAIL
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="contact@page.com"
                placeholderTextColor={palette.text3}
                keyboardType="email-address"
                autoCapitalize="none"
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
                DESCRIPTION
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="What is this page about?"
                placeholderTextColor={palette.text3}
                multiline
                style={[
                  styles.descriptionInput,
                  {
                    color: palette.text,
                    backgroundColor: palette.input,
                    borderColor: palette.border,
                  },
                ]}
              />

              <Text style={[styles.fieldLabel, { color: palette.text3 }]}>
                ADMINS
              </Text>
              <Pressable
                onPress={() => setPickerOpen(true)}
                disabled={saving}
                style={({ pressed }) => [
                  styles.adminsRow,
                  {
                    backgroundColor: palette.input,
                    borderColor: palette.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                {admins.length === 0 ? (
                  <Text
                    style={[
                      styles.adminsPlaceholder,
                      { color: palette.text3 },
                    ]}
                  >
                    Add co-admins (optional)
                  </Text>
                ) : (
                  <View style={styles.adminChipRow}>
                    {admins.map(c => (
                      <View
                        key={c.id}
                        style={[
                          styles.adminChip,
                          { backgroundColor: palette.brandSoft },
                        ]}
                      >
                        <Text
                          style={[
                            styles.adminChipText,
                            { color: palette.brand },
                          ]}
                        >
                          {c.firstName}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
                <CLIcon n="chevron-right" size={18} color={palette.text3} />
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        <ContactPicker
          mode="multi"
          visible={pickerOpen}
          value={admins}
          onChange={setAdmins}
          onClose={() => setPickerOpen(false)}
          title="Pick co-admins"
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1 },

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

  scroll: { paddingBottom: 24 },

  coverSlot: {
    width: '100%',
    height: 140,
    overflow: 'hidden',
    position: 'relative',
  },
  coverEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  coverHint: { fontSize: 12, fontWeight: '600' },
  busyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  profileSlot: {
    width: 84,
    height: 84,
    borderRadius: 999,
    borderWidth: 4,
    alignSelf: 'center',
    marginTop: -42,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profileImg: { width: '100%', height: '100%' },
  profileBusy: { borderRadius: 999 },

  fields: { padding: 16, gap: 6 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 12,
  },
  fieldHint: { fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  input: {
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  descriptionInput: {
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
    lineHeight: 20,
  },

  adminsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
  adminsPlaceholder: { flex: 1, fontSize: 14 },
  adminChipRow: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  adminChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  adminChipText: { fontSize: 11, fontWeight: '700' },
});
