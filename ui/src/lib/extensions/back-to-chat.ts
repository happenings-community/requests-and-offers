import { getContext, setContext } from 'svelte';
import type { Component } from 'svelte';
import type { ActionHash } from '@holochain/client';

/**
 * The extension point for the way back to a conversation.
 *
 * A page can know it was reached from somewhere without knowing what that somewhere is.
 * Deciding where you came from is the page's own business, and it reads that from the
 * marker in its own address; saying "back to your conversation with so-and-so", and
 * addressing it, belongs to whatever provides conversations. On a network built without
 * them nothing is plugged in here, and a page that asks gets nothing back, which is right:
 * there was no conversation to arrive from.
 *
 * Keeping the sentence in one place is the point. It was written out on a page that had no
 * other business with conversations, which is how a formal page came to depend on a module
 * it otherwise never touched.
 */

export type BackToChatProps = {
  /** The person whose conversation to go back to. */
  counterparty: ActionHash;
  /** The look the asking page wants, since its Back may be small and quiet. */
  classes?: string;
};

export type BackToChatComponent = Component<BackToChatProps>;

/**
 * A provider rather than a component, because the answer is not known when this is set:
 * the context is fixed while the root layout initialises, and which modules this network
 * has is read a moment later. Read at render time, one plug still answers correctly.
 */
export type BackToChatProvider = () => BackToChatComponent | undefined;

const BACK_TO_CHAT_KEY = Symbol('back-to-chat');

/** Plug in the way back to a conversation. Called once, by the root layout. */
export function setBackToChat(provider: BackToChatProvider): void {
  setContext(BACK_TO_CHAT_KEY, provider);
}

/** What is plugged in, or nothing, which is a real answer rather than a failure. */
export function getBackToChat(): BackToChatProvider {
  return getContext<BackToChatProvider | undefined>(BACK_TO_CHAT_KEY) ?? (() => undefined);
}
