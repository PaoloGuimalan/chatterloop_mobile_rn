/* Map Feed — list-view shipped first; the actual map lands when
 * @rnmapbox/maps + lottie are installed.
 *
 * Reads the `coordinates` redux slice (fed by SSE `coordinates_broadcast`)
 * and shows everyone who is currently sharing a position. Names are
 * cross-referenced against `contactslist` so contacts get full names +
 * avatars; non-contact broadcasters fall back to a short referenceID
 * tail so the row still renders.
 *
 * Your own row (if you're sharing) is pinned at the top with no
 * distance. Other rows are sorted by distance ascending when both
 * your position and theirs are known; otherwise sorted by referenceID
 * for stable ordering.
 *
 * The Map Feed Access settings toggle gates *sending* coordinates
 * (handled in MapFeedSettings + the eventual location streamer), not
 * receiving — so this list shows whoever is broadcasting regardless
 * of your own sharing state. */

import React, { useCallback, useMemo } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';

import type { AppState } from '../../../redux/store';
import { useTheme } from '../../../reusables/design/ThemeProvider';
import { CLIcon } from '../../../reusables/design/primitives';
import { radii } from '../../../reusables/design/tokens';
import type {
  IContact,
  IUserSettings,
  PaginationProp,
} from '../../../reusables/vars/interfaces';

interface CoordinateEntry {
  referenceID?: string;
  label?: string;
  longitude?: number;
  latitude?: number;
  type?: string;
}

interface ContactSummary {
  name: string;
  username: string | null;
  profile: string | null;
}

function buildContactDirectory(
  contacts: PaginationProp<IContact>,
  me: string,
): Map<string, ContactSummary> {
  const map = new Map<string, ContactSummary>();
  for (const c of contacts.results ?? []) {
    if (c.type !== 'single') continue;
    for (const side of [c.action_by, c.involved_user]) {
      if (!side?.id || side.id === me) continue;
      if (map.has(side.id)) continue;
      const middle =
        side.middle_name && side.middle_name !== 'N/A'
          ? ` ${side.middle_name}`
          : '';
      map.set(side.id, {
        name: `${side.first_name}${middle} ${side.last_name}`.trim(),
        username: side.username ?? null,
        profile: side.profile && side.profile !== 'none' ? side.profile : null,
      });
    }
  }
  return map;
}

/** Haversine great-circle distance in kilometres. */
function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

interface Row {
  key: string;
  entry: CoordinateEntry;
  isSelf: boolean;
  contact: ContactSummary | null;
  distanceKm: number | null;
}

