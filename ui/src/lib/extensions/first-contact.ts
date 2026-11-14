import { getContext, setContext } from 'svelte';
import type { Component } from 'svelte';

/**
 * The extension point for the link that says something before a member's first proposal.
 *
 * A proposal puts a public record on the network, and the first time somebody sends one
 * they are told what that means and can stop. The telling only applies where
 * conversations exist, because what it says about who can read what depends on them, so
 * the formal page asks for a link and renders a plain one when nothing is plugged in.
 *
 * **The page keeps the word and the address.** "Make a proposal", and where it goes, are
 * the formal route's own business; only the notice in front of it belongs to whatever
 * provides conversations. That is why this carries a label and an href rather than a
 * listing: whatever is plugged in has nothing to decide about either.
 */

export type FirstContactProps = {
  /**
   * Which action this is, because the notice says something different about each: a
   * proposal is a public record, while a message is readable only by the two people.
   */
  kind: 'proposal' | 'chat';
  /** Where the member is going, once they have read it. */
  href: string;
  /** What the link says, which the asking page owns. */
  label: string;
  /**
   * Who the member is about to deal with, for the notice to name. Optional, because a
   * page that has not read them yet should still offer the link; the notice stands in a
   * word rather than waiting.
   */
  name?: string;
  classes?: string;
};

export type FirstContactComponent = Component<FirstContactProps>;

/**
 * A provider rather than a component, because the answer is not known when this is set:
 * the context is fixed while the root layout initialises, and which modules this network
 * has is read a moment later.
 */
export type FirstContactProvider = () => FirstContactComponent | undefined;

const FIRST_CONTACT_KEY = Symbol('first-contact');

/** Plug in the link that tells a member first. Called once, by the root layout. */
export function setFirstContact(provider: FirstContactProvider): void {
  setContext(FIRST_CONTACT_KEY, provider);
}

/** What is plugged in, or nothing, which is a real answer rather than a failure. */
export function getFirstContact(): FirstContactProvider {
  return getContext<FirstContactProvider | undefined>(FIRST_CONTACT_KEY) ?? (() => undefined);
}
