/* Auth API helpers — mirrors webapp/src/reusables/hooks/requests.ts.
 *
 * Only the auth-related entries are ported here. Everything else (feed,
 * conversations, calls, etc.) lives as TODO stubs you can fill in by
 * copying the corresponding webapp helper and adapting localStorage
 * lookups to AsyncStorage via ./storage. */

import { Dispatch } from 'redux';
import { jwtDecode } from 'jwt-decode';
import sign from 'jwt-encode';
import { Axios } from './axios_client';
import envs from './env_configs';
import { getItem, removeItem, setItem } from './storage';
import { clearViewPosts, getAllViewCache } from './viewcache';
import { ConvertedResponse, convertLoginResponse } from './reusable';
import { authenticationstate } from '../../redux/actions/states';
import {
  SET_ACTIVE_USERS_LIST,
  SET_ALERTS,
  SET_AUTHENTICATION,
  SET_CONTACTS_LIST,
  SET_CONTACTS_LIST_OVERRIDE,
  SET_NOTIFICATIONS_LIST,
  SET_NOTIFICATIONS_LIST_APPEND,
  SET_NOTIFICATIONS_LIST_OVERRIDE,
} from '../../redux/types';

const API = envs.CHATTERLOOP_API;
const USER_SERVICE_API = envs.USER_SERVICE_API;
const SECRET = envs.SECRET;

interface AlertEntry {
  id: number;
  type: 'success' | 'info' | 'warning' | 'error' | 'incomingcall';
  content: string;
}

function pushAlert(
  dispatch: Dispatch<any>,
  current: AlertEntry[],
  type: AlertEntry['type'],
  content: string,
) {
  dispatch({
    type: SET_ALERTS,
    payload: {
      alerts: { id: current.length, type, content },
    },
  });
}

function applyAuthFromDecoded(
  dispatch: Dispatch<any>,
  decoded: ConvertedResponse,
) {
  dispatch({
    type: SET_AUTHENTICATION,
    payload: {
      authentication: {
        auth: true,
        user: {
          id: decoded.id,
          userID: decoded.userID,
          username: decoded.username,
          fullName: {
            firstName: decoded.fullname.firstName,
            middleName: decoded.fullname.middleName,
            lastName: decoded.fullname.lastName,
          },
          birthdate: decoded.birthdate,
          gender: decoded.gender,
          email: decoded.email,
          isActivated: decoded.isActivated,
          isVerified: decoded.isVerified,
          isComplete: decoded.isComplete,
          profile: decoded.profile,
          coverphoto: decoded.coverphoto || '',
        },
      },
    },
  });
}

// ---- AuthCheck — called by Splash on mount ---------------------------------

export const AuthCheck = async (dispatch: Dispatch<any>) => {
  try {
    const token = await getItem('authtoken');
    const response = await Axios.get(`${API}/auth/jwtchecker`, {
      headers: { 'x-access-token': token },
    });

    if (response.data?.status) {
      const userData: any = jwtDecode(response.data.result.usertoken);
      setTimeout(() => {
        dispatch({
          type: SET_AUTHENTICATION,
          payload: {
            authentication: {
              auth: true,
              user: {
                id: userData._id,
                userID: userData._id,
                username: userData.userID,
                fullName: {
                  firstName: userData.fullname.firstName,
                  middleName: userData.fullname.middleName,
                  lastName: userData.fullname.lastName,
                },
                email: userData.email,
                birthdate: userData.birthdate,
                gender: userData.gender,
                isActivated: userData.isActivated,
                isVerified: userData.isVerified,
                isComplete: userData.isComplete,
                profile: userData.profile,
                coverphoto: userData.coverphoto || '',
              },
            },
          },
        });
      }, 200);
    } else {
      dispatch({
        type: SET_AUTHENTICATION,
        payload: { authentication: { ...authenticationstate, auth: false } },
      });
    }
  } catch (err) {
    console.log('[AuthCheck]', err);
    dispatch({
      type: SET_AUTHENTICATION,
      payload: { authentication: { ...authenticationstate, auth: false } },
    });
  }
};

// ---- LoginRequest ----------------------------------------------------------

export const LoginRequest = async (
  params: { email_username: string; password: string },
  dispatch: Dispatch<any>,
  currentAlertState: AlertEntry[],
  setisWaitingRequest: (v: boolean) => void,
) => {
  try {
    const response = await Axios.post(
      `${USER_SERVICE_API}/api/user/auth`,
      params,
    );
    if (response.data.status) {
      await setItem('authtoken', response.data.result.authtoken);
      const decodedRaw: any = jwtDecode(response.data.result.usertoken);
      const decoded = convertLoginResponse(decodedRaw);
      applyAuthFromDecoded(dispatch, decoded);
      pushAlert(
        dispatch,
        currentAlertState,
        'success',
        'You have been Logged In.',
      );
    } else {
      pushAlert(dispatch, currentAlertState, 'warning', response.data.message);
    }
  } catch (err: any) {
    pushAlert(
      dispatch,
      currentAlertState,
      'error',
      err?.message ?? 'Login failed.',
    );
  } finally {
    setisWaitingRequest(false);
  }
};

// ---- ThirdPartyAuthenticationRequest (Google) ------------------------------

export const ThirdPartyAuthenticationRequest = async (
  params: { token: string },
  dispatch: Dispatch<any>,
  currentAlertState: AlertEntry[],
  setisWaitingRequest: (v: boolean) => void,
) => {
  try {
    const response = await Axios.post(
      `${USER_SERVICE_API}/api/user/tp_auth`,
      params,
    );
    if (response.data.status) {
      await setItem('authtoken', response.data.result.authtoken);
      const decodedRaw: any = jwtDecode(response.data.result.usertoken);
      const decoded = convertLoginResponse(decodedRaw);
      applyAuthFromDecoded(dispatch, decoded);
      pushAlert(
        dispatch,
        currentAlertState,
        'success',
        'You have been Logged In.',
      );
    } else {
      pushAlert(dispatch, currentAlertState, 'warning', response.data.message);
    }
  } catch (err: any) {
    pushAlert(
      dispatch,
      currentAlertState,
      'error',
      err?.message ?? 'Login failed.',
    );
  } finally {
    setisWaitingRequest(false);
  }
};

// ---- RegisterRequest -------------------------------------------------------

export interface RegisterPayload {
  firstName: string;
  middleName: string | null;
  lastName: string;
  birthmonth: number;
  birthday: string;
  birthyear: string;
  gender: string;
  email: string;
  password: string;
}

