import type { ModalStore } from '@skeletonlabs/skeleton';
import ContactAdminsModal from '$lib/components/users/ContactAdminsModal.svelte';
import type { ContactContext } from '$lib/utils/admin-contacts';

/**
 * The one way the interface reaches the administrators. Every button that
 * contacts them calls this with a context, so when messaging (a role message)
 * or stewarding (a flag) arrives, this function changes and its callers do
 * not. In core it opens the contact modal, whose links carry the context into
 * the member's own email program.
 */
export function openContact(modalStore: ModalStore, context: ContactContext): void {
  modalStore.trigger({
    type: 'component',
    component: { ref: ContactAdminsModal, props: { context } }
  });
}
