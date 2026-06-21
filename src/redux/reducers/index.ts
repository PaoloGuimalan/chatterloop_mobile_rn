/* Root reducer — combines the slices we've ported so far.
 *
 * The webapp's full slice list (calls, media tracks, etc.) is larger.
 * This file mirrors the same shape and naming so adding the remaining
 * slices later is a copy/adapt job. */

import { combineReducers } from 'redux';
import {
  REMOVE_PREVIEW_PARTICIPANT,
  SET_ACTIVE_USERS_LIST,
  SET_ALERTS,
  SET_AUTHENTICATION,
  SET_CLEAR_ALERTS,
  CLEAR_PENDING_CALL_ALERTS,
  REMOVE_PENDING_CALL_ALERTS,
  SET_CALLS_LIST,
  SET_CONTACTS_LIST,
  SET_CONTACTS_LIST_OVERRIDE,
  SET_CONVERSATION_SETUP,
  SET_COORDINATES,
  SET_EMOJIS_LIST,
  SET_MINIMIZED_CONVERSATION_OVERRIDE,
  SET_FILTERED_ALERTS,
  SET_IS_TYPING_LIST,
  SET_MESSAGES_LIST,
  SET_MESSAGES_LIST_OVERRIDE,
  SET_MUTATE_ALERTS,
  SET_NOTIFICATIONS_LIST,
  SET_NOTIFICATIONS_LIST_APPEND,
  SET_NOTIFICATIONS_LIST_OVERRIDE,
  SET_PATHNAME_LISTENER,
  SET_PENDING_CALL_ALERTS,
  SET_PREVIEW_PARTICIPANTS,
  SET_PREVIEW_PARTICIPANTS_BULK,
  SET_RAW_COORDINATES,
  SET_REJECTED_CALL_LIST,
  REMOVE_REJECTED_CALL_LIST,
  SET_REMOVE_IS_TYPING_LIST,
  SET_SCREEN_SIZE_LISTENER,
  SET_TOGGLE_RIGHT_WIDGET,
  SET_USER_SETTINGS,
  UPDATE_ACTIVE_USERS_LIST,
} from '../types';
import {
  authenticationstate,
  contactsliststate,
  conversationsetupstate,
  screensizelistenerstate,
  usersettingsstate,
} from '../actions/states';
import { AuthenticationInterface } from '../../reusables/vars/interfaces';

