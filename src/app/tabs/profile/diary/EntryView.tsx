/* EntryView — scoped port of
 * webapp/src/app/tabs/profile/diary/EntryView.tsx.
 *
 * Read-only single-entry detail. Webapp uses dangerouslySetInnerHTML on
 * Quill HTML; RN has no native HTML renderer in this codebase. Instead
 * of pulling in react-native-render-html (which lags on RN 0.86 / React
 * 19), we run a structured pass that turns common Quill block tags
 * into plain-text affordances (lists → bullets, headers → newlines,
 * blockquotes → "> " prefixes). Inline emphasis is dropped — bold and
 * italics need a real renderer. */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';

import { useTheme } from '../../../../reusables/design/ThemeProvider';
import { CLIcon, IconBtn } from '../../../../reusables/design/primitives';
import { radii } from '../../../../reusables/design/tokens';
import { formattedDateToWords } from '../../../../reusables/hooks/reusable';
import {
  DiaryEntry,
  GetEntryRequest,
} from '../../../../reusables/hooks/requests';

interface EntryViewParams {
  entry_id: string;
}

const ENTITY_MAP: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  '#39': "'",
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
};

function decodeEntities(s: string): string {
  return s
    .replace(/&(#?\w+);/g, (_m, name: string) => ENTITY_MAP[name] ?? `&${name};`)
    .replace(/&#(\d+);/g, (_m, code: string) =>
      String.fromCharCode(Number(code)),
    );
}

/** Renders Quill HTML as plain text with light formatting affordances.
 *  Lists become bullet/number prefixed lines, headers and blockquotes
 *  get their own paragraph breaks, and `<br>` / `</p>` collapse to
 *  newlines. Inline tags (bold, italic, links) are stripped — to
 *  preserve those we'd need a real HTML renderer. */
function renderHtmlAsText(html: string): string {
  let s = html;

  // Lists: walk each <ol>/<ul> block and number/bullet its <li>s.
  s = s.replace(
    /<ol\b[^>]*>([\s\S]*?)<\/ol>/gi,
    (_m, inner: string) => {
      let i = 0;
      return (
        '\n' +
        inner.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (__m, item: string) => {
          i += 1;
          return `${i}. ${item.trim()}\n`;
        }) +
        '\n'
      );
    },
  );
  s = s.replace(
    /<ul\b[^>]*>([\s\S]*?)<\/ul>/gi,
    (_m, inner: string) =>
      '\n' +
      inner.replace(
        /<li\b[^>]*>([\s\S]*?)<\/li>/gi,
        (__m, item: string) => `• ${item.trim()}\n`,
      ) +
      '\n',
  );

  // Block-level breaks.
  s = s.replace(/<\/(h[1-6]|p|div|blockquote)>/gi, '\n\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');

  // Blockquote prefix: any line in a <blockquote> gets a leading "> ".
  s = s.replace(
    /<blockquote\b[^>]*>([\s\S]*?)(?=<\/blockquote>|$)/gi,
    (_m, inner: string) =>
      inner
        .split('\n')
        .map((ln) => (ln.trim() ? `> ${ln}` : ln))
        .join('\n'),
  );

  // Strip everything else.
  s = s.replace(/<[^>]+>/g, '');
  s = decodeEntities(s);

  // Collapse 3+ blank lines down to 2; trim outer whitespace.
  s = s.replace(/\n{3,}/g, '\n\n').trim();
  return s;
}

export default function EntryView() {
  const { palette } = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { entry_id } = route.params as EntryViewParams;

  const [entry, setEntry] = useState<DiaryEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    const result = await GetEntryRequest(entry_id);
    setEntry(result);
    setIsLoading(false);
  }, [entry_id]);

  useEffect(() => {
    load();
  }, [load]);

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
          Entry
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.brand} />
        </View>
      ) : !entry ? (
        <View style={styles.center}>
          <CLIcon n="error-outline" size={28} color={palette.text3} />
          <Text style={[styles.emptyText, { color: palette.text3 }]}>
            Entry not found
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={[styles.entryDate, { color: palette.text3 }]}>
            {formattedDateToWords(entry.entry_date, 'YYYY-MM-DD')}
          </Text>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: palette.text }]}>
              {entry.title}
            </Text>
            {entry.mood ? (
              <Text style={[styles.mood, { color: palette.text2 }]}>
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

          <Text style={[styles.content, { color: palette.text }]}>
            {renderHtmlAsText(entry.content)}
          </Text>

          {entry.attachments.length > 0 ? (
            <View style={styles.attachmentsCol}>
              {entry.attachments.map((a) => (
                <Pressable
                  key={a.id ?? a.file_id ?? a.url}
                  style={[
                    styles.attachmentCard,
                    {
                      backgroundColor: palette.surface2,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  {(a.file_type || '').includes('image') ? (
                    <Image
                      source={{ uri: a.url }}
                      style={styles.attachmentImg}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.attachmentFile}>
                      <CLIcon
                        n="insert-drive-file"
                        size={18}
                        color={palette.text2}
                      />
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.attachmentName,
                          { color: palette.text2 },
                        ]}
                      >
                        {a.file_name ?? 'Attachment'}
                      </Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  emptyText: { fontSize: 13, fontWeight: '600' },

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

  scroll: { padding: 18, gap: 12, paddingBottom: 36 },
  entryDate: { fontSize: 12, fontWeight: '700' },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: { flex: 1, fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  mood: { fontSize: 13, fontWeight: '600' },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tagChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  tagText: { fontSize: 11, fontWeight: '700' },

  content: { fontSize: 14.5, lineHeight: 22, marginTop: 4 },

  attachmentsCol: { gap: 8, marginTop: 8 },
  attachmentCard: {
    borderWidth: 1,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  attachmentImg: { width: '100%', height: 200 },
  attachmentFile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  attachmentName: { flex: 1, fontSize: 13, fontWeight: '600' },
});
