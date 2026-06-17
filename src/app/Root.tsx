/* App root — auth gate + stack navigation.
 *
 * Mirrors webapp/src/App.tsx: while `authentication.auth` is null we
 * show Splash; if false we show Login/Register; if true but not
 * verified we route to Verification; if verified but not complete to
 * Setup; otherwise we show the main Shell. */

import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Dimensions } from "react-native";

import Splash from "./main/Splash";
import Login from "./auth/Login";
import Register from "./auth/Register";
import Verification from "./auth/Verification";
import SetupScreen from "./auth/Setup";
import Shell, {
  Notifications,
  Pages,
  Servers,
  Settings,
} from "./main/Shell";
import ServerDetail from "./tabs/servers/ServerDetail";
import PageDetail from "./tabs/pages/PageDetail";
import Conversation from "./tabs/messenger/Conversation";
import NewPostModal from "./tabs/feed/NewPostModal";
import Comments from "./tabs/feed/Comments";
import PostDetail from "./tabs/feed/PostDetail";
import Diary from "./tabs/profile/diary/Diary";
import NewDiaryEntry from "./tabs/profile/diary/NewEntry";
import DiaryEntryView from "./tabs/profile/diary/EntryView";

import type { AppState } from "../redux/store";
import {
  ActiveContactsRequest,
  AuthCheck,
  GetFeedEmojisRequest,
} from "../reusables/hooks/requests";
import {
  CloseSSENotifications,
  SSENotificationsTRequest,
} from "../reusables/hooks/sse";
import { useTheme } from "../reusables/design/ThemeProvider";
import { loadUserSettings } from "../reusables/hooks/usersettings";
import {
  SET_EMOJIS_LIST,
  SET_SCREEN_SIZE_LISTENER,
  SET_USER_SETTINGS,
} from "../redux/types";

const Stack = createNativeStackNavigator();

export default function Root() {
  const dispatch = useDispatch();
  const authentication = useSelector((s: AppState) => s.authentication);
  const alerts = useSelector((s: AppState) => s.alerts);
  const { theme, palette } = useTheme();

  // First-load auth check — mirrors webapp's AuthCheck on mount.
  useEffect(() => {
    AuthCheck(dispatch);
  }, [dispatch]);

  // Start SSE + active-contacts polling once the user is fully signed in.
  // Mirrors webapp Home.tsx initEventSources(). Closes on logout / unmount.
  const auth = authentication.auth;
  const user = authentication.user;
  const verified = user?.isVerified;
  const complete = user?.isComplete;
  const fullyAuthed = auth === true && !!verified && !!complete;

  useEffect(() => {
    if (!fullyAuthed) return;
    SSENotificationsTRequest(dispatch, alerts, authentication);
    ActiveContactsRequest(dispatch);
    // Emoji catalog rarely changes — fetch once per session.
    GetFeedEmojisRequest().then((emojilist) => {
      dispatch({ type: SET_EMOJIS_LIST, payload: { emojilist } });
    });
    // Hydrate per-user settings (map feed toggles, etc.) from AsyncStorage.
    loadUserSettings(user.userID).then((usersettings) => {
      dispatch({ type: SET_USER_SETTINGS, payload: { usersettings } });
    });
    return () => {
      CloseSSENotifications();
    };
    // We intentionally only re-run when fullyAuthed flips — re-subscribing
    // on every alert change would tear down the SSE connection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullyAuthed]);

  // Mirror webapp's resize listener so screensizelistener stays accurate.
  useEffect(() => {
    const sub = Dimensions.addEventListener("change", ({ window }) => {
      dispatch({
        type: SET_SCREEN_SIZE_LISTENER,
        payload: {
          screensizelistener: { W: window.width, H: window.height },
        },
      });
    });
    return () => sub.remove();
  }, [dispatch]);

  const navTheme = theme === "dark" ? DarkTheme : DefaultTheme;

  return (
    <NavigationContainer
      theme={{
        ...navTheme,
        colors: { ...navTheme.colors, background: palette.bg, primary: palette.brand },
      }}
    >
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
      >
        {auth == null ? (
          <Stack.Screen name="Splash" component={Splash} />
        ) : auth === false ? (
          <>
            <Stack.Screen name="Login" component={Login} />
            <Stack.Screen name="Register" component={Register} />
          </>
        ) : !verified ? (
          <Stack.Screen name="Verification" component={Verification} />
        ) : !complete ? (
          <Stack.Screen name="Setup" component={SetupScreen} />
        ) : (
          <>
            <Stack.Screen name="Shell" component={Shell} />
            <Stack.Screen name="Settings" component={Settings} />
            <Stack.Screen name="Notifications" component={Notifications} />
            <Stack.Screen name="Servers" component={Servers} />
            <Stack.Screen name="ServerDetail" component={ServerDetail} />
            <Stack.Screen name="Pages" component={Pages} />
            <Stack.Screen name="PageDetail" component={PageDetail} />
            <Stack.Screen name="Conversation" component={Conversation} />
            <Stack.Screen name="PostDetail" component={PostDetail} />
            <Stack.Screen name="Comments" component={Comments} />
            <Stack.Screen name="Diary" component={Diary} />
            <Stack.Screen name="DiaryEntry" component={DiaryEntryView} />
            <Stack.Screen
              name="NewPost"
              component={NewPostModal}
              options={{ presentation: "modal" }}
            />
            <Stack.Screen
              name="NewDiaryEntry"
              component={NewDiaryEntry}
              options={{ presentation: "modal" }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
