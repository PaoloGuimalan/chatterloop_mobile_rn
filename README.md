# ChatterLoop — Mobile (React Native)

A React Native port of [`webapp/`](../webapp), kept structurally
close to the source so screens can be ported file-by-file.

> **Status: scaffolded.** Auth flow (Login / Register / Verify / Setup /
> Splash) is wired against your real API. The 9 main tabs render
> placeholder screens with TODO notes pointing at the webapp file to
> port from.

---

## Run

Prereqs: Android Studio + Xcode (for iOS), Node 22+, Yarn, Watchman.

```bash
cd chatterloop_native
yarn install --ignore-engines    # engines pin requires 22.11; 22+ works fine
yarn start                       # Metro
# In another terminal:
yarn android                     # or: yarn ios
```

If `yarn install` complains about engines on your Node version, the
`--ignore-engines` flag above is safe.

---

## Project layout — mirrors `webapp/src`

```
chatterloop_native/
├── App.tsx                       # entrypoint: GestureHandler / SafeArea /
│                                 # Redux / Theme / <Root/>
└── src/
    ├── app/
    │   ├── Root.tsx              # auth gate + native-stack navigator
    │   ├── main/
    │   │   ├── Splash.tsx        # mirrors webapp/.../main/Splash.tsx
    │   │   └── Shell.tsx         # bottom-tab shell (replaces left rail)
    │   ├── auth/
    │   │   ├── Login.tsx         # webapp/.../auth/Login.tsx
    │   │   ├── Register.tsx      # webapp/.../auth/Register.tsx
    │   │   ├── Verification.tsx  # webapp/.../auth/Verification.tsx
    │   │   └── Setup.tsx         # webapp/.../auth/Setup.tsx
    │   └── tabs/                 # one folder per tab (most are stubs)
    │       ├── feed/Feed.tsx
    │       ├── messenger/Messages.tsx
    │       ├── notifications/Notifications.tsx
    │       ├── mapfeed/MapFeed.tsx
    │       ├── profile/Profile.tsx
    │       ├── servers/Servers.tsx
    │       ├── pages/Pages.tsx
    │       ├── contacts/Contacts.tsx
    │       ├── settings/Settings.tsx
    │       └── _TabStub.tsx
    ├── redux/                    # mirrors webapp/src/redux/*
    │   ├── types/index.ts        # action type constants (full set)
    │   ├── actions/states.ts     # initial slice states
    │   ├── reducers/index.ts     # combineReducers (auth-flow subset wired)
    │   └── store/index.ts        # createStore
    └── reusables/
        ├── design/
        │   ├── tokens.ts         # light/dark palette + radii + spacing
        │   ├── ThemeProvider.tsx # AsyncStorage-persisted theme
        │   └── primitives.tsx    # Btn, IconBtn, Field, Card, Icon, BrandPanel
        ├── vars/interfaces.ts    # subset of webapp interfaces
        └── hooks/
            ├── env_configs.ts    # API base URLs, OAuth client id
            ├── axios_client.ts   # shared axios instance + interceptors
            ├── storage.ts        # AsyncStorage wrapper (localStorage parity)
            ├── uuid.ts           # crypto.randomUUID() replacement
            ├── nonce.ts          # X-Nonce stub (TODO: real AES-GCM)
            ├── reusable.ts       # convertLoginResponse, checkIfValid, etc.
            └── requests.ts       # auth endpoints (Login/Register/...)
```

The folder names follow the webapp exactly, so when you port a screen
you can mostly do:

1. Open `webapp/src/app/tabs/<feature>/<Screen>.tsx`.
2. Create `src/app/tabs/<feature>/<Screen>.tsx`.
3. Swap `<div>` → `<View>`, `<button>` → `<Pressable>`, CSS → tokens,
   `localStorage` → `getItem/setItem`, etc.
4. The Redux dispatches and request helpers already exist.

---

## What's wired up

