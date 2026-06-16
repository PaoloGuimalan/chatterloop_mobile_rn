/* Shared tab stub — every unfinished tab uses this until ported. */

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { CLIcon } from "../../reusables/design/primitives";
import { useTheme } from "../../reusables/design/ThemeProvider";

export default function TabStub({
  title,
  icon,
  source,
  notes,
}: {
  title: string;
  icon: string;
  source: string; // path to the webapp file to port from
  notes?: string;
}) {
  const { palette } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: palette.brandSoft },
        ]}
      >
        <CLIcon n={icon} size={32} color={palette.brand} />
      </View>
      <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
      <Text style={[styles.body, { color: palette.text2 }]}>
        Coming soon — port from{"\n"}
        <Text style={[styles.code, { color: palette.text }]}>{source}</Text>
      </Text>
      {notes ? (
        <Text style={[styles.note, { color: palette.text3 }]}>{notes}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  iconCircle: {
    width: 62,
    height: 62,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 22, fontWeight: "800", letterSpacing: -0.4 },
  body: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  code: { fontFamily: "monospace", fontSize: 13 },
  note: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 16,
    lineHeight: 16,
  },
});
