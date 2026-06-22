/* Server detail — ports the channels pane from
 * webapp/src/app/tabs/servers/partials/Channels.tsx.
 *
 * Receives a `{ serverID, serverName, profile }` route param from the
 * Servers grid tap; fetches the full server channels list via
 * InitServerChannelsRequest; renders text/voice/location channel rows
 * grouped together. Tapping a text channel opens Conversation keyed
 * by the channel's groupID; voice/location remain disabled with a
 * visible kind hint.
 *
 * TODOs:
 *   - Voice channel join: depends on the MediaSoup active call UI.
 *   - Location channel: depends on the full MapFeed port (list view
 *     ships now, map view comes with @rnmapbox/maps). */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSelector } from 'react-redux';

import type { AppState } from '../../../redux/store';
import { useTheme } from '../../../reusables/design/ThemeProvider';
import { CLIcon, IconBtn } from '../../../reusables/design/primitives';
import { radii } from '../../../reusables/design/tokens';
import {
  InitServerChannelsRequest,
  ServerChannel,
  ServerDetails,
} from '../../../reusables/hooks/requests';
import { CreateChannelModal } from './CreateChannelModal';
import { ServerInfoModal } from './ServerInfoModal';

interface ServerDetailParams {
  serverID: string;
  serverName: string;
  profile?: string;
}

function channelIconFor(channel: ServerChannel): string {
  // Webapp uses FaHashtag (text) / AiFillSound (voice) / FaLocationArrow (location).
  // Material Icons equivalents:
  const t = (channel.channelType ?? channel.type ?? '').toLowerCase();
  if (t.includes('voice')) return 'volume-up';
  if (t.includes('location')) return 'near-me';
  return 'tag';
}

