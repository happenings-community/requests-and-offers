<script lang="ts">
  import type { UIUser, UIOrganization } from '$lib/types/ui';
  import { getModalStore, type ModalComponent } from '@skeletonlabs/skeleton';
  import ContactModal from './ContactModal.svelte';

  type Props = {
    user: UIUser | null;
    organization: UIOrganization | null;
    listingType?: 'request' | 'offer';
    listingTitle?: string;
  };

  // Props
  let {
    user = null,
    organization = null,
    listingType = 'request',
    listingTitle = ''
  }: Props = $props();

  const modalStore = getModalStore();

  // Open contact modal
  function openContactModal() {
    const modalComponent: ModalComponent = {
      ref: ContactModal,
      props: {
        user,
        organization,
        listingType,
        listingTitle
      }
    };

    modalStore.trigger({
      type: 'component',
      component: modalComponent,
      meta: {
        title: '',
        body: ''
      }
    });
  }

  // Check if contact info is available
  const hasContactInfo = $derived(user?.email || user?.phone || organization?.email);
</script>

{#if hasContactInfo}
  <div class="text-center">
    <button class="variant-filled-primary btn w-full" onclick={openContactModal}>
      🤝 Interested in this {listingType}?
    </button>
    <p class="mt-2 text-xs text-surface-500">Click to view contact information</p>
  </div>
{:else}
  <div class="card p-4 text-center">
    <p class="text-surface-500">Contact information not available</p>
  </div>
{/if}
