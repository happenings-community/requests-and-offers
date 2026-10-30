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
 * `{name}`, `{count}`, `{date}` and `{reason}` are filled in at runtime by `fill`, never
 * by string concatenation at the call site, so a translator or Anita can move a
 * placeholder within its sentence.
 */

/**
 * Re-exported from `./fill`, which the exchange strings share (H3). Importers here are
 * unaffected; an exchange module imports it from `./fill` directly, because it may not
 * reach a messaging module.
 */
export { fill } from './fill';

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
    intro:
      'One conversation per person. A row shows the listings and exchanges you share with them.',
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
    sharedByThem: '{name} shared a listing',
    /**
     * DRAFT, for Anita. Shown instead of the conversation when it could not be read: a
     * failed read is a fault with a way to try again, never an empty chat, because an
     * empty chat is exactly what a new conversation looks like.
     */
    loadFailed: "This conversation couldn't be loaded: {reason}",
    /**
     * DRAFT, for Anita. The address names nobody: either it is not a hash at all, or no
     * member record answers to it. Two different things, said as two different things,
     * and neither is shown as a conversation with "A member".
     */
    notAnAddress: "That isn't a member's address.",
    memberNotFound: "That member couldn't be found. They may have left, or the link may be wrong.",
    /**
     * DRAFT, for Anita. Shown in place of the composer while this member's own status
     * has not been read, so a pending member is not told "not accepted" by guesswork.
     */
    membershipUnknown: "Your membership status couldn't be read, so sending is off for now.",
    /** DRAFT, for Anita. A shared card whose listing could not be read, or is gone. */
    cardReadFailed: "This listing couldn't be read: {reason}",
    cardGone: 'This listing is no longer available.'
  },

  /**
   * The opening card's own lines. **View listing and Withdraw interest are not here:**
   * they are the exchange's actions, so H3 moved them to `EXCHANGE_STRINGS.interest`,
   * which the cards read.
   */
  card: {
    interest: {
      youInOffer: "You showed interest in {name}'s offer",
      youInRequest: "You showed interest in {name}'s request",
      theyInYourOffer: '{name} showed interest in your offer',
      theyInYourRequest: '{name} showed interest in your request'
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
    open: 'Open the exchange',
    /** An agreement that was cancelled afterwards. It happened, and then it stopped. */
    cancelled: 'Cancelled since'
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

  posted: {
    titleRequest: 'You published a request',
    titleOffer: 'You published an offer',
    waiting: '{name} sees this card with a Show interest button.',
    interested: '{name} showed interest',
    proposeRequest: 'Propose from this request',
    proposeOffer: 'Propose from this offer'
  },

  /**
   * What is left here is messaging's own: a way into the conversation, and a way back to
   * it. Show interest, You're interested and the three endings after publishing went to
   * `EXCHANGE_STRINGS.listing` in H3.
   *
   * **`goToChat` stays**, with `hub.unread` and `exchanges.goToChat`: H4 replaces all
   * three with one component that says Go to chat with a count when messaging is present
   * and offers Contact when it is absent. Moving them in H3 would move them twice.
   */
  listing: {
    goToChat: 'Go to chat',
    /**
     * Shown after publishing a listing that was started from a conversation, so the
     * member can get back to what they were doing. A link rather than an automatic jump:
     * they may want to check the listing they just posted first.
     */
    backToConversation: 'Back to your conversation with {name}',
    /**
     * Sending a listing you have just published to the person you were talking to. It
     * never happens by itself: publishing something and telling somebody about it are two
     * decisions, and someone who has just posted may want to look at it first.
     */
    shareWith: 'Share it with {name}',
    shareFailed: 'That could not be shared. Your listing is published; try sharing again.'
  },

  /**
   * Go to chat is the way into a conversation, so the word stays with the conversation.
   * Everything else My Exchanges says is about exchanges, which a network has whether or
   * not it has messaging, so those words live with them.
   */
  exchanges: {
    goToChat: 'Go to chat'
  },

  /**
   * Said once, the first time a member proposes or writes to somebody.
   *
   * **What is public and what is not differs between the two**, so there is a line for
   * each rather than one that covers both loosely: a proposal is a record any member can
   * read, while the words in a message are readable only by the two people, and the fact
   * that one was sent is not. Telling somebody afterwards is too late to be a choice,
   * which is why this comes before and offers a way out.
   *
   * It lives with the conversation because what it says depends on there being one. A
   * network built without conversations says nothing here, which is why the line that
   * continues is the word the member already pressed rather than one of ours.
   *
   * **Placeholder wording, for Anita to review in the app.**
   */
  firstContact: {
    title: 'Before you start',
    proposal:
      'A proposal is a record on this network. Its terms, and any note you add when you reply, decline or cancel, can be read by other members, even though the app shows them only to you and {name}.',
    chat: 'Only the two of you can read what you write. Other members can see that you wrote, and when, but not what you said.',
    cancel: 'Not now'
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
  /**
   * What a sent message is doing.
   *
   * **Read is never wrong, but it is sometimes missing.** A receipt is a signal that is
   * dropped without an error if the other person is unreachable, and an unchanged mark
   * is never re-sent, so a message they have read can stay at Sent. The general line
   * says so rather than letting a member read silence as a choice.
   */
  status: {
    sending: 'Sending…',
    sent: 'Sent',
    read: 'Read'
  },

  receipts: {
    /** The same line for everyone, so nobody can be told they were singled out. */
    optional: "Read receipts are optional and don't always arrive."
  },

  settings: {
    sendReceipts: 'Send read receipts',
    /** Honest about what a setting can and cannot undo. */
    sendReceiptsNote: "Turning this off doesn't take back receipts already sent."
  },

  chat: {
    receipts: 'Read receipts in this conversation',
    receiptsInherit: 'Use my setting',
    receiptsOn: 'On',
    receiptsOff: 'Off'
  },

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
