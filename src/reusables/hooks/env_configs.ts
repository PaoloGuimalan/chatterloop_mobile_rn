/* Env config — mirrors webapp/src/reusables/hooks/env_configs.ts.
 *
 * In React Native we don't have import.meta.env. Two options:
 *   1) Hardcode for now (the values below match what's in the webapp .env).
 *   2) Use react-native-config to read from a real .env file at runtime.
 *
 * TODO(env): swap to react-native-config when you wire production builds.
 *            For now, edit the constants below. */

import Config from 'react-native-config';

const envs = {
  CHATTERLOOP_API: Config.CHATTERLOOP_API,
  USER_SERVICE_API: Config.USER_SERVICE_API,
  SECRET: Config.SECRET,
  GOOGLE_CLIENT_ID: Config.GOOGLE_CLIENT_ID,
  OPEN_ROUTE_API: Config.OPEN_ROUTE_API,
  OPEN_ROUTE_API_KEY: Config.OPEN_ROUTE_API_KEY,
  TURN_SERVER_URL: Config.TURN_SERVER_URL,
  TURN_SERVER_USERNAME: Config.TURN_SERVER_USERNAME,
  TURN_SERVER_CREDENTIAL: Config.TURN_SERVER_CREDENTIAL,
};

export default envs;