export const RegisterRequest = async (
  params: RegisterPayload,
  dispatch: Dispatch<any>,
  currentAlertState: AlertEntry[],
  setisWaitingRequest: (v: boolean) => void,
) => {
  try {
    const response = await Axios.post(
      `${USER_SERVICE_API}/api/user/me`,
      params,
    );
    if (response.data.status) {
      await setItem('authtoken', response.data.authtoken);
      dispatch({
        type: SET_AUTHENTICATION,
        payload: {
          authentication: {
            auth: true,
            user: {
              id: response.data.userID,
              userID: response.data.userID,
              username: response.data.username,
              fullName: {
                firstName: params.firstName,
                middleName: params.middleName,
                lastName: params.lastName,
              },
              email: params.email,
              isActivated: true,
              isVerified: false,
              isComplete: true,
              gender: params.gender,
              birthdate: null,
              profile: 'none',
              coverphoto: '',
            },
          },
        },
      });
      pushAlert(
        dispatch,
        currentAlertState,
        'success',
        'You have been registered!',
      );
    } else {
      pushAlert(dispatch, currentAlertState, 'warning', response.data.message);
    }
  } catch (err: any) {
    pushAlert(
      dispatch,
      currentAlertState,
      'error',
      err?.message ?? 'Registration failed.',
    );
  } finally {
    setisWaitingRequest(false);
  }
};

// ---- VerifyCodeRequest -----------------------------------------------------

export const VerifyCodeRequest = async (
  params: { code: string },
  dispatch: Dispatch<any>,
  currentState: { user: any },
  currentAlertState: AlertEntry[],
  setisWaitingRequest: (v: boolean) => void,
) => {
  try {
    const token = await getItem('authtoken');
    const response = await Axios.post(
      `${USER_SERVICE_API}/api/user/verification`,
      params,
      { headers: { 'x-access-token': token } },
    );
    if (response.data.status) {
      dispatch({
        type: SET_AUTHENTICATION,
        payload: {
          authentication: {
            auth: true,
            user: { ...currentState.user, isVerified: true },
          },
        },
      });
      pushAlert(
        dispatch,
        currentAlertState,
        'success',
        'Your account is now verified.',
      );
    } else {
      pushAlert(dispatch, currentAlertState, 'warning', response.data.message);
    }
  } catch (err: any) {
    pushAlert(
      dispatch,
      currentAlertState,
      'error',
      err?.response?.data?.message ?? err?.message ?? 'Verification failed.',
    );
  } finally {
    setisWaitingRequest(false);
  }
};

// ---- CompleteProfileRequest (used by Setup) --------------------------------

export const CompleteProfileRequest = async (
  payload: Record<string, unknown>,
  dispatch: Dispatch<any>,
  currentAlertState: AlertEntry[],
  setisWaitingRequest: (v: boolean) => void,
) => {
  try {
    const token = await getItem('authtoken');
    const response = await Axios.put(
      `${USER_SERVICE_API}/api/user/me`,
      payload,
      {
        headers: { 'x-access-token': token },
      },
    );
    if (response.data.status) {
      await AuthCheck(dispatch);
      pushAlert(dispatch, currentAlertState, 'success', 'Profile updated.');
    } else {
      pushAlert(dispatch, currentAlertState, 'warning', response.data.message);
    }
  } catch (err: any) {
    pushAlert(
      dispatch,
      currentAlertState,
      'error',
      err?.message ?? 'Update failed.',
    );
  } finally {
    setisWaitingRequest(false);
  }
};

// ---- LogoutRequest ---------------------------------------------------------

export const LogoutRequest = async (dispatch: Dispatch<any>) => {
  await removeItem('authtoken');
  dispatch({
    type: SET_AUTHENTICATION,
    payload: { authentication: { ...authenticationstate, auth: false } },
  });
};

// ---- NotificationInitRequest -----------------------------------------------

export const NotificationInitRequest = async (
  page: number,
  range: number,
  dispatch: Dispatch<any>,
  setisLoading: (v: boolean) => void,
) => {
  try {
    const token = await getItem('authtoken');
    const response = await Axios.get(`${API}/u/getNotifications`, {
      headers: {
        'x-access-token': token,
        page: page || 1,
        range: range || 20,
      },
    });
    if (response.data?.status) {
      const decodedResult: any = jwtDecode(response.data.result);
      dispatch({
        type: SET_NOTIFICATIONS_LIST,
        payload: {
          notficationslist: {
            list: decodedResult.notifications,
            totalunread: decodedResult.totalunread,
            total: decodedResult.total,
            next: decodedResult.next,
          },
        },
      });
    }
  } catch (err) {
    console.log('[NotificationInitRequest]', err);
  } finally {
    setisLoading(false);
  }
};

// ---- ReadNotificationsRequest ----------------------------------------------

export const ReadNotificationsRequest = async () => {
  try {
    const token = await getItem('authtoken');
    await Axios.post(
      `${API}/u/readnotifications`,
      {},
      { headers: { 'x-access-token': token } },
    );
  } catch (err) {
    console.log('[ReadNotificationsRequest]', err);
  }
};

// ---- AcceptContactRequest --------------------------------------------------

export const AcceptContactRequest = async (
  params: { connection_id: string; to_user_id: string },
  dispatch: Dispatch<any>,
  currentAlertState: AlertEntry[],
  setisDisabledByRequest: (v: boolean) => void,
) => {
  try {
    const token = await getItem('authtoken');
    const response = await Axios.put(
      `${USER_SERVICE_API}/api/user/contacts`,
      params,
      { headers: { 'x-access-token': token } },
    );
    if (response.data?.status) {
      pushAlert(dispatch, currentAlertState, 'success', response.data.message);
    } else {
      pushAlert(dispatch, currentAlertState, 'warning', response.data.message);
    }
  } catch (err: any) {
    pushAlert(
      dispatch,
      currentAlertState,
      'error',
      err?.message ?? 'Request failed.',
    );
  } finally {
    setisDisabledByRequest(false);
  }
};

// ---- DeclineContactRequest -------------------------------------------------

/** DELETE /api/user/contacts — drives decline of an incoming request,
 *  remove of an existing contact, and cancel of an outgoing request.
 *  `action` is sent as a header per the webapp contract: "decline" |
 *  "remove" | "cancel" (cancel maps to "remove" backend-side). */
