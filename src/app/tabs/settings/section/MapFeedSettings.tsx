/* Map Feed Access section — ports
 * webapp/src/app/tabs/settings/section/MapFeedSettings.tsx.
 *
 * Two toggles:
 *   - Enable location (gates the whole feature).
 *   - Share location (only visible when enable_location is on).
 *
 * Each change dispatches SET_USER_SETTINGS and persists via
 * persistUserSettings — same shape the webapp uses but stored in
 * AsyncStorage instead of IndexedDB. */

import React, { useCallback } from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useDispatch, useSelector } from "react-redux";

import type { AppState } from "../../../../redux/store";
import { useTheme } from "../../../../reusables/design/ThemeProvider";
import { SET_USER_SETTINGS } from "../../../../redux/types";
import { persistUserSettings } from "../../../../reusables/hooks/usersettings";
import { IUserSettings } from "../../../../reusables/vars/interfaces";

export default function MapFeedSettings() {
  const { palette } = useTheme();
  const dispatch = useDispatch();
  const authentication = useSelector((s: AppState) => s.authentication);
  const usersettings = useSelector(
    (s: AppState) => s.usersettings as IUserSettings,
  );

  const update = useCallback(
    (next: IUserSettings) => {
      dispatch({
        type: SET_USER_SETTINGS,
        payload: { usersettings: next },
      });
      persistUserSettings(authentication.user.userID, next);
    },
    [authentication.user.userID, dispatch],
  );

  const onToggleEnable = useCallback(
    (v: boolean) => {
      update({
        ...usersettings,
        map_feed_access: {
          ...usersettings.map_feed_access,
          enable_location: v,
          // Turning location off also drops sharing so it doesn't reappear
          // silently the next time the user re-enables location.
          share_location: v ? usersettings.map_feed_access.share_location : false,
        },
      });
    },
    [update, usersettings],
  );

  const onToggleShare = useCallback(
    (v: boolean) => {
      update({
        ...usersettings,
        map_feed_access: {
          ...usersettings.map_feed_access,
          share_location: v,
        },
      });
    },
    [update, usersettings],
  );

  const enabled = usersettings.map_feed_access.enable_location;
  const sharing = usersettings.map_feed_access.share_location;

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={[styles.heading, { color: palette.text }]}>
        Map Feed Access
      </Text>

      <View style={styles.section}>
        <View style={styles.copy}>
          <Text style={[styles.label, { color: palette.text }]}>
            Enable location
          </Text>
          <Text style={[styles.desc, { color: palette.text2 }]}>
            Let the app use your location.
          </Text>
        </View>
        <View style={styles.toggleRow}>
          <Switch
            value={enabled}
            onValueChange={onToggleEnable}
            trackColor={{ false: palette.surface3, true: palette.brand }}
            thumbColor={palette.surface}
          />
          <Text style={[styles.toggleLabel, { color: palette.text2 }]}>
            {enabled ? "Enabled" : "Disabled"}
          </Text>
        </View>
      </View>

      {enabled ? (
        <View style={styles.section}>
          <View style={styles.copy}>
            <Text style={[styles.label, { color: palette.text }]}>
              Share location
            </Text>
            <Text style={[styles.desc, { color: palette.text2 }]}>
              Let your friends know where you are, and let anyone nearby see
              your location.
            </Text>
          </View>
          <View style={styles.toggleRow}>
            <Switch
              value={sharing}
              onValueChange={onToggleShare}
              trackColor={{ false: palette.surface3, true: palette.brand }}
              thumbColor={palette.surface}
            />
            <Text style={[styles.toggleLabel, { color: palette.text2 }]}>
              {sharing ? "Sharing" : "Disabled"}
            </Text>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, gap: 10 },
  heading: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
  section: { gap: 12, marginTop: 18 },
  copy: { gap: 4 },
  label: { fontSize: 14, fontWeight: "600" },
  desc: { fontSize: 13, lineHeight: 18 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
  },
  toggleLabel: { fontSize: 13, fontWeight: "500" },
});
