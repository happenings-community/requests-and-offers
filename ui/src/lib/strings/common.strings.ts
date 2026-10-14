/**
 * The words that belong to no feature.
 *
 * A listing's type, and the stand-ins shown while something is being read or when a record
 * could not be named. They appear on the formal pages and in conversations alike, so they
 * live where neither can claim them, the same reasoning that moved `fill` out of the
 * messaging strings.
 *
 * **Why they are worth collecting at all.** Written out wherever they were needed, the same
 * word drifted: the same fallback appeared as "A member" and "a member" and "Unknown
 * member" on three screens, and a copy review would have had to find each one. Here they
 * are one line each, and a reviewer changes a word once.
 *
 * Only the words this branch introduced are here. The handful already on `dev` were left
 * where they are rather than swept up in a change about something else; they are on the
 * post-alpha-2 tidy list.
 */

export const COMMON_STRINGS: {
  listingType: { offer: string; request: string };
  someone: string;
  someoneInSentence: string;
  something: string;
  loading: string;
} = {
  /**
   * A listing's type, always as label and colour together, never colour alone, and never
   * swapped: gold for requests, orange for offers.
   */
  listingType: {
    offer: '💡 Offer',
    request: '📝 Request'
  },

  /**
   * Shown in place of a name or title that is not there.
   *
   * **A stand-in, never a claim.** A record that has not been read yet and one that could
   * not be read look the same here, which is why these say as little as possible: a page
   * that needs to tell those apart says so itself rather than leaning on a fallback.
   */
  someone: 'A member',
  /** The same stand-in, mid-sentence. */
  someoneInSentence: 'a member',
  something: 'A listing',

  /** While a page is reading what it needs. */
  loading: 'Loading…'
};
