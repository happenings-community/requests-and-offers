import { reasonOf } from '$lib/utils/messaging-threads';

/**
 * Sequences where the order of two effects is the rule, not an implementation detail.
 *
 * Kept out of the components so the order can be tested. A component test would have to
 * drive a browser to assert "and then it navigated"; these take the two effects as
 * arguments and assert it directly.
 */

/** What `showInterestAndOpen` reports back, so a caller can show the right thing. */
export type ShowInterestOutcome =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Record an interest, and only then open the conversation.
 *
 * **Both halves matter, and in this order.** Showing interest is what gives two people
 * something to propose from, and the conversation is where that happens. Opening the
 * conversation first, or opening it anyway when the interest failed, leaves the member
 * in an empty chat with no card in it and no idea that anything went wrong — and the
 * listing's author with no record that anyone was interested.
 *
 * So a failure to record means nothing is opened and the reason is returned.
 */
export async function showInterestAndOpen(steps: {
  createInterest: () => Promise<unknown>;
  open: () => Promise<unknown>;
}): Promise<ShowInterestOutcome> {
  try {
    await steps.createInterest();
  } catch (e) {
    return { ok: false, reason: reasonOf(e) };
  }
  await steps.open();
  return { ok: true };
}

/** What `postListingFromConversation` reports back. */
export type PostListingOutcome =
  | { ok: true; posted: { type: 'Request' | 'Offer'; title: string } }
  | { ok: false; reason: string };

/**
 * Publish a listing from inside a conversation, then return to it.
 *
 * **The order and the failure path are the rule.** On success the form closes, the
 * posted listing is what the conversation now shows, and the conversation reloads so the
 * card is drawn from real data rather than from what the form happened to hold. On
 * failure **nothing closes and nothing reloads**: the member keeps the form they filled
 * in, with the reason, rather than being dropped back into the conversation wondering
 * whether their listing exists.
 *
 * `reload` is called only after a successful create, so a failed post cannot make the
 * conversation flicker as though something had happened.
 */
export async function postListingFromConversation(steps: {
  type: 'Request' | 'Offer';
  title: string;
  create: () => Promise<unknown>;
  reload: () => Promise<unknown> | unknown;
}): Promise<PostListingOutcome> {
  try {
    await steps.create();
  } catch (e) {
    return { ok: false, reason: reasonOf(e) };
  }
  await steps.reload();
  return { ok: true, posted: { type: steps.type, title: steps.title } };
}
