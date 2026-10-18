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
 * **The discriminator is the one required field only a request has**: `contact_preference`
 * (integrity `request.rs:22`, no serde default). `interaction_type` cannot tell them apart,
 * because both entries carry it (`request.rs:35`, `offer.rs:25`); testing for its absence
 * refused every real request, which is what the e2e requests journey caught. An offer is
 * a record with no `contact_preference` that does carry `interaction_type`, so a record
 * with neither field is still refused by both.
 *
 * The authoritative check is the record's entry type, which only the zome knows for
 * certain. That belongs with the integrity work in brief G.
 */
export function isListingOfType(record: HolochainRecord, type: ListingType): boolean {
  let entry: unknown;
  try {
    entry = decodeRecord(record);
  } catch {
    // Not decodable at all, so certainly not the listing we asked for.
    return false;
  }
  if (!entry || typeof entry !== 'object') return false;
  const fields = entry as Record<string, unknown>;
  const isRequest = fields.contact_preference !== undefined;
  // An offer must still show the field it does have, so a record carrying neither is
  // refused rather than passing as an offer by default.
  return type === 'Request' ? isRequest : !isRequest && fields.interaction_type !== undefined;
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
