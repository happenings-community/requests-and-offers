import { decodeHashFromBase64, encodeHashToBase64 } from '@holochain/client';

/**
 * The `ref:<type>:<hash>` notes that tie an hREA record to the R&O entry it mirrors.
 *
 * A note is written with the hash in its base64 form, the form the app shows and links
 * everywhere else. Notes written before that carry the hash as `Uint8Array.toString()`, its
 * bytes as decimals with commas ("132,41,36,..."), and hREA keeps them as they were.
 * So a note is read in either form, and what comes out is always the key the store's
 * maps use: the hash's `toString()`. Every comparison downstream stays as it was.
 */
export type RefEntityType = 'user' | 'organization' | 'serviceType' | 'mediumOfExchange';

type HashLike = Uint8Array | string;

const BYTE_LIST = /^\d+(,\d+)+$/;

/** A hash as the text a note carries: base64 for bytes, a string kept as it is. */
function noteText(hash: HashLike): string {
  if (typeof hash !== 'string') return encodeHashToBase64(hash);
  if (BYTE_LIST.test(hash)) {
    try {
      return encodeHashToBase64(new Uint8Array(hash.split(',').map(Number)));
    } catch {
      return hash;
    }
  }
  return hash;
}

/** The note for an R&O entry: `ref:<type>:<base64 hash>`, or `unknown` when there is no hash. */
export function refNote(entityType: RefEntityType, hash: HashLike | null | undefined): string {
  return `ref:${entityType}:${hash ? noteText(hash) : 'unknown'}`;
}

/**
 * The hash a note names, as the store's map key (`Uint8Array.toString()`), whichever form
 * the note was written in; null when the note is not a ref of that type.
 */
export function refHashFromNote(
  note: string | null | undefined,
  entityType: RefEntityType
): string | null {
  const prefix = `ref:${entityType}:`;
  if (!note?.startsWith(prefix)) return null;
  const raw = note.substring(prefix.length);
  if (BYTE_LIST.test(raw)) return raw;
  try {
    return decodeHashFromBase64(raw).toString();
  } catch {
    return raw;
  }
}

/** Whether a note names this hash, read in either form. */
export function noteRefersTo(
  note: string | null | undefined,
  entityType: RefEntityType,
  hash: HashLike | null | undefined
): boolean {
  if (!hash) return false;
  const named = refHashFromNote(note, entityType);
  return named !== null && named === refHashFromNote(refNote(entityType, hash), entityType);
}
