/* AsyncStorage wrapper that mirrors the webapp's localStorage usage.
 *
 * The webapp scatters localStorage.getItem("authtoken") / "device" calls
 * everywhere. To keep parity, we expose a tiny synchronous-feeling API
 * backed by AsyncStorage, plus an in-memory cache so the same lookup
 * doesn't hit native storage every request. */

import AsyncStorage from "@react-native-async-storage/async-storage";

const cache = new Map<string, string | null>();

export async function getItem(key: string): Promise<string | null> {
  if (cache.has(key)) return cache.get(key) ?? null;
  const v = await AsyncStorage.getItem(key);
  cache.set(key, v);
  return v;
}

export async function setItem(key: string, value: string): Promise<void> {
  cache.set(key, value);
  await AsyncStorage.setItem(key, value);
}

export async function removeItem(key: string): Promise<void> {
  cache.delete(key);
  await AsyncStorage.removeItem(key);
}

/** Eagerly load a key into the cache (so the next sync read works). */
export async function preload(key: string): Promise<void> {
  if (cache.has(key)) return;
  const v = await AsyncStorage.getItem(key);
  cache.set(key, v);
}

/** Sync read of a key. Caller must have preloaded it. */
export function readCached(key: string): string | null {
  return cache.get(key) ?? null;
}
