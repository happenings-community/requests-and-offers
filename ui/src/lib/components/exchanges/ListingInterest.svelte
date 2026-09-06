<script lang="ts">
  import { encodeHashToBase64, type ActionHash } from '@holochain/client';
  import { getToastStore } from '@skeletonlabs/skeleton';
  import exchangesStore from '$lib/stores/exchanges.store.svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import { runEffect } from '$lib/utils/effect';
  import type { ListingType } from '$lib/types/holochain';
  import type { UIInterest, UIUser } from '$lib/types/ui';

  type Props = {
    listingHash: ActionHash;
    listingType: ListingType;
    isCreator: boolean;
  };
  let { listingHash, listingType, isCreator }: Props = $props();

  const toastStore = getToastStore();

  let interests = $state<UIInterest[]>([]);
  let people = $state<Record<string, UIUser | null>>({});
  let loaded = $state(false);
  let busy = $state(false);

  const me = $derived(usersStore.currentUser?.original_action_hash);
  const isMine = (i: UIInterest) => !!me && i.user.toString() === me.toString();
  const mine = $derived(interests.find(isMine) ?? null);
  const others = $derived(interests.filter((i) => !isMine(i)));

  const proposeHref = (interest: UIInterest) =>
    `/exchanges/propose?interest=${encodeHashToBase64(interest.interest_hash)}` +
    `&listing=${encodeHashToBase64(listingHash)}&type=${listingType}`;

  function fail(e: unknown) {
    toastStore.trigger({
      message: e instanceof Error ? e.message : String(e),
      background: 'variant-filled-error'
    });
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
      toastStore.trigger({ message: 'Interest registered', background: 'variant-filled-success' });
      await load();
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
                Write up the agreement
              </a>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {:else if me}
    <div class="card space-y-3 p-4">
      {#if mine}
        <p>You have registered interest. Either of you can write up the agreement.</p>
        <div class="flex flex-wrap gap-2">
          <a class="variant-filled-primary btn" href={proposeHref(mine)}>Write up the agreement</a>
          <button class="variant-ghost-surface btn" onclick={withdraw} disabled={busy}>
            Withdraw interest
          </button>
        </div>
      {:else}
        <p class="text-surface-500">
          Registering interest lets the listing owner know, and lets either of you write up an
          agreement.
        </p>
        <button class="variant-filled-primary btn" onclick={express} disabled={busy}>
          I am interested
        </button>
      {/if}
    </div>
  {/if}
{/if}
