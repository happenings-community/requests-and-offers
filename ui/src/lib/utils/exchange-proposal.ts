import type { ModalStore } from '@skeletonlabs/skeleton';
import type { ActionHash } from '@holochain/client';
import CreateProposalModal from '$lib/components/exchanges/CreateProposalModal.svelte';

/**
 * Opens the exchange proposal creation modal
 */
export function openCreateProposalModal(
  modalStore: ModalStore,
  targetEntityHash: ActionHash,
  entityType: 'request' | 'offer',
  entityTitle: string,
  onSuccess?: () => void
) {
  modalStore.trigger({
    type: 'component',
    component: {
      ref: CreateProposalModal
    },
    meta: {
      targetEntityHash,
      entityType,
      entityTitle,
      onSuccess
    }
  });
}