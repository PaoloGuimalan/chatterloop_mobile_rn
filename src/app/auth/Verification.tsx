/* Verification — mirrors webapp/src/app/auth/Verification.tsx. */

import React, { useRef, useState } from "react";
import {
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputKeyPressEventData,
  View,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { Btn, CLIcon } from "../../reusables/design/primitives";
import { useTheme } from "../../reusables/design/ThemeProvider";
import { LogoutRequest, VerifyCodeRequest } from "../../reusables/hooks/requests";
import { SET_ALERTS } from "../../redux/types";
import type { AppState } from "../../redux/store";

export default function Verification() {
  const dispatch = useDispatch();
  const authentication = useSelector((s: AppState) => s.authentication);
  const alerts = useSelector((s: AppState) => s.alerts);
  const { palette, theme, toggleTheme } = useTheme();

  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [busy, setBusy] = useState(false);
  const refs = useRef<Array<TextInput | null>>([]);

  const code = digits.join("");
  const full = code.length === 6;

  const setDigit = (i: number, v: string) => {
    if (!/^\d?$/.test(v)) return;
    setDigits((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
    if (v && i < 5) refs.current[i + 1]?.focus();
  };

  const onKey = (i: number, e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (e.nativeEvent.key === "Backspace" && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  };

  const onSubmit = async () => {
    if (!full) {
      dispatch({
        type: SET_ALERTS,
        payload: {
          alerts: {
            id: alerts.length,
            type: "warning",
            content: "Please complete your verification code.",
          },
        },
      });
      return;
    }
    setBusy(true);
    await VerifyCodeRequest(
      { code },
      dispatch,
      authentication,
      alerts,
      setBusy,
    );
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
        <CLIcon n="mark-email-read" size={30} color={palette.brand} />
      </View>

      <Text style={[styles.h1, { color: palette.text }]}>Verify your email</Text>
      <Text style={[styles.sub, { color: palette.text2 }]}>
        We sent a 6-digit code to{" "}
        <Text style={{ color: palette.text, fontWeight: "700" }}>
          {authentication.user?.email}
        </Text>
      </Text>

      <View style={styles.digitsRow}>
        {digits.map((d, i) => (
          <TextInput
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={d}
            onChangeText={(v) => setDigit(i, v)}
            onKeyPress={(e) => onKey(i, e)}
            keyboardType="number-pad"
            maxLength={1}
            style={[
              styles.digit,
              {
                color: palette.text,
                backgroundColor: palette.input,
                borderColor: d ? palette.brand : palette.border2,
              },
            ]}
          />
        ))}
      </View>

      <Btn
        label={busy ? "Verifying…" : "Verify"}
        size="lg"
        block
        disabled={busy || !full}
        onPress={onSubmit}
      />

      <View style={styles.linksRow}>
        <Text style={{ color: palette.text2, fontSize: 13.5 }}>Didn't get it? </Text>
        <Pressable>
          <Text style={{ color: palette.brand, fontWeight: "700", fontSize: 13.5 }}>
            Resend Code
          </Text>
        </Pressable>
        <Text style={{ color: palette.border2, marginHorizontal: 8 }}>·</Text>
        <Pressable onPress={() => LogoutRequest(dispatch)}>
          <Text style={{ color: palette.brand, fontWeight: "700", fontSize: 13.5 }}>
            Logout
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 22, paddingTop: 80, alignItems: "center", gap: 16 },
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
  digitsRow: { flexDirection: "row", gap: 9 },
  digit: {
    width: 46,
    height: 56,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
    borderWidth: 1.5,
    borderRadius: 10,
  },
  linksRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
});
