import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Effect as E, Layer } from 'effect';
import { encode } from '@msgpack/msgpack';
import type { Record as HcRecord } from '@holochain/client';
import { createExchangesStore, type ExchangesStore } from '$lib/stores/exchanges.store.svelte';
import { ExchangesServiceTag, type ExchangesService } from '$lib/services/zomes/exchanges.service';
import { ExchangeError } from '$lib/errors/exchanges.errors';
import type { AgreementInDHT, ExchangeReadModel, InterestInDHT } from '$lib/types/holochain';

const hash = (n: number) => new Uint8Array([n, n, n, n]);

const record = (entry: object, actionHash: Uint8Array, atMs = 1_700_000_000_000): HcRecord =>
  ({
    signed_action: {
      hashed: {
        hash: actionHash,
        content: { timestamp: atMs * 1000, author: hash(9) }
      }
    },
    entry: { Present: { entry: encode(entry) } }
  }) as unknown as HcRecord;

const agreement: AgreementInDHT = {
  listing: hash(1),
  listing_type: 'Offer',
  interest: hash(2),
  counterparty: hash(3),
  provider: hash(4),
  receiver: hash(3),
  primary: { direction: 'Provide', resource_conforms_to: 'Gardening', resource_kind: 'Service', quantity: { value: 2, unit: 'h' } },
  reciprocal: { direction: 'Receive', resource_conforms_to: '', resource_kind: 'Gift', quantity: null },
  medium: 'Free/Pay it Forward',
  terms: 'Saturday, bring gloves',
  delivery_timeframe: 'Within 2 weeks'
};

const interest: InterestInDHT = { listing: hash(1), listing_type: 'Offer', user: hash(3) };

const model = (over: Partial<ExchangeReadModel> = {}): ExchangeReadModel => ({
  agreement: record(agreement, hash(10)),
  response: null,
  provider_completion: null,
  receiver_completion: null,
  provider_review: null,
  receiver_review: null,
  cancellation: null,
  status: 'Proposed',
  ...over
});

// What the next read returns; tests swap these instead of reassigning readonly fields.
let nextExchange: () => ExchangeReadModel = () => model();
let nextList: () => E.Effect<ExchangeReadModel[], ExchangeError> = () => E.succeed([model()]);

function mockService(over: Partial<ExchangesService> = {}): ExchangesService {
  return {
    createInterest: vi.fn(() => E.succeed(record(interest, hash(20)))),
    withdrawInterest: vi.fn(() => E.succeed(hash(20))),
    getInterestsForListing: vi.fn(() => E.succeed([record(interest, hash(20))])),
    getMyInterests: vi.fn(() => E.succeed([])),
    createAgreement: vi.fn(() => E.succeed(record(agreement, hash(10)))),
    respondToAgreement: vi.fn(() => E.succeed(record({ agreement: hash(10), accepted: true, note: '' }, hash(11)))),
    completeAgreement: vi.fn(() => E.succeed(record({ agreement: hash(10) }, hash(12)))),
    reviewAgreement: vi.fn(() => E.succeed(record({ agreement: hash(10), rating: 5, on_time: true, as_agreed: true, comment: '' }, hash(13)))),
    cancelAgreement: vi.fn(() => E.succeed(record({ agreement: hash(10), note: '' }, hash(14)))),
    getExchange: vi.fn(() => E.succeed(nextExchange())),
    getMyExchanges: vi.fn(() => nextList()),
    getExchangesForListing: vi.fn(() => E.succeed([model()])),
    ...over
  };
}

async function storeWith(service: ExchangesService): Promise<ExchangesStore> {
  return E.runPromise(E.provide(createExchangesStore(), Layer.succeed(ExchangesServiceTag, service)));
}

describe('exchanges store', () => {
  let service: ExchangesService;
  let store: ExchangesStore;

  beforeEach(async () => {
    nextExchange = () => model();
    nextList = () => E.succeed([model()]);
    service = mockService();
    store = await storeWith(service);
  });

  it('decodes an interest with its hash, member and time', async () => {
    const [i] = await E.runPromise(store.getInterestsForListing(hash(1)));
    expect(i.interest_hash).toEqual(hash(20));
    expect(i.user).toEqual(hash(3));
    expect(i.listing_type).toBe('Offer');
    expect(i.created_at).toBe(1_700_000_000_000);
  });

  it('decodes an exchange by role and carries the derived status', async () => {
    const provided = model({
      status: 'ProviderDelivered',
      response: record({ agreement: hash(10), accepted: true, note: 'yes' }, hash(11)),
      provider_completion: record({ agreement: hash(10) }, hash(12), 1_700_000_100_000)
    });
    nextExchange = () => provided;
    const ex = await E.runPromise(store.getExchange(hash(10)));
    expect(ex.agreement_hash).toEqual(hash(10));
    expect(ex.agreement.medium).toBe('Free/Pay it Forward');
    expect(ex.status).toBe('ProviderDelivered');
    expect(ex.response?.accepted).toBe(true);
    expect(ex.provider_done?.created_at).toBe(1_700_000_100_000);
    expect(ex.receiver_done).toBeUndefined();
    expect(ex.provider_review).toBeUndefined();
  });

  it('reads the exchange back after a write and keeps one entry per agreement', async () => {
    await E.runPromise(store.loadMyExchanges());
    expect(store.exchanges).toHaveLength(1);
    nextExchange = () => model({ status: 'Agreed', response: record({ agreement: hash(10), accepted: true, note: '' }, hash(11)) });
    const ex = await E.runPromise(store.respond(hash(10), true, ''));
    expect(service.respondToAgreement).toHaveBeenCalledWith(hash(10), true, '');
    expect(ex.status).toBe('Agreed');
    expect(store.exchanges).toHaveLength(1);
    expect(store.exchanges[0].status).toBe('Agreed');
  });

  it('replaces the list on load rather than appending', async () => {
    await E.runPromise(store.loadMyExchanges());
    await E.runPromise(store.loadMyExchanges());
    expect(store.exchanges).toHaveLength(1);
  });

  it('records a service failure and clears loading', async () => {
    nextList = () => E.fail(ExchangeError.create('conductor away'));
    await expect(E.runPromise(store.loadMyExchanges())).rejects.toThrow();
    expect(store.error).toContain('conductor away');
    expect(store.loading).toBe(false);
  });

  it('passes the review fields through to the zome', async () => {
    await E.runPromise(store.review(hash(10), { rating: 4, on_time: true, as_agreed: false, comment: 'fine' }));
    expect(service.reviewAgreement).toHaveBeenCalledWith(hash(10), { rating: 4, on_time: true, as_agreed: false, comment: 'fine' });
  });
});
