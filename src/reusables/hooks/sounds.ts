/* Alert sound playback — wraps react-native-sound for the SSE handlers.
 *
 * Why a wrapper:
 *   - Sound instances are expensive to construct (file decode); we cache
 *     one per cue and call .play() on the cached instance, mirroring how
 *     the webapp reuses `new Audio()` per cue type.
 *   - The first .play() on a cached instance returns immediately after
 *     load; subsequent plays are stop+restart so a rapid-fire stream of
 *     SSE events doesn't pile up overlapping tones.
 *
 * Asset placement:
 *   - Android: pre-seeded into android/app/src/main/res/raw/*.mp3.
 *   - iOS:     react-native.config.js + `npx react-native-asset` adds
 *              them to the Xcode bundle. (Run once.) */

import Sound from 'react-native-sound';

// Lookup matches the asset basenames (without extension on Android
// since res/raw drops it). MAIN_BUNDLE works for both platforms.
const FILES = {
  notification: 'notification_alert.mp3',
  message: 'message_alert.mp3',
  seen: 'seen_alert.mp3',
  call: 'alert_call_tune.mp3',
} as const;

export type SoundCue = keyof typeof FILES;

Sound.setCategory('Playback');

const cache: Partial<Record<SoundCue, Sound>> = {};

function load(cue: SoundCue): Sound {
  const cached = cache[cue];
  if (cached) return cached;
  // `error` is delivered to the callback — if it fails we keep the
  // instance in the cache and let play() be a no-op.
  const s = new Sound(FILES[cue], Sound.MAIN_BUNDLE, err => {
    if (err) console.log(`[sounds] failed to load ${cue}`, err);
  });
  cache[cue] = s;
  return s;
}

/** Play a cached alert tone. Safe to call repeatedly — overlapping calls
 *  restart from the beginning rather than layering. */
export function playSound(cue: SoundCue) {
  const s = load(cue);
  s.stop(() => {
    s.play(success => {
      if (!success) console.log(`[sounds] playback failed for ${cue}`);
    });
  });
}

/** Release all cached sounds (e.g. on logout). */
export function releaseSounds() {
  (Object.keys(cache) as SoundCue[]).forEach(k => {
    cache[k]?.release();
    delete cache[k];
  });
}
