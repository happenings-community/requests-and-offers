import { encodeHashToBase64 } from '@holochain/client';

/**
 * A short, readable label for a hash kept as text in an hREA note. Notes store an action
 * hash as its `toString()`, the bytes as numbers with commas, which reads as noise
 * ("53,154,186,5"); this shows the end of its base64 form, as the app shows hashes
 * elsewhere. Text that is not a list of bytes is shortened as it is.
 */
export function hashLabel(hash: string | null | undefined, chars = 8): string {
  if (!hash) return 'unknown';
  if (/^\d+(,\d+)+$/.test(hash)) {
    try {
      const b64 = encodeHashToBase64(new Uint8Array(hash.split(',').map(Number)));
      return `…${b64.slice(-chars)}`;
    } catch {
      // fall through to the text itself
    }
  }
  return hash.length > chars ? `…${hash.slice(-chars)}` : hash;
}
