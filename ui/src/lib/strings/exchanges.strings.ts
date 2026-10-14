/**
 * Every member-facing string the formal exchange route uses, in one module.
 *
 * **This exists because the formal route is the core** (R121, R122). Showing interest,
 * seeing what you are interested in, withdrawing, and what a listing offers you once it
 * is published are all things a network does whether or not it has messaging, so their
 * wording cannot live in the messaging strings. It did until H3, which is the same
 * mistake as the component that owned it: the layer a network may leave out held the
 * words the core needs.
 *
 * **Style, as in `messaging.strings.ts`:** British spelling, sentence case, no em dashes,
 * plain words. Say what happened and what the person can do next. These are placeholders
 * for Anita to review in the app, and the keys keep the shapes they had so a line can be
 * found by searching for the key it moved from.
 *
 * `{name}`, `{count}` and `{date}` are filled by `fill` from `./fill` — a neutral module,
 * because an exchange module may not reach a messaging one.
 */

export { fill } from './fill';

export const EXCHANGE_STRINGS = {
  /** On a listing page: the formal door (R122). */
  listing: {
    showInterest: 'Show interest',
    interestShown: "You're interested",
    /**
     * **Two endings, because there are two ways in.** Published from inside a proposal,
     * the listing is a step in that proposal, so the way on is back to it with the new
     * listing as the reciprocal side. Published from the picker, it is a thing to tell
     * somebody about, so the way on is to share it. Neither happens by itself.
     */
    continueProposal: 'Continue your proposal',
    shareWith: 'Share it with {name}',
    shareFailed: 'That could not be shared. Your listing is published; try sharing again.'
  },

  /**
   * The two actions on an interest, wherever it is shown.
   *
   * Moved from `card.interest.view` and `card.interest.withdraw`. They are read from here
   * by the conversation's cards too: the card is a view of the same record, so the action
   * is the exchange's and the wording belongs with it. One home per string, so a copy
   * review changes it once.
   */
  interest: {
    view: 'View listing',
    withdraw: 'Withdraw interest'
  },

  /** The Interested in tab on My exchanges. */
  interested: {
    title: "Listings you're interested in",
    intro:
      'Showing interest opens a conversation with the listing’s author and lets either of you propose an exchange from it. It works as your saved listings too.',
    since: 'Interested since {date}',
    count: '{count} members interested',
    noProposal: 'No proposal yet',
    archived: 'Archived by its author',
    empty: 'When you show interest in a listing, it’s saved here.'
  }
} as const;
