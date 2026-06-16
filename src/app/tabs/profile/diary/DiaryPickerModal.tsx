/* Generic searchable picker for diary mood (single) and tags (multi).
 * Replaces the webapp's AsyncPaginate <Select>. Paginates against
 * GetMoodListRequest / GetTagsListRequest and supports "create new"
 * for tags when the search has no exact match. */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../../../../reusables/design/ThemeProvider';
import { CLIcon, IconBtn } from '../../../../reusables/design/primitives';
import { radii } from '../../../../reusables/design/tokens';
import {
  DiaryMood,
  DiaryTag,
  GetMoodListRequest,
  GetTagsListRequest,
} from '../../../../reusables/hooks/requests';

const PAGE_SIZE = 20;

type PickerMode =
  | { kind: 'mood'; value: DiaryMood | null; onChange: (m: DiaryMood | null) => void }
  | { kind: 'tags'; value: DiaryTag[]; onChange: (tags: DiaryTag[]) => void };

interface Props {
  visible: boolean;
  onClose: () => void;
  mode: PickerMode;
}

interface ListItem {
  id: number | string;
  label: string;
  emoji?: string;
  selected: boolean;
  isCreateNew?: boolean;
  /** Original raw mood/tag for selection callback. */
  raw?: DiaryMood | DiaryTag;
}

export default function DiaryPickerModal({ visible, onClose, mode }: Props) {
  const { palette } = useTheme();

  const title = mode.kind === 'mood' ? 'Pick a mood' : 'Pick tags';

  const [items, setItems] = useState<DiaryMood[] | DiaryTag[]>([]);
  const [page, setPage] = useState(1);
  const [next, setNext] = useState<string | null>(null);
  // Backend tells us whether the searched string has no existing match.
  // True → render the "Create new tag" CTA; false → hide it.
  const [searchIsNew, setSearchIsNew] = useState(false);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(
    async (p: number, q: string, append: boolean) => {
      setIsLoading(true);
      try {
        if (mode.kind === 'mood') {
          const res = await GetMoodListRequest(p, PAGE_SIZE);
          setItems((prev) =>
            append ? ([...(prev as DiaryMood[]), ...res.results] as DiaryMood[]) : res.results,
          );
          setNext(res.next);
        } else {
          const res = await GetTagsListRequest(p, PAGE_SIZE, q);
          const list = res.results.list;
          setItems((prev) =>
            append ? ([...(prev as DiaryTag[]), ...list] as DiaryTag[]) : list,
          );
          setNext(res.next);
          setSearchIsNew(res.results.is_new);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [mode.kind],
  );

  // Reset + reload when the modal opens (or search query changes for tags).
  useEffect(() => {
    if (!visible) return;
    setPage(1);
    load(1, search, false);
  }, [visible, search, load]);

  const onEndReached = useCallback(() => {
    if (isLoading || !next) return;
    const nextPage = page + 1;
    setPage(nextPage);
    load(nextPage, search, true);
  }, [isLoading, load, next, page, search]);

  const selectedSet = useMemo(() => {
    if (mode.kind === 'mood') {
      return new Set<number>(mode.value ? [mode.value.id] : []);
    }
    return new Set<number>(mode.value.map((t) => t.id));
  }, [mode]);

  const listItems = useMemo<ListItem[]>(() => {
    if (mode.kind === 'mood') {
      return (items as DiaryMood[]).map((m) => ({
        id: m.id,
        label: m.name,
        emoji: m.emoji,
        selected: selectedSet.has(m.id),
        raw: m,
      }));
    }
    const tagItems = (items as DiaryTag[]).map<ListItem>((t) => ({
      id: t.id,
      label: t.name,
      selected: selectedSet.has(t.id),
      raw: t,
    }));
    const q = search.trim();
    // Backend's `is_new` says "no exact match for this search" — surface
    // a create-new CTA only when both that flag is set and we have a query.
    if (q.length > 0 && searchIsNew) {
      tagItems.unshift({
        id: `new:${q}`,
        label: `Create "${q}" as new tag`,
        selected: false,
        isCreateNew: true,
      });
    }
    return tagItems;
  }, [items, mode.kind, search, searchIsNew, selectedSet]);

  const onPickItem = useCallback(
    (item: ListItem) => {
      if (mode.kind === 'mood') {
        const next = item.selected ? null : (item.raw as DiaryMood);
        mode.onChange(next);
        onClose();
        return;
      }
      // tags: toggle (or insert a new locally-created tag).
      if (item.isCreateNew) {
        const q = search.trim();
        // Use a negative id to mark client-only; backend assigns the real id.
        const newTag: DiaryTag = {
          id: -Date.now(),
          name: q,
          label: q,
          value: -Date.now(),
          is_new: true,
        };
        mode.onChange([...mode.value, newTag]);
        setSearch('');
        return;
      }
      const raw = item.raw as DiaryTag;
      if (item.selected) {
        mode.onChange(mode.value.filter((t) => t.id !== raw.id));
      } else {
        mode.onChange([...mode.value, raw]);
      }
    },
    [mode, onClose, search],
  );

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
            {title}
          </Text>
          {mode.kind === 'tags' ? (
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
          ) : (
            <View style={styles.doneSpacer} />
          )}
        </View>

        {mode.kind === 'tags' ? (
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
              placeholder="Search or create a tag"
              placeholderTextColor={palette.text3}
              style={[styles.searchInput, { color: palette.text }]}
            />
          </View>
        ) : null}

        <FlatList
          data={listItems}
          keyExtractor={(item) => `${item.id}`}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onPickItem(item)}
              style={({ pressed }) => [
                styles.row,
                {
                  borderBottomColor: palette.border,
                  backgroundColor: pressed ? palette.surface2 : 'transparent',
                },
              ]}
            >
              {item.emoji ? (
                <Text style={styles.emoji}>{item.emoji}</Text>
              ) : item.isCreateNew ? (
                <CLIcon n="add" size={18} color={palette.brand} />
              ) : (
                <CLIcon
                  n="local-offer"
                  size={16}
                  color={palette.text3}
                />
              )}
              <Text
                style={[
                  styles.rowLabel,
                  {
                    color: item.isCreateNew ? palette.brand : palette.text,
                    fontWeight: item.isCreateNew ? '700' : '500',
                  },
                ]}
              >
                {item.label}
              </Text>
              {item.selected ? (
                <CLIcon n="check" size={18} color={palette.brand} />
              ) : null}
            </Pressable>
          )}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            isLoading ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator color={palette.text3} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.empty}>
                <Text style={[styles.emptyText, { color: palette.text3 }]}>
                  {mode.kind === 'tags' ? 'No tags found' : 'No moods available'}
                </Text>
              </View>
            ) : null
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
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { flex: 1, fontSize: 14 },
  emoji: { fontSize: 18, width: 22, textAlign: 'center' },

  footerLoading: { paddingVertical: 14, alignItems: 'center' },
  empty: { paddingTop: 40, alignItems: 'center' },
  emptyText: { fontSize: 13, fontWeight: '600' },
});