export const DeclineContactRequest = async (
  params: {
    connection_id: string;
    to_user_id: string;
    action: 'decline' | 'remove' | 'cancel';
  },
  dispatch: Dispatch<any>,
  currentAlertState: AlertEntry[],
  setisDisabledByRequest: (v: boolean) => void,
) => {
  try {
    const token = await getItem('authtoken');
    const response = await Axios.delete(
      `${USER_SERVICE_API}/api/user/contacts`,
      {
        headers: {
          'x-access-token': token,
          action: params.action,
        },
        data: {
          connection_id: params.connection_id,
          to_user_id: params.to_user_id,
        },
      },
    );
    pushAlert(
      dispatch,
      currentAlertState,
      'success',
      response.data?.message ?? 'Request declined.',
    );
  } catch (err: any) {
    pushAlert(
      dispatch,
      currentAlertState,
      'error',
      err?.message ?? 'Request failed.',
    );
  } finally {
    setisDisabledByRequest(false);
  }
};

// ---- NotificationAppendRequest --------------------------------------------

/** Fetches a non-first page and appends to the redux list (de-duped
 *  by referenceID in the reducer). Powers the FlatList onEndReached. */
export const NotificationAppendRequest = async (
  page: number,
  range: number,
  dispatch: Dispatch<any>,
  setisLoading: (v: boolean) => void,
) => {
  try {
    const token = await getItem('authtoken');
    const response = await Axios.get(`${API}/u/getNotifications`, {
      headers: {
        'x-access-token': token,
        page: page || 1,
        range: range || 20,
      },
    });
    if (response.data?.status) {
      const decodedResult: any = jwtDecode(response.data.result);
      dispatch({
        type: SET_NOTIFICATIONS_LIST_APPEND,
        payload: {
          notficationslist: {
            list: decodedResult.notifications,
            totalunread: decodedResult.totalunread,
            total: decodedResult.total,
            next: decodedResult.next,
          },
        },
      });
    }
  } catch (err) {
    console.log('[NotificationAppendRequest]', err);
  } finally {
    setisLoading(false);
  }
};

// ---- NotificationOverrideRequest -------------------------------------------

export const NotificationOverrideRequest = async (
  page: number,
  range: number,
  dispatch: Dispatch<any>,
  setisLoading: (v: boolean) => void,
) => {
  try {
    const token = await getItem('authtoken');
    const response = await Axios.get(`${API}/u/getNotifications`, {
      headers: {
        'x-access-token': token,
        page: page || 1,
        range: range || 20,
      },
    });
    if (response.data?.status) {
      const decodedResult: any = jwtDecode(response.data.result);
      dispatch({
        type: SET_NOTIFICATIONS_LIST_OVERRIDE,
        payload: {
          notficationslist: {
            list: decodedResult.notifications,
            totalunread: decodedResult.totalunread,
            total: decodedResult.total,
            next: decodedResult.next,
          },
        },
      });
    }
  } catch (err) {
    console.log('[NotificationOverrideRequest]', err);
  } finally {
    setisLoading(false);
  }
};

// ---- ContactsListInitRequest -----------------------------------------------

export const ContactsListInitRequest = async (
  page: number,
  range: number,
  override: boolean,
  dispatch: Dispatch<any>,
  setisLoading: (v: boolean) => void,
  isState: boolean = false,
  search: string | null = null,
) => {
  try {
    const token = await getItem('authtoken');
    const response = await Axios.get(
      `${USER_SERVICE_API}/api/user/contacts?page=${page}&page_size=${range}`,
      {
        headers: { 'x-access-token': token },
        params: { search },
      },
    );
    const paginatedContacts = response.data;

    if (isState) {
      dispatch(paginatedContacts);
    } else {
      dispatch({
        type: override ? SET_CONTACTS_LIST_OVERRIDE : SET_CONTACTS_LIST,
        payload: { contactslist: paginatedContacts },
      });
    }
  } catch (err) {
    console.log('[ContactsListInitRequest]', err);
  } finally {
    setisLoading(false);
  }
};

// ---- Archived conversations ------------------------------------------------

export interface ArchivedConvo {
  conversationID: string;
  conversationType: 'single' | 'group' | 'server';
  unread?: number;
  isDeleted?: boolean;
  sender?: string;
  messageType?: string;
  content?: string;
  messageDate?: { date: string; time?: string } | string;
  users?: {
    _id: string;
    profile?: string;
    fullname: { firstName: string; middleName?: string; lastName: string };
  }[];
  groupdetails?: { groupID?: string; groupName: string; profile?: string };
  serverdetails?: { serverID?: string; serverName: string; profile?: string };
}

export interface ArchivedConvoPage {
  archives: ArchivedConvo[];
  next: boolean;
  total: number;
}

export const ManualInitConversationListRequest = async (
  page: number,
  range: number,
): Promise<ArchivedConvoPage> => {
  const empty: ArchivedConvoPage = { archives: [], next: false, total: 0 };
  try {
    const token = await getItem('authtoken');
    const response = await Axios.get(`${API}/m/archives`, {
      headers: {
        'x-access-token': token,
        page,
        range,
      },
    });
    if (response.data?.status) {
      return {
        archives: response.data.result?.archives ?? [],
        next: response.data.result?.next ?? false,
        total: response.data.result?.total ?? 0,
      };
    }
    return empty;
  } catch (err) {
    console.log('[ManualInitConversationListRequest]', err);
    return empty;
  }
};

// ---- Conversation thread helpers -------------------------------------------

export interface ThreadMessage {
  _id: string;
  messageID: string;
  conversationID: string;
  userID: string;
  sender?: string;
  content: string;
  messageType: string;
  seeners: string[];
  isDeleted?: boolean;
  messageDate: { date: string; time?: string } | string;
  pendingID?: string;
  references?: { reference: string; referenceMediaType?: string }[];
  [k: string]: unknown;
}

export interface InitConversationResult {
  messages: ThreadMessage[];
  total: number;
}

export const InitConversationRequest = async (
  conversationID: string,
  page: number,
  range: number,
): Promise<InitConversationResult | null> => {
  try {
    const token = await getItem('authtoken');
    const response = await Axios.get(
      `${API}/u/initConversation/${conversationID}`,
      {
        headers: {
          'x-access-token': token,
          page: page || 1,
          range: range || 20,
        },
      },
    );
    if (response.data?.status) {
      const decoded: { messages: ThreadMessage[]; total: number } = jwtDecode(
        response.data.result,
      );
      return { messages: decoded.messages ?? [], total: decoded.total ?? 0 };
    }
    return null;
  } catch (err) {
    console.log('[InitConversationRequest]', err);
    return null;
  }
};

export interface SendMessagePayload {
  conversationID: string;
  pendingID: string;
  receivers: string[];
  content: string;
  isReply?: boolean;
  replyingTo?: unknown;
  messageType?: string;
  conversationType?: string;
}

export interface SeenMessagePayload {
  conversationID: string;
  range: number;
  receivers: string[];
  messageIDs: string[];
}

