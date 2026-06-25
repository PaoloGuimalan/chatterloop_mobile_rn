/* eslint-disable react-native/no-inline-styles */
/* ManageRealm — port of webapp/src/app/tabs/realms/manage/ManageRealm.tsx
 * plus its tab views (Dashboard/Details/Media/Members/Followers).
 *
 * The web build uses a left sidebar to switch tab routes; on mobile we
 * use a horizontal segmented control. Reached from PageDetail when the
 * viewer is an admin of the realm. Dashboard is a placeholder on web
 * ("currently unavailable"), so it's omitted here — the functional tabs
 * are Details, Media, Members, and (pages only) Followers. */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';

import type { AppState } from '../../../redux/store';
import { useTheme } from '../../../reusables/design/ThemeProvider';
import { Btn, CLIcon, Field, IconBtn } from '../../../reusables/design/primitives';
import { radii } from '../../../reusables/design/tokens';
import {
  ContactPicker,
  ContactPickerItem,
} from '../../../reusables/design/ContactPicker';
import { formattedDateToWords } from '../../../reusables/hooks/reusable';
import {
  AddNewMemberRequest,
  AddNewMemberToServer,
  GetRealmFollowersRequest,
  GetRealmMembersRequest,
  RealmFollower,
  RealmManageInfo,
  RealmMember,
  RemoveRealmFollowersRequest,
  RemoveRealmMemberRequest,
  UpdateMemberRoleRequest,
  UpdateRealmMediaRequest,
  UpdateRealmRequest,
} from '../../../reusables/hooks/requests';
import { pickImages } from '../../../reusables/hooks/imagePicker';
import { SET_ALERTS } from '../../../redux/types';

type Segment = 'details' | 'media' | 'members' | 'followers';

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Shallow diff — keys whose value changed between `base` and `next`. */
function changedFields(
  base: Record<string, unknown>,
  next: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  Object.keys(next).forEach(k => {
    if (next[k] !== base[k]) out[k] = next[k];
  });
  return out;
}

function realmTypeLabel(realm: RealmManageInfo): string {
  return realm.type === 'group' && realm.parent ? 'channel' : realm.type;
}

function accountName(a: {
  first_name: string;
  middle_name?: string;
  last_name: string;
}): string {
  const middle =
    a.middle_name && a.middle_name !== 'N/A' ? ` ${a.middle_name}` : '';
  return `${a.first_name}${middle} ${a.last_name}`.trim();
}

