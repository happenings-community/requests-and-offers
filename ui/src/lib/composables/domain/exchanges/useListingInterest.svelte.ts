import { encodeHashToBase64, type ActionHash } from '@holochain/client';
import exchangesStore from '$lib/stores/exchanges.store.svelte';
import usersStore from '$lib/stores/users.store.svelte';
import { runEffect } from '$lib/utils/effect';
import { showToast } from '$lib/utils/toast';
import { reasonOf } from '$lib/utils/error-shape';
import { plainZomeError } from '$lib/utils/zome-refusals';
import { isUserApproved } from '$lib/utils';
import type { ListingType } from '$lib/types/holochain';
import type { UIInterest, UIUser } from '$lib/types/ui';
import { paths } from '$lib/paths';

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
  return paths.exchangePropose({
    listing: listingHash,
    type: listingType,
    interest: interest.interest_hash
  });
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
  /** Why the interests could not be read. The door shows this, with a way to try again. */
  let loadError = $state<string | null>(null);
  let busy = $state(false);

  const me = $derived(usersStore.currentUser?.original_action_hash);
  /** Only an accepted member can register interest or propose; the zome refuses anyone else. */
  const canAct = $derived(isUserApproved(usersStore.currentUser));
  const isMine = (interest: UIInterest) => !!me && interest.user.toString() === me.toString();
  const mine = $derived(interests.find(isMine) ?? null);
  const others = $derived(interests.filter((i) => !isMine(i)));

  const personOf = (interest: UIInterest) => people[encodeHashToBase64(interest.user)];
  const hrefFor = (interest: UIInterest) => proposeHref(interest, listingHash(), listingType());

  function fail(e: unknown) {
    const { message, details } = plainZomeError(e);
    showToast(message, 'error', 8000, {
      label: 'Copy details',
      response: () => {
        navigator.clipboard?.writeText(details).catch(() => {});
      }
    });
  }

  /**
   * Read who is interested. **A failed read is shown, not toasted away:** a toast fades
   * and leaves the listing with no door at all, which reads as "nothing to do here".
   */
  async function load(): Promise<void> {
    loadError = null;
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
      loadError = reasonOf(e);
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
    get loadError() {
      return loadError;
    },
    get busy() {
      return busy;
    },
    get me() {
      return me;
    },
    get canAct() {
      return canAct;
    },
    personOf,
    hrefFor,
    load,
    register,
    withdraw
  };
}

export type ListingInterest = ReturnType<typeof useListingInterest>;
