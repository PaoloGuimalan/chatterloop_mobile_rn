/* NewEntry — scoped port of
 * webapp/src/app/tabs/profile/diary/NewEntry.tsx.
 *
 * Webapp uses ReactQuill (rich-text), react-datepicker, and AsyncPaginate
 * for mood/tags. We collapse to plain inputs for this pass:
 *   - title: single-line TextInput
 *   - content: multiline TextInput (no rich text)
 *   - entry_date: native date string YYYY-MM-DD via TextInput (placeholder)
 *   - mood/tags: skipped in v1 (server accepts null mood + [] tags)
 *   - attachments: pickImages → UploadMediaRequest → attach uploaded URLs
 *
 * Caller wires `onSaved` via route params; we call it before goBack(). */

import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
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
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

import type { AppState } from '../../../../redux/store';
import { useTheme } from '../../../../reusables/design/ThemeProvider';
import { CLIcon, IconBtn } from '../../../../reusables/design/primitives';
import { radii } from '../../../../reusables/design/tokens';
import {
  formatToDjangoDate,
  formattedDateToWords,
} from '../../../../reusables/hooks/reusable';
import {
  DiaryEntry,
  DiaryEntryAttachment,
  DiaryMood,
  DiaryTag,
  PostNewEntryRequest,
  UploadMediaRequest,
} from '../../../../reusables/hooks/requests';
import { pickImages } from '../../../../reusables/hooks/imagePicker';
import { SET_ALERTS } from '../../../../redux/types';
import DiaryPickerModal from './DiaryPickerModal';

interface NewEntryParams {
  onSaved?: (entry: DiaryEntry) => void;
}

interface PendingAttachment {
  id: number;
  name: string | null;
  reference: string;
  caption: string;
  referenceMediaType: 'image' | 'video';
}

