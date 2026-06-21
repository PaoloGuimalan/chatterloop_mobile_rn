/* Thin wrapper around react-native-image-picker that yields the same
 * shape the webapp medialist uses: { base, type, name } where `base`
 * is a full data URL ("data:<mime>;base64,...") so it can be dropped
 * straight into SendFilesRequest / CreatePostRequest payloads. */

import {
  launchImageLibrary,
  MediaType,
  PhotoQuality,
  Asset,
} from 'react-native-image-picker';

export interface PickedMedia {
  /** Full data URL, ready to drop into webapp-shaped payloads. */
  base: string;
  /** "image" | "video" — coarse bucket used by the messenger flow. */
  type: 'image' | 'video';
  name: string;
  /** Raw file URI (file:// or content://). Use this when uploading
   *  via FormData multipart — the `base` data URL is for endpoints
   *  that accept base64 inline. */
  uri?: string;
  /** Full MIME (e.g. "image/jpeg"). Pairs with `uri` for FormData. */
  mime?: string;
}

interface PickOptions {
  selectionLimit?: number;
  mediaType?: MediaType;
  /** 0..1; smaller = smaller base64 payload. */
  quality?: PhotoQuality;
}

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB — mirrors webapp guard.

function assetToPicked(a: Asset): PickedMedia | null {
  if (!a.base64 || !a.type) return null;
  const bucket: 'image' | 'video' = a.type.startsWith('video') ? 'video' : 'image';
  return {
    base: `data:${a.type};base64,${a.base64}`,
    type: bucket,
    name: a.fileName ?? `${bucket}_${Date.now()}`,
    uri: a.uri,
    mime: a.type,
  };
}

/** Returns picked items or [] if cancelled / errored. Filters out
 *  oversize assets silently — caller can check length to alert. */
export async function pickImages(
  opts: PickOptions = {},
): Promise<PickedMedia[]> {
  try {
    const res = await launchImageLibrary({
      mediaType: opts.mediaType ?? 'photo',
      selectionLimit: opts.selectionLimit ?? 0,
      quality: opts.quality ?? 0.8,
      includeBase64: true,
    });
    if (res.didCancel || res.errorCode || !res.assets) return [];
    const picked: PickedMedia[] = [];
    for (const a of res.assets) {
      if (a.fileSize && a.fileSize > MAX_BYTES) continue;
      const p = assetToPicked(a);
      if (p) picked.push(p);
    }
    return picked;
  } catch (err) {
    console.log('[pickImages]', err);
    return [];
  }
}