export default function ManageRealm() {
  const { palette } = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const initialRealm = (route.params as { realm: RealmManageInfo }).realm;

  const [realm, setRealm] = useState<RealmManageInfo>(initialRealm);
  const isPage = realm.type === 'page';
  const [segment, setSegment] = useState<Segment>('details');

  const segments = useMemo(() => {
    const base: { key: Segment; label: string; icon: string }[] = [
      { key: 'details', label: 'Details', icon: 'tune' },
      { key: 'media', label: 'Media', icon: 'image' },
      { key: 'members', label: 'Members', icon: 'group' },
    ];
    if (isPage) {
      base.push({ key: 'followers', label: 'Followers', icon: 'favorite' });
    }
    return base;
  }, [isPage]);

  const hasAvatar = realm.profile && realm.profile !== 'N/A' && realm.profile !== 'none';

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.screen, { backgroundColor: palette.bg }]}
    >
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <IconBtn n="arrow-back" iconSize={22} color={palette.text} onPress={() => nav.goBack()} />
        {hasAvatar ? (
          <Image source={{ uri: realm.profile as string }} style={styles.headerAvatar} />
        ) : (
          <View
            style={[
              styles.headerAvatar,
              styles.avatarFallback,
              { backgroundColor: palette.brandSoft },
            ]}
          >
            <Text style={[styles.headerInitial, { color: palette.brand }]}>
              {realm.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.headerTitleWrap}>
          <Text numberOfLines={1} style={[styles.headerTitle, { color: palette.text }]}>
            {realm.name}
          </Text>
          {realm.parent ? (
            <Text numberOfLines={1} style={[styles.headerSub, { color: palette.text2 }]}>
              {realm.parent.name}
            </Text>
          ) : (
            <Text style={[styles.headerSub, { color: palette.text2 }]}>
              Manage {realmTypeLabel(realm)}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.segmentRow}>
        {segments.map(seg => {
          const active = segment === seg.key;
          return (
            <Pressable
              key={seg.key}
              onPress={() => setSegment(seg.key)}
              style={[
                styles.segmentBtn,
                { backgroundColor: active ? palette.brandSoft : 'transparent' },
              ]}
            >
              <CLIcon
                n={seg.icon}
                size={16}
                color={active ? palette.brand : palette.text3}
              />
              <Text
                style={[
                  styles.segmentLabel,
                  { color: active ? palette.brand : palette.text3 },
                ]}
              >
                {seg.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {segment === 'details' ? (
        <DetailsTab realm={realm} onSaved={setRealm} />
      ) : segment === 'media' ? (
        <MediaTab realm={realm} onChanged={setRealm} />
      ) : segment === 'members' ? (
        <MembersTab realm={realm} />
      ) : (
        <FollowersTab realm={realm} />
      )}
    </SafeAreaView>
  );
}

// ---- Details ---------------------------------------------------------------

function DetailsTab({
  realm,
  onSaved,
}: {
  realm: RealmManageInfo;
  onSaved: (r: RealmManageInfo) => void;
}) {
  const { palette } = useTheme();
  const dispatch = useDispatch();
  const alerts = useSelector((s: AppState) => s.alerts);

  const [draft, setDraft] = useState<RealmManageInfo>(realm);
  const [saving, setSaving] = useState(false);
  const [slugError, setSlugError] = useState(false);

  const preset = useMemo(() => {
    const formPreset: Record<string, string[]> = {
      group: ['name', 'privacy'],
      channel: ['name'],
      voice: ['name'],
      page: ['name', 'description', 'email', 'slug'],
      server: ['name', 'description', 'privacy'],
    };
    const isChannel = draft.type === 'group' && draft.parent;
    return formPreset[isChannel ? 'channel' : draft.type] ?? ['name'];
  }, [draft]);

  const diff = useMemo(
    () =>
      changedFields(
        realm as Record<string, unknown>,
        draft as Record<string, unknown>,
      ),
    [realm, draft],
  );

  const onSave = async () => {
    setSlugError(false);
    setSaving(true);
    try {
      await UpdateRealmRequest(draft.realm_id, diff);
      onSaved(draft);
      dispatch({
        type: SET_ALERTS,
        payload: {
          alerts: { id: alerts.length, type: 'success', content: 'Saved' },
        },
      });
    } catch (err: any) {
      if (err?.message?.includes('Slug already exists')) {
        setSlugError(true);
        dispatch({
          type: SET_ALERTS,
          payload: {
            alerts: {
              id: alerts.length,
              type: 'error',
              content: 'Slug provided already exists',
            },
          },
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.tabBody} keyboardShouldPersistTaps="handled">
      <Text style={[styles.tabTitle, { color: palette.text }]}>Profile Details</Text>
      <Text style={[styles.tabHint, { color: palette.text2 }]}>
        Manage your {realmTypeLabel(realm)} details. Keep information up to date.
      </Text>

      <View style={styles.formCard}>
        {preset.includes('name') ? (
          <Field
            label="Name"
            value={draft.name}
            editable={!saving}
            onChangeText={t => setDraft(p => ({ ...p, name: t }))}
            placeholder="Name"
          />
        ) : null}
        {preset.includes('slug') ? (
          <Field
            label="Slug"
            value={draft.slug ?? ''}
            editable={!saving}
            onChangeText={t => setDraft(p => ({ ...p, slug: t }))}
            placeholder="Slug"
            style={slugError ? { borderColor: palette.pink } : undefined}
          />
        ) : null}
        {preset.includes('email') ? (
          <Field
            label="Email"
            value={draft.email ?? ''}
            editable={!saving}
            keyboardType="email-address"
            autoCapitalize="none"
            onChangeText={t => setDraft(p => ({ ...p, email: t }))}
            placeholder="Email"
          />
        ) : null}
        {preset.includes('description') ? (
          <View>
            <Text style={[styles.fieldLabel, { color: palette.text2 }]}>
              Description
            </Text>
            <TextInput
              editable={!saving}
              value={draft.description ?? ''}
              onChangeText={t => setDraft(p => ({ ...p, description: t }))}
              placeholder="Description"
              placeholderTextColor={palette.text3}
              multiline
              style={[
                styles.textArea,
                {
                  backgroundColor: palette.input,
                  borderColor: palette.border,
                  color: palette.text,
                },
              ]}
            />
          </View>
        ) : null}
        {preset.includes('privacy') ? (
          <View style={styles.privacyRow}>
            <View style={styles.flex1}>
              <Text style={[styles.fieldLabel, { color: palette.text2 }]}>
                Privacy
              </Text>
              <Text style={[styles.privacyHint, { color: palette.text3 }]}>
                {draft.is_private ? 'Private' : 'Public'}
              </Text>
            </View>
            <Switch
              value={!!draft.is_private}
              disabled={saving}
              onValueChange={v => setDraft(p => ({ ...p, is_private: v }))}
              trackColor={{ false: palette.border2, true: palette.brand }}
              thumbColor="#fff"
            />
          </View>
        ) : null}

        <View style={styles.formActions}>
          <Btn
            label="Reset"
            variant="outline"
            disabled={saving || Object.keys(diff).length === 0}
            onPress={() => setDraft(realm)}
          />
          <Btn
            label={saving ? 'Saving…' : 'Save'}
            disabled={saving || Object.keys(diff).length === 0}
            onPress={onSave}
          />
        </View>
      </View>
    </ScrollView>
  );
}

// ---- Media -----------------------------------------------------------------

function MediaTab({
  realm,
  onChanged,
}: {
  realm: RealmManageInfo;
  onChanged: (r: RealmManageInfo) => void;
}) {
  const { palette } = useTheme();
  const showCover = realm.type !== 'group';

  return (
    <ScrollView contentContainerStyle={styles.tabBody}>
      <Text style={[styles.tabTitle, { color: palette.text }]}>Media</Text>
      <Text style={[styles.tabHint, { color: palette.text2 }]}>
        Manage your {realmTypeLabel(realm)} profile or cover photo.
      </Text>

      <MediaSlot
        realm={realm}
        mediaType="profile"
        label="Profile"
        current={realm.profile}
        aspectRatio={1}
        onChanged={onChanged}
      />
      {showCover ? (
        <MediaSlot
          realm={realm}
          mediaType="cover_photo"
          label="Cover Photo"
          current={realm.cover_photo}
          aspectRatio={16 / 9}
          onChanged={onChanged}
        />
      ) : null}
    </ScrollView>
  );
}

function MediaSlot({
  realm,
  mediaType,
  label,
  current,
  aspectRatio,
  onChanged,
}: {
  realm: RealmManageInfo;
  mediaType: 'profile' | 'cover_photo';
  label: string;
  current: string | null;
  aspectRatio: number;
  onChanged: (r: RealmManageInfo) => void;
}) {
  const { palette } = useTheme();
  const [picked, setPicked] = useState<{
    uri: string;
    name: string;
    mime: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const onPick = async () => {
    const result = await pickImages({ selectionLimit: 1, mediaType: 'photo' });
    if (result.length === 0) return;
    const p = result[0];
    setPicked({ uri: p.uri ?? '', name: p.name, mime: p.mime ?? 'image/jpeg' });
  };

  const onUpload = async () => {
    if (!picked) return;
    setSaving(true);
    const res = await UpdateRealmMediaRequest({
      realm_id: realm.realm_id,
      realm_type: realmTypeLabel(realm),
      media_type: mediaType,
      uri: picked.uri,
      name: picked.name,
      mime: picked.mime,
    });
    setSaving(false);
    if (res) {
      setPicked(null);
      onChanged(
        mediaType === 'profile'
          ? { ...realm, profile: res.url }
          : { ...realm, cover_photo: res.url },
      );
    }
  };

  const previewURI =
    picked?.uri ??
    (current && current !== 'N/A' && current !== 'none' ? current : null);

  return (
    <View style={styles.mediaBlock}>
      <Text style={[styles.mediaLabel, { color: palette.text }]}>{label}</Text>
      <View
        style={[
          styles.mediaCard,
          { backgroundColor: palette.surface, borderColor: palette.border },
        ]}
      >
        {previewURI ? (
          <Image
            source={{ uri: previewURI }}
            style={[styles.mediaPreview, { aspectRatio }]}
            resizeMode="cover"
          />
        ) : (
          <View
            style={[
              styles.mediaPreview,
              styles.mediaPlaceholder,
              { aspectRatio, backgroundColor: palette.surface2 },
            ]}
          >
            <CLIcon n="image" size={32} color={palette.text3} />
          </View>
        )}
        <View style={styles.mediaActions}>
          <Btn label="Select Image" variant="outline" disabled={saving} onPress={onPick} />
          {picked ? (
            <Btn
              label={saving ? 'Uploading…' : 'Upload'}
              disabled={saving}
              onPress={onUpload}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

// ---- Members ---------------------------------------------------------------

function MembersTab({ realm }: { realm: RealmManageInfo }) {
  const { palette } = useTheme();
  const [members, setMembers] = useState<RealmMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [picked, setPicked] = useState<ContactPickerItem[]>([]);
  const [adding, setAdding] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const label = realmTypeLabel(realm);
  const canAdd = !(
    (label === 'channel' || label === 'voice') &&
    !realm.is_private
  );

  const load = useCallback(
    async (searchValue: string) => {
      setLoading(true);
      const res = await GetRealmMembersRequest(realm.id, 1, 50, searchValue || null);
      setMembers(res.results);
      setLoading(false);
    },
    [realm.id],
  );

  useEffect(() => {
    load('');
  }, [load]);

  const onSearch = (text: string) => {
    setSearch(text);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => load(text.trim()), 450);
  };

  const memberOptions = useCallback(
    (m: RealmMember) => {
      const isAdmin = m.role === 'admin';
      const options: { text: string; onPress?: () => void; style?: 'destructive' | 'cancel' }[] = [
        {
          text: isAdmin ? 'Demote to Member' : 'Promote to Admin',
          onPress: async () => {
            const ok = await UpdateMemberRoleRequest(
              m.realm,
              m.member_id,
              isAdmin ? 'member' : 'admin',
            );
            if (ok) load(search.trim());
          },
        },
      ];
      if (canAdd) {
        options.push({
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const ok = await RemoveRealmMemberRequest(m.realm, [m.account.id]);
            if (ok) setMembers(prev => prev.filter(x => x.member_id !== m.member_id));
          },
        });
      }
      options.push({ text: 'Cancel', style: 'cancel' });
      Alert.alert(accountName(m.account), cap(m.role), options);
    },
    [canAdd, load, search],
  );

  const onAdd = async () => {
    if (picked.length === 0) return;
    setAdding(true);
    const memberstoadd = picked.map(p => ({
      id: p.id,
      userID: p.username,
      fullName: accountName({
        first_name: p.firstName,
        middle_name: p.middleName ?? undefined,
        last_name: p.lastName,
      }),
    }));
    const receivers = picked.map(p => p.id);
    // Servers and non-server realms use different add endpoints, matching
    // the webapp Members tab's server/non-server branch.
    const ok =
      realm.type === 'server'
        ? await AddNewMemberToServer({
            serverID: realm.realm_id,
            memberstoadd,
            receivers,
          })
        : await AddNewMemberRequest({
            conversationID: realm.realm_id,
            memberstoadd,
            receivers,
          });
    setAdding(false);
    if (ok) {
      setPicked([]);
      load(search.trim());
    }
  };

  return (
    <View style={styles.tabBodyFlex}>
      <Text style={[styles.tabTitle, { color: palette.text }]}>Members</Text>
      <Text style={[styles.tabHint, { color: palette.text2 }]}>
        Manage your {label} members and their roles.
      </Text>

      {canAdd ? (
        <View style={styles.addRow}>
          <Btn
            label={picked.length > 0 ? `Add ${picked.length} selected` : 'Pick members'}
            iconL="person-add"
            variant="outline"
            disabled={adding}
            onPress={() => setPickerOpen(true)}
            style={styles.flex1}
          />
          {picked.length > 0 ? (
            <Btn label={adding ? 'Adding…' : 'Add'} disabled={adding} onPress={onAdd} />
          ) : null}
        </View>
      ) : null}

      <View
        style={[
          styles.searchBox,
          { backgroundColor: palette.input, borderColor: palette.border },
        ]}
      >
        <CLIcon n="search" size={18} color={palette.text3} />
        <TextInput
          value={search}
          onChangeText={onSearch}
          placeholder="Search members"
          placeholderTextColor={palette.text3}
          autoCapitalize="none"
          style={[styles.searchInput, { color: palette.text }]}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.brand} />
        </View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={m => m.member_id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.center}>
              <CLIcon n="group" size={30} color={palette.text3} />
              <Text style={[styles.emptyText, { color: palette.text3 }]}>
                No members
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <PersonRow
              account={item.account}
              subtitle={cap(item.role)}
              actionIcon="more-vert"
              onAction={() => memberOptions(item)}
            />
          )}
        />
      )}

      <ContactPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        mode="multi"
        value={picked}
        onChange={setPicked}
        title="Add members"
      />
    </View>
  );
}

// ---- Followers -------------------------------------------------------------

function FollowersTab({ realm }: { realm: RealmManageInfo }) {
  const { palette } = useTheme();
  const [followers, setFollowers] = useState<RealmFollower[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (searchValue: string) => {
      setLoading(true);
      const res = await GetRealmFollowersRequest(
        realm.realm_id,
        1,
        20,
        searchValue || null,
      );
      setFollowers(res.results);
      setLoading(false);
    },
    [realm.realm_id],
  );

  useEffect(() => {
    load('');
  }, [load]);

  const onSearch = (text: string) => {
    setSearch(text);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => load(text.trim()), 450);
  };

  const remove = (f: RealmFollower) => {
    Alert.alert('Remove follower?', accountName(f.follower), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const ok = await RemoveRealmFollowersRequest(realm.realm_id, f.follow_id);
          if (ok) {
            setFollowers(prev => prev.filter(x => x.follow_id !== f.follow_id));
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.tabBodyFlex}>
      <Text style={[styles.tabTitle, { color: palette.text }]}>Followers</Text>
      <Text style={[styles.tabHint, { color: palette.text2 }]}>
        Manage, navigate, or remove followers.
      </Text>

      <View
        style={[
          styles.searchBox,
          { backgroundColor: palette.input, borderColor: palette.border },
        ]}
      >
        <CLIcon n="search" size={18} color={palette.text3} />
        <TextInput
          value={search}
          onChangeText={onSearch}
          placeholder="Search followers"
          placeholderTextColor={palette.text3}
          autoCapitalize="none"
          style={[styles.searchInput, { color: palette.text }]}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.brand} />
        </View>
      ) : (
        <FlatList
          data={followers}
          keyExtractor={f => f.follow_id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.center}>
              <CLIcon n="favorite-border" size={30} color={palette.text3} />
              <Text style={[styles.emptyText, { color: palette.text3 }]}>
                No followers
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <PersonRow
              account={item.follower}
              subtitle={`Following since ${formattedDateToWords(
                item.created_at,
                'YYYY-MM-DD',
              )}`}
              actionLabel="Remove"
              onAction={() => remove(item)}
            />
          )}
        />
      )}
    </View>
  );
}

// ---- Shared person row -----------------------------------------------------

function PersonRow({
  account,
  subtitle,
  actionLabel,
  actionIcon,
  onAction,
}: {
  account: RealmMember['account'];
  subtitle: string;
  actionLabel?: string;
  actionIcon?: string;
  onAction: () => void;
}) {
  const { palette } = useTheme();
  const nav = useNavigation<any>();
  const hasAvatar = account.profile && account.profile !== 'none';
  const openProfile = () =>
    nav.navigate('UserProfile', { userID: account.username });
  return (
    <View
      style={[
        styles.personRow,
        { backgroundColor: palette.surface2, borderColor: palette.border },
      ]}
    >
      <Pressable style={styles.personMain} onPress={openProfile}>
        {hasAvatar ? (
          <Image source={{ uri: account.profile }} style={styles.personAvatar} />
        ) : (
          <View
            style={[
              styles.personAvatar,
              styles.avatarFallback,
              { backgroundColor: palette.brandSoft },
            ]}
          >
            <Text style={[styles.personInitial, { color: palette.brand }]}>
              {account.first_name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.flex1}>
          <Text numberOfLines={1} style={[styles.personName, { color: palette.text }]}>
            {accountName(account)}
          </Text>
          <Text numberOfLines={1} style={[styles.personSub, { color: palette.text2 }]}>
            {subtitle}
          </Text>
        </View>
      </Pressable>
      {actionLabel ? (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [
            styles.removeBtn,
            { backgroundColor: palette.surface, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.removeText, { color: palette.text }]}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : (
        <IconBtn n={actionIcon ?? 'more-vert'} iconSize={20} color={palette.text2} onPress={onAction} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex1: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 6,
    paddingRight: 14,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  headerAvatar: { width: 38, height: 38, borderRadius: radii.pill },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  headerInitial: { fontSize: 15, fontWeight: '700' },
  headerTitleWrap: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  headerSub: { fontSize: 12, marginTop: 1 },

  segmentRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: radii.md,
  },
  segmentLabel: { fontSize: 12, fontWeight: '700' },

  tabBody: { padding: 16, gap: 14 },
  tabBodyFlex: { flex: 1, padding: 16, gap: 12 },
  tabTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  tabHint: { fontSize: 13.5, lineHeight: 19 },

  formCard: { gap: 16, marginTop: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  textArea: {
    minHeight: 120,
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  privacyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  privacyHint: { fontSize: 13 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },

  mediaBlock: { gap: 10 },
  mediaLabel: { fontSize: 15, fontWeight: '700' },
  mediaCard: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 16,
    gap: 16,
    alignItems: 'center',
  },
  mediaPreview: { width: '100%', borderRadius: radii.sm },
  mediaPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  mediaActions: { flexDirection: 'row', gap: 8 },

  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: radii.md,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 40 },
  emptyText: { fontSize: 13, fontWeight: '600' },
  listContent: { gap: 8, paddingBottom: 24 },

  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderWidth: 1,
    borderRadius: radii.md,
  },
  personMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  personAvatar: { width: 40, height: 40, borderRadius: radii.pill },
  personInitial: { fontSize: 15, fontWeight: '700' },
  personName: { fontSize: 14, fontWeight: '700' },
  personSub: { fontSize: 12, marginTop: 1 },
  removeBtn: {
    minWidth: 80,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  removeText: { fontSize: 12, fontWeight: '600' },
});
