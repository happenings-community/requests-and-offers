import { Effect as E } from 'effect';
import hreaStore from '$lib/stores/hrea.store.svelte';
import usersStore from '$lib/stores/users.store.svelte';
import organizationsStore from '$lib/stores/organizations.store.svelte';
import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
import mediumsOfExchangeStore from '$lib/stores/mediums_of_exchange.store.svelte';
import requestsStore from '$lib/stores/requests.store.svelte';
import offersStore from '$lib/stores/offers.store.svelte';
import exchangesStore from '$lib/stores/exchanges.store.svelte';
import { formatUserName } from '$lib/schemas/users.schemas';
import type { UIExchange } from '$lib/types/ui';
import {
  buildExchangeFlow,
  buildLedger,
  countVfTypes,
  type FlowNode,
  type HreaSnapshot,
  type LedgerRow,
  type RoInventory,
  type VfCounts
} from '$lib/utils/hrea-dashboard';

/**
 * The admin hREA dashboard: the hREA snapshot read from hREA, the R&O
 * inventory it is audited against, and the flow of one chosen exchange.
 * R&O exchanges have no list-all read, so they are gathered per listing.
 */
export function useHreaDashboard() {
  let snapshot = $state<HreaSnapshot | null>(null);
  let inventory = $state<RoInventory | null>(null);
  let names = $state<Map<string, string>>(new Map());
  let titles = $state<Map<string, string>>(new Map());
  let loading = $state(false);
  let error = $state<string | null>(null);
  let selectedRef = $state<string | null>(null);

  const counts = $derived<VfCounts | null>(snapshot ? countVfTypes(snapshot) : null);
  const ledger = $derived<LedgerRow[]>(
    snapshot && inventory ? buildLedger(inventory, snapshot) : []
  );
  const exchanges = $derived<UIExchange[]>(inventory?.exchanges ?? []);
  const selected = $derived(
    exchanges.find((x) => x.agreement_hash.toString() === selectedRef) ?? exchanges[0]
  );
  const flow = $derived<FlowNode[]>(
    snapshot && selected
      ? buildExchangeFlow(
          selected,
          {
            listingTitle: titles.get(selected.agreement.listing.toString()) ?? '(unknown listing)',
            providerName: names.get(selected.agreement.provider.toString()) ?? 'Provider',
            receiverName: names.get(selected.agreement.receiver.toString()) ?? 'Receiver'
          },
          snapshot
        )
      : []
  );

  const exchangeLabel = (x: UIExchange) =>
    `${titles.get(x.agreement.listing.toString()) ?? '(unknown listing)'} · ${x.status}`;

  const loadInventory = E.gen(function* () {
    const [
      users,
      organizations,
      serviceTypes,
      mediums,
      activeRequests,
      archivedRequests,
      activeOffers,
      archivedOffers
    ] = yield* E.all(
      [
        usersStore.getAcceptedUsers(),
        organizationsStore.getAcceptedOrganizations(),
        serviceTypesStore.getApprovedServiceTypes(),
        mediumsOfExchangeStore.getApprovedMediumsOfExchange(),
        requestsStore.getActiveRequests(),
        requestsStore.getArchivedRequests(),
        offersStore.getActiveOffers(),
        offersStore.getArchivedOffers()
      ],
      { concurrency: 'unbounded' }
    );
    const listings = [...activeRequests, ...archivedRequests, ...activeOffers, ...archivedOffers];
    const perListing = yield* E.all(
      listings
        .filter((l) => l.original_action_hash)
        .map((l) =>
          E.orElseSucceed(exchangesStore.getExchangesForListing(l.original_action_hash!), () => [])
        ),
      { concurrency: 5 }
    );
    const byRef = new Map<string, UIExchange>();
    for (const x of perListing.flat()) byRef.set(x.agreement_hash.toString(), x);

    names = new Map(
      users
        .filter((u) => u.original_action_hash)
        .map((u) => [
          u.original_action_hash!.toString(),
          formatUserName(u.name) || u.nickname || 'Member'
        ])
    );
    titles = new Map(
      listings
        .filter((l) => l.original_action_hash)
        .map((l) => [l.original_action_hash!.toString(), l.title])
    );
    const inv: RoInventory = {
      users: users.length,
      organizations: organizations.length,
      serviceTypes: serviceTypes.length,
      mediums: mediums.length,
      requests: activeRequests.length + archivedRequests.length,
      offers: activeOffers.length + archivedOffers.length,
      exchanges: [...byRef.values()].sort((a, b) => b.created_at - a.created_at)
    };
    return inv;
  });

  async function load() {
    loading = true;
    error = null;
    try {
      const [snap, inv] = await E.runPromise(
        E.all([hreaStore.loadAuditSnapshot(), loadInventory], {
          concurrency: 'unbounded'
        }) as E.Effect<[HreaSnapshot, RoInventory], unknown, never>
      );
      snapshot = snap;
      inventory = inv;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  return {
    get loading() {
      return loading;
    },
    get error() {
      return error;
    },
    get counts() {
      return counts;
    },
    get ledger() {
      return ledger;
    },
    get exchanges() {
      return exchanges;
    },
    get selected() {
      return selected;
    },
    get flow() {
      return flow;
    },
    select(ref: string) {
      selectedRef = ref;
    },
    exchangeLabel,
    load
  };
}
