/**
 * Every member-facing string the alpha 2 messaging screens use, in one module.
 *
 * **One module is the rule.** The strings below are placeholders, seeded whole rather
 * than screen by screen, so a copy review replaces them in one change instead of chasing
 * them through components. A string invented in a component would be outside that
 * review.
 *
 * Keys follow the wording file's suggestions, so a line there can be found here by
 * searching for its key.
 *
 * **Style, from the wording file:** British spelling, sentence case, no em dashes, plain
 * words. Say what happened and what the person can do next.
 *
 * `{name}`, `{count}`, `{date}` and `{reason}` are filled in at runtime by `fill` below,
 * never by string concatenation at the call site, so a translator or Anita can move a
 * placeholder within its sentence.
 */

/** Replace every `{token}` with the matching value. Unknown tokens are left alone. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole
  );
}

export const MESSAGING_STRINGS = {
  hub: {
    title: 'My messages',
    intro:
      "Two kinds of correspondence, kept apart on purpose: conversations with other members, and anything from the network's admins or stewards.",
    messages: {
      title: 'Messages',
      body: 'Your conversations with other members, one per person. Only you and the person you write to can read them.'
    },
    roles: {
      title: 'Admin and steward',
      body: "Replies about problems you've reported, and anything the network's admins or stewards need from you. Never mixed into your member conversations."
    },
    unread: '{count} unread',
    new: '{count} new'
  },

  messages: {
    title: 'Messages',
    intro: 'One conversation per person. A row shows the listings and exchanges you share with them.',
    privacy:
      'Only you and the person you write to can read your messages. Other members can see that you sent one, and when.',
    filter: {
      label: 'Show',
      all: 'All',
      unopened: 'Unopened',
      offers: 'Offers',
      requests: 'Requests',
      exchanges: 'Exchanges',
      archived: 'Archived'
    },
    blocked: { button: 'Blocked members' },
    youPrefix: 'You:',
    archive: 'Archive',
    unarchive: 'Move back to Messages',
    empty: {
      title: 'No conversations yet',
      body: 'When you show interest in a listing, or someone shows interest in yours, your conversation with them starts here.',
      filtered: 'Nothing here for this filter.'
    }
  },

  fault: {
    title: "A message from {name} couldn't be opened",
    chip: 'Fault',
    body: 'It was sent to you, so it should open here. That points to a fault, not to anything you did. You can send the details to the network’s admins so they can look into it.',
    report: 'Report to Admins',
    copy: 'Copy details',
    copied: 'Details copied',
    reported: 'Reported to Admins, {date}',
    seeReply: "See the admins' reply"
  },

  conversation: {
    back: 'Messages',
    subtitle: 'Your conversation with {name}. Listings and exchanges appear here as cards.',
    composer: { label: 'Write to {name}', placeholder: 'Write to {name}.' },
    encrypted: 'Encrypted between you and {name}.',
    send: 'Send',
    sendFailed: "Your message wasn't sent: {reason}",
    /**
     * Shown only near the composer, and only when the end is in sight. A counter sitting
     * there from the first character turns writing a message into filling a form.
     *
     * A percentage rather than a byte count: "412 left" means nothing to someone writing
     * prose, and the number it counts is UTF-8 bytes, which is not what they typed.
     */
    limitUsed: '{percent}% of the limit used',
    /**
     * One line past the limit, not a number and a separate sentence. It says how far
     * over and what to do about it, which "-3617 left" did neither of.
     */
    tooLongBy: 'Too long by {percent}%. Split it into {count} messages.',
    makeProposal: 'Make a proposal',
    /**
     * Sending one of your own listings into a conversation as a card.
     *
     * The card is how it reaches the other person: it travels as a card-only message
     * with no text, so it stays a card and never becomes a tag on something somebody
     * wrote.
     */
    shareListing: 'Share a listing',
    shareListingIntro: 'Pick one of your listings to send as a card.',
    sharedByYou: 'You shared a listing',
    sharedByThem: '{name} shared a listing'
  },

  card: {
    interest: {
      youInOffer: "You showed interest in {name}'s offer",
      youInRequest: "You showed interest in {name}'s request",
      theyInYourOffer: '{name} showed interest in your offer',
      theyInYourRequest: '{name} showed interest in your request',
      withdraw: 'Withdraw interest',
      view: 'View listing'
    }
  },

  proposal: {
    fromThem: 'Proposal from {name}',
    fromYou: 'Proposal from you',
    field: {
      from: 'From',
      what: 'What',
      when: 'When',
      where: 'Where',
      inReturn: 'In return',
      /**
       * **Not the dropped proposal note.** No new proposal carries free text; this
       * labels the `terms` field on agreements made before that changed, which must
       * still display. It disappears on its own once those are gone.
       */
      note: 'Note'
    },
    sent: 'Sent {date}',
    status: {
      waitingForYou: 'Waiting for you',
      waitingForThem: 'Waiting for {name}',
      accepted: 'Accepted',
      declined: 'Declined',
      withdrawn: 'Withdrawn'
    },
    accept: 'Accept',
    decline: 'Decline',
    withdraw: 'Withdraw',
    declineForm: {
      label: 'Why are you declining?',
      placeholder: '{name} will see this. For example, what would work better for you.',
      confirm: 'Decline proposal',
      cancel: 'Cancel',
      required: 'Please give a reason, so {name} knows what to change.'
    },
    declinedReason: { yours: 'Your reason:', theirs: "{name}'s reason:" },
    declinedLine: "You declined {name}'s proposal. The conversation carries on as usual.",
    hint: "When you've agreed new terms, use Make a proposal below."
  },

  agreement: {
    line: 'You and {name} reached an agreement',
    open: 'Open the exchange'
  },

  picker: {
    title: 'Listings you can propose from',
    intro:
      'You can propose from a listing either of you has shown interest in. Its terms come with it.',
    theirs: "{name}'s",
    yours: 'Yours',
    none: 'Nothing here fits? Publish a new listing with the terms you’ve agreed, and propose from that.',
    newRequest: 'New request',
    newOffer: 'New offer'
  },

  form: {
    title: 'Proposal to {name}',
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

  posted: {
    titleRequest: 'You published a request',
    titleOffer: 'You published an offer',
    waiting: '{name} sees this card with a Show interest button.',
    interested: '{name} showed interest',
    proposeRequest: 'Propose from this request',
    proposeOffer: 'Propose from this offer'
  },

  listing: {
    showInterest: 'Show interest',
    interestShown: "You're interested",
    goToChat: 'Go to chat',
    /**
     * Shown after publishing a listing that was started from a conversation, so the
     * member can get back to what they were doing. A link rather than an automatic jump:
     * they may want to check the listing they just posted first.
     */
    backToConversation: 'Back to your conversation with {name}'
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
    intro:
      "Every exchange you're part of, and the listings you've shown interest in. Go to chat takes you to the conversation.",
    tab: { exchanges: 'Exchanges ({count})', interested: 'Interested in ({count})' },
    inProgress: 'In progress',
    completed: 'Completed',
    goToChat: 'Go to chat',
    open: 'Open'
  },

  interested: {
    title: "Listings you're interested in",
    intro:
      'Showing interest opens a conversation with the listing’s author and lets either of you propose an exchange from it. It works as your saved listings too.',
    since: 'Interested since {date}',
    count: '{count} members interested',
    noProposal: 'No proposal yet',
    archived: 'Archived by its author',
    empty: 'When you show interest in a listing, it’s saved here.'
  },

  block: {
    button: 'Block',
    confirm: {
      title: 'Block {name}?',
      body: "You won't see messages from {name} while they're blocked. Anything they send while blocked appears again when you unblock. They aren't told.",
      yes: 'Block {name}'
    },
    blockedNotice: "You've blocked {name}.",
    unblock: 'Unblock'
  },

  blocked: {
    title: 'Blocked members',
    now: 'Blocked now',
    history: 'History',
    empty: "You haven't blocked anyone."
  },

  /** Shared lines, used by more than one screen. */
  general: {
    notAccepted: "Your membership hasn't been accepted yet, so you can't send messages.",
    unknownMember: 'Unknown member',
    tryAgain: 'Something went wrong. Please try again.',
    youOffline:
      "You're offline. Your message will be sent automatically when you're connected again.",
    waitingToSend: 'Waiting to send',
    /**
     * **Not in the wording file yet** (Sam, 4 October), so it wants Anita's eye with the
     * rest.
     *
     * Shown when the send got no answer at all: a timeout, or the connection going. The
     * call may have committed without telling us, so the app will not retry it by itself
     * and asks instead. **The uncertainty is the message**: saying "not sent" would be a
     * claim we cannot make.
     *
     * A zome *refusal* is a different thing and does not use this. There we know nothing
     * was written and we know why, so `conversation.sendFailed` shows the zome's own
     * reason and offers no retry.
     */
    mayNotHaveSent: 'This may not have sent. Send again?'
  },

  /**
   * Part 2's strings, seeded now so Anita reviews one module once. Nothing in part 1
   * reads them.
   */
  roles: {
    title: 'Admin and steward messages',
    intro:
      'Correspondence with the people who look after this network. Every message here carries a label checked against their role when it arrives, so it can’t be faked.',
    fromAdmins: 'From the admins',
    fromStewards: 'From the stewards',
    writeToAdmins: 'Write to the admins',
    writeToStewards: 'Write to the stewards',
    label: { admin: 'Admin', steward: 'Steward', coordinator: 'Coordinator, {organisation}' },
    everyHolderReads: 'Every admin can read this conversation.'
  }
} as const;
