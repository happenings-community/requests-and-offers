import { getContext, setContext } from 'svelte';

/**
 * **The extension point for the nav bar's messages badge** (brief H4).
 *
 * The same shape as `reach-person.ts`, for the other thing messaging adds to shared
 * chrome. The nav bar is not exchange code, so it is allowed to ask whether messaging is
 * here (brief H's rule 2) — but asking is all it may do. Counting unopened conversations
 * means reading the messaging store and keeping a poll alive, and both of those belong to
 * messaging.
 *
 * So messaging supplies the count and owns its own polling; the layout plugs it in while
 * presence is present; the nav bar reads a number and has no timing of its own.
 */

/** How many conversations have something unopened in them, or nothing when unknown. */
export type UnreadCountProvider = () => number | undefined;

const UNREAD_COUNT_KEY = Symbol('unread-count');

/** Plug in a count. Called once, by the root layout. */
export function setUnreadCount(provider: UnreadCountProvider): void {
  setContext(UNREAD_COUNT_KEY, provider);
}

/**
 * The count, or `undefined` when nothing is plugged in.
 *
 * `undefined` renders as no badge at all, which is what a network without messaging
 * should show — and also the honest answer before the first poll has returned, since a
 * confident `0` beside My Messages would be a claim nobody has checked.
 */
export function getUnreadCount(): UnreadCountProvider {
  return getContext<UnreadCountProvider | undefined>(UNREAD_COUNT_KEY) ?? (() => undefined);
}
