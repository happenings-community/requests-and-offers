<script lang="ts">
  import { encodeHashToBase64, type ActionHash } from '@holochain/client';
  import { MESSAGING_STRINGS as S, fill } from '$lib/strings/messaging.strings';
  import type { UIInterest } from '$lib/types/ui';
  import type { OfferInput, RequestInput } from '$lib/types/holochain';
  import RequestForm from '$lib/components/requests/RequestForm.svelte';
  import OfferForm from '$lib/components/offers/OfferForm.svelte';
  import requestsStore from '$lib/stores/requests.store.svelte';
  import offersStore from '$lib/stores/offers.store.svelte';
  import { runEffect } from '$lib/utils/effect';
  import { postListingFromConversation } from '$lib/utils/messaging-actions';

  type Props = {
    theirs: UIInterest[];
    yours: UIInterest[];
    name: string;
    titleOf: (listing: ActionHash) => string;
    onClose: () => void;
    /** Called after a listing is published, so the conversation can reload. */
    onPosted: () => void;
  };
  const { theirs, yours, name, titleOf, onClose, onPosted }: Props = $props();

  /**
   * Where choosing a listing goes.
   *
   * The proposal form is the existing `/exchanges/propose`, which already knows how to
   * build an agreement from a listing and an interest. Sending the member there rather
   * than growing a second one keeps one proposal path in the app.
   */
  const proposeHref = (i: UIInterest) =>
    `/exchanges/propose?interest=${encodeHashToBase64(i.interest_hash)}` +
    `&listing=${encodeHashToBase64(i.listing)}&listingType=${i.listing_type}`;

  const nothingFits = $derived(theirs.length === 0 && yours.length === 0);

  /**
   * Publishing a new listing without leaving the conversation.
   *
   * **Publishing a listing is the only way to propose terms that no listing carries**,
   * so the form is here rather than behind a link: sending a member off to
   * `/requests/create` loses the conversation they were having, which is the context the
   * new listing exists for.
   */
  let creating = $state<'Request' | 'Offer' | null>(null);
  let posted = $state<{ type: 'Request' | 'Offer'; title: string } | null>(null);
  let postError = $state<string | null>(null);

  /** The order and the failure path are tested in `utils/messaging-actions.ts`. */
  async function post(type: 'Request' | 'Offer', title: string, create: () => Promise<unknown>) {
    postError = null;
    const outcome = await postListingFromConversation({ type, title, create, reload: onPosted });
    if (outcome.ok) {
      posted = outcome.posted;
      creating = null;
    } else {
      postError = outcome.reason;
    }
  }

  const postRequest = (input: RequestInput) =>
    post('Request', input.title, async () => {
      await runEffect(requestsStore.createRequest(input));
      requestsStore.invalidateCache();
    });

  const postOffer = (input: OfferInput) =>
    post('Offer', input.title, async () => {
      await runEffect(offersStore.createOffer(input));
      offersStore.invalidateCache?.();
    });
</script>

<section class="card flex flex-col gap-3 p-4" data-testid="proposal-picker">
  <header class="flex flex-wrap items-center gap-2">
    <h2 class="h4">{S.picker.title}</h2>
    <button type="button" class="btn btn-sm variant-ghost ml-auto" onclick={onClose}>
      {S.proposal.declineForm.cancel}
    </button>
  </header>
  <p class="text-surface-500 text-sm">{S.picker.intro}</p>

  {#each [{ label: fill(S.picker.theirs, { name }), items: theirs }, { label: S.picker.yours, items: yours }] as group (group.label)}
    {#if group.items.length > 0}
      <div class="flex flex-col gap-2">
        <h3 class="text-surface-500 text-sm font-semibold">{group.label}</h3>
        {#each group.items as item (encodeHashToBase64(item.interest_hash))}
          <a
            class="card flex items-center gap-3 p-3 no-underline transition-colors hover:bg-surface-100 dark:hover:bg-surface-700"
            href={proposeHref(item)}
          >
            <span
              class="badge {item.listing_type === 'Offer'
                ? 'variant-soft-warning'
                : 'variant-soft-secondary'}"
            >
              {item.listing_type === 'Offer' ? '💡 Offer' : '📝 Request'}
            </span>
            <span class="min-w-0 flex-1 truncate">{titleOf(item.listing)}</span>
          </a>
        {/each}
      </div>
    {/if}
  {/each}

  {#if nothingFits}
    <p class="text-surface-500 text-sm">{S.picker.none}</p>
  {/if}

  {#if posted}
    <!--
      The poster's half. The other person's copy of this card needs a `listing` field on
      MessageBody, a planned follow-up; until that lands, only the poster sees it.
      Tracked in #307.
    -->
    <div class="card variant-soft-success space-y-1 p-3" data-testid="posted-listing">
      <p class="font-semibold">
        {posted.type === 'Request' ? S.posted.titleRequest : S.posted.titleOffer}
      </p>
      <p class="text-sm">{posted.title}</p>
      <p class="text-surface-500 text-sm">{fill(S.posted.waiting, { name })}</p>
    </div>
  {/if}

  {#if postError}
    <p class="text-error-700 dark:text-error-300 text-sm" role="alert">{postError}</p>
  {/if}

  {#if creating === 'Request'}
    <div class="card variant-soft p-4">
      <RequestForm mode="create" organizations={[]} onSubmit={postRequest} />
    </div>
  {:else if creating === 'Offer'}
    <div class="card variant-soft p-4">
      <OfferForm mode="create" organizations={[]} onSubmit={postOffer} />
    </div>
  {:else}
    <div class="flex flex-wrap gap-2 pt-1">
      <button type="button" class="btn btn-sm variant-ghost" onclick={() => (creating = 'Request')}
        >{S.picker.newRequest}</button
      >
      <button type="button" class="btn btn-sm variant-ghost" onclick={() => (creating = 'Offer')}
        >{S.picker.newOffer}</button
      >
    </div>
  {/if}
</section>
