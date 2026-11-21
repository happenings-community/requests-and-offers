import { decode } from '@msgpack/msgpack';
import type { Record as HolochainRecord } from '@holochain/client';
import type { MediumOfExchangeInDHT } from '$lib/schemas/mediums-of-exchange.schemas';
import type { Proposal } from '$lib/types/hrea';

/**
 * What a listing's reciprocal intent records, by the medium it names: the same rule an
 * agreement's reciprocal term follows (`exchange-ui.ts`, #380). A currency is paid, so
 * the intent is a `transfer` of it. Service Exchange is a service given in return, so it
 * is `work`. Any other base medium (Free/Pay it Forward) expects nothing back, so the
 * listing publishes no reciprocal intent at all.
 *
 * A medium that could not be read keeps what every listing wrote before this rule: a
 * `transfer`. A missing proposal is retried by nothing, and a wrong action is the lesser
 * harm.
 */
export type ListingReciprocalAction = 'transfer' | 'work' | null;

export const SERVICE_EXCHANGE = { code: 'EXCHANGE_SERVICES', name: 'Service Exchange' } as const;

export function listingReciprocalAction(
  medium: Pick<MediumOfExchangeInDHT, 'code' | 'name' | 'exchange_type'> | null
): ListingReciprocalAction {
  if (!medium) return 'transfer';
  if (medium.exchange_type === 'currency') return 'transfer';
  if (medium.code === SERVICE_EXCHANGE.code || medium.name === SERVICE_EXCHANGE.name) {
    return 'work';
  }
  return null;
}

/** A medium of exchange's entry, from its Record; null when the Record carries none. */
export function mediumFromRecord(record: HolochainRecord | null): MediumOfExchangeInDHT | null {
  const present = (record?.entry as { Present?: { entry: Uint8Array } } | undefined)?.Present;
  if (!present) return null;
  try {
    return decode(present.entry) as MediumOfExchangeInDHT;
  } catch {
    return null;
  }
}

/**
 * The line a listing's proposal note carries naming the listing (`createProposalNote` in
 * the request and offer mappers). The hash is written as the action hash's
 * `toString()`, the same key the store's mappings use.
 */
export const listingNoteLine = (kind: 'request' | 'offer', hash: string): string =>
  `Original ${kind} hash: ${hash}`;

/**
 * Every proposal hREA holds for one listing, found by its note line. The store's
 * listing-to-proposal map is kept in memory and starts empty on each launch, so after a
 * restart this is the only way to find a listing's proposal (#278): an edit or a delete
 * that missed it wrote a second proposal, or left the first behind.
 */
export function proposalsForListing<P extends Pick<Proposal, 'note'>>(
  proposals: readonly P[],
  kind: 'request' | 'offer',
  hash: string
): P[] {
  const line = listingNoteLine(kind, hash);
  return proposals.filter((p) => mappingLines(p.note).some((l) => l === line));
}

/**
 * The note's lines after its `--- hREA Mapping ---` marker. Only those are the
 * mapper's own: the description comes first and is the member's text, which may hold
 * any line, including one that looks like another listing's hash.
 */
const MAPPING_MARKER = '--- hREA Mapping ---';
function mappingLines(note: string | undefined | null): string[] {
  const lines = (note ?? '').split('\n').map((l) => l.trim());
  const at = lines.lastIndexOf(MAPPING_MARKER);
  return at < 0 ? [] : lines.slice(at + 1);
}

/**
 * Which listing a proposal mirrors, read from its note: the kind and the hash, or null
 * for a proposal that names none.
 */
export function listingOfProposal(
  proposal: Pick<Proposal, 'note'>
): { kind: 'request' | 'offer'; hash: string } | null {
  for (const line of mappingLines(proposal.note)) {
    const m = /^Original (request|offer) hash: (.+)$/.exec(line);
    if (m && m[2] !== 'N/A') return { kind: m[1] as 'request' | 'offer', hash: m[2] };
  }
  return null;
}
