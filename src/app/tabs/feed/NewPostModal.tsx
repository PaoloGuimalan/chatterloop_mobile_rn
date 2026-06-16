/* New-post composer — scoped port of
 * webapp/src/app/widgets/modals/CreatePost/NewPostModal.tsx (422 lines).
 *
 * Supports: caption, image/video attachments via pickImages, a
 * public/friends/filtered privacy selector (with filtered audience
 * picker), and a contact tagging picker. References are sent inline
 * as base64 data URLs in the CreatePostRequest payload — the unchanged
 * backend persists them.
 *
 * The screen is registered as a regular stack screen with a presentation
 * sheet animation; the previous screen reads the success result via a
 * navigation callback (`onPosted`) passed in route.params. */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';

import type { AppState } from '../../../redux/store';
import { useTheme } from '../../../reusables/design/ThemeProvider';
import { CLIcon, IconBtn } from '../../../reusables/design/primitives';
import {
  ContactPicker,
  ContactPickerItem,
} from '../../../reusables/design/ContactPicker';
import { radii } from '../../../reusables/design/tokens';
import { CreatePostRequest } from '../../../reusables/hooks/requests';
import { pickImages } from '../../../reusables/hooks/imagePicker';
import { SET_ALERTS } from '../../../redux/types';

interface MediaItem {
  id: number;
  name: string | null;
  reference: string;
  caption: string;
  referenceMediaType: 'image' | 'video';
}

type Privacy = 'public' | 'friends' | 'filtered';

const PRIVACY_META: Record<
  Privacy,
  { label: string; icon: string; description: string }
> = {
  public: {
    label: 'Public',
    icon: 'public',
    description: 'Anyone on Chatterloop can see this post.',
  },
  friends: {
    label: 'Friends',
    icon: 'group',
    description: 'Only people in your contacts will see this post.',
  },
  filtered: {
    label: 'Selected',
    icon: 'filter-list',
    description: 'Only a specific list of users you choose.',
  },
};

interface NewPostModalParams {
  /** Optional callback fired after a successful post. The Feed wires
   *  this to its own refetch so the new post shows up immediately. */
  onPosted?: () => void;
  /** Optional realm context — when set, the post is published on that
   *  page's feed rather than the global one. Passed straight through
   *  to CreatePostRequest. */
  realm_id?: string | null;
  /** Human-readable page name, shown in the privacy/identity row so
   *  the author sees where the post is going. */
  realm_name?: string;
}