| Area | Status | Source it mirrors |
| --- | --- | --- |
| Splash / Login / Register / Verify / Setup | done — visually + against real API | `webapp/src/app/auth/*`, `main/Splash.tsx` |
| Auth gate (Splash → Login → Verify → Setup → Shell) | done | `webapp/src/App.tsx` |
| Theme (light/dark + persisted) | done | `webapp/src/reusables/design/ThemeProvider.tsx` |
| Design primitives (Btn, IconBtn, Field, Card, Icon, BrandPanel) | done | `webapp/src/reusables/design/primitives*.tsx` |
| Redux store + auth/alerts/notifications/conversations/contacts slices | done | `webapp/src/redux/*` |
| Axios client with X-Nonce + Device-Token interceptors | done (nonce is stubbed) | `webapp/src/reusables/hooks/requests.ts` |
| 9 main tabs UI | placeholder | each `_TabStub` points to its source file |
| Google sign-in button | partial — button present, idToken plumbing TODO | `webapp/src/app/auth/Login.tsx` (GoogleLogin) |
| Realtime sockets / SSE notifications | not started | `webapp/src/reusables/hooks/{sockets,sse}.ts` |
| MediaSoup voice/video calls | not started | `webapp/src/app/absolutes/calls_v2/*` |
| Live Map Feed broadcast | not started | `webapp/src/reusables/hooks/mapsocket.ts` |
| Push notifications | not started | `Notification.requestPermission()` in Home |

---

## TODOs grouped by area

### Quick wins
- **`reusables/hooks/env_configs.ts`** — replace the hardcoded URLs with
  `react-native-config` reading from `.env` so prod/staging diverge.
- **`reusables/hooks/nonce.ts`** — implement the real AES-GCM nonce. The
  webapp version uses WebCrypto; for RN install `react-native-quick-crypto`
  or polyfill via `expo-crypto` + `crypto-js`.
- **`app/auth/Login.tsx`** — wire `@react-native-google-signin/google-signin`
  and feed the resulting `idToken` into `ThirdPartyAuthenticationRequest`.

### Per-tab ports (each tab file already lists its source path)
- Feed: `GetFeedRequest`, `ReactionSaveRequest`, `CreatePostRequest`, and
  the `PostItem` component.
- Messages: `InitConversationListRequest`, `SendMessageRequest`,
  `SeenMessageRequest`, plus the socket layer from
  `webapp/.../hooks/sockets.ts` (use `socket.io-client` on RN).
- Notifications: `NotificationInitRequest`,
  `ReadNotificationsRequest`, and the SSE layer from
  `webapp/.../hooks/sse.ts` (use `react-native-sse` or stream `fetch`).
- Map: pick `react-native-maps` or `@rnmapbox/maps`, then port
  `socketMapConnect` / `socketSendCoordinatesBroadcast` from
  `webapp/.../hooks/mapsocket.ts`. Request foreground (and optionally
  background) location permissions.
- Servers/Pages/Contacts/Settings: port the webapp file directly — they
  read straight from the Axios helpers.
- Profile: extend the placeholder with the cover photo, info card, diary
  card, and post grid from `webapp/.../tabs/profile/user/Profile.tsx`.

### Realtime + calls (big ones)
- **Sockets** (`socket.io-client`) — message broadcast, typing, seen,
  active-user heartbeat, call invite. Mirror `redux/types/*` action names
  for parity.
- **SSE notifications** — push new notification entries into the same
  reducer slice.
- **Calls (MediaSoup)** — port `webapp/.../calls_v2/*` using
  `react-native-webrtc` + a MediaSoup client library. Requires mic/camera
  permission flow on both platforms.
- **Push** — Firebase Cloud Messaging (Android) + APNs (iOS) via
  `@react-native-firebase/messaging`.

### Native modules to add

| Feature | Library |
| --- | --- |
| Maps | `react-native-maps` or `@rnmapbox/maps` |
| Realtime sockets | `socket.io-client` |
| SSE | `react-native-sse` |
| WebRTC | `react-native-webrtc` |
| Crypto / nonce | `react-native-quick-crypto` |
| Env config | `react-native-config` |
| Push | `@react-native-firebase/messaging` |
| Date pickers | `@react-native-picker/picker`, `@react-native-community/datetimepicker` |

---

## Notes

- **Engines.** The CLI generated `"node": ">= 22.11.0"`; relaxed to
  `>=22.0.0` so 22.1.x works. If your Node is older than 22, bump it.
- **Inter font.** The webapp uses Inter; the RN scaffold uses the system
  font for now. Add `Inter-*.ttf` files under `src/assets/fonts/`,
  register them in `react-native.config.js`, and run
  `npx react-native-asset` to link.
- **Vector icons.** The design primitives use Material Icons via
  `react-native-vector-icons`. On Android you'll need the font bundled
  (see the library's setup), on iOS run `pod install`.
- **No tests yet.** The Jest config the template generates still works;
  add tests under `__tests__/` as you port screens.

---

## Sibling Flutter project

There's an earlier scaffold at `../chatterloop_mobile/` (Flutter). It's
unfinished and we pivoted to React Native to stay closer to the webapp.
Feel free to delete `chatterloop_mobile/` once you confirm the RN port
is the direction you want.
