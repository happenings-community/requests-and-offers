<script lang="ts">
  import { encodeHashToBase64, type ActionHash } from '@holochain/client';
  import { MESSAGING_STRINGS as S, fill } from '$lib/strings/messaging.strings';
  import type { UIInterest } from '$lib/types/ui';

  type Props = {
    theirs: UIInterest[];
    yours: UIInterest[];
    name: string;
    titleOf: (listing: ActionHash) => string;
    onClose: () => void;
    /** The person this conversation is with, so the create page can offer a way back. */
    counterparty: ActionHash;
  };
  const { theirs, yours, name, titleOf, onClose, counterparty }: Props = $props();

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
   * New listings are published the usual way.
   *
   * The form used to open inline here. It went because a listing published from a
   * conversation should be no different from any other: one create page, one set of
   * rules, one thing to keep working. The conversation is carried in `from` so the
   * create page can offer a way back.
   */
  const createHref = (kind: 'requests' | 'offers') =>
    `/${kind}/create?from=${encodeHashToBase64(counterparty)}`;
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

  <div class="flex flex-wrap gap-2 pt-1">
    <a class="btn btn-sm variant-ghost" href={createHref('requests')}>{S.picker.newRequest}</a>
    <a class="btn btn-sm variant-ghost" href={createHref('offers')}>{S.picker.newOffer}</a>
  </div>
</section>
