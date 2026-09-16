import { encodeHashToBase64 } from '@holochain/client';
import exchangesStore from '$lib/stores/exchanges.store.svelte';
import usersStore from '$lib/stores/users.store.svelte';
import offersStore from '$lib/stores/offers.store.svelte';
import requestsStore from '$lib/stores/requests.store.svelte';
import { runEffect } from '$lib/utils/effect';
import { useConnectionGuard } from '$lib/composables/connection/useConnectionGuard';
import {
  awaitingMe,
  counterpartyOf,
  roleOf,
  tabOf,
  turnOf,
  type ExchangeTab
} from '$lib/utils/exchange-ui';
import type { UIExchange } from '$lib/types/ui';

/**
 * My Exchanges: the list, its tabs, its filters and the names behind the hashes.
 *
 * The page renders what this returns and owns no fetching of its own.
 */

export type ExchangeSide = 'all' | 'provider' | 'receiver';
export type ExchangeOrigin = 'all' | 'Offer' | 'Request';
export type ExchangeTurnFilter = 'all' | 'you' | 'them';
export type ExchangeOrder = 'latest' | 'oldest';

export const EXCHANGE_TAB_ORDER: readonly ExchangeTab[] = ['proposals', 'active', 'completed'];

/**
 * When the exchange last moved: the newest of the agreement and every entry
 * written against it. Sorting on the agreement alone puts a proposal answered
 * this morning below one nobody has touched in a month.
 */
export function lastActivity(exchange: UIExchange): number {
  return Math.max(
    exchange.created_at,
    exchange.response?.created_at ?? 0,
    exchange.provider_done?.created_at ?? 0,
    exchange.receiver_done?.created_at ?? 0,
    exchange.provider_review?.created_at ?? 0,
    exchange.receiver_review?.created_at ?? 0,
    exchange.cancellation?.created_at ?? 0
  );
}

/** The tab to open on: the first one holding something waiting on the member. */
export function tabToOpen(
  list: UIExchange[],
  me: Uint8Array | undefined,
  fallback: ExchangeTab
): ExchangeTab {
  return (
    EXCHANGE_TAB_ORDER.find((t) => list.some((e) => tabOf(e) === t && awaitingMe(e, me))) ??
    fallback
  );
}

/** The filters, applied in the order the page presents them, then sorted. */
export function applyExchangeFilters(
  list: UIExchange[],
  me: Uint8Array | undefined,
  filters: {
    tab: ExchangeTab;
    side: ExchangeSide;
    origin: ExchangeOrigin;
    turn: ExchangeTurnFilter;
    order: ExchangeOrder;
  }
): UIExchange[] {
  return list
    .filter((e) => tabOf(e) === filters.tab)
    .filter((e) => filters.side === 'all' || roleOf(e, me) === filters.side)
    .filter((e) => filters.origin === 'all' || e.agreement.listing_type === filters.origin)
    .filter((e) => filters.turn === 'all' || turnOf(e, me) === filters.turn)
    .sort((a, b) => (filters.order === 'latest' ? 1 : -1) * (lastActivity(b) - lastActivity(a)));
}

export interface UseExchangesManagementOptions {
  /** The tab shown when nothing is waiting on the member. */
  initialTab?: ExchangeTab;
}

export function useExchangesManagement(options: UseExchangesManagementOptions = {}) {
  const { initialTab = 'active' } = options;

  let tab = $state<ExchangeTab>(initialTab);
  let side = $state<ExchangeSide>('all');
  let origin = $state<ExchangeOrigin>('all');
  let turn = $state<ExchangeTurnFilter>('all');
  let order = $state<ExchangeOrder>('latest');

  const names = $state<Record<string, string>>({});
  const titles = $state<Record<string, string>>({});
  let ready = $state(false);
  let error = $state<string | null>(null);

  const me = $derived(usersStore.currentUser?.original_action_hash);
  const exchanges = $derived(exchangesStore.exchanges);
  const shown = $derived(applyExchangeFilters(exchanges, me, { tab, side, origin, turn, order }));

  const countIn = (t: ExchangeTab) => exchanges.filter((e) => tabOf(e) === t).length;
  const myTurnIn = (t: ExchangeTab) =>
    exchanges.filter((e) => tabOf(e) === t && awaitingMe(e, me)).length;

  const nameOf = (exchange: UIExchange) => names[encodeHashToBase64(counterpartyOf(exchange, me))];
  const titleOf = (exchange: UIExchange) => titles[encodeHashToBase64(exchange.agreement.listing)];

  /**
   * The counterparty's name and the listing's title, one lookup per distinct
   * hash. Failures here leave a placeholder rather than emptying the list: a
   * name that will not resolve is no reason to hide the exchange.
   */
  async function resolveLabels(list: UIExchange[]): Promise<void> {
    for (const exchange of list) {
      const other = encodeHashToBase64(counterpartyOf(exchange, me));
      if (!(other in names)) {
        const user = await runEffect(usersStore.getUserByActionHash(counterpartyOf(exchange, me)));
        names[other] = user?.name ?? 'A member';
      }
      const listing = encodeHashToBase64(exchange.agreement.listing);
      if (!(listing in titles)) {
        const item =
          exchange.agreement.listing_type === 'Offer'
            ? await runEffect(offersStore.getOffer(exchange.agreement.listing))
            : await runEffect(requestsStore.getRequest(exchange.agreement.listing));
        titles[listing] = item?.title ?? 'A listing';
      }
    }
  }

  async function initialize(): Promise<void> {
    try {
      await runEffect(useConnectionGuard());
      const list = await runEffect(exchangesStore.loadMyExchanges());
      tab = tabToOpen(list, me, tab);
      ready = true;
      await resolveLabels(list);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  return {
    get tab() {
      return tab;
    },
    set tab(value: ExchangeTab) {
      tab = value;
    },
    get side() {
      return side;
    },
    set side(value: ExchangeSide) {
      side = value;
    },
    get origin() {
      return origin;
    },
    set origin(value: ExchangeOrigin) {
      origin = value;
    },
    get turn() {
      return turn;
    },
    set turn(value: ExchangeTurnFilter) {
      turn = value;
    },
    get order() {
      return order;
    },
    set order(value: ExchangeOrder) {
      order = value;
    },
    get me() {
      return me;
    },
    get shown() {
      return shown;
    },
    get ready() {
      return ready;
    },
    get error() {
      return error;
    },
    get filtered() {
      return side !== 'all' || origin !== 'all' || turn !== 'all';
    },
    countIn,
    myTurnIn,
    nameOf,
    titleOf,
    lastActivity,
    initialize
  };
}

export type ExchangesManagement = ReturnType<typeof useExchangesManagement>;
