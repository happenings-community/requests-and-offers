import { encodeHashToBase64, type ActionHash } from '@holochain/client';
import exchangesStore from '$lib/stores/exchanges.store.svelte';
import usersStore from '$lib/stores/users.store.svelte';
import { runEffect } from '$lib/utils/effect';
import { showToast } from '$lib/utils/toast';
import type { ListingType } from '$lib/types/holochain';
import type { UIInterest, UIUser } from '$lib/types/ui';

/**
 * Interest on one listing: who registered it, whether I did, and the two writes
 * that change that. Registering interest is how a member says they are
 * interested; it is not a stand-in for a conversation and does not retract when
 * messaging lands (the boundary is in
 * `documentation/technical-specs/zomes/exchanges.md`).
 */

/** Where a proposal against this interest is written. */
export function proposeHref(
  interest: UIInterest,
  listingHash: ActionHash,
  listingType: ListingType
): string {
  return (
    `/exchanges/propose?interest=${encodeHashToBase64(interest.interest_hash)}` +
    `&listing=${encodeHashToBase64(listingHash)}&type=${listingType}`
  );
}

export interface UseListingInterestOptions {
  listingHash: () => ActionHash;
  listingType: () => ListingType;
  /** Called after interest is registered, when the author has contact details. */
  onRegistered?: () => void;
  /** True when there is contact information to open. */
  hasContactInfo?: () => boolean;
}

export function useListingInterest(options: UseListingInterestOptions) {
  const { listingHash, listingType, onRegistered, hasContactInfo } = options;

  let interests = $state<UIInterest[]>([]);
  const people = $state<Record<string, UIUser | null>>({});
  let loaded = $state(false);
  let busy = $state(false);

  const me = $derived(usersStore.currentUser?.original_action_hash);
  const isMine = (interest: UIInterest) => !!me && interest.user.toString() === me.toString();
  const mine = $derived(interests.find(isMine) ?? null);
  const others = $derived(interests.filter((i) => !isMine(i)));

  const personOf = (interest: UIInterest) => people[encodeHashToBase64(interest.user)];
  const hrefFor = (interest: UIInterest) => proposeHref(interest, listingHash(), listingType());

  function fail(e: unknown) {
    showToast(e instanceof Error ? e.message : String(e), 'error');
  }

  async function load(): Promise<void> {
    try {
      interests = await runEffect(exchangesStore.getInterestsForListing(listingHash()));
      loaded = true;
      for (const interest of interests) {
        const key = encodeHashToBase64(interest.user);
        if (!(key in people)) {
          people[key] = await runEffect(usersStore.getUserByActionHash(interest.user));
        }
      }
    } catch (e) {
      fail(e);
    }
  }

  async function register(): Promise<void> {
    busy = true;
    try {
      await runEffect(exchangesStore.createInterest(listingHash(), listingType()));
      await load();
      if (hasContactInfo?.() && onRegistered) onRegistered();
    } catch (e) {
      fail(e);
    } finally {
      busy = false;
    }
  }

  async function withdraw(): Promise<void> {
    const registered = mine;
    if (!registered) return;
    busy = true;
    try {
      await runEffect(exchangesStore.withdrawInterest(registered.interest_hash));
      showToast('Interest withdrawn', 'success');
      await load();
    } catch (e) {
      fail(e);
    } finally {
      busy = false;
    }
  }

  return {
    get interests() {
      return interests;
    },
    get mine() {
      return mine;
    },
    get others() {
      return others;
    },
    get loaded() {
      return loaded;
    },
    get busy() {
      return busy;
    },
    get me() {
      return me;
    },
    personOf,
    hrefFor,
    load,
    register,
    withdraw
  };
}

export type ListingInterest = ReturnType<typeof useListingInterest>;