export interface CallMetadata {
  conversationID: string;
  conversationType?: string;
  callType?: 'audio' | 'video' | string;
  caller?: {
    firstName?: string;
    lastName?: string;
    profile?: string;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

export interface Alert {
  id: number;
  type: 'success' | 'info' | 'warning' | 'error' | 'incomingcall';
  content: string;
  /** Present only when `type === 'incomingcall'` — carries the caller
   *  + conversation refs the IncomingCallModal needs. */
  callmetadata?: CallMetadata;
}

interface Action<P = unknown> {
  type: string;
  payload: P;
}

const setauthentication = (
  state: AuthenticationInterface = authenticationstate,
  action: Action<{ authentication: AuthenticationInterface }>,
): AuthenticationInterface => {
  switch (action.type) {
    case SET_AUTHENTICATION:
      return action.payload.authentication;
    default:
      return state;
  }
};

const setalerts = (
  state: Alert[] = [],
  action: Action<{ alerts: Alert | Alert[]; alertID?: number }>,
): Alert[] => {
  switch (action.type) {
    case SET_ALERTS:
      return [...state, action.payload.alerts as Alert];
    case SET_MUTATE_ALERTS:
      return [
        ...state,
        {
          id: state.length,
          ...(action.payload.alerts as Omit<Alert, 'id'>),
        } as Alert,
      ];
    case SET_FILTERED_ALERTS:
      return state.filter(a => a.id !== action.payload.alertID);
    case SET_CLEAR_ALERTS:
      return action.payload.alerts as Alert[];
    default:
      return state;
  }
};

const setnotificationslist = (
  state = {
    list: [] as unknown[],
    totalunread: 0,
    total: 0,
    next: null as string | null,
  },
  action: Action<{
    notficationslist: {
      list: unknown[];
      totalunread: number;
      total?: number;
      next?: string | null;
    };
  }>,
) => {
  switch (action.type) {
    case SET_NOTIFICATIONS_LIST:
    case SET_NOTIFICATIONS_LIST_OVERRIDE:
      return {
        list: action.payload.notficationslist.list,
        totalunread: action.payload.notficationslist.totalunread,
        total: action.payload.notficationslist.total ?? 0,
        next: action.payload.notficationslist.next ?? null,
      };
    case SET_NOTIFICATIONS_LIST_APPEND: {
      // Append the new page, de-duping by referenceID so a refresh that
      // races a page load doesn't produce visible duplicates.
      const incoming = action.payload.notficationslist.list as Array<
        Record<string, unknown>
      >;
      const seen = new Set(
        (state.list as Array<Record<string, unknown>>).map(
          n => n.referenceID as string | undefined,
        ),
      );
      const fresh = incoming.filter(n => {
        const id = n.referenceID as string | undefined;
        return !id || !seen.has(id);
      });
      return {
        list: [...state.list, ...fresh],
        totalunread: action.payload.notficationslist.totalunread,
        total: action.payload.notficationslist.total ?? state.total,
        next: action.payload.notficationslist.next ?? null,
      };
    }
    default:
      return state;
  }
};

const setmessageslist = (
  state: unknown[] = [],
  action: Action<{ messageslist: unknown[] }>,
): unknown[] => {
  switch (action.type) {
    case SET_MESSAGES_LIST:
    case SET_MESSAGES_LIST_OVERRIDE:
      return action.payload.messageslist;
    default:
      return state;
  }
};

const setcontactslist = (
  state = contactsliststate,
  action: Action<{ contactslist: typeof contactsliststate }>,
) => {
  switch (action.type) {
    case SET_CONTACTS_LIST:
    case SET_CONTACTS_LIST_OVERRIDE:
      return action.payload.contactslist;
    default:
      return state;
  }
};

const settogglerightwidget = (
  state = 'notifs',
  action: Action<{ togglerightwidget: string }>,
) => {
  switch (action.type) {
    case SET_TOGGLE_RIGHT_WIDGET:
      return action.payload.togglerightwidget;
    default:
      return state;
  }
};

const setscreensize = (
  state = screensizelistenerstate,
  action: Action<{ screensizelistener: typeof screensizelistenerstate }>,
) => {
  switch (action.type) {
    case SET_SCREEN_SIZE_LISTENER:
      return action.payload.screensizelistener;
    default:
      return state;
  }
};

const setpathname = (
  state = '/',
  action: Action<{ pathnamelistener: string }>,
) => {
  switch (action.type) {
    case SET_PATHNAME_LISTENER:
      return action.payload.pathnamelistener;
    default:
      return state;
  }
};

const setusersettings = (
  state = usersettingsstate,
  action: Action<{ usersettings: typeof usersettingsstate }>,
) => {
  switch (action.type) {
    case SET_USER_SETTINGS:
      return action.payload.usersettings;
    default:
      return state;
  }
};

// ----- Realtime slices (fed by sse.ts + sockets.ts) -------------------------

interface ActiveUser {
  _id: string;
  sessionStatus?: boolean;
  [k: string]: unknown;
}

const setactiveuserslist = (
  state: ActiveUser[] = [],
  action: Action<{
    activeuserslist?: ActiveUser[];
    updatedUser?: ActiveUser;
  }>,
): ActiveUser[] => {
  switch (action.type) {
    case SET_ACTIVE_USERS_LIST:
      return action.payload.activeuserslist ?? [];
    case UPDATE_ACTIVE_USERS_LIST: {
      const u = action.payload.updatedUser;
      if (!u) return state;
      return [...state.filter(s => s._id !== u._id), u];
    }
    default:
      return state;
  }
};

interface TypingEntry {
  userID: string;
  conversationID: string;
  [k: string]: unknown;
}

const setistypinglist = (
  state: TypingEntry[] = [],
  action: Action<{ istyping: TypingEntry }>,
): TypingEntry[] => {
  switch (action.type) {
    case SET_IS_TYPING_LIST: {
      // De-dupe only the EXACT match (same user AND same conversation).
      // The earlier `&& userID !==` predicate was too aggressive: it
      // wiped any entry that shared the same userID OR the same
      // conversationID, so two people typing in the same thread would
      // erase each other — making the indicator vanish on the second
      // ping. Mirrors webapp's `!(A && B)` semantics.
      const next = state.filter(
        s =>
          !(
            s.userID === action.payload.istyping.userID &&
            s.conversationID === action.payload.istyping.conversationID
          ),
      );
      return [...next, action.payload.istyping];
    }
    case SET_REMOVE_IS_TYPING_LIST:
      return state.filter(
        s =>
          !(
            s.userID === action.payload.istyping.userID &&
            s.conversationID === action.payload.istyping.conversationID
          ),
      );
    default:
      return state;
  }
};

interface CallAlert {
  callID: string;
  [k: string]: unknown;
}

const setpendingcallalerts = (
  state: CallAlert[] = [],
  action: Action<{ pendingcallalerts?: CallAlert; callID?: string }>,
): CallAlert[] => {
  switch (action.type) {
    case SET_PENDING_CALL_ALERTS:
      if (!action.payload.pendingcallalerts) return state;
      return [...state, action.payload.pendingcallalerts];
    case REMOVE_PENDING_CALL_ALERTS:
      return state.filter(a => a.callID !== action.payload.callID);
    case CLEAR_PENDING_CALL_ALERTS:
      return [];
    default:
      return state;
  }
};

const setrejectedcalllist = (
  state: string[] = [],
  action: Action<{ callID: string }>,
): string[] => {
  switch (action.type) {
    case SET_REJECTED_CALL_LIST:
      return [...state, action.payload.callID];
    case REMOVE_REJECTED_CALL_LIST:
      return state.filter(id => id !== action.payload.callID);
    default:
      return state;
  }
};

interface PreviewParticipant {
  clientID?: string;
  channelID?: string;
  [k: string]: unknown;
}

const setpreviewparticipants = (
  state: PreviewParticipant[] = [],
  action: Action<{
    previewparticipant?: PreviewParticipant;
    participants?: PreviewParticipant[];
  }>,
): PreviewParticipant[] => {
  switch (action.type) {
    case SET_PREVIEW_PARTICIPANTS:
      if (!action.payload.previewparticipant) return state;
      return [...state, action.payload.previewparticipant];
    case SET_PREVIEW_PARTICIPANTS_BULK:
      return action.payload.participants ?? [];
    case REMOVE_PREVIEW_PARTICIPANT:
      return state.filter(
        s => s.clientID !== action.payload.previewparticipant?.clientID,
      );
    default:
      return state;
  }
};

interface Coordinates {
  referenceID?: string;
  label?: string;
  longitude?: number;
  latitude?: number;
  heading?: number | null;
  speed?: number;
  mode?: unknown;
  type?: string;
}

const setcoordinates = (
  state: Coordinates[] = [],
  action: Action<{ coordinates: Coordinates }>,
): Coordinates[] => {
  switch (action.type) {
    case SET_COORDINATES: {
      const c = action.payload.coordinates;
      if (!c?.referenceID) return state;
      return [...state.filter(s => s.referenceID !== c.referenceID), c];
    }
    default:
      return state;
  }
};

const setrawcoordinates = (
  state: Coordinates | null = null,
  action: Action<{ rawcoordinates: Coordinates }>,
): Coordinates | null => {
  switch (action.type) {
    case SET_RAW_COORDINATES:
      return action.payload.rawcoordinates;
    default:
      return state;
  }
};

// ---- conversationsetup -----------------------------------------------------

type ConversationSetupState = typeof conversationsetupstate;

const setconversationsetup = (
  state: ConversationSetupState = conversationsetupstate,
  action: Action<{ conversationsetup: ConversationSetupState }>,
): ConversationSetupState => {
  switch (action.type) {
    case SET_CONVERSATION_SETUP:
      return action.payload.conversationsetup ?? conversationsetupstate;
    default:
      return state;
  }
};

// ---- callslist -------------------------------------------------------------

interface CallEntry {
  callID: string;
  [k: string]: unknown;
}

const setcallslist = (
  state: CallEntry[] = [],
  action: Action<{ callslist: CallEntry[] }>,
): CallEntry[] => {
  switch (action.type) {
    case SET_CALLS_LIST:
      return action.payload.callslist ?? [];
    default:
      return state;
  }
};

// ---- minimizedconversations -----------------------------------------------

interface MinimizedConversation {
  conversationID: string;
  [k: string]: unknown;
}

const setminimizedconversations = (
  state: MinimizedConversation[] = [],
  action: Action<{ conversations: MinimizedConversation[] }>,
): MinimizedConversation[] => {
  switch (action.type) {
    case SET_MINIMIZED_CONVERSATION_OVERRIDE:
      return action.payload.conversations ?? [];
    default:
      return state;
  }
};

interface EmojiInfo {
  emoji_id: number;
  emoji_content: string;
  emoji_theme?: string;
  animated_preview?: string;
  priority: number;
}

const setemojilist = (
  state: EmojiInfo[] = [],
  action: Action<{ emojilist: EmojiInfo[] }>,
): EmojiInfo[] => {
  switch (action.type) {
    case SET_EMOJIS_LIST:
      return action.payload.emojilist ?? [];
    default:
      return state;
  }
};

// TODO(realtime): port the remaining webapp slices when needed:
//   - media holders (MEDIA_TRACK_HOLDER, MEDIA_MY_VIDEO_HOLDER)
//   - call window check (CHECK_AND_ADD_NEW_CALL_LIST_WINDOW, END_CALL_LIST)
//   - page modal

const rootReducer = combineReducers({
  authentication: setauthentication,
  alerts: setalerts,
  notificationslist: setnotificationslist,
  messageslist: setmessageslist,
  contactslist: setcontactslist,
  togglerightwidget: settogglerightwidget,
  screensizelistener: setscreensize,
  pathnamelistener: setpathname,
  usersettings: setusersettings,
  activeuserslist: setactiveuserslist,
  istypinglist: setistypinglist,
  pendingcallalerts: setpendingcallalerts,
  rejectedcalllist: setrejectedcalllist,
  previewparticipants: setpreviewparticipants,
  coordinates: setcoordinates,
  rawcoordinates: setrawcoordinates,
  emojilist: setemojilist,
  conversationsetup: setconversationsetup,
  callslist: setcallslist,
  minimizedconversations: setminimizedconversations,
});

export default rootReducer;
export type AppState = ReturnType<typeof rootReducer>;