export interface SeenMessageResult {
  seen: string[];
}

export const SeenMessageRequest = async (
  params: SeenMessagePayload,
): Promise<SeenMessageResult> => {
  const empty: SeenMessageResult = { seen: [] };
  try {
    const token = await getItem('authtoken');
    const encoded = sign(params, SECRET);
    const response = await Axios.post(
      `${API}/u/seenNewMessages`,
      { token: encoded },
      {
        headers: {
          'x-access-token': token,
          range: params.range || 20,
        },
      },
    );
    if (response.data?.status) {
      return { seen: response.data.seen ?? [] };
    }
    return empty;
  } catch (err) {
    console.log('[SeenMessageRequest]', err);
    return empty;
  }
};

export interface IsTypingPayload {
  conversationID: string;
  receivers: string[];
}

export const IsTypingBroadcastRequest = async (
  payload: IsTypingPayload,
): Promise<void> => {
  try {
    const token = await getItem('authtoken');
    const encoded = sign(payload, SECRET);
    await Axios.post(
      `${API}/m/istypingbroadcast`,
      { token: encoded },
      { headers: { 'x-access-token': token } },
    );
  } catch (err) {
    console.log('[IsTypingBroadcastRequest]', err);
  }
};

export const SendMessageRequest = async (
  params: SendMessagePayload,
): Promise<boolean> => {
  try {
    const token = await getItem('authtoken');
    const encoded = sign(
      {
        ...params,
        messageType: params.messageType ?? 'text',
        isReply: params.isReply ?? false,
        replyingTo: params.replyingTo ?? null,
      },
      SECRET,
    );
    const response = await Axios.post(
      `${API}/u/sendMessage`,
      { token: encoded },
      { headers: { 'x-access-token': token } },
    );
    return response.data?.status === true;
  } catch (err) {
    console.log('[SendMessageRequest]', err);
    return false;
  }
};

// ---- InitConversationListRequest -------------------------------------------

export const InitConversationListRequest = async (
  page: number,
  range: number,
): Promise<any> => {
  try {
    const token = await getItem('authtoken');
    // NOTE: webapp pulls `type` from getSettings(userID). We don't have a
    // local settings store yet — default to "common" until that's ported.
    const type = 'common';

    const response = await Axios.get(`${API}/u/initConversationList`, {
      headers: {
        'x-access-token': token,
        type,
        page,
        range,
      },
    });
    console.log(response);
    if (response.data?.status) {
      const decodedResult: any = jwtDecode(response.data.result);
      return decodedResult;
    }
    return undefined;
  } catch (err) {
    console.log('[InitConversationListRequest]', err);
    return undefined;
  }
};

// ---- Realm follow helpers --------------------------------------------------

export const FollowRealmRequest = async (
  payload: Record<string, unknown>,
): Promise<boolean> => {
  try {
    const token = await getItem('authtoken');
    const response = await Axios.post(
      `${USER_SERVICE_API}/api/realm/follow`,
      payload,
      { headers: { 'x-access-token': token } },
    );
    return response.data?.status === true;
  } catch (err) {
    console.log('[FollowRealmRequest]', err);
    return false;
  }
};

export const UnfollowRealmRequest = async (
  payload: Record<string, unknown>,
): Promise<boolean> => {
  try {
    const token = await getItem('authtoken');
    const response = await Axios.delete(
      `${USER_SERVICE_API}/api/realm/follow`,
      {
        headers: { 'x-access-token': token },
        data: payload,
      },
    );
    return response.data?.status === true;
  } catch (err) {
    console.log('[UnfollowRealmRequest]', err);
    return false;
  }
};

// ---- Feed helpers ----------------------------------------------------------

export interface FeedReference {
  reference_id: string;
  reference: string;
  caption: string;
  reference_media_type: string;
  reference_name: string | null;
  post: string;
}

export interface FeedActivityCount {
  count_type: string;
  count: number;
}

export interface FeedPreviewCount {
  count: number;
  emoji: string;
}

export interface FeedAuthor {
  id: string;
  username: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  profile: string;
  is_badged?: boolean;
}

export interface FeedPost {
  post_id: string;
  user: FeedAuthor;
  caption: string;
  content_type: string;
  date_posted: string;
  references: FeedReference[];
  preview: FeedPreviewCount[];
  activity_counts: FeedActivityCount[];
  user_reaction: number | string | null;
  is_shared?: boolean;
  is_saved?: boolean;
}

export interface FeedPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: FeedPost[];
}

const EMPTY_FEED_PAGE: FeedPage = {
  count: 0,
  next: null,
  previous: null,
  results: [],
};

export const GetFeedRequest = async (params: {
  current_user_id: string;
  page: number;
  range: number;
}): Promise<FeedPage> => {
  try {
    const token = await getItem('authtoken');
    // Webapp pattern: drain the AsyncStorage-backed viewcache (per-post
    // duration telemetry collected while the user scrolled) and ship
    // it with the request, then clear so we don't double-count.
    const viewcache = await getAllViewCache(params.current_user_id);
    const response = await Axios.post(
      `${USER_SERVICE_API}/api/newsfeed/default/?page=${params.page}&page_size=${params.range}`,
      { viewcache },
      { headers: { 'x-access-token': token } },
    );
    await clearViewPosts();
    return response.data ?? EMPTY_FEED_PAGE;
  } catch (err) {
    console.log('[GetFeedRequest]', err);
    return EMPTY_FEED_PAGE;
  }
};

export interface CreatePostPayload {
  caption: string;
  /** Currently unused — passthrough for future image/video uploads. */
  references?: {
    id: number;
    name: string | null;
    reference: string;
    caption: string;
    referenceMediaType: string;
  }[];
  /** Defaults to "text"/"text" for caption-only posts. */
  fileType?: string;
  contentType?: string;
  realm_id?: string | null;
  /** Webapp default is "public"; "friends" restricts to contacts, and
   *  "filtered" lets the author pick specific viewers (privacy_users). */
  privacy_status?: 'public' | 'friends' | 'filtered';
  /** UserIDs allowed to see this post when privacy_status === "filtered". */
  privacy_users?: string[];
  /** Usernames to tag in the post (webapp expects usernames, not IDs). */
  tagging_users?: string[];
}

