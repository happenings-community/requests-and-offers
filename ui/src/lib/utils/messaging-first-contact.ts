import type { ModalStore } from '@skeletonlabs/skeleton';
import FirstContactNotice from '$lib/components/messaging/FirstContactNotice.svelte';
import messagingStore from '$lib/stores/messaging.store.svelte';

/**
 * Telling a member once, before their first proposal or first message, what it puts on
 * the network.
 *
 * **Before, and not after.** Afterwards it is news rather than a choice, which is why
 * this interrupts the press and offers a way out instead of appearing alongside it.
 *
 * The store is passed in rather than read here, because a modal store can only be taken
 * during a component's own set-up and this is called from two of them.
 */
export type FirstContactMeta = {
  kind: 'proposal' | 'chat';
  /** Who they are about to deal with, when the asking page knows. */
  name?: string;
  /** The word the member pressed, which is what the continuing button says. */
  label: string;
};

/** Whether there is anything left to say to this member. */
export function firstContactNeeded(): boolean {
  return !messagingStore.noticeSeen();
}

/**
 * Say it, and carry on only if they choose to.
 *
 * It is remembered on the way through rather than when the notice opens: somebody who
 * reads it and stops has not been told anything they chose to act on, and will want it
 * again next time.
 */
export function openFirstContact(
  modalStore: ModalStore,
  meta: FirstContactMeta,
  carryOn: () => void
): void {
  modalStore.trigger({
    type: 'component',
    component: { ref: FirstContactNotice },
    meta,
    response: (go: boolean) => {
      if (!go) return;
      messagingStore.markNoticeSeen();
      carryOn();
    }
  });
}
