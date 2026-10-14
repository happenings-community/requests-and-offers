import type { Record as HolochainRecord } from '@holochain/client';
import { decodeRecord } from '$lib/utils/store-helpers/record-helpers';
import type { ListingType } from '$lib/types/holochain';

/**
 * Is this record the kind of listing we asked for?
 *
 * **A read by hash does not check the entry type.** `get_latest_offer_record` is a bare
 * `get`, so handing it a request's hash returns the request's record, and the decode that
 * follows is plain msgpack with no schema behind it: the request arrives shaped like an
 * offer with its offer-only fields simply absent. Every shared card therefore said Offer,
 * and showing interest from one **stored** the Interest with `listing_type: 'Offer'` for a
 * request, which the propose page then read as an offer with no terms.
 *
 * The zome has a read that refuses: `get_latest_offer` decodes into `Offer` and fails when
 * a required field is missing. The stores use the raw-record read instead, so this applies
 * the same test on this side of the wire.
 *
 * **The discriminator is each entry's own required field**, not an incidental one:
 * `interaction_type` on an offer and `contact_preference` on a request. Neither has a
 * serde default, so a record of the other kind cannot carry it.
 *
 * The authoritative check is the record's entry type, which only the zome knows for
 * certain. That belongs with the integrity work in brief G.
 */
const REQUIRED_FIELD: Record<ListingType, string> = {
  Offer: 'interaction_type',
  Request: 'contact_preference'
};

export function isListingOfType(record: HolochainRecord, type: ListingType): boolean {
  let entry: unknown;
  try {
    entry = decodeRecord(record);
  } catch {
    // Not decodable at all, so certainly not the listing we asked for.
    return false;
  }
  if (!entry || typeof entry !== 'object') return false;
  const own = REQUIRED_FIELD[type];
  const other = REQUIRED_FIELD[type === 'Offer' ? 'Request' : 'Offer'];
  const fields = entry as Record<string, unknown>;
  // Both tests, so a record carrying neither field is refused rather than passing the
  // one that happens to look right.
  return fields[own] !== undefined && fields[other] === undefined;
}

/**
 * Which kind of listing this record is, from the record itself.
 *
 * For callers that hold only a hash and need the type before they can ask the right
 * store. Trying one store and then the other would give the same answer by trial order,
 * which is how the card came to label every shared listing an offer.
 */
export function listingTypeOf(record: HolochainRecord): ListingType | null {
  if (isListingOfType(record, 'Offer')) return 'Offer';
  if (isListingOfType(record, 'Request')) return 'Request';
  return null;
}
