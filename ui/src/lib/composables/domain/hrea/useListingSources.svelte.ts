import { Effect as E } from 'effect';
import requestsStore from '$lib/stores/requests.store.svelte';
import offersStore from '$lib/stores/offers.store.svelte';
import type { UIRequest, UIOffer } from '$lib/types/ui';

export type ListingKind = 'request' | 'offer';

/**
 * The listing an hREA proposal mirrors, read by the hash the proposal is mapped under.
 *
 * A proposal is mapped under its listing's original hash, but a list read gives each
 * listing at its latest revision, labelled with that revision's hash, so an edited
 * listing is not in the list under the hash the proposal knows. This asks for the latest
 * revision by that hash (getLatestRequest / getLatestOffer), which does not touch the
 * stores' lists. Hashes are `Uint8Array.toString()` strings. A read that fails (or
 * throws) is asked again on the next `track`; `reset` forgets every read, for a refresh.
 */
export function useListingSources() {
  let found = $state<Map<string, UIRequest | UIOffer>>(new Map());
  const asked = new Set<string>();

  const readOne = (kind: ListingKind, h: string) => {
    const bytes = new Uint8Array(h.split(',').map((n) => parseInt(n, 10)));
    const read: E.Effect<UIRequest | UIOffer | null, unknown> =
      kind === 'request'
        ? requestsStore.getLatestRequest(bytes)
        : offersStore.getLatestOffer(bytes);
    return E.catchAllCause(
      E.map(read, (listing) => [h, listing] as const),
      () => {
        asked.delete(h); // ask again next time
        return E.succeed(null);
      }
    );
  };

  /** Reads every listing not read or asked for yet; an empty list does nothing. */
  function track(wanted: Iterable<{ kind: ListingKind; hash: string }>): Promise<void> {
    const fresh = [...wanted].filter(({ hash }) => hash.includes(',') && !asked.has(hash));
    if (fresh.length === 0) return Promise.resolve();
    for (const { hash } of fresh) asked.add(hash);
    return E.runPromise(
      E.all(
        fresh.map(({ kind, hash }) => readOne(kind, hash)),
        { concurrency: 5 }
      )
    ).then((pairs) => {
      const next = new Map(found);
      for (const pair of pairs) if (pair && pair[1]) next.set(pair[0], pair[1]);
      found = next;
    });
  }

  /** Forgets every read, so the next `track` reads each listing afresh. */
  function reset(): void {
    asked.clear();
    found = new Map();
  }

  return {
    get found(): ReadonlyMap<string, UIRequest | UIOffer> {
      return found;
    },
    track,
    reset
  };
}