export const CreatePostRequest = async (
  payload: CreatePostPayload,
): Promise<boolean> => {
  try {
    const token = await getItem('authtoken');
    const refs = payload.references ?? [];
    const fileType = payload.fileType ?? (refs.length > 0 ? 'media' : 'text');
    const contentType =
      payload.contentType ?? (refs.length > 0 ? 'media' : 'text');
    const tagged = payload.tagging_users ?? [];
    const encoded = sign(
      {
        content: {
          isShared: false,
          references: refs,
          data: payload.caption,
        },
        type: { fileType, contentType },
        tagging: { isTagged: tagged.length > 0, users: tagged },
        privacy: {
          status: payload.privacy_status ?? 'public',
          users: payload.privacy_users ?? [],
        },
        onfeed: 'feed',
        realm_id: payload.realm_id ?? null,
      },
      SECRET,
    );
    const response = await Axios.post(
      `${API}/posts/createpost`,
      { token: encoded },
      { headers: { 'x-access-token': token } },
    );
    return response.data?.status === true;
  } catch (err) {
    console.log('[CreatePostRequest]', err);
    return false;
  }
};

/** Single-post fetch. Webapp hits the same endpoint via
 *  GetPostPreviewRequest; the response shape matches a FeedPost row
 *  (with `references`, `activity_counts`, `user_reaction`, etc.). */
export const GetPostPreviewRequest = async (
  postID: string,
): Promise<FeedPost | null> => {
  try {
    const token = await getItem('authtoken');
    const response = await Axios.get(
      `${USER_SERVICE_API}/api/newsfeed/preview/${postID}/`,
      { headers: { 'x-access-token': token } },
    );
    return (response.data ?? null) as FeedPost | null;
  } catch (err) {
    console.log('[GetPostPreviewRequest]', err);
    return null;
  }
};

export const GetPostRequest = async (params: {
  current_user_id: string;
  userID: string;
  page: number;
  range: number;
  archive?: boolean;
}): Promise<FeedPage> => {
  try {
    const token = await getItem('authtoken');
    const viewcache = await getAllViewCache(params.current_user_id);
    const response = await Axios.post(
      `${USER_SERVICE_API}/api/newsfeed/profile/${params.userID}/?page=${params.page}&page_size=${params.range}`,
      { viewcache },
      {
        headers: { 'x-access-token': token },
        params: { archive: params.archive },
      },
    );
    await clearViewPosts();
    return response.data ?? EMPTY_FEED_PAGE;
  } catch (err) {
    console.log('[GetPostRequest]', err);
    return EMPTY_FEED_PAGE;
  }
};

// ---- Realm (Pages) helpers -------------------------------------------------

export interface RealmProfileInfo {
  id: string;
  name: string;
  description?: string;
  profile?: string;
  cover?: string;
  type?: string;
  [k: string]: unknown;
}

export interface RealmPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: RealmProfileInfo[];
}

const EMPTY_REALM_PAGE: RealmPage = {
  count: 0,
  next: null,
  previous: null,
  results: [],
};

/** Realm/user profile info fetched from `/api/user/auth/<userID>/`.
 *  We narrow only what PageDetail needs today; the endpoint returns
 *  many more fields. The `userID` accepted by the endpoint can be a
 *  realm/page id too — webapp uses the same endpoint for both. */
export interface RealmInfo {
  id: string;
  name: string;
  description?: string;
  profile?: string;
  cover_photo?: string;
  is_follower?: boolean;
  is_admin?: boolean;
  is_verified?: boolean;
  realm_id?: string;
  [k: string]: unknown;
}

export const GetProfileInfoRequest = async (
  userID: string,
): Promise<RealmInfo | null> => {
  try {
    const token = await getItem('authtoken');
    const response = await Axios.get(
      `${USER_SERVICE_API}/api/user/auth/${userID}/`,
      { headers: { 'x-access-token': token } },
    );
    // Backend wraps the realm/user payload one level deep —
    // webapp accesses `response.data.data` (see ProfileContainer.tsx).
    // The outer `data` is the axios response body; the inner `data`
    // is the API envelope that actually carries is_follower / is_admin
    // / etc. Fall back to `response.data` for tolerant shapes.
    const payload = response.data?.data ?? response.data ?? null;
    return payload as RealmInfo | null;
  } catch (err) {
    console.log('[GetProfileInfoRequest]', err);
    return null;
  }
};

export const GetMyRealmsRequest = async (
  page: number,
  range: number,
  type: string,
  search?: string,
): Promise<RealmPage> => {
  try {
    const token = await getItem('authtoken');
    const response = await Axios.get(`${USER_SERVICE_API}/api/realm/my-list`, {
      headers: { 'x-access-token': token },
      params: { page, page_size: range, type, search },
    });
    return response.data ?? EMPTY_REALM_PAGE;
  } catch (err) {
    console.log('[GetMyRealmsRequest]', err);
    return EMPTY_REALM_PAGE;
  }
};

export const GetFollowRealmRequest = async (
  page: number,
  range: number,
  type: string,
  search?: string,
): Promise<RealmPage> => {
  try {
    const token = await getItem('authtoken');
    const response = await Axios.get(`${USER_SERVICE_API}/api/realm/follow`, {
      headers: { 'x-access-token': token },
      params: { page, page_size: range, type, search },
    });
    return response.data ?? EMPTY_REALM_PAGE;
  } catch (err) {
    console.log('[GetFollowRealmRequest]', err);
    return EMPTY_REALM_PAGE;
  }
};

// ---- Server helpers --------------------------------------------------------

export interface ServerSummary {
  serverID: string;
  serverName: string;
  profile?: string;
}

export interface ServerChannel {
  _id: string;
  serverID: string;
  groupID: string;
  groupName: string;
  profile?: string;
  type?: string;
  channelType?: string;
  privacy?: boolean;
  voice_participants?: unknown[];
}

export interface ServerMember {
  _id: string;
  userID?: string;
  fullname?: { firstName?: string; middleName?: string; lastName?: string };
  profile?: string;
  [k: string]: unknown;
}

export interface ServerDetails {
  _id: string;
  serverID: string;
  serverName: string;
  profile?: string;
  is_admin?: boolean;
  privacy?: boolean;
  channels: ServerChannel[];
  members?: unknown[];
  usersWithInfo?: ServerMember[];
}

/** Multipart-upload file ref shaped for React Native's FormData.
 *  RN's FormData wants `{ uri, type, name }`; the cast inside the
 *  request keeps the rest of the codebase free of any-casts. */
export interface UploadFile {
  uri: string;
  type: string;
  name: string;
}

export interface CreatePagePayload {
  pageName: string;
  pageDescription: string;
  email: string;
  slug: string;
  /** UserIDs added as page admins. */
  otherUsers: string[];
  profile: UploadFile;
  cover_photo: UploadFile;
}

/** Webapp uses multipart/form-data — POST `/u/createpage`. The slug
 *  acts as the realm's URL handle and must be unique. */
