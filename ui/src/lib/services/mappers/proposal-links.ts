import { decodeHashFromBase64 } from '@holochain/client';

/**
 * Which created intents a proposal publishes and which are reciprocal.
 *
 * hREA keeps both lists on the proposal entry itself, so the store creates the
 * intents first and the proposal with these ids. The mappers return their
 * intents in creation order, so the created intent at each position is the one
 * mapped there.
 */
export function proposalIntentLinks(
  mapped: ReadonlyArray<{ isReciprocal: boolean }>,
  created: ReadonlyArray<{ id: string }>
): { publishes: string[]; reciprocal: string[] } {
  if (mapped.length !== created.length) {
    throw new Error(`${mapped.length} intents mapped, ${created.length} created`);
  }
  const publishes: string[] = [];
  const reciprocal: string[] = [];
  mapped.forEach((m, i) => (m.isReciprocal ? reciprocal : publishes).push(created[i].id));
  return { publishes, reciprocal };
}

/**
 * The proposals hREA holds for one listing, found by the line the mappers write into every
 * proposal's note: `Original request hash: <hash>` or `Original offer hash: <hash>`.
 *
 * The listing-to-proposal map lives in memory only, so after a reload an edit mirrored a
 * new proposal beside the old one, and a delete or an archive left the proposal behind
 * (alpha 2 dogfooding, 21 November 2026). Reading hREA by this line finds the proposal
 * again, and every earlier copy an edit left, so they can all be retired. The hash is
 * matched in either form a note may carry it: the byte list the mappers write
 * (`toString()`), or base64.
 */
export function proposalsForListing<P extends { note?: string | null }>(
  proposals: ReadonlyArray<P>,
  kind: 'request' | 'offer',
  hash: Uint8Array | string
): P[] {
  const key = hashKey(hash);
  return proposals.filter((p) => listingHashOfProposal(p.note, kind) === key);
}

/**
 * The listing hash a proposal note names on its `Original <kind> hash:` line, as the store's
 * map key (`Uint8Array.toString()`), whichever form it was written in; null when none.
 */
export function listingHashOfProposal(
  note: string | null | undefined,
  kind: 'request' | 'offer'
): string | null {
  const marker = `Original ${kind} hash: `;
  const line = (note ?? '').split('\n').find((l) => l.startsWith(marker));
  if (!line) return null;
  const raw = line.slice(marker.length).trim();
  return raw && raw !== 'N/A' ? hashKey(raw) : null;
}

const BYTE_LIST = /^\d+(,\d+)+$/;

/** A hash as the store's map key: its bytes' `toString()`, from bytes, a byte list or base64. */
export function hashKey(hash: Uint8Array | string): string {
  if (typeof hash !== 'string') return hash.toString();
  if (BYTE_LIST.test(hash)) return hash;
  try {
    return decodeHashFromBase64(hash).toString();
  } catch {
    return hash;
  }
}

/**
 * The action a listing's chain starts from. A listing can reach the store under a revision's
 * hash: My Listings lists latest records, and the UI takes a record's own hash as its
 * original, so an edit started there mirrors under the revision. Walks each Update back to
 * the action it updates until it reaches the Create, the way the zome's `resolve_chain_root`
 * does. `readRecord` returns the record an action hash names, or null; a read that fails or
 * a chain longer than `maxSteps` stops the walk where it is.
 */
export async function chainRoot(
  hash: Uint8Array,
  readRecord: (hash: Uint8Array) => Promise<unknown>,
  maxSteps = 64
): Promise<Uint8Array> {
  let current = hash;
  for (let step = 0; step < maxSteps; step++) {
    let record: unknown;
    try {
      record = await readRecord(current);
    } catch {
      return current;
    }
    const data = (
      record as {
        signed_action?: {
          hashed?: { content?: { data?: { type?: string; original_action_address?: Uint8Array } } };
        };
      } | null
    )?.signed_action?.hashed?.content?.data;
    if (data?.type !== 'Update' || !data.original_action_address) return current;
    current = data.original_action_address;
  }
  return current;
}
