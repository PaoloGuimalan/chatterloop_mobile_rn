/* Credentials section — ports
 * webapp/src/app/tabs/settings/section/Credentials.tsx.
 *
 * Same "under development" pattern as PersonalInformation: the fields
 * pre-fill from current auth state but have no save handlers because
 * the webapp version doesn't either. */

import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSelector } from "react-redux";

import type { AppState } from "../../../../redux/store";
import { useTheme } from "../../../../reusables/design/ThemeProvider";
import { Field } from "../../../../reusables/design/primitives";

interface FormSectionProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

function FormSection({ title, description, children }: FormSectionProps) {
  const { palette } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: palette.text }]}>
        {title}
      </Text>
      <Text style={[styles.sectionDesc, { color: palette.text2 }]}>
        {description}
      </Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

export default function Credentials() {
  const { palette } = useTheme();
  const authentication = useSelector((s: AppState) => s.authentication);
  const user = authentication.user;

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={[styles.heading, { color: palette.text }]}>
        Credentials (under development)
      </Text>

      <FormSection
        title="Username"
        description="Changing your username will affect how people contact, mention, and access your contents."
      >
        <Field
          icon="alternate-email"
          placeholder="user1234"
          value={user.username}
          editable={false}
        />
      </FormSection>

      <FormSection
        title="Email"
        description="Replace your user email. Note that this will require verification from your old and new email address."
      >
        <Field
          icon="email"
          placeholder="you@chatterloop.app"
          value={user.email}
          editable={false}
        />
      </FormSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, gap: 10 },
  heading: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
  section: { gap: 12, marginTop: 18 },
  sectionTitle: { fontSize: 14, fontWeight: "600" },
  sectionDesc: { fontSize: 13, lineHeight: 18 },
  sectionBody: { gap: 13, marginTop: 4 },
});
