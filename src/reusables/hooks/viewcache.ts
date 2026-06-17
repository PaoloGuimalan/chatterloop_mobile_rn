/* Per-post view-duration telemetry, persisted across app restarts.
 *
 * Webapp persists this to IndexedDB so the backend can de-prioritize
 * already-seen posts on the next paginate even when the session was
 * interrupted (refresh, app kill). The mobile port mirrors that with
 * AsyncStorage:
 *
 *   - Hydrate the in-memory map once on module load.
 *   - Mutations write to memory immediately + schedule a debounced
 *     AsyncStorage write (300ms), so a fast scroll through 20 posts
 *     produces one write instead of twenty.
 *   - Reads (getAllViewCache) await hydrate first so a cold-launched
 *     request still sees the previous session's pending entries.
 *   - Clear is awaited so the post-send wipe is durable. */

import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "cl_viewcache_v1";
const PERSIST_DEBOUNCE_MS = 300;

interface ViewCacheEntry {
  post_id: string;
  user_id: string;
  post_owner_id: string;
  duration: number;
  created_at: string;
}

let cache: Map<string, ViewCacheEntry> | null = null;
let hydratePromise: Promise<void> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

/** Idempotent. First call starts the AsyncStorage read; subsequent
 *  calls await the same promise. */
function hydrate(): Promise<void> {
  if (cache !== null) return Promise.resolve();
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ViewCacheEntry[];
        cache = new Map(parsed.map((e) => [e.post_id, e]));
      } else {
        cache = new Map();
      }
    } catch (err) {
      console.log("[viewcache hydrate]", err);
      cache = new Map();
    } finally {
      hydratePromise = null;
    }
  })();
  return hydratePromise;
}

/** Flushes the in-memory map to AsyncStorage. Cancels any pending
 *  debounced write so we don't race with our own scheduled persist. */
async function persistNow(): Promise<void> {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (!cache) return;
  try {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(Array.from(cache.values())),
    );
  } catch (err) {
    console.log("[viewcache persist]", err);
  }
}

function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    // Fire-and-forget; failures are logged inside persistNow.
    persistNow().catch(() => {});
  }, PERSIST_DEBOUNCE_MS);
}

// Kick off hydrate at module load so the cache is ready by the time
// the first request fires. Reads still await hydrate defensively in
// case they race the initial fetch.
hydrate().catch(() => {});

/** Record a post's viewport session. If an entry already exists,
 *  accumulate the duration so multiple in→out cycles add up. Returns
 *  a Promise the caller can ignore — Feed uses fire-and-forget. */
export async function persistViewPost(
  postID: string,
  data: Omit<ViewCacheEntry, "post_id">,
): Promise<void> {
  await hydrate();
  if (!cache) return;
  const existing = cache.get(postID);
  if (existing) {
    cache.set(postID, {
      post_id: postID,
      user_id: existing.user_id,
      post_owner_id: data.post_owner_id || existing.post_owner_id,
      created_at: existing.created_at,
      duration: round3(existing.duration + data.duration),
    });
  } else {
    cache.set(postID, {
      post_id: postID,
      user_id: data.user_id,
      post_owner_id: data.post_owner_id,
      created_at: data.created_at,
      duration: round3(data.duration),
    });
  }
  schedulePersist();
}

/** Snapshot for the backend's `viewcache` param. Filters by userID so
 *  a logged-out → logged-in handoff doesn't leak another account's
 *  history (e.g. a shared device). */
export async function getAllViewCache(
  currentUserID: string,
): Promise<ViewCacheEntry[]> {
  await hydrate();
  if (!cache) return [];
  return Array.from(cache.values()).filter((v) => v.user_id === currentUserID);
}

/** Empty the cache. Webapp calls clearViewPosts() right after a
 *  successful GetFeedRequest — same pattern here. Awaited so the
 *  wipe is durable; if the app gets killed before the persist
 *  resolves, the entries would resurrect next launch. */
export async function clearViewPosts(): Promise<void> {
  await hydrate();
  if (!cache) return;
  cache.clear();
  await persistNow();
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
