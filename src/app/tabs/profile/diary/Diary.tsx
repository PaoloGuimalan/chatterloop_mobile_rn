/* Diary screen — scoped port of
 * webapp/src/app/tabs/profile/diary/Diary.tsx (657 lines).
 *
 * Lists the current user's diary entries grouped by `entry_date`, with
 * a "Write an entry" action in the header that navigates to NewEntry.
 * Tapping a card opens EntryView. Web's split-pane layout collapses to
 * a single stack on mobile, so we drop the desktop column. */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { useTheme } from '../../../../reusables/design/ThemeProvider';
import { CLIcon, IconBtn } from '../../../../reusables/design/primitives';
import { radii } from '../../../../reusables/design/tokens';
import { formattedDateToWords } from '../../../../reusables/hooks/reusable';
import {
  DiaryEntry,
  GetUserEntriesRequest,
} from '../../../../reusables/hooks/requests';

const RANGE = 10;

interface DateGroup {
  date: string;
  entries: DiaryEntry[];
}

function groupByDate(entries: DiaryEntry[]): DateGroup[] {
  const sorted = [...entries].sort((a, b) => {
    const diff =
      new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime();
    if (diff !== 0) return diff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  const groups: Record<string, DiaryEntry[]> = {};
  for (const e of sorted) {
    (groups[e.entry_date] ??= []).push(e);
  }
  return Object.entries(groups)
    .map(([date, list]) => ({ date, entries: list.reverse() }))
    .reverse();
}

export default function Diary() {
  const { palette } = useTheme();
  const nav = useNavigation<any>();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (p: number, append: boolean) => {
    const result = await GetUserEntriesRequest(p, RANGE);
    setEntries((prev) => {
      const combined = append ? [...prev, ...result.results] : result.results;
      // De-dupe by id (the web list lazy-loads via scroll; we mirror that).
      const seen = new Set<string>();
      return combined.filter((e) => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });
    });
    setNext(result.next);
    setIsLoading(false);
    setLoadingMore(false);
  }, []);

  useEffect(() => {
    load(1, false);
  }, [load]);

  const onEndReached = useCallback(() => {
    if (loadingMore || !next) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    load(nextPage, true);
  }, [load, loadingMore, next, page]);

  const groups = useMemo(() => groupByDate(entries), [entries]);

  const onEntryAdded = useCallback((entry: DiaryEntry) => {
    setEntries((prev) => {
      const seen = new Set(prev.map((e) => e.id));
      return seen.has(entry.id) ? prev : [entry, ...prev];
    });
  }, []);

  const renderGroup = useCallback(
    ({ item }: { item: DateGroup }) => {
      if (item.entries.length === 1) {
        const entry = item.entries[0];
        return (
          <Pressable
            onPress={() =>
              nav.navigate('DiaryEntry', { entry_id: entry.id })
            }
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: palette.surface2,
                borderColor: palette.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <View style={styles.cardHead}>
              <Text
                numberOfLines={1}
                style={[styles.cardTitle, { color: palette.text }]}
              >
                {entry.title}
              </Text>
              {entry.mood ? (
                <Text style={[styles.cardMood, { color: palette.text2 }]}>
                  {entry.mood.emoji} {entry.mood.name}
                </Text>
              ) : null}
            </View>
            {entry.tag_objects.length > 0 ? (
              <View style={styles.tagRow}>
                {entry.tag_objects.map((t) => (
                  <View
                    key={t.id}
                    style={[
                      styles.tagChip,
                      { backgroundColor: palette.brandSoft },
                    ]}
                  >
                    <Text style={[styles.tagText, { color: palette.brand }]}>
                      {t.name}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            <Text
              numberOfLines={3}
              style={[styles.cardBody, { color: palette.text2 }]}
            >
              {stripHtml(entry.content)}
            </Text>
            <Text style={[styles.cardDate, { color: palette.text3 }]}>
              {formattedDateToWords(entry.entry_date, 'YYYY-MM-DD')}
            </Text>
          </Pressable>
        );
      }
      // Multi-entry group — single card with nested entries.
      const allTags = item.entries
        .flatMap((e) => e.tag_objects)
        .filter((t, i, arr) => i === arr.findIndex((x) => x.id === t.id));
      return (
        <View
          style={[
            styles.card,
            {
              backgroundColor: palette.surface2,
              borderColor: palette.border,
            },
          ]}
        >
          <Text style={[styles.cardTitle, { color: palette.text }]}>
            {formattedDateToWords(item.date, 'YYYY-MM-DD')}
          </Text>
          {allTags.length > 0 ? (
            <View style={styles.tagRow}>
              {allTags.map((t) => (
                <View
                  key={t.id}
                  style={[
                    styles.tagChip,
                    { backgroundColor: palette.brandSoft },
                  ]}
                >
                  <Text style={[styles.tagText, { color: palette.brand }]}>
                    {t.name}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          {item.entries.map((entry) => (
            <Pressable
              key={entry.id}
              onPress={() =>
                nav.navigate('DiaryEntry', { entry_id: entry.id })
              }
              style={({ pressed }) => [
                styles.subCard,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View style={styles.cardHead}>
                <Text
                  numberOfLines={1}
                  style={[styles.subCardTitle, { color: palette.text }]}
                >
                  {entry.title}
                </Text>
                {entry.mood ? (
                  <Text style={[styles.cardMood, { color: palette.text2 }]}>
                    {entry.mood.emoji} {entry.mood.name}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
          <Text style={[styles.cardDate, { color: palette.text3 }]}>
            {item.entries.length} entries
          </Text>
        </View>
      );
    },
    [nav, palette],
  );

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.screen, { backgroundColor: palette.bg }]}
    >
      <View style={[styles.headerBar, { borderBottomColor: palette.border }]}>
        <IconBtn
          n="arrow-back"
          iconSize={22}
          color={palette.text}
          onPress={() => nav.goBack()}
        />
        <Text style={[styles.headerTitle, { color: palette.text }]}>
          Chatterloop Diary
        </Text>
        <Pressable
          onPress={() => nav.navigate('NewDiaryEntry', { onSaved: onEntryAdded })}
          style={({ pressed }) => [
            styles.writeBtn,
            {
              backgroundColor: palette.surface2,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <CLIcon n="edit" size={14} color={palette.text} />
          <Text style={[styles.writeText, { color: palette.text }]}>Write</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.brand} />
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.date}
          renderItem={renderGroup}
          contentContainerStyle={styles.listContent}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <View style={styles.empty}>
              <CLIcon n="book" size={48} color={palette.text3} />
              <Text style={[styles.emptyText, { color: palette.text3 }]}>
                No entries made yet
              </Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator color={palette.text3} />
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

// Quick-and-dirty: server stores rich HTML (Quill output). Strip tags
// for the card preview — RN has no HTML renderer here.
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

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
  writeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: radii.pill,
  },
  writeText: { fontSize: 13, fontWeight: '700' },

  listContent: { padding: 16, gap: 10, paddingBottom: 32 },
  card: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 14,
    gap: 8,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700' },
  subCardTitle: { flex: 1, fontSize: 13, fontWeight: '600' },
  cardMood: { fontSize: 12, fontWeight: '600' },
  cardBody: { fontSize: 13, lineHeight: 18 },
  cardDate: { fontSize: 11, fontWeight: '600' },
  subCard: {
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: 10,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  tagChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  tagText: { fontSize: 11, fontWeight: '700' },

  empty: {
    paddingTop: 60,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: { fontSize: 13, fontWeight: '600' },
  footerLoading: { paddingVertical: 14, alignItems: 'center' },
});
