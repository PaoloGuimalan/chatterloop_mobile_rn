/* SSE notifications client — mirrors webapp/src/reusables/hooks/sse.ts.
 *
 * Key differences from the webapp version:
 *   - Uses `react-native-sse` (RNEventSource) instead of the browser's
 *     EventSource. Same `addEventListener("name", cb)` shape.
 *   - Replaces `document.dispatchEvent(new CustomEvent(...))` with
 *     RN's `DeviceEventEmitter.emit(...)`. Consumers (Conversation
 *     screens, call UI) subscribe with `DeviceEventEmitter.addListener`.
 *   - Replaces `localStorage.getItem` with the async storage wrapper.
 *   - Sound playback is intentionally skipped here — pick `react-native-sound`
 *     (or similar) and wire the TODOs below when you port the ringtone UX. */

import RNEventSource from 'react-native-sse';
import sign from 'jwt-encode';
import { jwtDecode } from 'jwt-decode';
import { Dispatch } from 'redux';
import { DeviceEventEmitter } from 'react-native';

import {
  REMOVE_PREVIEW_PARTICIPANT,
  SET_ALERTS,
  SET_COORDINATES,
  SET_IS_TYPING_LIST,
  SET_MESSAGES_LIST_OVERRIDE,
  SET_PENDING_CALL_ALERTS,
  SET_PREVIEW_PARTICIPANTS,
  SET_PREVIEW_PARTICIPANTS_BULK,
  SET_REJECTED_CALL_LIST,
  SET_REMOVE_IS_TYPING_LIST,
  UPDATE_ACTIVE_USERS_LIST,
} from '../../redux/types';
import {
  ContactsListInitRequest,
  InitConversationListRequest,
  NotificationOverrideRequest,
} from './requests';
import envs from './env_configs';
import { getItem } from './storage';
import { playSound } from './sounds';

const API = envs.CHATTERLOOP_API;
const SECRET = envs.SECRET;

/** Channel name used by all MediaSoup/voice room relay events.
 *  Subscribe with: DeviceEventEmitter.addListener(SSE_ROOM_RELAY, handler) */
export const SSE_ROOM_RELAY = 'room-events-relay';
/** Channel name for the produce-response variant (kept separate to match
 *  the webapp's two-channel split). */
export const SSE_ROOM_RELAY_PRODUCE = 'room-events-relay-produce';

interface RelayPayload {
  event: string;
  data: string;
}

function relay(channel: string, event: string, data: string) {
  DeviceEventEmitter.emit(channel, { event, data } as RelayPayload);
}

let sseNtfsSource: RNEventSource | null = null;