export const CreatePageRequest = async (
  payload: CreatePagePayload,
): Promise<boolean> => {
  try {
    const token = await getItem('authtoken');
    const form = new FormData();
    form.append('pageName', payload.pageName);
    form.append('pageDescription', payload.pageDescription);
    form.append('email', payload.email);
    form.append('slug', payload.slug);
    form.append('otherUsers', JSON.stringify(payload.otherUsers));
    // RN FormData expects { uri, type, name } objects for files; the
    // cast is the documented escape hatch for fetch/axios multipart.
    form.append('profile', payload.profile as unknown as Blob);
    form.append('cover_photo', payload.cover_photo as unknown as Blob);
    const response = await Axios.post(`${API}/u/createpage`, form, {
      headers: {
        'x-access-token': token,
        // Let axios+RN set the multipart boundary automatically by
        // not setting Content-Type explicitly.
      },
    });
    return response.data?.status === true;
  } catch (err) {
    console.log('[CreatePageRequest]', err);
    return false;
  }
};

export interface CreateChannelPayload {
  serverID: string;
  groupName: string;
  privacy: boolean;
  /** Webapp uses 'text' | 'voice' | 'location'. Voice and location
   *  channels also create the corresponding socket room; for the
   *  native port only 'text' is interactive today. */
  type: 'text' | 'voice' | 'location';
  otherUsers: string[];
}

export const CreateChannelRequest = async (
  payload: CreateChannelPayload,
): Promise<boolean> => {
  try {
    const token = await getItem('authtoken');
    const encoded = sign(payload, SECRET);
    const response = await Axios.post(
      `${API}/u/createchannel`,
      { token: encoded },
      { headers: { 'x-access-token': token } },
    );
    return response.data?.status === true;
  } catch (err) {
    console.log('[CreateChannelRequest]', err);
    return false;
  }
};

export interface CreateServerPayload {
  groupName: string;
  privacy: boolean;
  otherUsers: string[];
}

/** Webapp signs the payload then POSTs `/u/createserver`. The backend
 *  returns `{ status: boolean }` — true means the server was created
 *  and the new entry will appear on the next InitServerListRequest. */
export const CreateServerRequest = async (
  payload: CreateServerPayload,
): Promise<boolean> => {
  try {
    const token = await getItem('authtoken');
    const encoded = sign(payload, SECRET);
    const response = await Axios.post(
      `${API}/u/createserver`,
      { token: encoded },
      { headers: { 'x-access-token': token } },
    );
    return response.data?.status === true;
  } catch (err) {
    console.log('[CreateServerRequest]', err);
    return false;
  }
};

export const InitServerListRequest = async (): Promise<ServerSummary[]> => {
  try {
    const token = await getItem('authtoken');
    const response = await Axios.get(`${API}/s/initserverlist`, {
      headers: { 'x-access-token': token },
    });
    if (response.data?.status) {
      const decoded: { data: ServerSummary[] } = jwtDecode(
        response.data.result,
      );
      return decoded.data ?? [];
    }
    return [];
  } catch (err) {
    console.log('[InitServerListRequest]', err);
    return [];
  }
};

export const InitServerChannelsRequest = async (
  serverID: string,
): Promise<ServerDetails | null> => {
  try {
    const token = await getItem('authtoken');
    const response = await Axios.get(
      `${API}/s/initserverchannels/${serverID}`,
      { headers: { 'x-access-token': token } },
    );
    if (response.data?.status) {
      const decoded: { data: { data: ServerDetails[] } } = jwtDecode(
        response.data.result,
      );
      return decoded.data?.data?.[0] ?? null;
    }
    return null;
  } catch (err) {
    console.log('[InitServerChannelsRequest]', err);
    return null;
  }
};

// ---- Media helpers ---------------------------------------------------------

/** A picked image/video reference, mirroring the webapp's
 *  `medialist`/`pendingArrImages` shape so the same payloads work
 *  against the unchanged backend. `reference` is a full data URL
 *  (e.g. "data:image/jpeg;base64,...."). */
export interface PostMediaReference {
  id: number;
  name: string | null;
  reference: string;
  caption: string;
  referenceMediaType: 'image' | 'video';
}

/** Uploads media references and gets back persisted URLs. Used by
 *  the Diary flow on web; not currently called by the feed/messenger
 *  ports (those send base64 inline). */
export const UploadMediaRequest = async (
  payload: PostMediaReference[],
): Promise<any> => {
  try {
    const token = await getItem('authtoken');
    const response = await Axios.post(
      `${API}/posts/upload`,
      { references: payload },
      { headers: { 'x-access-token': token } },
    );
    return response.data;
  } catch (err) {
    console.log('[UploadMediaRequest]', err);
    return null;
  }
};

export interface SendFilesPayload {
  conversationID: string;
  receivers: string[];
  files: {
    conversationID: string;
    pendingID: string;
    reference: string;
    referenceMediaType: string;
    type: string;
    name: string;
  }[];
  isReply?: boolean;
  replyingTo?: unknown;
  conversationType?: string;
}

export const SendFilesRequest = async (
  payload: SendFilesPayload,
): Promise<boolean> => {
  try {
    const token = await getItem('authtoken');
    const encoded = sign(
      {
        ...payload,
        isReply: payload.isReply ?? false,
        replyingTo: payload.replyingTo ?? null,
      },
      SECRET,
    );
    const response = await Axios.post(
      `${API}/u/sendFiles`,
      { token: encoded },
      { headers: { 'x-access-token': token } },
    );
    return response.data?.status === true;
  } catch (err) {
    console.log('[SendFilesRequest]', err);
    return false;
  }
};

// ---- Comment helpers -------------------------------------------------------

export interface PostCommentAuthor {
  id?: string;
  userID?: string;
  username: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  profile?: string;
  is_badged?: boolean;
}

export interface PostComment {
  comment_id: string;
  text: string;
  attachment: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  parent_comment: string | null;
  post: string;
  user: PostCommentAuthor;
  deleted_by: string | null;
}

export interface PostCommentPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: PostComment[];
}

const EMPTY_COMMENT_PAGE: PostCommentPage = {
  count: 0,
  next: null,
  previous: null,
  results: [],
};

