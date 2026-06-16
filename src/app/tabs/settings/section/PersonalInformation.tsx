/* Personal Information section — ports
 * webapp/src/app/tabs/settings/section/PersonalInformation.tsx.
 *
 * Mirrors the webapp's "under development" state: fields are pre-filled
 * with the current user's data but onChange handlers are intentionally
 * no-ops — the corresponding save endpoints aren't wired backend-side
 * either. */

import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSelector } from "react-redux";

import type { AppState } from "../../../../redux/store";
import { useTheme } from "../../../../reusables/design/ThemeProvider";
import { Field } from "../../../../reusables/design/primitives";
import { radii } from "../../../../reusables/design/tokens";

type GenderChoice = "Male" | "Female" | "Others";

function capitalize(s: string | null | undefined): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

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

export default function PersonalInformation() {
  const { palette } = useTheme();
  const authentication = useSelector((s: AppState) => s.authentication);
  const user = authentication.user;

  const initialGender = capitalize(user?.gender ?? "") as
    | GenderChoice
    | "";
  const [gender, setGender] = useState<"" | GenderChoice>(initialGender);

  const monthValue = user.birthdate?.month ?? "";
  const dayValue = user.birthdate?.day ?? "";
  const yearValue = user.birthdate?.year ?? "";

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={[styles.heading, { color: palette.text }]}>
        Personal Information (under development)
      </Text>

      <FormSection
        title="Name"
        description="Change your name how you prefer it."
      >
        <View style={styles.row2}>
          <View style={styles.col}>
            <Field
              icon="person"
              placeholder="First"
              value={user.fullName.firstName}
              editable={false}
            />
          </View>
          <View style={styles.col}>
            <Field
              placeholder="Middle (Optional)"
              value={user.fullName.middleName ?? ""}
              editable={false}
            />
          </View>
        </View>
        <Field
          icon="badge"
          placeholder="Last"
          value={user.fullName.lastName}
          editable={false}
        />
      </FormSection>

      <FormSection title="Birthdate" description="Update your birthdate.">
        <View style={styles.row3}>
          <View style={styles.col}>
            <Field icon="event" placeholder="Month" value={monthValue} editable={false} />
          </View>
          <View style={styles.col}>
            <Field placeholder="Day" value={dayValue} editable={false} />
          </View>
          <View style={styles.col}>
            <Field placeholder="Year" value={yearValue} editable={false} />
          </View>
        </View>
      </FormSection>

      <FormSection title="Gender" description="Update your gender.">
        <View style={styles.row3}>
          {(["Male", "Female", "Others"] as const).map((g) => {
            const active = gender === g;
            return (
              <Pressable
                key={g}
                onPress={() => setGender(g)}
                style={[
                  styles.genderBtn,
                  {
                    backgroundColor: active ? palette.brandSoft : palette.surface,
                    borderColor: active ? palette.brand : palette.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: active ? palette.brand : palette.text2,
                    fontWeight: "600",
                    fontSize: 13,
                  }}
                >
                  {g}
                </Text>
              </Pressable>
            );
          })}
        </View>
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
  row2: { flexDirection: "row", gap: 10 },
  row3: { flexDirection: "row", gap: 8 },
  col: { flex: 1 },
  genderBtn: {
    flex: 1,
    height: 44,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
