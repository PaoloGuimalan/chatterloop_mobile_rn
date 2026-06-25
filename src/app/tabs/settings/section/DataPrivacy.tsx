/* Data & Privacy section — scoped port of
 * webapp/src/app/tabs/settings/section/DataPrivacy.tsx.
 *
 * Two actions:
 *   - Export: GET /api/user/me/export. The web build triggers a file
 *     download; with no filesystem dep on native we hand the JSON to the
 *     OS share sheet (Share.share) so the user can save/send it.
 *   - Delete: DELETE /api/user/me, gated behind a two-step confirm to
 *     match the webapp's inline confirmation. */

import React, { useCallback, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import type { AppState } from '../../../../redux/store';
import { useTheme } from '../../../../reusables/design/ThemeProvider';
import { Btn } from '../../../../reusables/design/primitives';
import {
  DeleteAccountRequest,
  ExportAccountDataRequest,
} from '../../../../reusables/hooks/requests';

export default function DataPrivacy() {
  const { palette } = useTheme();
  const dispatch = useDispatch();
  const alerts = useSelector((s: AppState) => s.alerts);

  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const exportProcess = useCallback(async () => {
    setIsExporting(true);
    const json = await ExportAccountDataRequest(dispatch, alerts, setIsExporting);
    if (json) {
      try {
        await Share.share({
          title: 'Chatterloop data export',
          message: json,
        });
      } catch {
        // user dismissed the share sheet — nothing to do
      }
    }
  }, [dispatch, alerts]);

  const deleteProcess = useCallback(() => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setIsDeleting(true);
    DeleteAccountRequest(dispatch, alerts, setIsDeleting);
  }, [confirmDelete, dispatch, alerts]);

  return (
    <View style={styles.screen}>
      <Text style={[styles.heading, { color: palette.text }]}>
        Data &amp; Privacy
      </Text>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>
          Export your data
        </Text>
        <Text style={[styles.sectionBody, { color: palette.text2 }]}>
          Download a copy of the personal data we hold about you, including your
          profile, posts, comments, diary entries, realm memberships, messages,
          and consent history.
        </Text>
        <Btn
          label={isExporting ? 'Preparing…' : 'Export my data'}
          iconL="download"
          variant="soft"
          disabled={isExporting}
          onPress={exportProcess}
          style={styles.actionBtn}
        />
      </View>

      <View style={[styles.divider, { backgroundColor: palette.border }]} />

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: palette.pink }]}>
          Delete your account
        </Text>
        <Text style={[styles.sectionBody, { color: palette.text2 }]}>
          This permanently deactivates your account and removes your identifying
          information. Your account will become unusable and you'll be signed
          out immediately. This cannot be undone.
        </Text>
        <View style={styles.deleteRow}>
          <Btn
            label={
              isDeleting
                ? 'Deleting…'
                : confirmDelete
                ? 'Confirm permanent deletion'
                : 'Delete my account'
            }
            variant="danger"
            disabled={isDeleting}
            onPress={deleteProcess}
            style={styles.actionBtn}
          />
          {confirmDelete && !isDeleting ? (
            <Btn
              label="Cancel"
              variant="outline"
              onPress={() => setConfirmDelete(false)}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16 },
  heading: { fontSize: 16, fontWeight: '600', marginBottom: 16 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '600' },
  sectionBody: { fontSize: 14, lineHeight: 19 },
  actionBtn: { alignSelf: 'flex-start' },
  deleteRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  divider: { height: 1, marginVertical: 26 },
});
