import { describe, it, expect } from 'vitest';
import { messagingReachedFrom, reachableFrom, isMessaging } from './messaging-modules';

/**
 * **The extension point, as a test** (R121, brief H4).
 *
 * Messaging reaches the formal route from the inside out: the layout plugs its component
 * into a neutral module, and the exchange pages render whatever is there. The value of
 * that shape is entirely in which way the imports point, so that is what is asserted.
 *
 * Three claims, and each one has a way to break it named below it:
 *
 * 1. The neutral modules are neutral.
 * 2. The exchange side reaches them and stops there.
 * 3. The layout is the only place that sees both sides.
 */

const REACH_PERSON = 'src/lib/extensions/reach-person.ts';
const UNREAD_COUNT = 'src/lib/extensions/unread-count.ts';
const GO_TO_CHAT = 'src/lib/components/messaging/GoToChat.svelte';
const SHARE_LISTING = 'src/lib/extensions/share-listing.ts';
const BACK_TO_CHAT = 'src/lib/extensions/back-to-chat.ts';
const SHARE_COMPONENT = 'src/lib/components/messaging/ShareListing.svelte';
const EXCHANGE_SIDE = 'src/lib/components/exchanges/ReachPerson.svelte';
const NAV_BAR = 'src/lib/components/shared/NavBar.svelte';
const LAYOUT = 'src/routes/+layout.svelte';
const PRESENCE = 'src/lib/services/messagingPresence.svelte.ts';

describe('the extension points belong to neither side', () => {
  /**
   * **To make this go red:** import `GoToChat` in `reach-person.ts` to give it a default,
   * or import the messaging store in `unread-count.ts` to compute the number there. Either
   * one puts the whole feature in the import graph of every page that asks.
   */
  it.each([REACH_PERSON, UNREAD_COUNT, SHARE_LISTING, BACK_TO_CHAT])(
    '%s reaches no messaging module',
    (file) => {
      expect(messagingReachedFrom(file)).toEqual([]);
    }
  );

  it('and is not itself counted as messaging, despite what it carries', () => {
    expect(isMessaging(REACH_PERSON)).toBe(false);
    expect(isMessaging(UNREAD_COUNT)).toBe(false);
    expect(isMessaging(SHARE_LISTING)).toBe(false);
    expect(isMessaging(BACK_TO_CHAT)).toBe(false);
  });

  /** The components messaging supplies are messaging, and stay on that list. */
  it('while the components messaging supplies are messaging', () => {
    expect(isMessaging(GO_TO_CHAT)).toBe(true);
    expect(isMessaging(SHARE_COMPONENT)).toBe(true);
  });
});

describe('the exchange side reaches the extension point and stops', () => {
  /**
   * **This is the one Sam asked to see red:** have an exchange page import `GoToChat`
   * directly. It renders identically and the seam is gone, because the walk from the page
   * now runs through the component into the store, the service and the zome.
   */
  it('ReachPerson reaches no messaging module', () => {
    expect(messagingReachedFrom(EXCHANGE_SIDE)).toEqual([]);
  });

  it('and does reach the extension point, rather than deciding for itself', () => {
    expect([...reachableFrom(EXCHANGE_SIDE)]).toContain(REACH_PERSON);
  });

  /**
   * It must not read presence either. "Nothing is plugged in" is the only question the
   * exchange side needs answered, and the layout is what decides it; a second reader of
   * presence is a second place for the two to disagree.
   */
  it('and does not read presence itself', () => {
    expect([...reachableFrom(EXCHANGE_SIDE)]).not.toContain(PRESENCE);
  });
});

describe('the extension points are what keep rule 2 true', () => {
  /**
   * Shared chrome may ask whether conversations exist here; it may not reach them. The
   * neutral modules are the whole of why that holds, so each is asserted against the same
   * walk the nav bar is judged by: whatever the nav bar reaches, it reaches through these.
   *
   * **To make this go red:** compute the count inside `unread-count.ts` by reading the
   * messaging store. The module then carries the feature, and every file that asks the
   * badge a question reaches the store, the service and the zome behind it — the nav bar
   * included, without a line of the nav bar changing.
   */
  it.each([REACH_PERSON, UNREAD_COUNT, SHARE_LISTING, BACK_TO_CHAT])(
    '%s stays clean, so anything that reaches it stays clean',
    (file) => {
      expect(messagingReachedFrom(file)).toEqual([]);
    }
  );
});

describe('the nav bar asks, and does not reach', () => {
  /**
   * Rule 2, in the half H4 can settle now. **To make this go red:** read
   * `unopenedConversations(messagingStore.threads)` in the nav bar again, as it did before
   * H4.
   */
  it('reaches no messaging module', () => {
    expect(messagingReachedFrom(NAV_BAR)).toEqual([]);
  });

  it('asks whether messaging is here, and takes its badge from the extension point', () => {
    const reached = [...reachableFrom(NAV_BAR)];
    expect(reached, 'so the item can disappear on a network without messaging').toContain(PRESENCE);
    expect(reached, 'so the count comes from messaging without being reached for').toContain(
      UNREAD_COUNT
    );
  });
});

describe('what a publish page offers is plugged in too', () => {
  const AFTER_PUBLISH = 'src/lib/components/exchanges/AfterPublish.svelte';

  /**
   * Publishing a listing is the member's own; telling somebody about it is a conversation.
   * **To make this go red:** send the card from the publish component again, as it did
   * when it owned the share button.
   */
  it('AfterPublish reaches no messaging module', () => {
    expect(messagingReachedFrom(AFTER_PUBLISH)).toEqual([]);
  });

  it('and reaches the extension point instead', () => {
    expect([...reachableFrom(AFTER_PUBLISH)]).toContain(SHARE_LISTING);
  });
});

describe('the layout is where the two sides meet', () => {
  /**
   * **The one file that is allowed to see both**, and the reason the others need not. If
   * this ever stops reaching messaging, nothing is plugged in and every network silently
   * becomes an absent one, so it is asserted rather than assumed.
   */
  it('reaches messaging, deliberately', () => {
    const reached = messagingReachedFrom(LAYOUT);
    expect(reached).toContain(GO_TO_CHAT);
    expect(reached).toContain(SHARE_COMPONENT);
  });

  it('and reaches every extension point, to plug them in', () => {
    const reached = [...reachableFrom(LAYOUT)];
    expect(reached).toContain(REACH_PERSON);
    expect(reached).toContain(UNREAD_COUNT);
    expect(reached).toContain(SHARE_LISTING);
    expect(reached).toContain(BACK_TO_CHAT);
  });
});