export const GetCommentsRequest = async (
  post_id: string,
  parent_id: string | null,
  page: number = 1,
  range: number = 20,
): Promise<PostCommentPage> => {
  try {
    const token = await getItem('authtoken');
    const url = parent_id
      ? `${USER_SERVICE_API}/api/newsfeed/comments?post_id=${post_id}&parent_id=${parent_id}&page=${page}&page_size=${range}`
      : `${USER_SERVICE_API}/api/newsfeed/comments?post_id=${post_id}&page=${page}&page_size=${range}`;
    const response = await Axios.get(url, {
      headers: { 'x-access-token': token },
    });
    return response.data ?? EMPTY_COMMENT_PAGE;
  } catch (err) {
    console.log('[GetCommentsRequest]', err);
    return EMPTY_COMMENT_PAGE;
  }
};

export const SaveCommentRequest = async (
  post_id: string,
  parent_id: string | null,
  new_comment: string,
  new_attachment: string | null = null,
): Promise<PostComment | null> => {
  try {
    const token = await getItem('authtoken');
    // Mirror webapp's removeNullsFromObject — only send keys that have
    // a value. Server treats missing parent_id as a top-level comment.
    const payload: Record<string, string> = {
      post_id,
      new_comment,
    };
    if (parent_id) payload.parent_id = parent_id;
    if (new_attachment) payload.new_attachment = new_attachment;
    const response = await Axios.post(
      `${USER_SERVICE_API}/api/newsfeed/comments`,
      payload,
      { headers: { 'x-access-token': token } },
    );
    return response.data ?? null;
  } catch (err) {
    console.log('[SaveCommentRequest]', err);
    return null;
  }
};

// ---- Reaction helpers ------------------------------------------------------

export interface EmojiInfo {
  emoji_id: number;
  emoji_content: string;
  emoji_theme?: string;
  animated_preview?: string;
  priority: number;
}

export const GetFeedEmojisRequest = async (): Promise<EmojiInfo[]> => {
  try {
    const token = await getItem('authtoken');
    const response = await Axios.get(
      `${USER_SERVICE_API}/api/newsfeed/emojis`,
      { headers: { 'x-access-token': token } },
    );
    return response.data ?? [];
  } catch (err) {
    console.log('[GetFeedEmojisRequest]', err);
    return [];
  }
};

export interface ReactionSavePayload {
  post_id: string;
  emoji_id: number;
  /** "POST" (new), "PUT" (change), "DELETE" (clear). */
  method: 'POST' | 'PUT' | 'DELETE';
}

export const ReactionSaveRequest = async (
  params: ReactionSavePayload,
): Promise<boolean> => {
  try {
    const token = await getItem('authtoken');
    const response = await Axios.request({
      url: `${USER_SERVICE_API}/api/newsfeed/reaction`,
      method: params.method,
      data: { post_id: params.post_id, emoji_id: params.emoji_id },
      headers: { 'x-access-token': token },
    });
    return response.data?.status === true || response.status < 400;
  } catch (err) {
    console.log('[ReactionSaveRequest]', err);
    return false;
  }
};

// ---- Diary helpers ---------------------------------------------------------

export interface DiaryMood {
  id: number;
  value: number;
  name: string;
  emoji: string;
  label: string;
}

export interface DiaryTag {
  id: number;
  name: string;
  label?: string;
  value?: number;
  is_new?: boolean;
}

export interface DiaryEntryAttachment {
  file_id?: string;
  id?: string;
  file_type: string;
  file_name: string | null;
  url: string;
  created_at?: string;
}

export interface DiaryEntry {
  id: string;
  account: string;
  title: string;
  content: string;
  entry_date: string;
  mood: { id: number; name: string; emoji: string } | null;
  is_private: boolean;
  tag_objects: DiaryTag[];
  attachments: DiaryEntryAttachment[];
  entry_map_info: unknown;
  created_at: string;
  updated_at: string;
}

export interface DiaryEntryPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: DiaryEntry[];
}

const EMPTY_DIARY_PAGE: DiaryEntryPage = {
  count: 0,
  next: null,
  previous: null,
  results: [],
};

export interface NewDiaryEntryPayload {
  title: string;
  content: string;
  mood: DiaryMood | null;
  tags: DiaryTag[];
  attachments: DiaryEntryAttachment[];
  entry_date: string | null;
  is_private: boolean;
}

export interface DiaryMoodPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: DiaryMood[];
}

const EMPTY_MOOD_PAGE: DiaryMoodPage = {
  count: 0,
  next: null,
  previous: null,
  results: [],
};

/** Backend wraps tag pagination differently from mood:
 *  `{ results: { list, is_new }, next, ... }`. `is_new` is true when
 *  the searched string didn't match any existing tag — used to surface
 *  a "Create new tag" CTA. */
export interface DiaryTagPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: { list: DiaryTag[]; is_new: boolean };
}

const EMPTY_TAG_PAGE: DiaryTagPage = {
  count: 0,
  next: null,
  previous: null,
  results: { list: [], is_new: false },
};

export const GetMoodListRequest = async (
  page: number,
  range: number,
): Promise<DiaryMoodPage> => {
  try {
    const token = await getItem('authtoken');
    const response = await Axios.get(
      `${USER_SERVICE_API}/api/diary/moods/?page=${page}&page_size=${range}`,
      { headers: { 'x-access-token': token } },
    );
    return response.data ?? EMPTY_MOOD_PAGE;
  } catch (err) {
    console.log('[GetMoodListRequest]', err);
    return EMPTY_MOOD_PAGE;
  }
};

export const GetTagsListRequest = async (
  page: number,
  range: number,
  search: string = '',
): Promise<DiaryTagPage> => {
  try {
    const token = await getItem('authtoken');
    const response = await Axios.get(
      `${USER_SERVICE_API}/api/diary/tags/?search=${encodeURIComponent(
        search,
      )}&page=${page}&page_size=${range}`,
      { headers: { 'x-access-token': token } },
    );
    return response.data ?? EMPTY_TAG_PAGE;
  } catch (err) {
    console.log('[GetTagsListRequest]', err);
    return EMPTY_TAG_PAGE;
  }
};

export const GetUserEntriesRequest = async (
  page: number,
  range: number,
): Promise<DiaryEntryPage> => {
  try {
    const token = await getItem('authtoken');
    const response = await Axios.get(
      `${USER_SERVICE_API}/api/diary/entries/?page=${page}&page_size=${range}`,
      { headers: { 'x-access-token': token } },
    );
    return response.data ?? EMPTY_DIARY_PAGE;
  } catch (err) {
    console.log('[GetUserEntriesRequest]', err);
    return EMPTY_DIARY_PAGE;
  }
};

export const GetEntryRequest = async (
  entry_id: string,
): Promise<DiaryEntry | null> => {
  try {
    const token = await getItem('authtoken');
    const response = await Axios.get(
      `${USER_SERVICE_API}/api/diary/entry/${entry_id}`,
      { headers: { 'x-access-token': token } },
    );
    return response.data ?? null;
  } catch (err) {
    console.log('[GetEntryRequest]', err);
    return null;
  }
};