const SSENotificationsTRequest = async (
  dispatch: Dispatch<any>,
  currentAlertState: any[],
  authentication: any,
) => {
  const token = await getItem('authtoken');
  const deviceToken = await getItem('device');

  const payload = {
    token,
    deviceToken,
    type: 'notifications',
  };
  const encodedPayload = sign(payload, SECRET);

  sseNtfsSource = new RNEventSource(
    `${API}/u/sseNotifications/${encodedPayload}`,
    {
      headers: {
        Origin: 'https://chatterloop.app',
      },
    },
  );

  sseNtfsSource.addEventListener('notifications' as any, (e: any) => {
    const parsedresponse = JSON.parse(e.data);
    if (parsedresponse.auth && parsedresponse.status) {
      playSound('notification');

      NotificationOverrideRequest(1, 10, dispatch, () => {});

      dispatch({
        type: SET_ALERTS,
        payload: {
          alerts: {
            id: currentAlertState.length,
            type: 'info',
            content: parsedresponse.message,
          },
        },
      });
    }
  });

  sseNtfsSource.addEventListener('coordinates_broadcast' as any, (e: any) => {
    const parsedresponse = JSON.parse(e.data);
    if (parsedresponse.auth && parsedresponse.status) {
      const decodedResult: any = jwtDecode(parsedresponse.result);
      dispatch({
        type: SET_COORDINATES,
        payload: { coordinates: decodedResult },
      });
    }
  });

  sseNtfsSource.addEventListener('notifications_reload' as any, (e: any) => {
    const parsedresponse = JSON.parse(e.data);
    if (parsedresponse.auth && parsedresponse.status) {
      NotificationOverrideRequest(1, 10, dispatch, () => {});
    }
  });

  sseNtfsSource.addEventListener('istyping_broadcast' as any, (e: any) => {
    const parsedresponse = JSON.parse(e.data);
    if (parsedresponse.auth && parsedresponse.status) {
      const decodedResult: any = jwtDecode(parsedresponse.result);
      const istyping = decodedResult.istyping;
      dispatch({
        type: SET_IS_TYPING_LIST,
        payload: { istyping },
      });
      // Auto-clear after 4s — mirrors webapp's Home.tsx useEffect. The
      // backend's `istyping_broadcast` is fire-and-forget, so without
      // this the indicator sticks forever. If the user keeps typing,
      // each new broadcast resets the entry (the reducer de-dupes on
      // userID+conversationID), and the corresponding stale timer
      // becomes a no-op when it fires against the already-replaced
      // entry.
      setTimeout(() => {
        dispatch({
          type: SET_REMOVE_IS_TYPING_LIST,
          payload: { istyping },
        });
      }, 4000);
    }
  });

  sseNtfsSource.addEventListener('incomingcall' as any, (e: any) => {
    const parsedresponse = JSON.parse(e.data);
    if (parsedresponse.auth && parsedresponse.status) {
      const decodedResult: any = jwtDecode(parsedresponse.result);
      const randomID = Math.random() * (2000 - 1 + 1) + 1;
      playSound('call');

      dispatch({
        type: SET_ALERTS,
        payload: {
          alerts: {
            id: randomID,
            type: 'incomingcall',
            content: parsedresponse.message,
            callmetadata: decodedResult.callmetadata,
          },
        },
      });

      dispatch({
        type: SET_PENDING_CALL_ALERTS,
        payload: {
          pendingcallalerts: {
            callID: decodedResult.callmetadata.conversationID,
          },
        },
      });
    }
  });

  sseNtfsSource.addEventListener('callreject' as any, (e: any) => {
    const parsedresponse = JSON.parse(e.data);
    if (parsedresponse.auth && parsedresponse.status) {
      const decodedResult: any = jwtDecode(parsedresponse.result);
      const conversationID: any = decodedResult.rejectdata.conversationID;

      dispatch({
        type: SET_REJECTED_CALL_LIST,
        payload: { callID: conversationID },
      });

      relay(
        SSE_ROOM_RELAY,
        'callreject',
        JSON.stringify(decodedResult.rejectdata),
      );
    }
  });

  sseNtfsSource.addEventListener('contactslist' as any, (e: any) => {
    const parsedresponse = JSON.parse(e.data);
    if (parsedresponse.auth && parsedresponse.status) {
      ContactsListInitRequest(1, 50, true, dispatch, () => {});
    }
  });

  sseNtfsSource.addEventListener('messages_list' as any, (e: any) => {
    const parsedresponse = JSON.parse(e.data);
    if (parsedresponse.auth && parsedresponse.status) {
      InitConversationListRequest(1, 20).then(response => {
        if (!response) return;
        dispatch({
          type: SET_MESSAGES_LIST_OVERRIDE,
          payload: { messageslist: response.conversationslist },
        });
      });

      if (parsedresponse.message.mentioner) {
        const mention = parsedresponse.message.mentioner;
        playSound('notification');
        dispatch({
          type: SET_ALERTS,
          payload: {
            alerts: {
              id: currentAlertState.length,
              type: 'info',
              content: mention.isSingle
                ? `${mention.username} mentioned you`
                : `${mention.username} mentioned you at ${mention.realmName}`,
            },
          },
        });
      }

      // Per-conversation relay: the channel name *is* the conversationID,
      // matching the webapp's CustomEvent(conversationID) pattern.
      const convoID = parsedresponse.message.conversationID;
      if (parsedresponse.message.deletedMessageID) {
        DeviceEventEmitter.emit(convoID, {
          event: 'reload_deleted_message',
          data: parsedresponse,
        });
      } else {
        DeviceEventEmitter.emit(convoID, {
          event: 'reload',
          data: parsedresponse,
        });
      }

      if (authentication.user.userID !== parsedresponse.message.userID) {
        // Webapp delays the cue ~1.5s so it lands after the message lands
        // on screen — same behavior here.
        setTimeout(() => {
          playSound(parsedresponse.onseen ? 'seen' : 'message');
        }, 1500);
      }
    }
  });

  sseNtfsSource.addEventListener('active_users' as any, (e: any) => {
    const parsedresponse = JSON.parse(e.data);
    if (parsedresponse.auth && parsedresponse.status) {
      const decodedResult: any = jwtDecode(parsedresponse.result);
      dispatch({
        type: UPDATE_ACTIVE_USERS_LIST,
        payload: { updatedUser: decodedResult.user },
      });
    }
  });

  sseNtfsSource.addEventListener('voice-joined' as any, (e: any) => {
    const parsedresponse = JSON.parse(e.data);
    if (parsedresponse.auth && parsedresponse.status) {
      const decodedResult: any = jwtDecode(parsedresponse.result);
      dispatch({
        type: SET_PREVIEW_PARTICIPANTS,
        payload: { previewparticipant: decodedResult.voice_participant },
      });
    }
  });

  // ---- MediaSoup relay events — fan out to SSE_ROOM_RELAY -----------------

  const roomRelayEvents: string[] = [
    'join-room-response',
    'create-transport-response',
    'transport-connect-response',
    'new_producer',
    'participant-joined',
    'participant-left',
    'participant-status',
    'producer-closed',
    'consume-response',
    'consume-transport-error',
    'consume-error',
  ];

  roomRelayEvents.forEach(name => {
    sseNtfsSource!.addEventListener(name as any, (e: any) => {
      relay(SSE_ROOM_RELAY, name, e.data);
    });
  });

  // produce-response goes to its own channel (webapp split).
  sseNtfsSource.addEventListener('produce-response' as any, (e: any) => {
    relay(SSE_ROOM_RELAY_PRODUCE, 'produce-response', e.data);
  });

  sseNtfsSource.addEventListener('update_participants' as any, (e: any) => {
    const data = JSON.parse(e.data);
    if (data.result.action === 'left') {
      dispatch({
        type: REMOVE_PREVIEW_PARTICIPANT,
        payload: {
          previewparticipant: { clientID: data.result.clientId },
        },
      });
    }
  });

  sseNtfsSource.addEventListener('removed_user_notif' as any, (e: any) => {
    const data = JSON.parse(e.data);

    InitConversationListRequest(1, 10).then(response => {
      if (!response) return;
      dispatch({
        type: SET_PREVIEW_PARTICIPANTS_BULK,
        payload: {
          participants: response.conversationslist
            .map((mp: any) => mp.voice_participants)
            .flat(),
        },
      });
      dispatch({
        type: SET_MESSAGES_LIST_OVERRIDE,
        payload: { messageslist: response.conversationslist },
      });
    });

    DeviceEventEmitter.emit(data.result.realm_id, {
      event: 'removed_user_notif',
      data: data,
    });
  });
};

const CloseSSENotifications = () => {
  if (sseNtfsSource) {
    sseNtfsSource.close();
    sseNtfsSource = null;
  }
};

export { SSENotificationsTRequest, CloseSSENotifications };
