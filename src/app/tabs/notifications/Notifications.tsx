/* Notifications tab — ports webapp/src/app/tabs/feed/Notifications.tsx.
 *
 * Reads from `state.notificationslist` which is fed both by the initial
 * NotificationInitRequest on mount AND by the SSE "notifications" /
 * "notifications_reload" events wired in sse.ts. So this screen
 * demonstrates the realtime path end-to-end: open it, get a push from
 * the server, the list updates without a re-fetch. */

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";

import type { AppState } from "../../../redux/store";
import { useTheme } from "../../../reusables/design/ThemeProvider";
import { Btn, CLIcon, IconBtn } from "../../../reusables/design/primitives";
import { radii } from "../../../reusables/design/tokens";
import { timeSince } from "../../../reusables/hooks/reusable";
import {
  AcceptContactRequest,
  NotificationAppendRequest,
  NotificationInitRequest,
  ReadNotificationsRequest,
} from "../../../reusables/hooks/requests";

interface NotificationItem {
  type: string;
  referenceID?: string;
  referenceStatus?: boolean;
  fromUserID?: string;
  fromUser?: {
    userID?: string;
    profile?: string;
    fullName?: { firstName?: string; lastName?: string };
  };
  content: { headline: string; details: string };
  date: { date: string; time?: string };
}

interface NotificationsList {
  list: NotificationItem[];
  totalunread: number;
  total: number;
  next: string | null;
}

export default function Notifications() {
  const dispatch = useDispatch();
  const nav = useNavigation<any>();
  const { palette } = useTheme();
  const notificationslist = useSelector(
    (s: AppState) => s.notificationslist as NotificationsList,
  );
  const alerts = useSelector((s: AppState) => s.alerts);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [busyConnId, setBusyConnId] = useState<string | null>(null);
  const range = 10;

  // Initial load. SSE will push subsequent updates straight into redux.
  useEffect(() => {
    NotificationInitRequest(1, range, dispatch, setIsLoading);
  }, [dispatch]);

  const onEndReached = useCallback(() => {
    if (loadingMore || isLoading) return;
    if (!notificationslist.next) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    NotificationAppendRequest(nextPage, range, dispatch, () =>
      setLoadingMore(false),
    );
  }, [dispatch, isLoading, loadingMore, notificationslist.next, page]);

  // Mark notifications read once the list has finished loading — mirrors
  // webapp behavior so opening the tab clears the unread badge.
  useEffect(() => {
    if (!isLoading) ReadNotificationsRequest();
  }, [isLoading]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    NotificationInitRequest(1, range, dispatch, (v) => {
      setRefreshing(v);
      setIsLoading(v);
    });
  }, [dispatch]);

  const acceptRequest = useCallback(
    (connection_id: string, to_user_id: string) => {
      setBusyConnId(connection_id);
      AcceptContactRequest(
        { connection_id, to_user_id },
        dispatch,
        alerts,
        () => setBusyConnId(null),
      );
    },
    [alerts, dispatch],
  );

  const renderItem = useCallback(
    ({ item }: { item: NotificationItem }) => {
      const isContactRequest = item.type === "contact_request";
      const showActions = isContactRequest && !item.referenceStatus;
      const profileURI =
        item.fromUser?.profile && item.fromUser.profile !== "none"
          ? item.fromUser.profile
          : undefined;
      const initial =
        item.fromUser?.fullName?.firstName?.charAt(0)?.toUpperCase() ??
        item.content.headline?.charAt(0)?.toUpperCase() ??
        "?";
      const busy = busyConnId === item.referenceID;

      return (
        <View
          style={[
            styles.row,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          {profileURI ? (
            <Image source={{ uri: profileURI }} style={styles.avatar} />
          ) : (
            <View
              style={[
                styles.avatar,
                {
                  backgroundColor: palette.brandSoft,
                  alignItems: "center",
                  justifyContent: "center",
                },
              ]}
            >
              <Text style={{ color: palette.brand, fontWeight: "700" }}>
                {initial}
              </Text>
            </View>
          )}
          <View style={styles.body}>
            <View style={styles.header}>
              <Text
                numberOfLines={1}
                style={[styles.headline, { color: palette.text }]}
              >
                {item.content.headline}
              </Text>
              <Text style={[styles.time, { color: palette.text3 }]}>
                {item.date.time
                  ? `${item.date.date} · ${item.date.time}`
                  : timeSince(item.date.date)}
              </Text>
            </View>
            <Text style={[styles.details, { color: palette.text2 }]}>
              {item.content.details}
            </Text>
            {showActions && item.referenceID && item.fromUserID ? (
              <View style={styles.actions}>
                <Btn
                  size="sm"
                  disabled={busy}
                  onPress={() =>
                    acceptRequest(item.referenceID!, item.fromUserID!)
                  }
                >
                  Confirm
                </Btn>
                <Btn size="sm" variant="outline" disabled={busy}>
                  Decline
                </Btn>
                {/* TODO(decline): port DeclineContactRequest — webapp version
                    is commented out, may need backend re-add. */}
              </View>
            ) : null}
          </View>
        </View>
      );
    },
    [palette, busyConnId, acceptRequest],
  );

  const showInitialLoader = isLoading && !refreshing;

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.screen, { backgroundColor: palette.bg }]}
    >
      <View style={styles.titleBar}>
        {nav.canGoBack() ? (
          <IconBtn
            n="arrow-back"
            iconSize={22}
            color={palette.text}
            onPress={() => nav.goBack()}
          />
        ) : (
          <View
            style={[
              styles.titleIcon,
              { backgroundColor: palette.goldSoft },
            ]}
          >
            <CLIcon n="notifications" size={18} color={palette.gold} />
          </View>
        )}
        <Text style={[styles.title, { color: palette.text }]}>Activity</Text>
        {notificationslist.totalunread > 0 ? (
          <View
            style={[styles.unreadPill, { backgroundColor: palette.pink }]}
          >
            <Text style={styles.unreadText}>
              {notificationslist.totalunread}
            </Text>
          </View>
        ) : null}
      </View>

      {showInitialLoader ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={palette.brand} />
        </View>
      ) : notificationslist.list.length === 0 ? (
        <View style={styles.center}>
          <CLIcon n="notifications_none" size={42} color={palette.text3} />
          <Text style={[styles.emptyText, { color: palette.text3 }]}>
            No notifications
          </Text>
        </View>
      ) : (
        <FlatList
          data={notificationslist.list}
          keyExtractor={(item, i) => `${item.referenceID ?? "ntfs"}-${i}`}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator color={palette.text3} />
              </View>
            ) : null
          }
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
  title: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
    flex: 1,
  },
  unreadPill: {
    minWidth: 24,
    height: 22,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyText: { fontSize: 14, fontWeight: "600" },
  listContent: { padding: 12, gap: 8 },
  footerLoading: { paddingVertical: 14, alignItems: "center" },
  row: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderRadius: radii.md,
    alignItems: "flex-start",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
  },
  body: { flex: 1, minWidth: 0 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  headline: { flex: 1, fontSize: 13.5, fontWeight: "700" },
  time: { fontSize: 11.5, textAlign: "right" },
  details: { fontSize: 12.5, marginTop: 2 },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    flexWrap: "wrap",
  },
});
