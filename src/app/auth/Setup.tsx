/* Setup — mirrors webapp/src/app/auth/Setup.tsx. Asks for missing fields
 * (birthdate, gender) and submits via CompleteProfileRequest. */

import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { Btn, CLIcon } from "../../reusables/design/primitives";
import { useTheme } from "../../reusables/design/ThemeProvider";
import type { AppState } from "../../redux/store";
import {
  CompleteProfileRequest,
  LogoutRequest,
} from "../../reusables/hooks/requests";
import { SET_ALERTS } from "../../redux/types";

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function formatBirthdate(month: string, day: string, year: string): string | null {
  const idx = MONTH_NAMES.indexOf(month.toLowerCase());
  if (idx < 0 || !day || !year) return null;
  const mm = `${idx + 1}`.padStart(2, "0");
  const dd = day.padStart(2, "0");
  return `${year}-${mm}-${dd} 08:00:00.000 +0800`;
}

export default function Setup() {
  const dispatch = useDispatch();
  const authentication = useSelector((s: AppState) => s.authentication);
  const alerts = useSelector((s: AppState) => s.alerts);
  const { palette, theme, toggleTheme } = useTheme();

  const [busy, setBusy] = useState(false);
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [year, setYear] = useState("");
  const [gender, setGender] = useState("");

  const user = authentication.user as any;
  const needsBirthdate = !user?.birthdate;
  const needsGender = !user?.gender;

  const isOver13 = useMemo(() => {
    if (!needsBirthdate) return true;
    if (!month || !day || !year) return false;
    const idx = MONTH_NAMES.indexOf(month.toLowerCase());
    if (idx < 0) return false;
    const dob = new Date(parseInt(year, 10), idx, parseInt(day, 10));
    if (dob.getMonth() !== idx) return false;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age > 13;
  }, [month, day, year, needsBirthdate]);

  const onSubmit = async () => {
    const payload: Record<string, unknown> = {};

    if (needsBirthdate) {
      if (!isOver13) {
        dispatch({
          type: SET_ALERTS,
          payload: {
            alerts: {
              id: alerts.length,
              type: "warning",
              content: "Age must be 13 years or older",
            },
          },
        });
        return;
      }
      payload.birthdate = formatBirthdate(month, day, year);
    }
    if (needsGender) {
      if (!gender.trim()) {
        dispatch({
          type: SET_ALERTS,
          payload: {
            alerts: {
              id: alerts.length,
              type: "warning",
              content: "Please select a gender",
            },
          },
        });
        return;
      }
      payload.gender = gender.toLowerCase();
    }

    setBusy(true);
    await CompleteProfileRequest(payload, dispatch, alerts, setBusy);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable onPress={toggleTheme} style={styles.themeToggle}>
        <CLIcon
          n={theme === "dark" ? "light-mode" : "dark-mode"}
          size={20}
          color={palette.text2}
        />
      </Pressable>

      <View style={[styles.iconCircle, { backgroundColor: palette.brandSoft }]}>
        <CLIcon n="account-circle" size={30} color={palette.brand} />
      </View>

      <Text style={[styles.h1, { color: palette.text }]}>Complete your profile</Text>
      <Text style={[styles.sub, { color: palette.text2 }]}>
        Just a couple more details and you're in.
      </Text>

      {needsBirthdate ? (
        <View style={styles.section}>
          <Text style={[styles.label, { color: palette.text2 }]}>Birth date</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <ChipPicker
              flex={13}
              placeholder="Month"
              value={month}
              options={MONTH_NAMES.map((m) => m.charAt(0).toUpperCase() + m.slice(1))}
              onChange={setMonth}
            />
            <ChipPicker
              flex={10}
              placeholder="Day"
              value={day}
              options={Array.from({ length: 31 }, (_, i) => `${i + 1}`)}
              onChange={setDay}
            />
            <ChipPicker
              flex={10}
              placeholder="Year"
              value={year}
              options={Array.from(
                { length: 80 },
                (_, i) => `${new Date().getFullYear() - i}`,
              )}
              onChange={setYear}
            />
          </View>
        </View>
      ) : null}

      {needsGender ? (
        <View style={styles.section}>
          <Text style={[styles.label, { color: palette.text2 }]}>Gender</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["Male", "Female", "Others"] as const).map((g) => (
              <GenderButton
                key={g}
                value={g}
                active={gender === g}
                onPress={() => setGender(g)}
              />
            ))}
          </View>
        </View>
      ) : null}

      <Btn
        label={busy ? "Saving…" : "Complete"}
        size="lg"
        block
        disabled={busy}
        onPress={onSubmit}
        style={{ marginTop: 18 }}
      />

      <Pressable
        onPress={() => LogoutRequest(dispatch)}
        style={{ marginTop: 18 }}
      >
        <Text style={{ color: palette.brand, fontWeight: "700", fontSize: 13.5 }}>
          Logout
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function ChipPicker({
  flex,
  placeholder,
  value,
  options,
  onChange,
}: {
  flex: number;
  placeholder: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const { palette } = useTheme();
  const onTap = () => {
    if (options.length === 0) return;
    const i = options.indexOf(value);
    onChange(options[(i + 1) % options.length]);
  };
  return (
    <Pressable
      onPress={onTap}
      style={{
        flex,
        height: 44,
        paddingHorizontal: 14,
        backgroundColor: palette.input,
        borderColor: palette.border,
        borderWidth: 1,
        borderRadius: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Text
        style={{
          color: value ? palette.text : palette.text3,
          fontSize: 14,
          fontWeight: value ? "600" : "400",
        }}
      >
        {value || placeholder}
      </Text>
      <CLIcon n="expand-more" size={18} color={palette.text3} />
    </Pressable>
  );
}

function GenderButton({
  value,
  active,
  onPress,
}: {
  value: "Male" | "Female" | "Others";
  active: boolean;
  onPress: () => void;
}) {
  const { palette } = useTheme();
  const activeBg =
    value === "Male" ? "#49A1F8" : value === "Female" ? "#DB56A4" : palette.brand;
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        height: 40,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: active ? "transparent" : palette.border2,
        backgroundColor: active ? activeBg : palette.surface,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: active ? "#fff" : palette.text2,
          fontSize: 13.5,
          fontWeight: "600",
        }}
      >
        {value}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 22, paddingTop: 80, alignItems: "center", gap: 14 },
  themeToggle: { position: "absolute", top: 18, right: 18, padding: 8 },
  iconCircle: {
    width: 62,
    height: 62,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  h1: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  sub: { fontSize: 14, textAlign: "center" },
  section: { width: "100%", gap: 6 },
  label: { fontSize: 12, fontWeight: "600", marginTop: 8 },
});
