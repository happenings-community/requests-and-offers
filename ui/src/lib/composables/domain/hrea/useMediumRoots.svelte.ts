import { Effect as E } from 'effect';
import mediumsOfExchangeStore from '$lib/stores/mediums_of_exchange.store.svelte';

/**
 * The original (root) hash of each medium hash it is given, as the DHT resolves it.
 *
 * A list read gives each medium at its latest revision, and approval is an update, so an
 * approved medium's hash is rarely the one its hREA specification's note names (and
 * notes the retroactive sync wrote can name a revision too). Comparing roots is exact.
 * Hashes are `Uint8Array.toString()` strings, as notes carry them. A failed call is asked
 * again on the next `track`. The zome answers a hash it cannot read with that hash, as it
 * answers a root, so such a hash stands for itself until the page is opened again.
 */
export function useMediumRoots() {
  let rootOf = $state<Map<string, string>>(new Map());
  const asked = new Set<string>();

  const resolveOne = (h: string) =>
    E.catchAllCause(
      E.map(
        mediumsOfExchangeStore.resolveToOriginal(
          new Uint8Array(h.split(',').map((n) => parseInt(n, 10)))
        ),
        (root) => [h, root.toString()] as const
      ),
      () => {
        asked.delete(h); // ask again next time (a failure or a throw)
        return E.succeed(null);
      }
    );

  /** Resolves every hash not resolved or asked for yet; an empty list does nothing. */
  function track(hashes: Iterable<string>): Promise<void> {
    const fresh = [...hashes].filter((h) => h.includes(',') && !asked.has(h));
    if (fresh.length === 0) return Promise.resolve();
    for (const h of fresh) asked.add(h);
    return E.runPromise(E.all(fresh.map(resolveOne), { concurrency: 5 })).then((pairs) => {
      const next = new Map(rootOf);
      for (const pair of pairs) if (pair) next.set(pair[0], pair[1]);
      rootOf = next;
    });
  }

  return {
    get rootOf(): ReadonlyMap<string, string> {
      return rootOf;
    },
    track
  };
}
