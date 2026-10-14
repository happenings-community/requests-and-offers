<script lang="ts">
  import { encodeHashToBase64, type ActionHash } from '@holochain/client';
  import { getModalStore, type ModalComponent } from '@skeletonlabs/skeleton';
  import ContactModal from '$lib/components/shared/listings/ContactModal.svelte';
  import { useListingInterest } from '$lib/composables/domain/exchanges/useListingInterest.svelte';
  import type { ListingType } from '$lib/types/holochain';
  import type { UIOrganization, UIUser } from '$lib/types/ui';
  import { formatWhen } from '$lib/utils/exchange-ui';

  type Props = {
    listingHash: ActionHash;
    listingType: ListingType;
    listingTitle: string;
    creator: UIUser | null;
    organization: UIOrganization | null;
    isCreator: boolean;
  };
  let { listingHash, listingType, listingTitle, creator, organization, isCreator }: Props =
    $props();

  const modalStore = getModalStore();

  const firstName = $derived(creator?.name?.split(' ')[0] ?? 'the listing owner');
  const noun = $derived(listingType === 'Offer' ? 'offer' : 'request');
  const hasContactInfo = $derived(!!(creator?.email || creator?.phone || organization?.email));

  function openContact() {
    const component: ModalComponent = {
      ref: ContactModal,
      props: { user: creator, organization, listingType: noun, listingTitle }
    };
    modalStore.trigger({ type: 'component', component, meta: { title: '', body: '' } });
  }

  const interest = useListingInterest({
    listingHash: () => listingHash,
    listingType: () => listingType,
    hasContactInfo: () => hasContactInfo,
    onRegistered: openContact
  });

  const mine = $derived(interest.mine);
  const others = $derived(interest.others);
  const me = $derived(interest.me);
  const loaded = $derived(interest.loaded);
  const busy = $derived(interest.busy);

  $effect(() => {
    listingHash;
    interest.load();
  });
</script>

{#if loaded}
  {#if isCreator}
    <div class="card space-y-3 p-4">
      <h3 class="h3">Interested members</h3>
      {#if others.length === 0}
        <p class="text-surface-500">No one has registered interest yet.</p>
      {:else}
        <ul class="space-y-2">
          {#each others as item (encodeHashToBase64(item.interest_hash))}
            {@const person = interest.personOf(item)}
            <li class="flex items-center justify-between gap-3">
              <a class="anchor" href={`/users/${encodeHashToBase64(item.user)}`}>
                {person?.name ?? 'A member'}
              </a>
              <a class="variant-filled-primary btn btn-sm" href={interest.hrefFor(item)}>
                Send a proposal
              </a>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {:else if me}
    <div class="space-y-2 text-center">
      {#if mine}
        <div class="alert variant-soft-primary py-2 text-sm">
          You registered interest on {formatWhen(mine.created_at)}. {firstName} can see it; either of
          you can send a proposal.
        </div>
        <div class="flex flex-col gap-2 sm:flex-row">
          <a class="variant-filled-primary btn flex-1" href={interest.hrefFor(mine)}
            >Send a proposal</a
          >
          <button
            class="variant-ghost-surface btn flex-1"
            onclick={interest.withdraw}
            disabled={busy}
          >
            Withdraw interest
          </button>
        </div>
        {#if hasContactInfo}
          <button class="variant-soft-primary btn w-full" onclick={openContact}>
            View contact information
          </button>
        {:else}
          <p class="text-xs text-surface-500">Contact information not available</p>
        {/if}
      {:else}
        <button
          class="variant-filled-primary btn w-full"
          onclick={interest.register}
          disabled={busy}
        >
          Interested in this {noun}?
        </button>
        <p class="text-xs text-surface-500">
          Registering interest notifies {firstName}, opens their contact details, and lets either of
          you send a proposal.
        </p>
      {/if}
    </div>
  {/if}
{/if}
