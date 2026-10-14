import { describe, it, expect } from 'vitest';
import { EXCHANGE_STRINGS } from '$lib/strings/exchanges.strings';
import { MESSAGING_STRINGS } from '$lib/strings/messaging.strings';
import { messagingReachedFrom } from './messaging-modules';

/** Every leaf string in a strings module, keyed by its dotted path. */
function leaves(node: unknown, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  if (typeof node === 'string') {
    out.set(prefix, node);
    return out;
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      for (const [path, leaf] of leaves(value, prefix ? `${prefix}.${key}` : key)) {
        out.set(path, leaf);
      }
    }
  }
  return out;
}

const EXCHANGE = leaves(EXCHANGE_STRINGS);
const MESSAGING = leaves(MESSAGING_STRINGS);

/**
 * **Where a string lives is the seam, in wording** (R121, brief H's rule 1 and H3).
 *
 * The formal exchange route is the core of every R&O network, so its words cannot sit in
 * the module belonging to the layer a network may leave out. Until H3 they did:
 * `ShowInterestButton`, `InterestedIn` and `AfterPublish` lived in the messaging
 * components and read `MESSAGING_STRINGS`, which made Show interest a messaging feature
 * by accident.
 */
describe('the wording the formal route needs lives with the formal route', () => {
  /**
   * **To make this go red:** leave any of these in `MESSAGING_STRINGS` as well — which is
   * what a split done by copying rather than moving looks like.
   */
  it.each([
    ['listing.showInterest', 'listing.showInterest'],
    ['listing.interestShown', 'listing.interestShown'],
    ['listing.continueProposal', 'listing.continueProposal'],
    ['listing.shareWith', 'listing.shareWith'],
    ['listing.shareFailed', 'listing.shareFailed'],
    ['interest.view', 'card.interest.view'],
    ['interest.withdraw', 'card.interest.withdraw'],
    ['interested.title', 'interested.title'],
    ['interested.intro', 'interested.intro'],
    ['interested.since', 'interested.since'],
    ['interested.count', 'interested.count'],
    ['interested.noProposal', 'interested.noProposal'],
    ['interested.archived', 'interested.archived'],
    ['interested.empty', 'interested.empty']
  ])('%s moved, and is gone from where it was', (now, before) => {
    expect(EXCHANGE.has(now), `EXCHANGE_STRINGS.${now} should exist`).toBe(true);
    expect(MESSAGING.has(before), `MESSAGING_STRINGS.${before} should be gone`).toBe(false);
  });

  /**
   * **These three stay, on purpose.** H4 replaces all of them with one component that says
   * Go to chat with a count when messaging is present and offers Contact when it is
   * absent, so moving them in H3 would move the same wording twice. Sam settled this on
   * 14 October.
   */
  it.each(['hub.unread', 'exchanges.goToChat', 'listing.goToChat'])(
    '%s is still messaging wording, for H4 to take over',
    (path) => {
      expect(MESSAGING.has(path)).toBe(true);
      expect([...EXCHANGE.keys()].some((k) => k.endsWith('goToChat') || k.endsWith('unread'))).toBe(
        false
      );
    }
  );

  /**
   * One home per string, so a copy review changes a line once. The conversation's cards
   * read View listing and Withdraw interest from the exchange module rather than keeping
   * their own copies.
   */
  it('no string is worded in both modules', () => {
    const shared = [...EXCHANGE.values()].filter((value) =>
      [...MESSAGING.values()].includes(value)
    );
    expect(shared, `worded twice: ${shared.join(' | ')}`).toEqual([]);
  });
});

/**
 * **The exchange strings must not reach messaging.**
 *
 * `fill` started life in `messaging.strings.ts`, so the quickest way to write this module
 * was to import it from there — which would put a messaging module in the import graph of
 * every page on the formal route, through its own wording. It moved to `strings/fill.ts`
 * instead, the same move H1a made for the error helpers.
 *
 * **To make this go red:** import `fill` from `./messaging.strings` here.
 */
describe('the exchange strings keep the seam', () => {
  it('reach no messaging module', () => {
    expect(messagingReachedFrom('src/lib/strings/exchanges.strings.ts')).toEqual([]);
  });

  it('and neither does the shared fill helper', () => {
    expect(messagingReachedFrom('src/lib/strings/fill.ts')).toEqual([]);
  });
});
