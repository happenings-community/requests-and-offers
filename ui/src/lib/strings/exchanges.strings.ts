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
      'You showed interest on {date}. {name} can see it, and either of you can make a proposal.',
    /**
     * DRAFT, for Anita. A read that fails is a fault with a way to try again, never
     * "nobody is interested" or a button that may write a duplicate.
     */
    interestReadFailed: "Couldn't check whether you've shown interest: {reason}",
    interestsReadFailed: "Couldn't read who's interested: {reason}"
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
    tab: {
      exchanges: 'Exchanges ({count})',
      interested: 'Interested in ({count})',
      /** The same tab before the count has been read, or when it could not be. */
      interestedUncounted: 'Interested in'
    },
    inProgress: 'In progress',
    completed: 'Completed',
    open: 'Open'
  },

  /**
   * **One exchange's page.** DRAFT copy for Anita.
   *
   * `confirm`: Decline, Withdraw and Cancel are final, so each asks first through the
   * app's ConfirmModal, as archiving a listing does.
   *
   * `movedOn`: the exchange changed while the page was open (the other member withdrew,
   * declined or cancelled) and this member's action met it. Nothing was written; the
   * page now shows the exchange as it is, and says why the click did nothing.
   */
  detail: {
    confirm: {
      decline: "Decline {name}'s proposal? This cannot be undone.",
      declineLabel: 'Yes, decline',
      withdraw: 'Withdraw your proposal to {name}? This cannot be undone.',
      withdrawLabel: 'Yes, withdraw',
      cancel: 'Cancel your agreement with {name}? This cannot be undone.',
      cancelLabel: 'Yes, cancel it',
      keep: 'Keep it'
    },
    movedOn: {
      withdrawn:
        '{name} withdrew this proposal before your answer reached it. Nothing was changed.',
      declined: '{name} declined this proposal before your action reached it. Nothing was changed.',
      cancelled:
        '{name} cancelled this agreement before your action reached it. Nothing was changed.',
      other:
        'This exchange changed before your action reached it: it is now {state}. Nothing was changed.'
    },
    /** The comment box under a review: the limit is said once, by the counter. */
    commentLabel: 'Comment',
    commentCount: '{count}/200 characters',
    review: "{name}'s review"
  },

  /**
   * **When** (#380): a timeframe as a member reads it. The four presets the propose and
   * counter pages offer, and the two forms a window of dates takes. A preset is a
   * turnaround counted from agreeing, so its label says so; a window is calendar dates.
   * The wording is DRAFT copy for Anita.
   */
  timeframe: {
    presets: {
      WithinAFewDays: 'Within a few days of agreeing',
      WithinTwoWeeks: 'Within 2 weeks of agreeing',
      WithinAMonth: 'Within a month of agreeing',
      Flexible: 'Flexible'
    },
    by: 'by {end}',
    between: '{start} to {end}'
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
    /**
     * The listing's estimate, when it states none, estimates none (zero is allowed: some
     * tasks cannot be put in hours), or states something no quantity can carry. The
     * second is DRAFT copy for Anita (#380).
     */
    hoursNotStated: 'not stated on the listing',
    hoursNone: 'estimated at none, so none are proposed',
    hoursUnusable: 'not a number of hours a proposal can carry',
    /**
     * **The link named an interest the listing does not have.**
     *
     * Read, and not there, which is a different thing from a read that failed: the
     * interest may have been withdrawn, or the link may have been kept from an older
     * one. Either way there is nothing to propose against, so this says so rather than
     * letting the member fill the form and meet the zome's refusal at Send.
     */
    interestMissing:
      'This proposal was opened from an interest that is not on this listing, so there is nothing to propose against. Open the listing and show interest again.',
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

  /**
   * **The propose page when it cannot open** (alpha 2 dogfooding, 21 November).
   *
   * It used to say "This page needs a listing to propose against." in a red bar and
   * nothing else. Each reason now says what happened in a member's words and comes with a
   * way on. DRAFT, for Anita.
   */
  unavailable: {
    noListing: {
      eyebrow: 'No listing chosen',
      title: 'Proposals start from a listing',
      body: 'This page opens from a request or an offer you are talking about with someone. Pick up an exchange you have already started, or find the listing you want to propose on.'
    },
    noType: {
      eyebrow: 'Incomplete link',
      title: 'This link is missing part of the listing',
      body: 'It names a listing but not whether it is a request or an offer, so it cannot be looked up. Open the proposal again from the listing itself.'
    },
    notFound: {
      eyebrow: 'Listing not found',
      title: 'This listing is not available',
      body: 'It may have been archived or deleted, or it has not reached you yet. Look for it among the listings, or pick up an exchange you have already started.'
    },
    failed: {
      eyebrow: 'Could not load',
      title: 'The listing could not be loaded',
      body: 'Something went wrong while reading it. Try again, or go back to the listing and start the proposal from there.'
    },
    /**
     * The listing was read; a later read failed: who is involved (its author, the interest,
     * the interested member), its terms, or the offers to exchange in return.
     */
    unprepared: {
      eyebrow: 'Could not prepare',
      title: 'The proposal could not be prepared',
      body: 'The listing was read, but something else the proposal needs could not be: who is involved, the terms, or the offers to exchange in return. Try again, or go back to the listing and start the proposal from there.'
    },
    detail: 'The app said:',
    backToListing: 'Back to the listing',
    retry: 'Try again',
    myExchanges: 'My exchanges',
    browseRequests: 'Browse requests',
    browseOffers: 'Browse offers'
  },

  /** The Interested in tab on My exchanges. */
  interested: {
    title: "Listings you're interested in",
    intro:
      'Showing interest opens a conversation with the listing’s author and lets either of you propose an exchange from it. It works as your saved listings too.',
    since: 'Interested since {date}',
    /** DRAFT, for Anita. */
    loadFailed: "Couldn't read the listings you're interested in: {reason}",
    // DRAFT, for Anita
    withdrawFailed: "Your interest wasn't withdrawn: {reason}",
    count: '{count} members interested',
    noProposal: 'No proposal yet',
    archived: 'Archived by its author',
    empty: 'When you show interest in a listing, it’s saved here.'
  }
} as const;
