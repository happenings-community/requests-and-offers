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
     * Published from inside a proposal, the listing is a step in that proposal, so the way
     * on is back to it with the new listing as the reciprocal side. It never happens by
     * itself. Telling somebody about a listing is a conversation instead, so those words
     * are with the conversation.
     */
    continueProposal: 'Continue your proposal',
    /** The way from a listing to a proposal, which is where an exchange begins. */
    makeProposal: 'Make a proposal',
    /**
     * Says what showing interest did, because nothing else on the page moves when it
     * happens: the member stays on the listing, so the page has to tell them it worked and
     * what it means.
     */
    interestNoted:
      'You showed interest on {date}. {name} can see it, and either of you can make a proposal.'
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

  /**
   * Reaching the other person, whatever this network is (R121, R122).
   *
   * **The formal half only.** Go to chat and its count are messaging's wording and live in
   * `messaging.strings.ts`, said by the component messaging plugs in. What is here is what
   * a network without messaging shows instead: the contact details on their profile, which
   * is where R78 left them.
   */
  reach: {
    contact: 'Contact',
    contactNamed: 'Contact {name}',
    noContactDetails: 'No contact details on their profile.',
    /**
     * Said when their profile could not be read at all, which is a different thing from a
     * profile with nothing in it. Reporting somebody as unreachable because a read failed
     * would be a claim we have not earned.
     */
    contactUnread: 'Their contact details could not be read: {reason}',
    contactRetry: 'Try again'
  },

  exchanges: {
    /**
     * **Not a number.** My Exchanges shows no count: the Profile badge and My Messages
     * both count unopened conversations, and a second number over the same events made
     * one proposal look like two things to deal with. An exchange waiting on this member
     * says so on its own row instead, and that clears only when they act rather than
     * when they look.
     */
    yourTurn: 'Your turn',
    title: 'My exchanges',
    intro: "Every exchange you're part of, and the listings you've shown interest in.",
    tab: { exchanges: 'Exchanges ({count})', interested: 'Interested in ({count})' },
    inProgress: 'In progress',
    completed: 'Completed',
    open: 'Open'
  },

  form: {
    title: 'Proposal to {name}',
    /**
     * **"Not loaded" must never read as "none".**
     *
     * A listing's services and mediums are separate records fetched after the listing
     * itself, so for a moment there are none of them, and a lookup can also fail. Both
     * used to render as the empty case: "this listing names no service", and worse,
     * "no medium of exchange, so this is a gift". Sending at that moment would have
     * turned a swap into a gift. These three say which of the three states it is.
     */
    termsLoading: 'Reading the listing’s terms…',
    termsFailed: 'The listing’s terms could not be read, so nothing can be proposed yet.',
    termsRetry: 'Try again',
    termsLocked: "These terms come from the listing and can't be changed here.",
    send: 'Send proposal',
    /**
     * A service exchange names an offer from each side, and the proposer may not have
     * one. Saying so and leaving them there is a dead end, so the message comes with a
     * way out.
     */
    needOffer:
      "A service exchange names an offer from each of you, and you don't have one yet. Post one, then come back to this proposal.",
    postOffer: 'Post an offer'
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
