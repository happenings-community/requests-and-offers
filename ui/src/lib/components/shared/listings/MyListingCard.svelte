<script lang="ts">
  import { encodeHashToBase64 } from '@holochain/client';
  import { getModalStore, getToastStore, type ModalComponent } from '@skeletonlabs/skeleton';
  import ConfirmModal from '$lib/components/shared/dialogs/ConfirmModal.svelte';
  import ServiceTypeTag from '$lib/components/service-types/ServiceTypeTag.svelte';
  import exchangesStore from '$lib/stores/exchanges.store.svelte';
  import offersStore from '$lib/stores/offers.store.svelte';
  import requestsStore from '$lib/stores/requests.store.svelte';
  import { useListingInterest } from '$lib/composables/domain/exchanges/useListingInterest.svelte';
  import { formatWhen, latestOnInterest, statusLabel } from '$lib/utils/exchange-ui';
  import { runEffect } from '$lib/utils/effect';
  import { getUserPictureUrl, queueAndReverseModal } from '$lib/utils';
  import type { ConfirmModalMeta } from '$lib/types/ui';
  import type { MyListing } from '$lib/utils/my-listings';

  /**
   * One of my listings, as the design system's managed listing card (#344):
   * type, status and how it is delivered; title and description; service
   * types; View, Edit, Archive and Delete. The "N interested" chip opens the
   * card to show who is interested, with Send a proposal or where the exchange
   * on their interest stands.
   */
  let { item, onChanged }: { item: MyListing; onChanged: () => void } = $props();

  const modalStore = getModalStore();
  const toastStore = getToastStore();
  const confirmModal: ModalComponent = { ref: ConfirmModal };

  const listing = $derived(item.listing);
  const hash = $derived(listing.original_action_hash);
  const isOffer = $derived(item.kind === 'Offer');
  const noun = $derived(isOffer ? 'offer' : 'request');
  const base = $derived(`/${isOffer ? 'offers' : 'requests'}/${encodeHashToBase64(hash)}`);

  const interest = useListingInterest({
    listingHash: () => hash,
    listingType: () => item.kind,
    quiet: true
  });
  const others = $derived(interest.others);
  let open = $state(false);
  let busy = $state(false);

  $effect(() => {
    hash;
    interest.load();
  });

  function confirm(message: string, confirmLabel: string, then: () => Promise<void>) {
    queueAndReverseModal(
      {
        type: 'component',
        component: confirmModal,
        meta: { message, confirmLabel, cancelLabel: 'Cancel' } as ConfirmModalMeta,
        response: (confirmed: boolean) => {
          if (confirmed) {
            modalStore.close();
            then();
          }
        }
      },
      modalStore
    );
  }

  async function act(run: () => Promise<unknown>, done: string, failed: string) {
    busy = true;
    try {
      await run();
      toastStore.trigger({ message: done, background: 'variant-filled-success' });
      onChanged();
    } catch (e) {
      toastStore.trigger({
        message: `${failed}: ${e instanceof Error ? e.message : String(e)}`,
        background: 'variant-filled-error'
      });
    } finally {
      busy = false;
    }
  }

  const archive = () =>
    confirm(`Are you sure you want to archive this ${noun}?`, 'Archive', () =>
      act(
        () =>
          isOffer
            ? runEffect(offersStore.archiveOffer(hash))
            : runEffect(requestsStore.archiveRequest(hash)),
        `${isOffer ? 'Offer' : 'Request'} archived`,
        `Couldn't archive this ${noun}`
      )
    );

  const remove = () =>
    confirm(
      `Are you sure you want to delete this ${noun}? This action cannot be undone.`,
      'Delete',
      () =>
        act(
          () =>
            isOffer
              ? runEffect(offersStore.deleteOffer(hash))
              : runEffect(requestsStore.deleteRequest(hash)),
          `${isOffer ? 'Offer' : 'Request'} deleted`,
          `Couldn't delete this ${noun}`
        )
    );
</script>

<div class="card flex flex-col gap-3 p-4" data-testid="my-listing-card">
  <div class="flex flex-wrap items-center gap-2 text-sm">
    <span class="badge {isOffer ? 'variant-soft-warning' : 'variant-soft-secondary'}"
      >{isOffer ? '💡 Offer' : '📝 Request'}</span
    >
    {#if item.archived}
      <span class="variant-soft-warning badge">Archived</span>
    {:else}
      <span class="variant-soft-success badge">Active</span>
    {/if}
    <span class="text-surface-500"
      >{listing.interaction_type === 'InPerson' ? 'In person' : 'Virtual'}</span
    >
    {#if interest.loaded && others.length > 0}
      <button
        type="button"
        class="variant-filled-primary badge ml-auto"
        aria-expanded={open}
        onclick={() => (open = !open)}
        data-testid="interested-chip">{others.length} interested</button
      >
    {/if}
  </div>

  <h3 class="h4"><a class="hover:underline" href={base}>{listing.title}</a></h3>
  {#if listing.description}
    <p class="line-clamp-2 text-sm text-surface-600 dark:text-surface-300">
      {listing.description}
    </p>
  {/if}
  {#if listing.service_type_hashes?.length}
    <div class="flex flex-wrap gap-1">
      {#each listing.service_type_hashes as st (encodeHashToBase64(st))}
        <ServiceTypeTag serviceTypeActionHash={st} />
      {/each}
    </div>
  {/if}

  {#if open && others.length > 0}
    <ul
      class="space-y-2 border-t border-surface-300 pt-3 text-sm dark:border-surface-600"
      data-testid="interested-members"
    >
      {#each others as person (encodeHashToBase64(person.interest_hash))}
        {@const who = interest.personOf(person)}
        {@const exchange = latestOnInterest(person.interest_hash, exchangesStore.exchanges)}
        <li class="flex flex-wrap items-center gap-2">
          <img
            src={who ? getUserPictureUrl(who) : '/default_avatar.webp'}
            alt=""
            class="h-6 w-6 rounded-full bg-surface-200 object-cover"
          />
          <a class="anchor" href={`/users/${encodeHashToBase64(person.user)}`}
            >{who?.name ?? 'A member'}</a
          >
          <span class="text-surface-500">{formatWhen(person.created_at)}</span>
          {#if exchange}
            <a
              class="variant-soft-surface btn btn-sm ml-auto"
              href={`/exchanges/${encodeHashToBase64(exchange.agreement_hash)}`}
              >{statusLabel(exchange)} &rarr;</a
            >
          {:else}
            <a class="variant-filled-primary btn btn-sm ml-auto" href={interest.hrefFor(person)}
              >Send a proposal</a
            >
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  {#if interest.loadFailed}
    <p class="text-xs text-surface-500" data-testid="interested-members-failed">
      Couldn't check who is interested.
      <button type="button" class="anchor" onclick={() => interest.load()}>Try again</button>
    </p>
  {/if}

  <div class="mt-auto flex flex-wrap gap-2">
    <a class="variant-ghost-surface btn btn-sm" href={base}>View</a>
    {#if !item.archived}
      <a class="variant-ghost-surface btn btn-sm" href={`${base}/edit`}>Edit</a>
      <button class="variant-ghost-warning btn btn-sm" onclick={archive} disabled={busy}
        >Archive</button
      >
    {/if}
    <button class="variant-ghost-error btn btn-sm" onclick={remove} disabled={busy}>Delete</button>
  </div>
</div>
