import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Effect as E } from 'effect';
import type { UIExchange } from '$lib/types/ui';
import type { HreaSnapshot } from '$lib/utils/hrea-dashboard';

// U14: the dashboard composable gathers the R&O inventory beside the hREA
// snapshot. R&O has no list-all read for exchanges, so they come per listing.

const h = (n: number) => new Uint8Array([132, 41, 36, n]) as unknown as UIExchange['agreement_hash'];

const exchange = (agreement: number, listing: number, created_at = 1): UIExchange =>
  ({
    created_at,
    agreement_hash: h(agreement),
    status: 'Proposed',
    agreement: {
      listing: h(listing),
      listing_type: 'Offer',
      interest: h(50),
      counterparty: h(51),
      provider: h(52),
      receiver: h(51),
      primary: { direction: 'Provide', resource_conforms_to: 'Repair', resource_kind: 'Service', quantity: null },
      reciprocal: { direction: 'Receive', resource_conforms_to: 'CAD', resource_kind: 'Currency', quantity: null },
      medium: 'CAD',
      terms: '',
      delivery_timeframe: ''
    }
  }) as UIExchange;

const snapshot: HreaSnapshot = {
  agents: [],
  specs: [],
  proposals: [],
  intents: [],
  agreements: [],
  commitments: [],
  events: []
};

const listing = (n: number, title: string) => ({ original_action_hash: h(n), title });

const mocks = vi.hoisted(() => ({
  loadAuditSnapshot: vi.fn(),
  getExchangesForListing: vi.fn()
}));

vi.mock('$lib/stores/hrea.store.svelte', () => ({
  default: { loadAuditSnapshot: mocks.loadAuditSnapshot }
}));
vi.mock('$lib/stores/users.store.svelte', () => ({
  default: {
    getAcceptedUsers: () =>
      E.succeed([{ original_action_hash: h(52), name: 'Ada Lovelace', nickname: 'ada' }])
  }
}));
vi.mock('$lib/stores/organizations.store.svelte', () => ({
  default: { getAcceptedOrganizations: () => E.succeed([{}]) }
}));
vi.mock('$lib/stores/serviceTypes.store.svelte', () => ({
  default: { getApprovedServiceTypes: () => E.succeed([{}, {}]) }
}));
vi.mock('$lib/stores/mediums_of_exchange.store.svelte', () => ({
  default: { getApprovedMediumsOfExchange: () => E.succeed([{}]) }
}));
vi.mock('$lib/stores/requests.store.svelte', () => ({
  default: {
    getActiveRequests: () => E.succeed([listing(1, 'Soup')]),
    getArchivedRequests: () => E.succeed([listing(2, 'Old soup')])
  }
}));
vi.mock('$lib/stores/offers.store.svelte', () => ({
  default: {
    getActiveOffers: () => E.succeed([listing(3, 'Fix your bike'), { title: 'unsaved' }]),
    getArchivedOffers: () => E.succeed([])
  }
}));
vi.mock('$lib/stores/exchanges.store.svelte', () => ({
  default: { getExchangesForListing: mocks.getExchangesForListing }
}));

import { useHreaDashboard } from '$lib/composables/domain/hrea/useHreaDashboard.svelte';

describe('useHreaDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadAuditSnapshot.mockReturnValue(E.succeed(snapshot));
    mocks.getExchangesForListing.mockImplementation((l: Uint8Array) => {
      if (l[3] === 3) return E.succeed([exchange(9, 3, 1), exchange(10, 3, 5)]);
      if (l[3] === 2) return E.fail(new Error('archived listing unreadable'));
      return E.succeed([]);
    });
  });

  it('reads exchanges once per saved listing and builds the ledger beside the hREA snapshot', async () => {
    const dash = useHreaDashboard();
    await dash.load();

    expect(dash.loading).toBe(false);
    expect(dash.error).toBeNull();
    expect(mocks.loadAuditSnapshot).toHaveBeenCalledTimes(1);
    // Three listings carry a hash; the unsaved one is skipped.
    expect(mocks.getExchangesForListing).toHaveBeenCalledTimes(3);

    const byRo = Object.fromEntries(dash.ledger.map((r) => [r.ro, r]));
    expect(byRo['Users'].roCount).toBe(1);
    expect(byRo['Service types'].roCount).toBe(2);
    expect(byRo['Requests'].roCount).toBe(2);
    expect(byRo['Offers'].roCount).toBe(2);
    expect(dash.counts?.agents).toBe(0);
  });

  it('keeps going when one listing cannot be read, and lists the newest exchange first', async () => {
    const dash = useHreaDashboard();
    await dash.load();

    expect(dash.exchanges.map((x) => x.created_at)).toEqual([5, 1]);
    expect(dash.selected?.agreement_hash).toEqual(h(10));
    expect(dash.exchangeLabel(dash.exchanges[0])).toBe('Fix your bike · Proposed');
    expect(dash.flow.find((n) => n.id === 'agentA')?.title).toBe('Ada Lovelace');
  });

  it('switches the flow to the chosen exchange', async () => {
    const dash = useHreaDashboard();
    await dash.load();
    dash.select(h(9).toString());
    expect(dash.selected?.agreement_hash).toEqual(h(9));
  });

  it('reports a failed hREA read as an error, not as empty numbers', async () => {
    mocks.loadAuditSnapshot.mockReturnValue(E.fail(new Error('hREA cell missing')));
    const dash = useHreaDashboard();
    await dash.load();
    expect(dash.error).toMatch(/hREA cell missing/);
    expect(dash.ledger).toEqual([]);
    expect(dash.loading).toBe(false);
  });
});
