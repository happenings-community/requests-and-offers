<script lang="ts">
  import { encodeHashToBase64, type ActionHash } from '@holochain/client';
  import { useListingInterest } from '$lib/composables/domain/exchanges/useListingInterest.svelte';
  import type { ListingType } from '$lib/types/holochain';
  import type { UIOrganization, UIUser } from '$lib/types/ui';
  import { formatWhen } from '$lib/utils/exchange-ui';
  import { paths } from '$lib/paths';
  import { EXCHANGE_STRINGS as S, fill } from '$lib/strings/exchanges.strings';
  import { COMMON_STRINGS as C } from '$lib/strings/common.strings';
  import ReachPerson from './ReachPerson.svelte';
  import { getFirstContact } from '$lib/extensions/first-contact';

  /**
   * The listing page's formal door.
   *
   * **Every network has these, because they are the exchange itself**: show interest, make
   * a proposal from it, withdraw it. None of them needs a conversation, and none of them
   * takes the member off the page they are reading, because until somebody proposes there
   * is no exchange to go to.
   *
   * Beside them sits one control for reaching the other person, which is the only part
   * that differs between networks: a way into the conversation where there is one, the
   * contact details from their profile where there is not. This component cannot tell
   * which, and does not need to.
   */

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

  const firstName = $derived(creator?.name?.split(' ')[0] ?? 'the listing owner');
  const noun = $derived(listingType === 'Offer' ? 'offer' : 'request');

  /**
   * Whatever says a word before a member's first proposal, if anything does.
   *
   * Read at render time rather than at set-up, because which modules this network has is
   * read from the DNA a moment after the plug is put in. Nothing is plugged in on a
   * network without conversations, and then the links below are ordinary links.
   */
  const firstContact = getFirstContact();
  const FirstContact = $derived(firstContact());

  /**
   * Showing interest no longer opens anything by itself.
   *
   * It used to throw the author's contact details up as soon as interest was recorded,
   * which decided for the member how they were going to get in touch and did it before
   * they asked. The way to reach somebody is a control beside the actions now, so they
   * choose.
   */
  const interest = useListingInterest({
    listingHash: () => listingHash,
    listingType: () => listingType
  });

  const mine = $derived(interest.mine);
  const others = $derived(interest.others);
  const me = $derived(interest.me);
  const canAct = $derived(interest.canAct);
  const loaded = $derived(interest.loaded);
  const loadError = $derived(interest.loadError);
  const busy = $derived(interest.busy);

  $effect(() => {
    listingHash;
    interest.load();
  });
</script>

{#if loadError}
  <!-- The door is still here when the read fails: the fault, and the way to try again. -->
  <div class="alert variant-soft-error flex flex-wrap items-center gap-3" role="alert">
    <span class="text-sm">{fill(S.listing.interestsReadFailed, { reason: loadError })}</span>
    <button type="button" class="variant-filled btn btn-sm" onclick={interest.load}
      >{C.tryAgain}</button
    >
  </div>
{:else if loaded}
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
              <a class="anchor" href={paths.userProfile(item.user)}>
                {person?.name ?? 'A member'}
              </a>
              {#if FirstContact}
                <FirstContact
                  kind="proposal"
                  href={interest.hrefFor(item)}
                  label="Send a proposal"
                  name={person?.name}
                  classes="variant-filled-primary btn btn-sm"
                />
              {:else}
                <a class="variant-filled-primary btn btn-sm" href={interest.hrefFor(item)}>
                  Send a proposal
                </a>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {:else if me && canAct}
    <div class="space-y-2 text-center" data-testid="listing-door">
      {#if mine}
        <div class="alert variant-soft-primary py-2 text-sm">
          {fill(S.listing.interestNoted, {
            date: formatWhen(mine.created_at),
            name: firstName
          })}
        </div>
        <div class="flex flex-col gap-2 sm:flex-row">
          <!--
            The same link either way. Where there are conversations, a member's first
            proposal is told what it puts on the network before it writes one; where there
            are none, nothing is plugged in and this is an ordinary link.
          -->
          {#if FirstContact}
            <FirstContact
              kind="proposal"
              href={interest.hrefFor(mine)}
              label={S.listing.makeProposal}
              name={firstName}
              classes="variant-filled-primary btn flex-1"
            />
          {:else}
            <a class="variant-filled-primary btn flex-1" href={interest.hrefFor(mine)}
              >{S.listing.makeProposal}</a
            >
          {/if}
          <button
            class="variant-ghost-surface btn flex-1"
            onclick={interest.withdraw}
            disabled={busy}
          >
            {S.interest.withdraw}
          </button>
        </div>
      {:else}
        <button
          class="variant-filled-primary btn w-full"
          onclick={interest.register}
          disabled={busy}
          data-testid="show-interest"
        >
          {S.listing.showInterest}
        </button>
      {/if}
      <!--
        Beside the actions in both states, because wanting to ask something does not wait
        for an interest to be recorded.
      -->
      <div class="flex flex-wrap items-center justify-center gap-2">
        <ReachPerson
          person={creator?.original_action_hash}
          listingType={noun}
          {listingTitle}
          {organization}
        />
      </div>
    </div>
  {/if}
{/if}
