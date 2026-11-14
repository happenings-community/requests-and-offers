/**
 * Whether a listing's terms are known, and what the page may therefore say about them.
 *
 * A listing carries its service types and mediums as hashes, and both default to `[]`
 * when nobody has read the links yet, so an empty array means "not yet" as often as it
 * means "none". The detail pages read it as "none" and said "No service types specified"
 * about listings that had them, filling in moments later; a link read that failed said
 * the same thing and never filled in.
 *
 * `terms_load` is set only on the path that actually reads the links, so its absence is
 * the "nobody has looked" case.
 */
export type TermsState = 'loading' | 'failed' | 'known';

export function termsState(
  listing: { terms_load?: 'ok' | 'failed' } | null | undefined
): TermsState {
  if (!listing || listing.terms_load === undefined) return 'loading';
  return listing.terms_load === 'failed' ? 'failed' : 'known';
}

/**
 * May the page say "none specified" about this list?
 *
 * Only when the terms are known and the list really is empty. Every other case is the
 * page not knowing yet, which is a different sentence.
 */
export function saysNone(
  listing: { terms_load?: 'ok' | 'failed' } | null | undefined,
  hashes: unknown[] | undefined
): boolean {
  return termsState(listing) === 'known' && (hashes?.length ?? 0) === 0;
}

/** What to show instead, while the terms are unknown. */
export const TERMS_LOADING = 'Reading the listing’s terms…';
export const TERMS_FAILED = 'The listing’s terms could not be read.';
