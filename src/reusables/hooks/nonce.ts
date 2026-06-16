/* Mirrors webapp `generateXNonce`.
 *
 * The web version uses window.crypto.subtle (AES-GCM with SHA-256-derived
 * key). RN doesn't ship WebCrypto. Two ways to handle this:
 *
 *   - Easy:    use a JS-only crypto polyfill (e.g. expo-crypto + crypto-js).
 *   - Robust:  add react-native-quick-crypto, which provides WebCrypto.
 *
 * TODO(crypto): replace this stub with a real AES-GCM implementation that
 *               matches the webapp's bit-for-bit so the backend accepts it.
 *               Until then, the auth backend must either be tolerant or this
 *               must be wired before login will succeed. */

import envs from './env_configs';
import sjcl from 'sjcl';

export async function generateXNonce(userId: string) {
  const secret = envs.SECRET;

  // 1. Generate standard timestamp and random string payload
  const timestamp = Math.floor(Date.now() / 1000);
  const random = Math.random().toString(36).substring(2, 10);
  const plainText = `${userId}.${timestamp}.${random}`;

  // 2. Hash the secret to get a typesafe key bit array
  const keyBits = sjcl.hash.sha256.hash(secret);

  // 3. FIXES: "generator isn't seeded" error
  // Seed the generator manually with an array of random numbers and current timestamps
  const seedArray = Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 0xffffffff),
  );
  sjcl.random.addEntropy(seedArray, 1024, 'crypto.getRandomValues');

  // 4. Initialize a 12-byte initialization vector (IV / Nonce) via SJCL random words
  const ivBits = sjcl.random.randomWords(3);

  // 5. Initialize the custom AES block engine with your key
  const cipher = new sjcl.cipher.aes(keyBits);

  // 6. Encrypt using pure-JS AES-GCM
  const encryptedBits = sjcl.mode.gcm.encrypt(
    cipher,
    sjcl.codec.utf8String.toBits(plainText),
    ivBits,
    [],
    128,
  );

  // 7. Convert the bit arrays directly into clean Hex string formats
  const ivHex = sjcl.codec.hex.fromBits(ivBits);
  const cipherTextHex = sjcl.codec.hex.fromBits(encryptedBits);

  return `${ivHex}.${cipherTextHex}`;
}