export default function NewEntry() {
  const { palette } = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  // Memoize so the `?? {}` fallback doesn't churn useCallback deps.
  const params = useMemo<NewEntryParams>(
    () => (route.params ?? {}) as NewEntryParams,
    [route.params],
  );
  const dispatch = useDispatch();
  const alerts = useSelector((s: AppState) => s.alerts);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [entryDate, setEntryDate] = useState<Date>(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const onChangeDate = useCallback(
    (event: DateTimePickerEvent, selected?: Date) => {
      // Android auto-dismisses on select/cancel; iOS keeps the inline
      // picker open until the user taps elsewhere.
      setShowDatePicker(Platform.OS === 'ios');
      if (event.type === 'dismissed') return;
      if (selected) setEntryDate(selected);
    },
    [],
  );

  // Display "YYYY-MM-DD" for formattedDateToWords compatibility and for
  // debug visibility — the user sees the friendly form in the row.
  const entryDateYmd = useMemo(() => {
    const y = entryDate.getFullYear();
    const m = String(entryDate.getMonth() + 1).padStart(2, '0');
    const d = String(entryDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [entryDate]);
  const [media, setMedia] = useState<PendingAttachment[]>([]);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mood, setMood] = useState<DiaryMood | null>(null);
  const [tags, setTags] = useState<DiaryTag[]>([]);
  const [pickerOpen, setPickerOpen] = useState<null | 'mood' | 'tags'>(null);

  const canSave = title.trim() !== '' && content.trim() !== '' && !saving;

  const onAddMedia = useCallback(async () => {
    if (picking || saving) return;
    setPicking(true);
    const picked = await pickImages({ selectionLimit: 0, mediaType: 'photo' });
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
  }, [picking, saving]);

  const removeMedia = useCallback((id: number) => {
    setMedia((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const onSave = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);

    const djangoDate = formatToDjangoDate(entryDate);

    // Upload attachments first if any, then map response shape into the
    // entry payload. Mirrors webapp NewEntry.SaveNewEntry().
    let uploadedAttachments: DiaryEntryAttachment[] = [];
    if (media.length > 0) {
      const uploadResponse = await UploadMediaRequest(media);
      if (uploadResponse?.status) {
        uploadedAttachments = (uploadResponse.result ?? []).map((mp: any) => ({
          file_id: mp.fileID,
          file_type: mp.fileType,
          file_name: mp.fileName,
          url: mp.fileDetails?.data ?? '',
        }));
      } else {
        dispatch({
          type: SET_ALERTS,
          payload: {
            alerts: {
              id: alerts.length,
              type: 'error',
              content: 'There was a problem uploading your attachments.',
            },
          },
        });
        setSaving(false);
        return;
      }
    }

    const saved = await PostNewEntryRequest({
      title: title.trim(),
      content: content.trim(),
      mood,
      tags,
      attachments: uploadedAttachments,
      entry_date: djangoDate,
      is_private: true,
    });

    setSaving(false);
    if (saved) {
      params.onSaved?.(saved);
      dispatch({
        type: SET_ALERTS,
        payload: {
          alerts: {
            id: alerts.length,
            type: 'success',
            content: 'Entry saved.',
          },
        },
      });
      nav.goBack();
    } else {
      dispatch({
        type: SET_ALERTS,
        payload: {
          alerts: {
            id: alerts.length,
            type: 'error',
            content: 'There was a problem saving your entry.',
          },
        },
      });
    }
  }, [
    alerts.length,
    canSave,
    content,
    dispatch,
    entryDate,
    media,
    mood,
    nav,
    params,
    tags,
    title,
  ]);

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
          New entry
        </Text>
        <Pressable
          disabled={!canSave}
          onPress={onSave}
          style={({ pressed }) => [
            styles.saveBtn,
            {
              backgroundColor: palette.brand,
              opacity: !canSave ? 0.5 : pressed ? 0.85 : 1,
            },
          ]}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.body}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={[styles.fieldLabel, { color: palette.text3 }]}>
            DATE
          </Text>
          <Pressable
            onPress={() => setShowDatePicker(true)}
            style={({ pressed }) => [
              styles.pickerRow,
              {
                backgroundColor: palette.input,
                borderColor: palette.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <CLIcon n="event" size={16} color={palette.text2} />
            <Text style={[styles.pickerValue, { color: palette.text }]}>
              {formattedDateToWords(entryDateYmd, 'YYYY-MM-DD')}
            </Text>
            <CLIcon n="chevron-right" size={18} color={palette.text3} />
          </Pressable>
          {showDatePicker ? (
            <DateTimePicker
              value={entryDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onChangeDate}
            />
          ) : null}

          <Text style={[styles.fieldLabel, { color: palette.text3 }]}>
            TITLE
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Title your entry"
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
            MOOD
          </Text>
          <Pressable
            onPress={() => setPickerOpen('mood')}
            style={({ pressed }) => [
              styles.pickerRow,
              {
                backgroundColor: palette.input,
                borderColor: palette.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            {mood ? (
              <>
                <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                <Text style={[styles.pickerValue, { color: palette.text }]}>
                  {mood.name}
                </Text>
                <Pressable
                  hitSlop={8}
                  onPress={() => setMood(null)}
                  style={({ pressed }) => [
                    styles.clearBtn,
                    { opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <CLIcon n="close" size={16} color={palette.text3} />
                </Pressable>
              </>
            ) : (
              <Text style={[styles.pickerPlaceholder, { color: palette.text3 }]}>
                Pick a mood
              </Text>
            )}
            <CLIcon n="chevron-right" size={18} color={palette.text3} />
          </Pressable>

          <Text style={[styles.fieldLabel, { color: palette.text3 }]}>
            TAGS
          </Text>
          <Pressable
            onPress={() => setPickerOpen('tags')}
            style={({ pressed }) => [
              styles.pickerRow,
              {
                backgroundColor: palette.input,
                borderColor: palette.border,
                opacity: pressed ? 0.7 : 1,
                minHeight: 44,
                paddingVertical: 8,
              },
            ]}
          >
            {tags.length === 0 ? (
              <Text style={[styles.pickerPlaceholder, { color: palette.text3 }]}>
                Add tags
              </Text>
            ) : (
              <View style={styles.tagChipRow}>
                {tags.map((t) => (
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
            )}
            <CLIcon n="chevron-right" size={18} color={palette.text3} />
          </Pressable>

          <Text style={[styles.fieldLabel, { color: palette.text3 }]}>
            CONTENT
          </Text>
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder="Today I…"
            placeholderTextColor={palette.text3}
            multiline
            style={[
              styles.contentInput,
              {
                color: palette.text,
                backgroundColor: palette.input,
                borderColor: palette.border,
              },
            ]}
          />

          {media.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.previewRow}
            >
              {media.map((m) => (
                <View key={m.id} style={styles.thumbWrap}>
                  <Image
                    source={{ uri: m.reference }}
                    style={[
                      styles.thumb,
                      { backgroundColor: palette.surface2 },
                    ]}
                  />
                  <Pressable
                    hitSlop={8}
                    onPress={() => removeMedia(m.id)}
                    style={({ pressed }) => [
                      styles.thumbRemove,
                      { opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <CLIcon n="close" size={14} color="#fff" />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          ) : null}

          <Pressable
            onPress={onAddMedia}
            disabled={picking || saving}
            style={({ pressed }) => [
              styles.attachRow,
              {
                borderColor: palette.border,
                opacity: picking || saving ? 0.5 : pressed ? 0.7 : 1,
              },
            ]}
          >
            {picking ? (
              <ActivityIndicator color={palette.brand} size="small" />
            ) : (
              <CLIcon n="image" size={18} color={palette.green} />
            )}
            <Text style={[styles.attachText, { color: palette.text2 }]}>
              Attach photos
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <DiaryPickerModal
        visible={pickerOpen === 'mood'}
        onClose={() => setPickerOpen(null)}
        mode={{ kind: 'mood', value: mood, onChange: setMood }}
      />
      <DiaryPickerModal
        visible={pickerOpen === 'tags'}
        onClose={() => setPickerOpen(null)}
        mode={{ kind: 'tags', value: tags, onChange: setTags }}
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
  saveBtn: {
    paddingHorizontal: 16,
    height: 32,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  scroll: { padding: 16, gap: 8, paddingBottom: 32 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  contentInput: {
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
    minHeight: 180,
    textAlignVertical: 'top',
    lineHeight: 20,
  },

  previewRow: { paddingVertical: 8, gap: 8, flexDirection: 'row' },
  thumbWrap: { position: 'relative', width: 84, height: 84 },
  thumb: { width: '100%', height: '100%', borderRadius: radii.sm },
  thumbRemove: {
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

  attachRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    height: 44,
  },
  attachText: { fontSize: 13, fontWeight: '600' },

  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  pickerPlaceholder: { flex: 1, fontSize: 14 },
  pickerValue: { flex: 1, fontSize: 14, fontWeight: '600' },
  moodEmoji: { fontSize: 18 },
  clearBtn: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagChipRow: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tagChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  tagText: { fontSize: 11, fontWeight: '700' },
});
