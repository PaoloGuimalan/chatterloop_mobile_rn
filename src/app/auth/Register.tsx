/* eslint-disable react-native/no-inline-styles */
/* Register — mirrors webapp/src/app/auth/Register.tsx (mobile-first).
 * Calls RegisterRequest. */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { Btn, Field, CLIcon } from '../../reusables/design/primitives';
import { useTheme } from '../../reusables/design/ThemeProvider';
import { SET_ALERTS } from '../../redux/types';
import type { AppState } from '../../redux/store';
import {
  GetCurrentPoliciesRequest,
  RegisterRequest,
  type PolicyDocument,
  type RegisterPayload,
} from '../../reusables/hooks/requests';
import { checkIfValid } from '../../reusables/hooks/reusable';
import DocumentViewerModal from '../widgets/DocumentViewerModal';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

type Gender = 'Male' | 'Female' | 'Others';

export default function Register() {
  const dispatch = useDispatch();
  const nav = useNavigation<any>();
  const alerts = useSelector((s: AppState) => s.alerts);
  const { palette, theme, toggleTheme } = useTheme();

  const [first, setFirst] = useState('');
  const [middle, setMiddle] = useState('');
  const [last, setLast] = useState('');
  const [email, setEmail] = useState('');
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState<'' | Gender>('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

  // Legal documents shown inline via DocumentViewerModal (mirrors webapp
  // Register). Fetched once on mount; `activeDoc` drives the viewer.
  const [policies, setPolicies] = useState<PolicyDocument[]>([]);
  const [activeDoc, setActiveDoc] = useState<{
    title: string;
    content?: string;
    url?: string;
  } | null>(null);

  useEffect(() => {
    GetCurrentPoliciesRequest().then(setPolicies);
  }, []);

  const openPolicy = useCallback(
    (documentType: string, title: string) => {
      const doc = policies.find(d => d.document_type === documentType);
      setActiveDoc({
        title,
        content: doc?.content,
        url: doc?.document_url,
      });
    },
    [policies],
  );

  const maxBirthDate = useMemo(() => new Date(), []);

  const onChangeBirthDate = useCallback(
    (event: DateTimePickerEvent, selected?: Date) => {
      setShowDatePicker(Platform.OS === 'ios');
      if (event.type === 'dismissed') return;
      if (selected) setBirthDate(selected);
    },
    [],
  );

  const birthLabel = useMemo(() => {
    if (!birthDate) return '';
    return `${
      MONTHS[birthDate.getMonth()]
    } ${birthDate.getDate()}, ${birthDate.getFullYear()}`;
  }, [birthDate]);

  const alert = (content: string) => {
    dispatch({
      type: SET_ALERTS,
      payload: { alerts: { id: alerts.length, type: 'warning', content } },
    });
  };

  const onSubmit = async () => {
    if (!agreed) return alert('Please agree with the Terms and Conditions.');
    if (!checkIfValid([first, last, email, gender, password]) || !birthDate) {
      return alert('Please complete the fields.');
    }
    setBusy(true);
    const payload: RegisterPayload = {
      firstName: first,
      middleName: middle.trim() === '' ? null : middle.trim(),
      lastName: last,
      birthmonth: birthDate.getMonth() + 1,
      birthday: `${birthDate.getDate()}`,
      birthyear: `${birthDate.getFullYear()}`,
      gender,
      email,
      password,
    };
    await RegisterRequest(payload, dispatch, alerts, setBusy);
    // After RegisterRequest succeeds, the auth gate in Root.tsx flips
    // automatically to /verify.
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable onPress={toggleTheme} style={styles.themeToggle}>
        <CLIcon
          n={theme === 'dark' ? 'light-mode' : 'dark-mode'}
          size={20}
          color={palette.text2}
        />
      </Pressable>

      <Text style={[styles.h1, { color: palette.text }]}>
        Create your account
      </Text>
      <Text style={[styles.sub, { color: palette.text2 }]}>
        Join the loop in less than a minute.
      </Text>

      <View style={{ gap: 13 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field
              icon="person"
              label="First name"
              value={first}
              onChangeText={setFirst}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Middle (optional)"
              value={middle}
              onChangeText={setMiddle}
            />
          </View>
        </View>
        <Field
          icon="badge"
          label="Last name"
          value={last}
          onChangeText={setLast}
        />
        <Field
          icon="alternate-email"
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={[styles.label, { color: palette.text2 }]}>Birth date</Text>
        <Pressable
          onPress={() => setShowDatePicker(true)}
          style={{
            height: 44,
            paddingHorizontal: 14,
            backgroundColor: palette.input,
            borderColor: palette.border,
            borderWidth: 1,
            borderRadius: 10,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              flex: 1,
            }}
          >
            <CLIcon n="event" size={16} color={palette.text3} />
            <Text
              style={{
                color: birthDate ? palette.text : palette.text3,
                fontSize: 14,
                fontWeight: birthDate ? '600' : '400',
              }}
            >
              {birthLabel || 'Pick your birth date'}
            </Text>
          </View>
          <CLIcon n="expand-more" size={18} color={palette.text3} />
        </Pressable>
        {showDatePicker ? (
          <DateTimePicker
            value={birthDate ?? new Date(2000, 0, 1)}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={maxBirthDate}
            onChange={onChangeBirthDate}
          />
        ) : null}

        <Text style={[styles.label, { color: palette.text2 }]}>Gender</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['Male', 'Female', 'Others'] as const).map(g => (
            <GenderButton
              key={g}
              value={g}
              active={gender === g}
              onPress={() => setGender(g)}
            />
          ))}
        </View>

        <Field
          icon="lock"
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
      </View>

      <Pressable style={styles.termsRow} onPress={() => setAgreed(v => !v)}>
        <View
          style={[
            styles.checkbox,
            { borderColor: palette.border2 },
            agreed && {
              backgroundColor: palette.brand,
              borderColor: palette.brand,
            },
          ]}
        >
          {agreed ? <CLIcon n="check" size={14} color="#fff" /> : null}
        </View>
        <Text style={{ color: palette.text2, fontSize: 13 }}>
          I agree to the{' '}
          <Text
            style={{ color: palette.brand, fontWeight: '700' }}
            onPress={() => openPolicy('terms', 'Terms and Conditions')}
          >
            Terms and Conditions
          </Text>{' '}
          and{' '}
          <Text
            style={{ color: palette.brand, fontWeight: '700' }}
            onPress={() => openPolicy('privacy', 'Privacy Policy')}
          >
            Privacy Policy
          </Text>
        </Text>
      </Pressable>

      <Btn
        label={busy ? 'Signing up…' : 'Sign Up'}
        size="lg"
        block
        disabled={busy}
        onPress={onSubmit}
        style={{ marginTop: 10 }}
      />

      <View style={styles.footerRow}>
        <Text style={{ color: palette.text2, fontSize: 13.5 }}>
          Already have an account?{' '}
        </Text>
        <Pressable onPress={() => nav.navigate('Login')}>
          <Text
            style={{ color: palette.brand, fontWeight: '700', fontSize: 13.5 }}
          >
            Log In
          </Text>
        </Pressable>
      </View>

      <DocumentViewerModal
        visible={activeDoc !== null}
        title={activeDoc?.title ?? ''}
        content={activeDoc?.content}
        url={activeDoc?.url}
        onClose={() => setActiveDoc(null)}
      />
    </ScrollView>
  );
}

function GenderButton({
  value,
  active,
  onPress,
}: {
  value: Gender;
  active: boolean;
  onPress: () => void;
}) {
  const { palette } = useTheme();
  const activeBg =
    value === 'Male'
      ? '#49A1F8'
      : value === 'Female'
      ? '#DB56A4'
      : palette.brand;
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        height: 40,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: active ? 'transparent' : palette.border2,
        backgroundColor: active ? activeBg : palette.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: active ? '#fff' : palette.text2,
          fontSize: 13.5,
          fontWeight: '600',
        }}
      >
        {value}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 22, paddingTop: 60, gap: 6 },
  themeToggle: { position: 'absolute', top: 18, right: 18, padding: 8 },
  h1: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginTop: 4 },
  sub: { fontSize: 14, marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '600', marginTop: 6 },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 16,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 22 },
});
