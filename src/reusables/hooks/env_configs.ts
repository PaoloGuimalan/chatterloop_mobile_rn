/* Env config — mirrors webapp/src/reusables/hooks/env_configs.ts.
 *
 * In React Native we don't have import.meta.env. Two options:
 *   1) Hardcode for now (the values below match what's in the webapp .env).
 *   2) Use react-native-config to read from a real .env file at runtime.
 *
 * TODO(env): swap to react-native-config when you wire production builds.
 *            For now, edit the constants below. */

import Config from 'react-native-config';

// react-native-config types every entry as string|undefined because
// values come from .env at build time and could be missing. Downstream
// consumers (jwt-encode `sign`, Axios URLs, AES-GCM nonce) all need
// proper strings, so we coerce at the boundary: missing vars become
// "" so the failure mode is a clearly broken request rather than a
// TypeError deep in a third-party library.
const s = (v: string | undefined): string => v ?? '';

const envs = {
  CHATTERLOOP_API: s(Config.CHATTERLOOP_API),
  USER_SERVICE_API: s(Config.USER_SERVICE_API),
  SECRET: s(Config.SECRET),
  GOOGLE_CLIENT_ID: s(Config.GOOGLE_CLIENT_ID),
  OPEN_ROUTE_API: s(Config.OPEN_ROUTE_API),
  OPEN_ROUTE_API_KEY: s(Config.OPEN_ROUTE_API_KEY),
  TURN_SERVER_URL: s(Config.TURN_SERVER_URL),
  TURN_SERVER_USERNAME: s(Config.TURN_SERVER_USERNAME),
  TURN_SERVER_CREDENTIAL: s(Config.TURN_SERVER_CREDENTIAL),
};

export default envs;
