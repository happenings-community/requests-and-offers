import { getContext, setContext } from 'svelte';
import type { Component } from 'svelte';
import type { ActionHash } from '@holochain/client';

/**
 * The extension point for what a conversation offers once a listing is published.
 *
 * Publishing a listing is something a member does on their own; telling somebody about it
 * is a conversation. So the way back to that conversation, and sending the listing into it
 * as a card, belong to whoever provides conversations. On a network built without them
 * there is nobody to send it to and no conversation to go back to, so there is simply
 * nothing here, and the page shows only what it owns itself.
 *
 * This module knows the shape of such a thing and how to set and get one. It imports
 * nothing from either side, which is what lets the publish pages offer it without
 * reaching for it.
 */

export type ShareListingProps = {
  /** The listing just published, which is what sharing sends. */
  listing: ActionHash | null;
  /** The person the member was talking to when they came here. */
  counterparty: ActionHash;
  /** Where to go back to. */
  conversation: string;
};

export type ShareListingComponent = Component<ShareListingProps>;

/**
 * A provider rather than a component, because the answer is not known yet when this is
 * set: the context is fixed while the root layout initialises, and which modules this
 * network has is read a moment later. Reading it at render time means one plug still gives
 * the right answer afterwards, and the page re-renders when it arrives.
 */
export type ShareListingProvider = () => ShareListingComponent | undefined;

const SHARE_LISTING_KEY = Symbol('share-listing');

/** Plug in what a conversation offers after publishing. Called once, by the root layout. */
export function setShareListing(provider: ShareListingProvider): void {
  setContext(SHARE_LISTING_KEY, provider);
}

/** What is plugged in, or nothing, which is a real answer rather than a failure. */
export function getShareListing(): ShareListingProvider {
  return getContext<ShareListingProvider | undefined>(SHARE_LISTING_KEY) ?? (() => undefined);
}
