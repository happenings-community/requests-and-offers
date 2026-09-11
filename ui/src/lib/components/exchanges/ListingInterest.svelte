<script lang="ts">
  import { encodeHashToBase64, type ActionHash } from '@holochain/client';
  import { getModalStore, getToastStore, type ModalComponent } from '@skeletonlabs/skeleton';
  import ContactModal from '$lib/components/shared/listings/ContactModal.svelte';
  import exchangesStore from '$lib/stores/exchanges.store.svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import { runEffect } from '$lib/utils/effect';
  import type { ListingType } from '$lib/types/holochain';
  import type { UIInterest, UIOrganization, UIUser } from '$lib/types/ui';
  import { formatWhen } from '$lib/utils/exchange-ui';

  type Props = {
    listingHash: ActionHash;
    listingType: ListingType;
    listingTitle: string;
    creator: UIUser | null;
    organization: UIOrganization | null;
    isCreator: boolean;
  };
  let { listingHash, listingType, listingTitle, creator, organization, isCreator }: Props = $props();

  const toastStore = getToastStore();
  const modalStore = getModalStore();

  let interests = $state<UIInterest[]>([]);
  let people = $state<Record<string, UIUser | null>>({});
  let loaded = $state(false);
  let busy = $state(false);

  const me = $derived(usersStore.currentUser?.original_action_hash);
  const isMine = (i: UIInterest) => !!me && i.user.toString() === me.toString();
  const mine = $derived(interests.find(isMine) ?? null);
  const others = $derived(interests.filter((i) => !isMine(i)));
  const firstName = $derived(creator?.name?.split(' ')[0] ?? 'the listing owner');
  const noun = $derived(listingType === 'Offer' ? 'offer' : 'request');
  const hasContactInfo = $derived(!!(creator?.email || creator?.phone || organization?.email));

  const proposeHref = (interest: UIInterest) =>
    `/exchanges/propose?interest=${encodeHashToBase64(interest.interest_hash)}` +
    `&listing=${encodeHashToBase64(listingHash)}&type=${listingType}`;

  function fail(e: unknown) {
    toastStore.trigger({
      message: e instanceof Error ? e.message : String(e),
      background: 'variant-filled-error'
    });
  }

  function openContact() {
    const component: ModalComponent = {
      ref: ContactModal,
      props: { user: creator, organization, listingType: noun, listingTitle }
    };
    modalStore.trigger({ type: 'component', component, meta: { title: '', body: '' } });
  }

  async function load() {
    try {
      interests = await runEffect(exchangesStore.getInterestsForListing(listingHash));
      loaded = true;
      for (const i of interests) {
        const key = encodeHashToBase64(i.user);
        if (!(key in people)) {
          people[key] = await runEffect(usersStore.getUserByActionHash(i.user));
        }
      }
    } catch (e) {
      fail(e);
    }
  }

  async function express() {
    busy = true;
    try {
      await runEffect(exchangesStore.createInterest(listingHash, listingType));
      await load();
      if (hasContactInfo) openContact();
    } catch (e) {
      fail(e);
    } finally {
      busy = false;
    }
  }

  async function withdraw() {
    if (!mine) return;
    busy = true;
    try {
      await runEffect(exchangesStore.withdrawInterest(mine.interest_hash));
      toastStore.trigger({ message: 'Interest withdrawn', background: 'variant-filled-surface' });
      await load();
    } catch (e) {
      fail(e);
    } finally {
      busy = false;
    }
  }

  $effect(() => {
    listingHash;
    load();
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
          {#each others as interest (encodeHashToBase64(interest.interest_hash))}
            {@const person = people[encodeHashToBase64(interest.user)]}
            <li class="flex items-center justify-between gap-3">
              <a class="anchor" href={`/users/${encodeHashToBase64(interest.user)}`}>
                {person?.name ?? 'A member'}
              </a>
              <a class="variant-filled-primary btn btn-sm" href={proposeHref(interest)}>
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
          You registered interest on {formatWhen(mine.created_at)}. {firstName} can see it; either of you can send a proposal.
        </div>
        <div class="flex flex-col gap-2 sm:flex-row">
          <a class="variant-filled-primary btn flex-1" href={proposeHref(mine)}>Send a proposal</a>
          <button class="variant-ghost-surface btn flex-1" onclick={withdraw} disabled={busy}>
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
        <button class="variant-filled-primary btn w-full" onclick={express} disabled={busy}>
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