export default function ServerDetail() {
  const { palette } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { serverID, serverName, profile } = route.params as ServerDetailParams;
  const myUserID = useSelector((s: AppState) => s.authentication.user.userID);

  const [details, setDetails] = useState<ServerDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  // Server channels deliver to every member except the current user.
  // Recomputed when the server roster changes (e.g. after refresh).
  const receivers = useMemo(() => {
    return (details?.usersWithInfo ?? [])
      .map(m => m._id)
      .filter((id): id is string => !!id && id !== myUserID);
  }, [details?.usersWithInfo, myUserID]);

  const openTextChannel = useCallback(
    (channel: ServerChannel) => {
      navigation.navigate('Conversation', {
        conversationID: channel.groupID,
        type: 'server',
        title: channel.groupName,
        profile: channel.profile ?? profile,
        receivers,
      });
    },
    [navigation, profile, receivers],
  );

  const load = useCallback(
    async (silent: boolean) => {
      if (!silent) setIsLoading(true);
      const result = await InitServerChannelsRequest(serverID);
      setDetails(result);
      setIsLoading(false);
      setRefreshing(false);
    },
    [serverID],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  const hasAvatar = profile && profile !== 'N/A';
  const initial = serverName.charAt(0).toUpperCase();
  const channels = details?.channels ?? [];

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.screen, { backgroundColor: palette.bg }]}
    >
      <View style={styles.headerBar}>
        <IconBtn
          n="arrow-back"
          iconSize={22}
          color={palette.text}
          onPress={() => navigation.goBack()}
        />
        <View style={styles.headerCenter}>
          <Text
            numberOfLines={1}
            style={[styles.headerTitle, { color: palette.text }]}
          >
            {serverName}
          </Text>
          {details ? (
            <Text style={[styles.headerSub, { color: palette.text3 }]}>
              {channels.length} channel{channels.length === 1 ? '' : 's'}
              {details.is_admin ? ' · Admin' : ''}
            </Text>
          ) : null}
        </View>
        <IconBtn
          n="info-outline"
          iconSize={22}
          color={palette.text2}
          onPress={details ? () => setInfoOpen(true) : undefined}
        />
      </View>

      {isLoading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={palette.brand} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={palette.brand}
            />
          }
        >
          <View
            style={[
              styles.banner,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
              },
            ]}
          >
            {hasAvatar ? (
              <Image source={{ uri: profile }} style={styles.bannerAvatar} />
            ) : (
              <View
                style={[
                  styles.bannerAvatar,
                  styles.avatarFallback,
                  { backgroundColor: palette.goldSoft },
                ]}
              >
                <Text style={[styles.bannerInitial, { color: palette.gold }]}>
                  {initial}
                </Text>
              </View>
            )}
            <Text
              numberOfLines={1}
              style={[styles.bannerName, { color: palette.text }]}
            >
              {serverName}
            </Text>
            {details?.privacy ? (
              <View
                style={[
                  styles.privacyChip,
                  { backgroundColor: palette.surface2 },
                ]}
              >
                <CLIcon n="lock" size={12} color={palette.text2} />
                <Text style={[styles.privacyText, { color: palette.text2 }]}>
                  Private
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionLabel, { color: palette.text3 }]}>
              CHANNELS
            </Text>
            {details?.is_admin ? (
              <Pressable
                onPress={() => setCreateChannelOpen(true)}
                style={({ pressed }) => [
                  styles.addChannelBtn,
                  {
                    backgroundColor: palette.surface2,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <CLIcon n="add" size={14} color={palette.text} />
                <Text style={[styles.addChannelText, { color: palette.text }]}>
                  New
                </Text>
              </Pressable>
            ) : null}
          </View>

          {channels.length === 0 ? (
            <View
              style={[
                styles.empty,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                },
              ]}
            >
              <CLIcon n="tag" size={32} color={palette.text3} />
              <Text style={[styles.emptyText, { color: palette.text3 }]}>
                No channels yet
              </Text>
            </View>
          ) : (
            channels.map(channel => {
              const icon = channelIconFor(channel);
              const channelKind = (
                channel.channelType ??
                channel.type ??
                ''
              ).toLowerCase();
              const isVoice = channelKind.includes('voice');
              const isLocation = channelKind.includes('location');
              const isText = !isVoice && !isLocation;
              const hasParticipants =
                (channel.voice_participants?.length ?? 0) > 0;
              return (
                <Pressable
                  key={channel._id}
                  onPress={isText ? () => openTextChannel(channel) : undefined}
                  disabled={!isText}
                  style={({ pressed }) => [
                    styles.channelRow,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.border,
                      opacity: !isText ? 0.55 : pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <CLIcon n={icon} size={20} color={palette.text2} />
                  <Text
                    numberOfLines={1}
                    style={[styles.channelName, { color: palette.text }]}
                  >
                    {channel.groupName}
                  </Text>
                  {channel.privacy ? (
                    <CLIcon n="lock" size={14} color={palette.text3} />
                  ) : null}
                  {isVoice ? (
                    <Text style={[styles.kindHint, { color: palette.text3 }]}>
                      Voice
                    </Text>
                  ) : null}
                  {isLocation ? (
                    <Text style={[styles.kindHint, { color: palette.text3 }]}>
                      Location
                    </Text>
                  ) : null}
                  {hasParticipants ? (
                    <View
                      style={[
                        styles.liveDot,
                        { backgroundColor: palette.green },
                      ]}
                    />
                  ) : null}
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}

      {details ? (
        <>
          <CreateChannelModal
            visible={createChannelOpen}
            onClose={() => setCreateChannelOpen(false)}
            onCreated={() => load(true)}
            serverID={details.serverID}
            serverMembers={details.usersWithInfo ?? []}
          />
          <ServerInfoModal
            visible={infoOpen}
            onClose={() => setInfoOpen(false)}
            details={details}
          />
        </>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 10,
    gap: 8,
  },
  headerCenter: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  headerSub: { fontSize: 11.5, marginTop: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, gap: 10 },

  banner: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 16,
    alignItems: 'center',
    gap: 10,
  },
  bannerAvatar: { width: 72, height: 72, borderRadius: radii.md },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  bannerInitial: { fontSize: 26, fontWeight: '800' },
  bannerName: { fontSize: 16, fontWeight: '700' },
  privacyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    height: 22,
    borderRadius: radii.pill,
  },
  privacyText: { fontSize: 11, fontWeight: '600' },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginLeft: 4,
    marginRight: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  addChannelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 26,
    borderRadius: radii.pill,
  },
  addChannelText: { fontSize: 11, fontWeight: '700' },

  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
    borderRadius: radii.sm,
  },
  channelName: { flex: 1, fontSize: 14, fontWeight: '600' },
  kindHint: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
  },

  empty: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: { fontSize: 13, fontWeight: '600' },
});
