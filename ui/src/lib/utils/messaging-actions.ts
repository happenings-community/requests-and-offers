import { reasonOf } from '$lib/utils/error-shape';

/**
 * Sequences where the order of two effects is the rule, not an implementation detail.
 *
 * Kept out of the components so the order can be tested. A component test would have to
 * drive a browser to assert "and then it navigated"; these take the two effects as
 * arguments and assert it directly.
 */

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
