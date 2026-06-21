/* eslint-disable react-native/no-inline-styles */
/* eslint-disable react/no-unstable-nested-components */
/* Main shell — bottom tab bar.
 *
 * The webapp uses a left blue rail on desktop and a bottom tab bar on
 * mobile. On phone we just do bottom tabs. Theme toggle + Settings live
 * in the header (AppMenu replacement). */

import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { CLIcon, IconBtn } from '../../reusables/design/primitives';
import { radii } from '../../reusables/design/tokens';
import { useTheme } from '../../reusables/design/ThemeProvider';
import { useDispatch, useSelector } from 'react-redux';
import type { AppState } from '../../redux/store';
import { LogoutRequest } from '../../reusables/hooks/requests';
import Feed from '../tabs/feed/Feed';
import Messages from '../tabs/messenger/Messages';
import Notifications from '../tabs/notifications/Notifications';
import MapFeed from '../tabs/mapfeed/MapFeed';
import Profile from '../tabs/profile/Profile';
import Servers from '../tabs/servers/Servers';
import Pages from '../tabs/pages/Pages';
import Contacts from '../tabs/contacts/Contacts';
import Settings from '../tabs/settings/Settings';
import {
  contactsliststate,
  conversationsetupstate,
} from '../../redux/actions/states';
import {
  CLEAR_PENDING_CALL_ALERTS,
  SET_CALLS_LIST,
  SET_CLEAR_ALERTS,
  SET_CONTACTS_LIST_OVERRIDE,
  SET_CONVERSATION_SETUP,
  SET_MESSAGES_LIST_OVERRIDE,
  SET_MINIMIZED_CONVERSATION_OVERRIDE,
  SET_NOTIFICATIONS_LIST_OVERRIDE,
} from '../../redux/types';
import { CloseSSENotifications } from '../../reusables/hooks/sse';
import IncomingCallModal from '../absolutes/IncomingCallModal';

const Tab = createBottomTabNavigator();

// Both variants required statically so Metro can resolve them — the
// active source is selected at render time based on theme.
const logoLight = require('../../assets/imgs/chatterloop.png');
const logoDark = require('../../assets/imgs/chatterloop-dark.png');

function Header({ onLogout }: { onLogout: () => void }) {
  const { palette, theme, toggleTheme } = useTheme();
  const navigation = useNavigation<any>();
  // Unread count drives the badge on the notifications bell. The slice
  // is kept warm by NotificationInitRequest + the SSE "notifications"
  // event, so this badge updates live.
  const unread = useSelector(
    (s: AppState) =>
      (s.notificationslist as { totalunread?: number } | undefined)
        ?.totalunread ?? 0,
  );

  return (
    <View
      style={[
        styles.header,
        { backgroundColor: palette.surface, borderBottomColor: palette.border },
      ]}
    >
      <Image
        source={theme === 'dark' ? logoDark : logoLight}
        style={styles.headerLogo}
      />
      <Text style={[styles.headerTitle, { color: palette.text }]}>
        Chatterloop
      </Text>
      <View style={{ flex: 1 }} />
      <Pressable
        onPress={() => navigation.navigate('Notifications')}
        hitSlop={6}
        style={({ pressed }) => [
          styles.bellBtn,
          { opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <CLIcon n="notifications" size={22} color={palette.text2} />
        {unread > 0 ? (
          <View
            style={[
              styles.bellBadge,
              { backgroundColor: palette.pink, borderColor: palette.surface },
            ]}
          >
            <Text style={styles.bellBadgeText}>
              {unread > 99 ? '99+' : unread}
            </Text>
          </View>
        ) : null}
      </Pressable>
      <IconBtn
        n={theme === 'dark' ? 'light-mode' : 'dark-mode'}
        onPress={toggleTheme}
      />
      <IconBtn n="logout" onPress={onLogout} color={palette.pink} />
    </View>
  );
}

export default function Shell() {
  const { palette } = useTheme();
  const dispatch = useDispatch();

  const clearStates = () => {
    dispatch({
      type: SET_CONVERSATION_SETUP,
      payload: { conversationsetup: conversationsetupstate },
    });
    dispatch({
      type: SET_MESSAGES_LIST_OVERRIDE,
      payload: { messageslist: [] },
    });
    dispatch({
      type: SET_CLEAR_ALERTS,
      payload: { alerts: [] },
    });
    dispatch({
      type: SET_CALLS_LIST,
      payload: { callslist: [] },
    });
    dispatch({
      type: CLEAR_PENDING_CALL_ALERTS,
      payload: { clearstate: [] },
    });
    dispatch({
      type: SET_CONTACTS_LIST_OVERRIDE,
      payload: { contactslist: contactsliststate },
    });
    dispatch({
      type: SET_MINIMIZED_CONVERSATION_OVERRIDE,
      payload: { conversations: [] },
    });
    dispatch({
      type: SET_NOTIFICATIONS_LIST_OVERRIDE,
      payload: { notficationslist: { list: [], totalunread: 0 } },
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <Header
        onLogout={() => {
          clearStates();
          CloseSSENotifications();
          LogoutRequest(dispatch);
        }}
      />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: palette.brand,
          tabBarInactiveTintColor: palette.text3,
          tabBarStyle: {
            backgroundColor: palette.surface,
            borderTopColor: palette.border,
            height: 60,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          tabBarIcon: ({ color, size }) => {
            const icon: Record<string, string> = {
              Feed: 'home',
              Messages: 'forum',
              Map: 'map',
              Contacts: 'contacts',
              Profile: 'person',
            };
            return (
              <CLIcon
                n={icon[route.name] ?? 'circle'}
                size={size}
                color={color}
              />
            );
          },
        })}
      >
        <Tab.Screen name="Feed" component={Feed} />
        <Tab.Screen name="Messages" component={Messages} />
        <Tab.Screen name="Map" component={MapFeed} />
        <Tab.Screen name="Contacts" component={Contacts} />
        <Tab.Screen name="Profile" component={Profile} />
      </Tab.Navigator>
      <IncomingCallModal />
    </View>
  );
}

// keep Servers/Pages/Settings/Notifications exports alive so the
// navigator from Root.tsx can mount them as stack screens. (Contacts
// is now a bottom tab, accessed via the tab bar — not via Stack.)
export { Servers, Pages, Settings, Notifications };

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 56,
    borderBottomWidth: 1,
    gap: 10,
  },
  headerLogo: { width: 28, height: 28 },
  headerTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 999,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  bellBadgeText: { color: '#fff', fontSize: 9.5, fontWeight: '800' },
});
