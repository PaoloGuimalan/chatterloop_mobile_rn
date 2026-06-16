/* eslint-disable dot-notation */
/* Shared axios instance — mirrors webapp/src/reusables/hooks/requests.ts.
 *
 * Webapp behavior we keep:
 *   - Read authtoken from storage (localStorage there, AsyncStorage here)
 *   - Attach X-Nonce + Device-Token request headers
 *   - Auto-generate a Device-Token UUID on first use
 *
 * Anything that talks to your backend should import { Axios } from here,
 * not call axios.create() locally. */

import axios from 'axios';
import { generateUUID } from './uuid';
import { generateXNonce } from './nonce';
import { getItem, setItem } from './storage';
import { jwtDecode } from 'jwt-decode';

const Axios = axios.create();

Axios.interceptors.request.use(async config => {
  try {
    const user = await getItem('authtoken');
    const decoded: { username: string; userID: string } | null = user
      ? jwtDecode(user)
      : null;
    const userID = decoded ? decoded.userID : 'guest';

    const nonce = await generateXNonce(userID);
    config.headers['X-Nonce'] = nonce;

    let deviceToken = await getItem('device');
    if (!deviceToken) {
      deviceToken = generateUUID();
      await setItem('device', deviceToken);
    }
    config.headers['Device-Token'] = deviceToken;
    config.headers['Origin'] = 'https://chatterloop.app';

    return config;
  } catch (err) {
    return Promise.reject(err);
  }
});

export { Axios };
