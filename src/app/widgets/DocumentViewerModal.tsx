/* DocumentViewerModal — port of
 * webapp/src/app/widgets/modals/DocumentViewerModal.tsx.
 *
 * The web build renders the policy HTML inline (sanitized) or in an
 * iframe. React Native has no HTML renderer without a webview dep, so
 * this port degrades gracefully:
 *   - `content` (HTML from the DB) is converted to readable plain text
 *     (tags stripped, entities decoded, block tags → line breaks) and
 *     shown in a scrollable view. This covers the common case where
 *     policies live entirely in the DB.
 *   - `url` (an externally hosted PDF) is offered via "Open document",
 *     handed to the OS browser through Linking.
 *   - Neither → a short "unavailable" message. */

import React, { useMemo } from 'react';
import { Linking, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../../reusables/design/ThemeProvider';
import { Btn, IconBtn } from '../../reusables/design/primitives';

/** Best-effort HTML → readable text. Not a full parser — strips tags,
 *  turns block-level boundaries into line breaks, and decodes the few
 *  entities policy text actually uses. */
function htmlToText(html: string): string {
  return html
    .replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6])\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '\n• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

interface Props {
  visible: boolean;
  title: string;
  content?: string;
  url?: string;
  onClose: () => void;
}

export default function DocumentViewerModal({
  visible,
  title,
  content,
  url,
  onClose,
}: Props) {
  const { palette } = useTheme();

  const hasContent = !!content && content.trim().length > 0;
  const hasUrl = !!url && url.trim().length > 0;
  const text = useMemo(
    () => (hasContent ? htmlToText(content as string) : ''),
    [content, hasContent],
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
        <View style={[styles.header, { borderBottomColor: palette.border }]}>
          <Text
            numberOfLines={1}
            style={[styles.title, { color: palette.text }]}
          >
            {title}
          </Text>
          <IconBtn n="close" iconSize={22} color={palette.text2} onPress={onClose} />
        </View>

        {hasContent ? (
          <ScrollView contentContainerStyle={styles.body}>
            <Text style={[styles.content, { color: palette.text }]}>{text}</Text>
          </ScrollView>
        ) : hasUrl ? (
          <View style={styles.center}>
            <Text style={[styles.hint, { color: palette.text2 }]}>
              This document is hosted externally.
            </Text>
            <Btn
              label="Open document"
              iconL="open-in-new"
              onPress={() => Linking.openURL(url as string)}
            />
          </View>
        ) : (
          <View style={styles.center}>
            <Text style={[styles.hint, { color: palette.text2 }]}>
              This document is currently unavailable. Please try again later.
            </Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  title: { flex: 1, fontSize: 15, fontWeight: '700' },
  body: { padding: 18 },
  content: { fontSize: 14, lineHeight: 21 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 28,
  },
  hint: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
