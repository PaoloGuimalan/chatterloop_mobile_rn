/* Servers tab — ports the list rail from webapp/src/app/tabs/servers/Servers.tsx.
 *
 * Webapp scope was master/detail (rail + routed Channels). On RN the
 * detail half is a separate stack screen so this file is just the
 * list — a scrollable grid of server tiles fetched once via
 * InitServerListRequest. Tap = navigate to the per-server detail
 * which is still a stub.
 *
 * TODOs:
 *   - Realtime: server membership changes don't push yet (webapp doesn't
 *     either — list is fetched once on mount). */

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";

import { useTheme } from "../../../reusables/design/ThemeProvider";
import { Btn, CLIcon } from "../../../reusables/design/primitives";
import { radii } from "../../../reusables/design/tokens";
import {
  InitServerListRequest,
  ServerSummary,
} from "../../../reusables/hooks/requests";
import { CreateServerModal } from "./CreateServerModal";

export default function Servers() {
  const { palette } = useTheme();
  const navigation = useNavigation<any>();
  const [servers, setServers] = useState<ServerSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async (silent: boolean) => {
    if (!silent) setIsLoading(true);
    const list = await InitServerListRequest();
    setServers(list);
    setIsLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  const renderItem = useCallback(
    ({ item }: { item: ServerSummary }) => {
      const hasAvatar = item.profile && item.profile !== "N/A";
      const initial = item.serverName.charAt(0).toUpperCase();
      return (
        <Pressable
          onPress={() =>
            navigation.navigate("ServerDetail", {
              serverID: item.serverID,
              serverName: item.serverName,
              profile: item.profile,
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
                { backgroundColor: palette.goldSoft },
              ]}
            >
              <Text style={[styles.avatarInitial, { color: palette.gold }]}>
                {initial}
              </Text>
            </View>
          )}
          <Text
            numberOfLines={2}
            style={[styles.tileName, { color: palette.text }]}
          >
            {item.serverName}
          </Text>
        </Pressable>
      );
    },
    [palette, navigation],
  );

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.screen, { backgroundColor: palette.bg }]}
    >
      <View style={styles.titleBar}>
        <View
          style={[styles.titleIcon, { backgroundColor: palette.goldSoft }]}
        >
          <CLIcon n="dns" size={18} color={palette.gold} />
        </View>
        <Text style={[styles.titleText, { color: palette.text }]}>Servers</Text>
        <Btn
          size="sm"
          variant="soft"
          iconL="add"
          label="New"
          onPress={() => setCreateOpen(true)}
        />
      </View>

      {isLoading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={palette.brand} />
        </View>
      ) : servers.length === 0 ? (
        <View style={styles.center}>
          <CLIcon n="dns" size={42} color={palette.text3} />
          <Text style={[styles.emptyText, { color: palette.text3 }]}>
            No servers yet
          </Text>
          <Text style={[styles.emptyHint, { color: palette.text3 }]}>
            Create one to start chatting with channels and roles.
          </Text>
        </View>
      ) : (
        <FlatList
          data={servers}
          keyExtractor={(s) => s.serverID}
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

      <CreateServerModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => load(true)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  titleBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 10,
  },
  titleIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  titleText: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 32,
  },
  emptyText: { fontSize: 14, fontWeight: "600" },
  emptyHint: { fontSize: 12, textAlign: "center", lineHeight: 17 },
  gridContent: { paddingHorizontal: 12, paddingBottom: 32, gap: 12 },
  columnWrapper: { gap: 12 },
  tile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 16,
    alignItems: "center",
    gap: 10,
  },
  avatar: { width: 60, height: 60, borderRadius: radii.md },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontSize: 22, fontWeight: "800" },
  tileName: { fontSize: 13, fontWeight: "700", textAlign: "center" },
});
