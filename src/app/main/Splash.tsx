/* Splash — mirrors webapp/src/app/main/Splash.tsx. */

import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../reusables/design/ThemeProvider";

// `require` calls must be statically analyzable for the Metro asset
// resolver, so both variants are imported up-front and switched at
// render time based on theme.
const logoLight = require("../../assets/imgs/chatterloop.gif");
const logoDark = require("../../assets/imgs/chatterloop-dark.gif");

export default function Splash() {
  const { palette, theme } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      <Image
        source={theme === "dark" ? logoDark : logoLight}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={[styles.title, { color: palette.text }]}>Chatterloop</Text>
      <Text style={[styles.subtitle, { color: palette.text2 }]}>
        Link · Share · Explore
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14 },
  logo: { width: 120, height: 120 },
  title: { fontSize: 30, fontWeight: "800", letterSpacing: -0.6 },
  subtitle: { fontSize: 14, fontWeight: "500" },
});
