/* Settings tab — ports webapp/src/app/tabs/settings/Settings.tsx.
 *
 * Master/detail shell with the same three categories (Account /
 * Messages / Location) and the same item set. Each item routes to a
 * detail placeholder until the corresponding section component is
 * ported — see the matching TODO(section:*) markers below for the
 * webapp source paths to mirror.
 *
 * On mobile the detail view fills the screen; a back chevron returns
 * to the list. (Desktop's side-by-side layout doesn't apply on RN.) */

import React, { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../../../reusables/design/ThemeProvider";
import { CLIcon, IconBtn } from "../../../reusables/design/primitives";
import { radii } from "../../../reusables/design/tokens";
import PersonalInformation from "./section/PersonalInformation";
import Credentials from "./section/Credentials";
import MapFeedSettings from "./section/MapFeedSettings";
import ArchivedMessages from "./section/ArchivedMessages";

interface SettingsItem {
  key: string;
  icon: string;
  name: string;
  description: string;
  isDisabled: boolean;
  /** Webapp source path for the section's content — see TODO(section:*). */
  source: string | null;
}

interface SettingsCategory {
  category: string;
  description: string;
  items: SettingsItem[];
}

export default function Settings() {
  const { palette } = useTheme();
  const [openItem, setOpenItem] = useState<SettingsItem | null>(null);

  const mappedSettingsList: SettingsCategory[] = useMemo(
    () => [
      {
        category: "Account",
        description:
          "Review, update, validate, and manage your account information.",
        items: [
          {
            key: "personal",
            icon: "account-circle",
            name: "Personal Information",
            description:
              "Change your name, birthdate, address, and your other public info.",
            isDisabled: false,
            // TODO(section:personal): port webapp/src/app/tabs/settings/section/PersonalInformation.tsx
            source: "webapp/src/app/tabs/settings/section/PersonalInformation.tsx",
          },
          {
            key: "credentials",
            icon: "vpn-key",
            name: "Credentials",
            description: "Setup or update your account credentials.",
            isDisabled: false,
            // TODO(section:credentials): port webapp/src/app/tabs/settings/section/Credentials.tsx
            source: "webapp/src/app/tabs/settings/section/Credentials.tsx",
          },
          {
            key: "privacy",
            icon: "lock",
            name: "Privacy",
            description: "Configure your account privacy settings.",
            isDisabled: true,
            source: null,
          },
        ],
      },
      {
        category: "Messages",
        description:
          "Archived or restricted messages and other messaging settings.",
        items: [
          {
            key: "archives",
            icon: "inventory-2",
            name: "Archives",
            description:
              "Check your archived messages and revisit conversations.",
            isDisabled: false,
            // TODO(section:archives): port webapp/src/app/tabs/settings/section/ArchivedMessages.tsx
            source: "webapp/src/app/tabs/settings/section/ArchivedMessages.tsx",
          },
          {
            key: "restricted",
            icon: "block",
            name: "Restricted",
            description:
              "Access your restricted conversations and/or unrestrict people.",
            isDisabled: true,
            source: null,
          },
        ],
      },
      {
        category: "Location",
        description: "View or modify how the app displays your location.",
        items: [
          {
            key: "map",
            icon: "map",
            name: "Map Feed Access",
            description:
              "Change how Map Feed uses or displays your location.",
            isDisabled: false,
            // TODO(section:map): port webapp/src/app/tabs/settings/section/MapFeedSettings.tsx
            source: "webapp/src/app/tabs/settings/section/MapFeedSettings.tsx",
          },
        ],
      },
    ],
    [],
  );

  const onItemPress = useCallback((it: SettingsItem) => {
    if (it.isDisabled) return;
    setOpenItem(it);
  }, []);

  const onBack = useCallback(() => setOpenItem(null), []);

  if (openItem) {
    let sectionBody: React.ReactNode;
    switch (openItem.key) {
      case "personal":
        sectionBody = <PersonalInformation />;
        break;
      case "credentials":
        sectionBody = <Credentials />;
        break;
      case "map":
        sectionBody = <MapFeedSettings />;
        break;
      case "archives":
        sectionBody = <ArchivedMessages />;
        break;
      default:
        sectionBody = (
          <View
            style={[
              styles.detailBody,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
              },
            ]}
          >
            <CLIcon n={openItem.icon} size={42} color={palette.text3} />
            <Text style={[styles.detailHeadline, { color: palette.text }]}>
              {openItem.name}
            </Text>
            <Text style={[styles.detailHint, { color: palette.text3 }]}>
              {openItem.description}
            </Text>
            <Text style={[styles.detailTodo, { color: palette.text3 }]}>
              TODO: port {openItem.source}
            </Text>
          </View>
        );
    }

    return (
      <SafeAreaView
        edges={["top"]}
        style={[styles.screen, { backgroundColor: palette.bg }]}
      >
        <View style={styles.detailHeader}>
          <IconBtn
            n="arrow-back"
            iconSize={22}
            color={palette.text}
            onPress={onBack}
          />
          <Text
            numberOfLines={1}
            style={[styles.detailTitle, { color: palette.text }]}
          >
            {openItem.name}
          </Text>
        </View>
        {sectionBody}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.screen, { backgroundColor: palette.bg }]}
    >
      <View style={styles.titleBar}>
        <Text style={[styles.titleText, { color: palette.text }]}>
          Settings
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.listContent}>
        {mappedSettingsList.map((cat) => (
          <View
            key={cat.category}
            style={[
              styles.card,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            <Text style={[styles.catName, { color: palette.text }]}>
              {cat.category}
            </Text>
            <Text style={[styles.catDesc, { color: palette.text3 }]}>
              {cat.description}
            </Text>
            <View style={styles.itemList}>
              {cat.items.map((it) => (
                <Pressable
                  key={it.key}
                  onPress={() => onItemPress(it)}
                  disabled={it.isDisabled}
                  style={({ pressed }) => [
                    styles.item,
                    {
                      opacity: it.isDisabled ? 0.5 : pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.itemIcon,
                      { backgroundColor: palette.surface2 },
                    ]}
                  >
                    <CLIcon n={it.icon} size={26} color={palette.text2} />
                  </View>
                  <View style={styles.itemBody}>
                    <Text
                      numberOfLines={1}
                      style={[styles.itemName, { color: palette.text }]}
                    >
                      {it.name}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={[styles.itemDesc, { color: palette.text3 }]}
                    >
                      {it.description}
                    </Text>
                  </View>
                  {!it.isDisabled ? (
                    <CLIcon
                      n="chevron-right"
                      size={22}
                      color={palette.text3}
                    />
                  ) : null}
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  titleBar: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 12,
  },
  titleText: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 18,
  },
  catName: { fontSize: 14, fontWeight: "700" },
  catDesc: { fontSize: 12, marginTop: 4 },
  itemList: {
    marginTop: 14,
    gap: 16,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  itemIcon: {
    width: 50,
    height: 50,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  itemBody: { flex: 1, minWidth: 0 },
  itemName: { fontSize: 14, fontWeight: "600" },
  itemDesc: { fontSize: 12, marginTop: 2 },

  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 4,
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
    flex: 1,
  },
  detailBody: {
    margin: 16,
    padding: 22,
    borderWidth: 1,
    borderRadius: radii.md,
    alignItems: "center",
    gap: 10,
  },
  detailHeadline: { fontSize: 18, fontWeight: "800", marginTop: 8 },
  detailHint: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  detailTodo: {
    fontSize: 11.5,
    textAlign: "center",
    marginTop: 14,
    lineHeight: 16,
  },
});
