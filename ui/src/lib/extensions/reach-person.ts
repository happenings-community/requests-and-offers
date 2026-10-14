import { getContext, setContext } from 'svelte';
import type { Component } from 'svelte';
import type { ActionHash } from '@holochain/client';

/**
 * **The extension point for reaching the other person** (R121, brief H4).
 *
 * This module knows only the *shape* of a way to reach somebody, and how to set and get
 * one. It imports nothing of messaging and nothing of the exchange route, which is what
 * lets both sides meet here without either reaching the other:
 *
 * - **Messaging supplies** `components/messaging/GoToChat.svelte`, which takes the same
 *   props and adds the unread count.
 * - **The root layout plugs it in**, because it is the one place that already sees both
 *   sides, and only while messaging is present (H2).
 * - **The exchange pages render whatever is plugged in**, through
 *   `components/exchanges/ReachPerson.svelte`, and fall back to the formal Contact pop-up
 *   when nothing is (R78 as amended by R121).
 *
 * So the import walk from an exchange page stops here, at a module that is nobody's
 * feature.
 */

/** Everything any way of reaching a person needs. */
export type ReachPersonProps = {
  /** The other person's `User`, as the conversation and the profile both key on it. */
  person: ActionHash;
};

export type ReachPersonComponent = Component<ReachPersonProps>;

/**
 * A provider rather than a component, because of *when* the answer is known.
 *
 * `setContext` has to run while the layout is initialising, and whether messaging is
 * present is read from the DNA a moment later, in start-up step 3. A provider is read at
 * render time instead, so one plug at init can still answer "nothing, this network has no
 * messaging" once the DNA has been read. It also means a page re-renders when presence
 * settles, since reading `$state` inside it is tracked.
 */
export type ReachPersonProvider = () => ReachPersonComponent | undefined;

const REACH_PERSON_KEY = Symbol('reach-person');

/** Plug in a way of reaching a person. Called once, by the root layout. */
export function setReachPerson(provider: ReachPersonProvider): void {
  setContext(REACH_PERSON_KEY, provider);
}

/**
 * What is plugged in, or nothing.
 *
 * Nothing is a real answer, not a failure: on a network without messaging there is no way
 * to chat, and the caller shows the formal Contact instead.
 */
export function getReachPerson(): ReachPersonProvider {
  return getContext<ReachPersonProvider | undefined>(REACH_PERSON_KEY) ?? (() => undefined);
}
