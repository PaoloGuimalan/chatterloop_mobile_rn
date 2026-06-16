/* ContactPicker — searchable contact modal for tagging, filtered
 * privacy audiences, group invite, etc. Single- and multi-select.
 *
 * Reads from the redux `contactslist` slice (already populated on app
 * boot and kept fresh via SSE). The picker does client-side filtering
 * against the cached list — sufficient for typical contact counts.
 * If the list ever grows large, swap to server-side search via
 * ContactsListInitRequest's `search` arg. */

import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

import type { AppState } from '../../redux/store';
import { useTheme } from './ThemeProvider';
import { CLIcon, IconBtn } from './primitives';
import { radii } from './tokens';
import {
  IContact,
  PaginationProp,
} from '../vars/interfaces';

export interface ContactPickerItem {
  id: string;
  username: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  profile: string;
  isBadged?: boolean;
}

interface BaseProps {
  visible: boolean;
  onClose: () => void;
  /** Header label; defaults to "Pick contacts" / "Pick a contact". */
  title?: string;
}

type Props = BaseProps &
  (
    | {
        mode: 'multi';
        value: ContactPickerItem[];
        onChange: (next: ContactPickerItem[]) => void;
      }
    | {
        mode: 'single';
        value: ContactPickerItem | null;
        onChange: (next: ContactPickerItem | null) => void;
      }
  );

function contactsToItems(
  contacts: PaginationProp<IContact>,
  me: string,
): ContactPickerItem[] {
  return (contacts.results ?? []).flatMap((c) => {
    if (c.type !== 'single') return [];
    if (!c.involved_user || !c.action_by) return [];
    const u = c.action_by.id === me ? c.involved_user : c.action_by;
    return [
      {
        id: u.id,
        username: u.username,
        firstName: u.first_name,
        middleName: u.middle_name,
        lastName: u.last_name,
        profile: u.profile,
        isBadged: u.is_badged,
      },
    ];
  });
}

function fullName(c: ContactPickerItem): string {
  const middle =
    c.middleName && c.middleName !== 'N/A' ? ` ${c.middleName}` : '';
  return `${c.firstName}${middle} ${c.lastName}`.trim();
}

export function ContactPicker(props: Props) {
  const { palette } = useTheme();
  const contacts = useSelector(
    (s: AppState) => s.contactslist as PaginationProp<IContact>,
  );
  const me = useSelector((s: AppState) => s.authentication.user.userID);

  const [search, setSearch] = useState('');

  const items = useMemo(() => contactsToItems(contacts, me), [contacts, me]);

  const selectedIds = useMemo(() => {
    if (props.mode === 'multi') {
      return new Set(props.value.map((v) => v.id));
    }
    return new Set(props.value ? [props.value.id] : []);
  }, [props.mode, props.value]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((c) => {
      return (
        c.username.toLowerCase().includes(q) ||
        fullName(c).toLowerCase().includes(q)
      );
    });
  }, [items, search]);

  const togglePick = (item: ContactPickerItem) => {
    if (props.mode === 'multi') {
      const exists = selectedIds.has(item.id);
      const next = exists
        ? props.value.filter((v) => v.id !== item.id)
        : [...props.value, item];
      props.onChange(next);
    } else {
      const exists = selectedIds.has(item.id);
      props.onChange(exists ? null : item);
      props.onClose();
    }
  };

  const headerTitle =
    props.title ?? (props.mode === 'multi' ? 'Pick contacts' : 'Pick a contact');

  return (
    <Modal
      visible={props.visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={props.onClose}
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
            onPress={props.onClose}
          />
          <Text style={[styles.headerTitle, { color: palette.text }]}>
            {headerTitle}
          </Text>
          {props.mode === 'multi' ? (
            <Pressable
              onPress={props.onClose}
              style={({ pressed }) => [
                styles.doneBtn,
                {
                  backgroundColor: palette.brand,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={styles.doneBtnText}>
                Done{props.value.length > 0 ? ` · ${props.value.length}` : ''}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.doneSpacer} />
          )}
        </View>

        <View
          style={[
            styles.searchRow,
            {
              backgroundColor: palette.input,
              borderColor: palette.border,
            },
          ]}
        >
          <CLIcon n="search" size={16} color={palette.text3} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search contacts"
            placeholderTextColor={palette.text3}
            style={[styles.searchInput, { color: palette.text }]}
          />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => {
            const selected = selectedIds.has(item.id);
            const hasProfile = item.profile && item.profile !== 'none';
            return (
              <Pressable
                onPress={() => togglePick(item)}
                style={({ pressed }) => [
                  styles.row,
                  {
                    borderBottomColor: palette.border,
                    backgroundColor: pressed ? palette.surface2 : 'transparent',
                  },
                ]}
              >
                {hasProfile ? (
                  <Image
                    source={{ uri: item.profile }}
                    style={[
                      styles.avatar,
                      { backgroundColor: palette.brandSoft },
                    ]}
                  />
                ) : (
                  <View
                    style={[
                      styles.avatar,
                      styles.avatarFallback,
                      { backgroundColor: palette.brandSoft },
                    ]}
                  >
                    <Text style={[styles.avatarInitial, { color: palette.brand }]}>
                      {item.firstName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.rowCopy}>
                  <View style={styles.nameRow}>
                    <Text
                      numberOfLines={1}
                      style={[styles.name, { color: palette.text }]}
                    >
                      {fullName(item)}
                    </Text>
                    {item.isBadged ? (
                      <CLIcon n="verified" size={14} color={palette.brand} />
                    ) : null}
                  </View>
                  <Text style={[styles.handle, { color: palette.text3 }]}>
                    @{item.username}
                  </Text>
                </View>
                {selected ? (
                  <CLIcon n="check" size={20} color={palette.brand} />
                ) : (
                  <View style={styles.checkSpacer} />
                )}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: palette.text3 }]}>
                {search ? 'No matches' : 'No contacts yet'}
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },

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
  doneBtn: {
    paddingHorizontal: 16,
    height: 32,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  doneBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  doneSpacer: { width: 0, height: 32 },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: { width: 40, height: 40, borderRadius: radii.pill },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 15, fontWeight: '800' },
  rowCopy: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { fontSize: 14, fontWeight: '700' },
  handle: { fontSize: 12 },
  checkSpacer: { width: 20, height: 20 },

  empty: { paddingTop: 40, alignItems: 'center' },
  emptyText: { fontSize: 13, fontWeight: '600' },
});