export default function MapFeed() {
  const { palette } = useTheme();
  const navigation = useNavigation<any>();
  const coordinates = useSelector(
    (s: AppState) => s.coordinates as CoordinateEntry[],
  );
  const contacts = useSelector(
    (s: AppState) => s.contactslist as PaginationProp<IContact>,
  );
  const me = useSelector((s: AppState) => s.authentication.user.userID);
  const usersettings = useSelector(
    (s: AppState) => s.usersettings as IUserSettings,
  );

  const directory = useMemo(
    () => buildContactDirectory(contacts, me),
    [contacts, me],
  );

  const myPosition = useMemo(() => {
    const mine = coordinates.find(c => c.referenceID === me);
    if (
      mine?.latitude == null ||
      mine?.longitude == null ||
      Number.isNaN(mine.latitude) ||
      Number.isNaN(mine.longitude)
    ) {
      return null;
    }
    return { latitude: mine.latitude, longitude: mine.longitude };
  }, [coordinates, me]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = coordinates
      .filter(c => c.referenceID)
      .map(c => {
        const isSelf = c.referenceID === me;
        const contact = !isSelf ? directory.get(c.referenceID!) ?? null : null;
        let dist: number | null = null;
        if (
          !isSelf &&
          myPosition &&
          c.latitude != null &&
          c.longitude != null
        ) {
          dist = distanceKm(myPosition, {
            latitude: c.latitude,
            longitude: c.longitude,
          });
        }
        return {
          key: c.referenceID!,
          entry: c,
          isSelf,
          contact,
          distanceKm: dist,
        };
      });
    out.sort((a, b) => {
      if (a.isSelf) return -1;
      if (b.isSelf) return 1;
      if (a.distanceKm != null && b.distanceKm != null) {
        return a.distanceKm - b.distanceKm;
      }
      if (a.distanceKm != null) return -1;
      if (b.distanceKm != null) return 1;
      return a.key.localeCompare(b.key);
    });
    return out;
  }, [coordinates, directory, me, myPosition]);

  const openSettings = useCallback(() => {
    navigation.navigate('Settings');
  }, [navigation]);

  const renderRow = useCallback(
    ({ item }: { item: Row }) => {
      const e = item.entry;
      const name = item.isSelf
        ? 'You'
        : item.contact?.name ?? `User ${item.key.slice(-6)}`;
      const sub = item.isSelf
        ? e.label ?? 'Sharing your location'
        : item.contact?.username
        ? `@${item.contact.username}`
        : e.label ?? 'Broadcasting';
      const profile = item.contact?.profile ?? null;
      const initial = (name === 'You' ? 'Y' : name).charAt(0).toUpperCase();

      return (
        <View
          style={[
            styles.row,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
            },
          ]}
        >
          {profile ? (
            <Image source={{ uri: profile }} style={styles.avatar} />
          ) : (
            <View
              style={[
                styles.avatar,
                styles.avatarFallback,
                {
                  backgroundColor: item.isSelf
                    ? palette.brandSoft
                    : palette.surface2,
                },
              ]}
            >
              <Text
                style={[
                  styles.avatarInitial,
                  { color: item.isSelf ? palette.brand : palette.text2 },
                ]}
              >
                {initial}
              </Text>
            </View>
          )}
          <View style={styles.copy}>
            <Text
              numberOfLines={1}
              style={[styles.name, { color: palette.text }]}
            >
              {name}
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.sub, { color: palette.text3 }]}
            >
              {sub}
            </Text>
          </View>
          <View style={styles.distanceWrap}>
            {item.isSelf ? (
              <Text style={[styles.selfTag, { color: palette.brand }]}>YOU</Text>
            ) : item.distanceKm != null ? (
              <Text style={[styles.distance, { color: palette.text2 }]}>
                {formatDistance(item.distanceKm)}
              </Text>
            ) : (
              <Text style={[styles.distance, { color: palette.text3 }]}>
                —
              </Text>
            )}
          </View>
        </View>
      );
    },
    [palette],
  );

  if (rows.length === 0) {
    return (
      <SafeAreaView
        edges={['top']}
        style={[styles.screen, { backgroundColor: palette.bg }]}
      >
        <View style={styles.titleBar}>
          <View
            style={[styles.titleIcon, { backgroundColor: palette.brandSoft }]}
          >
            <CLIcon n="map" size={18} color={palette.brand} />
          </View>
          <Text style={[styles.title, { color: palette.text }]}>Map Feed</Text>
        </View>
        <View style={styles.empty}>
          <CLIcon n="explore-off" size={32} color={palette.text3} />
          <Text style={[styles.emptyHead, { color: palette.text }]}>
            No one nearby is sharing
          </Text>
          <Text style={[styles.emptyBody, { color: palette.text2 }]}>
            When you or your contacts enable location sharing, they'll show up
            here.
          </Text>
          <Pressable
            onPress={openSettings}
            style={({ pressed }) => [
              styles.emptyAction,
              {
                backgroundColor: palette.brand,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={styles.emptyActionText}>Open Map Feed settings</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.screen, { backgroundColor: palette.bg }]}
    >
      <View style={styles.titleBar}>
        <View style={[styles.titleIcon, { backgroundColor: palette.brandSoft }]}>
          <CLIcon n="map" size={18} color={palette.brand} />
        </View>
        <Text style={[styles.title, { color: palette.text }]}>Map Feed</Text>
        <Pressable
          onPress={openSettings}
          style={({ pressed }) => [
            styles.settingsBtn,
            {
              backgroundColor: palette.surface2,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <CLIcon n="tune" size={14} color={palette.text2} />
          <Text style={[styles.settingsBtnText, { color: palette.text2 }]}>
            {usersettings.map_feed_access.share_location ? 'Sharing' : 'Private'}
          </Text>
        </Pressable>
      </View>
      <Text style={[styles.note, { color: palette.text3 }]}>
        List view. Full map ships with the next update.
      </Text>
      <FlatList
        data={rows}
        keyExtractor={r => r.key}
        renderItem={renderRow}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  titleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  titleIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  settingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 26,
    borderRadius: radii.pill,
  },
  settingsBtnText: { fontSize: 11.5, fontWeight: '700' },

  note: {
    fontSize: 11.5,
    fontWeight: '600',
    marginLeft: 16,
    marginBottom: 6,
  },
  list: { padding: 12, paddingTop: 6, gap: 8 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: radii.md,
  },
  avatar: { width: 44, height: 44, borderRadius: radii.pill },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 16, fontWeight: '800' },

  copy: { flex: 1, gap: 1 },
  name: { fontSize: 14, fontWeight: '700' },
  sub: { fontSize: 11.5 },

  distanceWrap: { alignItems: 'flex-end', minWidth: 60 },
  distance: { fontSize: 12, fontWeight: '700' },
  selfTag: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyHead: { fontSize: 16, fontWeight: '700' },
  emptyBody: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  emptyAction: {
    marginTop: 8,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActionText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
