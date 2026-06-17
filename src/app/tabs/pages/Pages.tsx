/* Pages tab — ports webapp/src/app/tabs/pages/Pages.tsx (rail) +
 * partials/MyPagesList.tsx + partials/FollowedPages.tsx.
 *
 * Webapp uses a vertical icon rail to switch between "My Pages" and
 * "Followed Pages". On RN we flatten that into a segmented control at
 * the top of a single screen — same two data sources, same realm tile
 * grid.
 *
 * TODOs:
 *   - Page detail view (tap a tile) — depends on porting the realm
 *     profile screen, still a stub.
 *   - Create-page flow — webapp routes /pages/my-pages/create. Wire
 *     once the form is ported. */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { useTheme } from '../../../reusables/design/ThemeProvider';
import { Btn, CLIcon } from '../../../reusables/design/primitives';
import { radii } from '../../../reusables/design/tokens';
import {
  GetFollowRealmRequest,
  GetMyRealmsRequest,
  RealmProfileInfo,
} from '../../../reusables/hooks/requests';

type PagesTab = 'my' | 'followed';

const RANGE = 10;

export default function Pages() {
  const { palette } = useTheme();
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<PagesTab>('my');
  const [pages, setPages] = useState<RealmProfileInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (which: PagesTab, silent: boolean) => {
    if (!silent) setIsLoading(true);
    const fetcher = which === 'my' ? GetMyRealmsRequest : GetFollowRealmRequest;
    const response = await fetcher(1, RANGE, 'page');
    setPages(response.results ?? []);
    setIsLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load(tab, false);
  }, [tab, load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(tab, true);
  }, [tab, load]);

  const renderItem = useCallback(
    ({ item }: { item: RealmProfileInfo }) => {
      const hasAvatar = item.profile && item.profile !== 'N/A';
      const initial = item.name.charAt(0).toUpperCase();
      return (
        <Pressable
          onPress={() =>
            navigation.navigate('PageDetail', {
              realmID: item.id,
              slug: item.slug,
              name: item.name,
              profile: item.profile,
              cover: (item as { cover?: string }).cover,
              description: item.description,
              isVerified: (item as { is_verified?: boolean }).is_verified,
              // My-tab tiles are pages I own (no follow toggle); followed-tab
              // tiles are by definition already followed.
              isFollowing: tab === 'followed',
            })
          }
          style={({ pressed }) => [
            styles.tile,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          {hasAvatar ? (
            <Image source={{ uri: item.profile }} style={styles.avatar} />
          ) : (
            <View
              style={[
                styles.avatar,
                styles.avatarFallback,
                { backgroundColor: palette.brandSoft },
              ]}
            >
              <Text style={[styles.avatarInitial, { color: palette.brand }]}>
                {initial}
              </Text>
            </View>
          )}
          <Text
            numberOfLines={2}
            style={[styles.tileName, { color: palette.text }]}
          >
            {item.name}
          </Text>
          {item.description ? (
            <Text
              numberOfLines={2}
              style={[styles.tileDesc, { color: palette.text3 }]}
            >
              {item.description}
            </Text>
          ) : null}
        </Pressable>
      );
    },
    [palette, navigation, tab],
  );

  const segments: { key: PagesTab; label: string }[] = [
    { key: 'my', label: 'My Pages' },
    { key: 'followed', label: 'Followed' },
  ];

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.screen, { backgroundColor: palette.bg }]}
    >
      <View style={styles.titleBar}>
        <View
          style={[styles.titleIcon, { backgroundColor: palette.brandSoft }]}
        >
          <CLIcon n="auto-stories" size={18} color={palette.brand} />
        </View>
        <Text style={[styles.titleText, { color: palette.text }]}>Pages</Text>
        {tab === 'my' ? (
          <Btn
            size="sm"
            variant="soft"
            iconL="add"
            label="Create"
            // TODO(create-page): wire to create-page form once ported.
          />
        ) : null}
      </View>

      <View style={[styles.segments, { backgroundColor: palette.surface2 }]}>
        {segments.map(s => {
          const active = tab === s.key;
          return (
            <Pressable
              key={s.key}
              onPress={() => setTab(s.key)}
              style={[
                styles.segment,
                active && {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: active ? palette.brand : palette.text2 },
                ]}
              >
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={palette.brand} />
        </View>
      ) : pages.length === 0 ? (
        <View style={styles.center}>
          <CLIcon n="auto-stories" size={42} color={palette.text3} />
          <Text style={[styles.emptyText, { color: palette.text3 }]}>
            {tab === 'my' ? 'No pages created yet' : 'No followed pages'}
          </Text>
          <Text style={[styles.emptyHint, { color: palette.text3 }]}>
            {tab === 'my'
              ? 'Create your own page to start connecting through realms.'
              : 'Follow pages from the explore feed to see them here.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={pages}
          keyExtractor={p => p.id}
          renderItem={renderItem}
          numColumns={2}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.columnWrapper}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={palette.brand}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  titleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 10,
  },
  titleIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    flex: 1,
  },
  segments: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 4,
    borderRadius: radii.pill,
    gap: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentText: { fontSize: 13, fontWeight: '600' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 32,
  },
  emptyText: { fontSize: 14, fontWeight: '600' },
  emptyHint: { fontSize: 12, textAlign: 'center', lineHeight: 17 },
  gridContent: { paddingHorizontal: 12, paddingBottom: 32, gap: 12 },
  columnWrapper: { gap: 12 },
  tile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 14,
    alignItems: 'center',
    gap: 8,
  },
  avatar: { width: 60, height: 60, borderRadius: radii.md },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 22, fontWeight: '800' },
  tileName: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  tileDesc: { fontSize: 11, textAlign: 'center', lineHeight: 14 },
});