export default function NewPostModal() {
  const { palette } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  // Memoize so the `?? {}` fallback doesn't churn the deps of the
  // post-success useCallback below on every render.
  const params = useMemo<NewPostModalParams>(
    () => (route.params ?? {}) as NewPostModalParams,
    [route.params],
  );
  const dispatch = useDispatch();
  const authentication = useSelector((s: AppState) => s.authentication);
  const alerts = useSelector((s: AppState) => s.alerts);

  const [caption, setCaption] = useState('');
  const [posting, setPosting] = useState(false);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [picking, setPicking] = useState(false);
  const [privacy, setPrivacy] = useState<'public' | 'friends' | 'filtered'>(
    'public',
  );
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [tagged, setTagged] = useState<ContactPickerItem[]>([]);
  const [audience, setAudience] = useState<ContactPickerItem[]>([]);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [audiencePickerOpen, setAudiencePickerOpen] = useState(false);

  const selectPrivacy = useCallback((next: Privacy) => {
    setPrivacy(next);
    setPrivacyOpen(false);
    // Tapping "Selected" should immediately open the audience picker —
    // matching the webapp UX where the privacy choice and the audience
    // selection are bundled.
    if (next === 'filtered') {
      setAudiencePickerOpen(true);
    }
  }, []);

  const onAddMedia = useCallback(async () => {
    if (picking || posting) return;
    setPicking(true);
    const picked = await pickImages({ selectionLimit: 0, mediaType: 'mixed' });
    setPicking(false);
    if (picked.length === 0) return;
    setMedia((prev) => {
      const startId = prev.length;
      return [
        ...prev,
        ...picked.map((p, i) => ({
          id: startId + i + 1,
          name: p.name,
          reference: p.base,
          caption: '',
          referenceMediaType: p.type,
        })),
      ];
    });
  }, [picking, posting]);

  const removeMedia = useCallback((id: number) => {
    setMedia((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const me = authentication.user;
  const meHasProfile = me?.profile && me.profile !== 'none';
  const meInitial = me?.fullName?.firstName?.charAt(0)?.toUpperCase() ?? '?';
  const fullName = [
    me?.fullName?.firstName,
    me?.fullName?.middleName && me?.fullName?.middleName !== 'N/A'
      ? me.fullName.middleName
      : null,
    me?.fullName?.lastName,
  ]
    .filter(Boolean)
    .join(' ');

  const onClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const onPost = useCallback(async () => {
    const text = caption.trim();
    if ((!text && media.length === 0) || posting) return;
    setPosting(true);
    const ok = await CreatePostRequest({
      caption: text,
      references: media.length > 0 ? media : undefined,
      privacy_status: privacy,
      privacy_users:
        privacy === 'filtered' ? audience.map((c) => c.id) : undefined,
      tagging_users:
        tagged.length > 0 ? tagged.map((c) => c.username) : undefined,
      realm_id: params.realm_id ?? null,
    });
    setPosting(false);
    if (ok) {
      dispatch({
        type: SET_ALERTS,
        payload: {
          alerts: {
            id: alerts.length,
            type: 'success',
            content: 'Your post has been saved',
          },
        },
      });
      setMedia([]);
      setTagged([]);
      setAudience([]);
      params.onPosted?.();
      navigation.goBack();
    } else {
      dispatch({
        type: SET_ALERTS,
        payload: {
          alerts: {
            id: alerts.length,
            type: 'error',
            content: "Couldn't save the post. Try again.",
          },
        },
      });
    }
  }, [
    alerts.length,
    audience,
    caption,
    dispatch,
    media,
    navigation,
    params,
    posting,
    privacy,
    tagged,
  ]);

  // Auto-focus matters more on a modal-style screen than on a tab.
  const [autoFocus, setAutoFocus] = useState(false);
  useEffect(() => {
    // Small delay so the screen-enter animation finishes before the
    // keyboard pops, which is gentler on Android.
    const t = setTimeout(() => setAutoFocus(true), 150);
    return () => clearTimeout(t);
  }, []);

  return (
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
          New post
        </Text>
        <Pressable
          disabled={(!caption.trim() && media.length === 0) || posting}
          onPress={onPost}
          style={({ pressed }) => [
            styles.postBtn,
            {
              backgroundColor: palette.brand,
              opacity:
                (!caption.trim() && media.length === 0) || posting
                  ? 0.5
                  : pressed
                    ? 0.85
                    : 1,
            },
          ]}
        >
          {posting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.postBtnText}>Post</Text>
          )}
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.body}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <View style={styles.identityRow}>
          {meHasProfile ? (
            <Image
              source={{ uri: me.profile }}
              style={styles.identityAvatar}
            />
          ) : (
            <View
              style={[
                styles.identityAvatar,
                styles.avatarFallback,
                { backgroundColor: palette.brandSoft },
              ]}
            >
              <Text style={[styles.identityInitial, { color: palette.brand }]}>
                {meInitial}
              </Text>
            </View>
          )}
          <View style={styles.identityCopy}>
            <Text
              numberOfLines={1}
              style={[styles.identityName, { color: palette.text }]}
            >
              {fullName || me?.username || 'You'}
            </Text>
            {params.realm_name ? (
              <View style={styles.realmContextRow}>
                <CLIcon
                  n="auto-stories"
                  size={11}
                  color={palette.brand}
                />
                <Text
                  numberOfLines={1}
                  style={[styles.realmContextText, { color: palette.brand }]}
                >
                  Posting to {params.realm_name}
                </Text>
              </View>
            ) : null}
            <Pressable
              onPress={() => setPrivacyOpen(true)}
              style={({ pressed }) => [
                styles.privacyChip,
                {
                  backgroundColor: palette.surface2,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <CLIcon
                n={PRIVACY_META[privacy].icon}
                size={12}
                color={palette.text2}
              />
              <Text style={[styles.privacyText, { color: palette.text2 }]}>
                {PRIVACY_META[privacy].label}
                {privacy === 'filtered' && audience.length > 0
                  ? ` · ${audience.length}`
                  : ''}
              </Text>
              <CLIcon
                n="keyboard-arrow-down"
                size={14}
                color={palette.text3}
              />
            </Pressable>
            {privacy === 'filtered' ? (
              <Pressable
                onPress={() => setAudiencePickerOpen(true)}
                style={({ pressed }) => [
                  styles.audienceEditBtn,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Text
                  style={[styles.audienceEditText, { color: palette.brand }]}
                >
                  {audience.length === 0 ? 'Add audience' : 'Edit audience'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <TextInput
          value={caption}
          onChangeText={setCaption}
          autoFocus={autoFocus}
          placeholder="Share something with your loop…"
          placeholderTextColor={palette.text3}
          multiline
          style={[styles.captionInput, { color: palette.text }]}
        />

        {media.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.previewRow}
          >
            {media.map((m) => (
              <View key={m.id} style={styles.previewThumbWrap}>
                <Image
                  source={{ uri: m.reference }}
                  style={[
                    styles.previewThumb,
                    { backgroundColor: palette.surface2 },
                  ]}
                />
                {m.referenceMediaType === 'video' ? (
                  <View style={styles.previewVideoBadge}>
                    <CLIcon n="play-arrow" size={14} color="#fff" />
                  </View>
                ) : null}
                <Pressable
                  hitSlop={8}
                  onPress={() => removeMedia(m.id)}
                  style={({ pressed }) => [
                    styles.previewRemove,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <CLIcon n="close" size={14} color="#fff" />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : null}

        <View style={[styles.toolbar, { borderTopColor: palette.border }]}>
          <Pressable
            onPress={onAddMedia}
            disabled={picking || posting}
            style={({ pressed }) => [
              styles.toolBtn,
              { opacity: picking || posting ? 0.4 : pressed ? 0.6 : 1 },
            ]}
          >
            {picking ? (
              <ActivityIndicator size="small" color={palette.green} />
            ) : (
              <CLIcon n="image" size={20} color={palette.green} />
            )}
            <Text style={[styles.toolLabel, { color: palette.text2 }]}>
              Photo
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setTagPickerOpen(true)}
            disabled={posting}
            style={({ pressed }) => [
              styles.toolBtn,
              { opacity: posting ? 0.4 : pressed ? 0.6 : 1 },
            ]}
          >
            <CLIcon n="alternate-email" size={18} color={palette.text2} />
            <Text style={[styles.toolLabel, { color: palette.text2 }]}>
              Tag{tagged.length > 0 ? ` · ${tagged.length}` : ''}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Modal
        transparent
        visible={privacyOpen}
        animationType="fade"
        onRequestClose={() => setPrivacyOpen(false)}
      >
        <Pressable
          style={styles.privacyBackdrop}
          onPress={() => setPrivacyOpen(false)}
        >
          <View
            style={[
              styles.privacyCard,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
              },
            ]}
          >
            <Text style={[styles.privacyCardTitle, { color: palette.text }]}>
              Who can see this post?
            </Text>
            {(Object.keys(PRIVACY_META) as Privacy[]).map((key) => {
              const meta = PRIVACY_META[key];
              const selected = privacy === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => selectPrivacy(key)}
                  style={({ pressed }) => [
                    styles.privacyOption,
                    {
                      backgroundColor: pressed
                        ? palette.surface2
                        : 'transparent',
                    },
                  ]}
                >
                  <CLIcon n={meta.icon} size={20} color={palette.text2} />
                  <View style={styles.privacyOptionCopy}>
                    <Text
                      style={[styles.privacyOptionLabel, { color: palette.text }]}
                    >
                      {meta.label}
                    </Text>
                    <Text
                      style={[styles.privacyOptionDesc, { color: palette.text3 }]}
                    >
                      {meta.description}
                    </Text>
                  </View>
                  {selected ? (
                    <CLIcon n="check" size={18} color={palette.brand} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      <ContactPicker
        mode="multi"
        visible={tagPickerOpen}
        value={tagged}
        onChange={setTagged}
        onClose={() => setTagPickerOpen(false)}
        title="Tag contacts"
      />
      <ContactPicker
        mode="multi"
        visible={audiencePickerOpen}
        value={audience}
        onChange={setAudience}
        onClose={() => setAudiencePickerOpen(false)}
        title="Who can see this post?"
      />
    </SafeAreaView>
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
  postBtn: {
    paddingHorizontal: 16,
    height: 32,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  postBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  identityAvatar: { width: 44, height: 44, borderRadius: radii.pill },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  identityInitial: { fontSize: 16, fontWeight: '800' },
  identityCopy: { flex: 1, minWidth: 0, gap: 4 },
  identityName: { fontSize: 14, fontWeight: '700' },
  privacyChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    height: 22,
    borderRadius: radii.pill,
  },
  privacyText: { fontSize: 11, fontWeight: '600' },
  audienceEditBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  audienceEditText: { fontSize: 11, fontWeight: '700' },
  realmContextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  realmContextText: { fontSize: 11, fontWeight: '700' },

  captionInput: {
    flex: 1,
    minHeight: 120,
    paddingHorizontal: 16,
    paddingTop: 8,
    fontSize: 16,
    lineHeight: 22,
    textAlignVertical: 'top',
  },

  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    gap: 4,
  },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: radii.sm,
  },
  toolLabel: { fontSize: 13, fontWeight: '600' },

  previewRow: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 8,
    flexDirection: 'row',
  },
  previewThumbWrap: {
    position: 'relative',
    width: 90,
    height: 90,
  },
  previewThumb: {
    width: '100%',
    height: '100%',
    borderRadius: radii.sm,
  },
  previewVideoBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  privacyBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  privacyCard: {
    borderTopWidth: 1,
    borderRadius: radii.lg,
    padding: 16,
    gap: 6,
  },
  privacyCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  privacyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: radii.sm,
  },
  privacyOptionCopy: { flex: 1, gap: 2 },
  privacyOptionLabel: { fontSize: 14, fontWeight: '700' },
  privacyOptionDesc: { fontSize: 12 },
});
