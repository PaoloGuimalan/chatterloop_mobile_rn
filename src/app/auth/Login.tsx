/* Login — mirrors webapp/src/app/auth/Login.tsx (mobile-first).
 * Wired against LoginRequest + ThirdPartyAuthenticationRequest. */

import React, { useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import type { AppState } from "../../redux/store";
import {
  LoginRequest,
  ThirdPartyAuthenticationRequest,
} from "../../reusables/hooks/requests";
import { SET_ALERTS } from "../../redux/types";
import { Btn, Field, CLIcon } from "../../reusables/design/primitives";
import { useTheme } from "../../reusables/design/ThemeProvider";

// Both variants required statically so Metro can resolve them — the
// active source is selected at render time based on theme.
const logoLight = require("../../assets/imgs/chatterloop.png");
const logoDark = require("../../assets/imgs/chatterloop-dark.png");

export default function Login() {
  const dispatch = useDispatch();
  const navigation = useNavigation<any>();
  const alerts = useSelector((s: AppState) => s.alerts);
  const { palette, theme, toggleTheme } = useTheme();

  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onLogin = async () => {
    if (!emailOrUsername.trim() || !password.trim()) {
      dispatch({
        type: SET_ALERTS,
        payload: {
          alerts: {
            id: alerts.length,
            type: "warning",
            content: "Please complete the field.",
          },
        },
      });
      return;
    }
    setBusy(true);
    await LoginRequest(
      { email_username: emailOrUsername, password },
      dispatch,
      alerts,
      setBusy,
    );
  };

  const onGoogle = async () => {
    // TODO(auth): integrate @react-native-google-signin/google-signin
    // and pass the resulting idToken below.
    Alert.alert(
      "Google sign-in",
      "Hook up @react-native-google-signin/google-signin and call ThirdPartyAuthenticationRequest({ token: idToken }).",
    );
    void ThirdPartyAuthenticationRequest;
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

      <View style={styles.brandRow}>
        <Image
          source={theme === "dark" ? logoDark : logoLight}
          style={styles.logo}
        />
        <Text style={[styles.brand, { color: palette.text }]}>Chatterloop</Text>
      </View>

      <Text style={[styles.h1, { color: palette.text }]}>Welcome back</Text>
      <Text style={[styles.sub, { color: palette.text2 }]}>
        Log in to jump back into your loop.
      </Text>

      <View style={{ gap: 13 }}>
        <Field
          icon="alternate-email"
          label="Email or Username"
          placeholder="you@chatterloop.app"
          autoCapitalize="none"
          keyboardType="email-address"
          value={emailOrUsername}
          onChangeText={setEmailOrUsername}
        />
        <Field
          icon="lock"
          label="Password"
          placeholder="••••••••"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
      </View>

      <Pressable style={styles.forgotRow}>
        <Text style={{ color: palette.brand, fontWeight: "600", fontSize: 13 }}>
          Forgot password?
        </Text>
      </Pressable>

      <Btn
        label={busy ? "Logging in…" : "Log In"}
        size="lg"
        block
        disabled={busy}
        onPress={onLogin}
      />

      <View style={styles.divider}>
        <View style={[styles.dividerLine, { backgroundColor: palette.border }]} />
        <Text style={[styles.dividerText, { color: palette.text3 }]}>OR</Text>
        <View style={[styles.dividerLine, { backgroundColor: palette.border }]} />
      </View>

      <Btn
        label="Continue with Google"
        iconL="login"
        variant="outline"
        block
        onPress={onGoogle}
      />

      <View style={styles.footerRow}>
        <Text style={{ color: palette.text2, fontSize: 13.5 }}>
          Don't have an account yet?{" "}
        </Text>
        <Pressable onPress={() => navigation.navigate("Register")}>
          <Text style={{ color: palette.brand, fontWeight: "700", fontSize: 13.5 }}>
            Sign Up
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 22, paddingTop: 60, gap: 14 },
  themeToggle: { position: "absolute", top: 18, right: 18, padding: 8 },
  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 14 },
  logo: { width: 38, height: 38 },
  brand: { fontSize: 24, fontWeight: "800" },
  h1: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  sub: { fontSize: 14, marginBottom: 14 },
  forgotRow: { alignItems: "flex-end", marginVertical: 4 },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 6 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontWeight: "600" },
  footerRow: { flexDirection: "row", justifyContent: "center", marginTop: 18 },
});