export const PostNewEntryRequest = async (
  payload: NewDiaryEntryPayload,
): Promise<DiaryEntry | null> => {
  try {
    const token = await getItem('authtoken');
    const response = await Axios.post(
      `${USER_SERVICE_API}/api/diary/entry/`,
      payload,
      { headers: { 'x-access-token': token } },
    );
    return response.data ?? null;
  } catch (err) {
    console.log('[PostNewEntryRequest]', err);
    return null;
  }
};

export interface DiaryPreview {
  latest_entry: string | null;
  top_tags: { id: number; name: string }[];
  total_entries: number;
}

/** Backs the profile diary summary card. Returns null on failure so
 *  the caller can render a skeleton row without throwing. */
export const GetDiaryTotalRequest = async (
  userID: string,
): Promise<DiaryPreview | null> => {
  try {
    const token = await getItem('authtoken');
    const response = await Axios.get(
      `${USER_SERVICE_API}/api/diary/total/${userID}/`,
      { headers: { 'x-access-token': token } },
    );
    const data = response.data;
    if (!data) return null;
    return {
      latest_entry: data.latest_entry ?? null,
      top_tags: Array.isArray(data.top_tags) ? data.top_tags : [],
      total_entries: data.total_entries ?? 0,
    };
  } catch (err) {
    console.log('[GetDiaryTotalRequest]', err);
    return null;
  }
};

// ---- ActiveContactsRequest -------------------------------------------------

export const ActiveContactsRequest = async (dispatch: Dispatch<any>) => {
  try {
    const token = await getItem('authtoken');
    const response = await Axios.get(`${API}/u/activecontacts`, {
      headers: { 'x-access-token': token },
    });
    if (response.data?.status) {
      dispatch({
        type: SET_ACTIVE_USERS_LIST,
        payload: { activeuserslist: response.data.result },
      });
    }
  } catch (err) {
    console.log('[ActiveContactsRequest]', err);
  }
};

// ---- Message-level helpers -------------------------------------------------

/** Reacts to a single message with an emoji. Payload mirrors webapp's
 *  EmojiPickerHandler: `newreaction` is `{ userID, emoji, ...rest }`.
 *  Backend dedupes by userID — a second call from the same user
 *  swaps their existing reaction. Fire-and-forget on the client;
 *  optimistic update is done at the call site. */
export const ReactToMessageRequest = async (params: {
  conversationID: string;
  messageID: string;
  newreaction: { userID: string; emoji: string; [k: string]: unknown };
}): Promise<boolean> => {
  try {
    const token = await getItem('authtoken');
    const encoded = sign(params, SECRET);
    const response = await Axios.post(
      `${API}/m/addreaction`,
      { token: encoded },
      { headers: { 'x-access-token': token } },
    );
    return Boolean(response.data?.status ?? true);
  } catch (err) {
    console.log('[ReactToMessageRequest]', err);
    return false;
  }
};

/** Soft-deletes a message by ID. Webapp signs the {conversationID,
 *  messageID} payload as a JWT then POSTs to `/m/deletemessage`. The
 *  backend flips `isDeleted` on the row and broadcasts `messages_list`
 *  via SSE so the conversation list/thread refresh on every device. */
export const DeleteMessageRequest = async (params: {
  conversationID: string;
  messageID: string;
}): Promise<boolean> => {
  try {
    const token = await getItem('authtoken');
    const encoded = sign(params, SECRET);
    const response = await Axios.post(
      `${API}/m/deletemessage`,
      { token: encoded },
      { headers: { 'x-access-token': token } },
    );
    return Boolean(response.data?.status ?? true);
  } catch (err) {
    console.log('[DeleteMessageRequest]', err);
    return false;
  }
};

// ---- Call signaling helpers -----------------------------------------------

export interface CallCaller {
  name: string;
  userID: string;
}

/** Caller-side: tell the backend to fan out an `incomingcall` push to
 *  every recipient. Body is JWT-signed per webapp's contract.
 *
 *  Note: backend expects the *misspelled* `recepients` key (not
 *  `recipients`). The receivers array in route params is just IDs —
 *  same shape as `callRecipients` in webapp Conversation.tsx. */
export const CallRequest = async (params: {
  conversationType: string;
  conversationID: string;
  callType: 'audio' | 'video';
  callDisplayName: string;
  caller: CallCaller;
  recepients: string[];
  displayImage: string;
}): Promise<boolean> => {
  try {
    const token = await getItem('authtoken');
    const encoded = sign(params, SECRET);
    const response = await Axios.post(
      `${API}/u/call`,
      { token: encoded },
      { headers: { 'x-access-token': token } },
    );
    return Boolean(response.data?.status);
  } catch (err) {
    console.log('[CallRequest]', err);
    return false;
  }
};

/** Callee-side: tell the backend to fan out a `callreject` push so the
 *  caller's UI dismisses the ringing modal. */
export const RejectCallRequest = async (params: {
  conversationType?: string;
  conversationID: string;
  caller?: unknown;
}): Promise<void> => {
  try {
    const token = await getItem('authtoken');
    const encoded = sign(params, SECRET);
    await Axios.post(
      `${API}/u/rejectcall`,
      { token: encoded },
      { headers: { 'x-access-token': token } },
    );
  } catch (err) {
    console.log('[RejectCallRequest]', err);
  }
};

/** Caller- or callee-side: tell the backend the call session is over so
 *  it can broadcast `endcall` to the other side(s). `recepients`
 *  (misspelled) and `conversationType` are required when the caller
 *  cancels mid-ring — without them the backend has nobody to notify. */
export const EndCallRequest = async (params: {
  conversationID: string;
  conversationType?: string;
  recepients?: string[];
  [k: string]: unknown;
}): Promise<void> => {
  try {
    const token = await getItem('authtoken');
    const encoded = sign(params, SECRET);
    await Axios.post(
      `${API}/u/endcall`,
      { token: encoded },
      { headers: { 'x-access-token': token } },
    );
  } catch (err) {
    console.log('[EndCallRequest]', err);
  }
};

// ---- TODOs to port later ---------------------------------------------------
// - VoiceRequest (server voice-channel join notify — needs ActiveCallScreen)
//
// Each one is a near-mechanical port:
//   1. Read the webapp implementation (src/reusables/hooks/requests.ts).
//   2. Replace `localStorage.getItem` with `await getItem(...)`.
//   3. Replace `localStorage.setItem` with `await setItem(...)`.
//   4. Use the shared Axios instance from ./axios_client.
