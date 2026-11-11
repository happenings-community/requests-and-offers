import { describe, it, expect, vi } from 'vitest';
import { Effect as E } from 'effect';
import { encode } from '@msgpack/msgpack';
import type { Record as HcRecord } from '@holochain/client';
import { CacheServiceLive } from '$lib/utils/cache.svelte';
import type { MediumOfExchangeInDHT } from '$lib/schemas/mediums-of-exchange.schemas';
import {
  MediumsOfExchangeServiceTag,
  type MediumsOfExchangeService
} from '$lib/services/zomes/mediums-of-exchange.service';
import { createMediumsOfExchangeStore } from '$lib/stores/mediums_of_exchange.store.svelte';

/**
 * A record as the conductor returns it: the entry msgpack-encoded, because
 * the store's createUIEntityFromRecord decodes it.
 */
const recordOf = (entry: MediumOfExchangeInDHT, seed: number): HcRecord =>
  ({
    signed_action: {
      hashed: {
        hash: new Uint8Array(39).fill(seed),
        content: { header: { timestamp: Date.now() * 1000 }, data: { type: 'Create' } }
      }
    },
    entry: { Present: { entry: encode(entry) } }
  }) as unknown as HcRecord;

const serviceWith = (approved: HcRecord[]): MediumsOfExchangeService =>
  ({
    getApprovedMediumsOfExchange: vi.fn(() => E.succeed(approved)),
    getPendingMediumsOfExchange: vi.fn(() => E.succeed([])),
    getRejectedMediumsOfExchange: vi.fn(() => E.succeed([])),
    getAllMediumsOfExchange: vi.fn(() => E.succeed(approved))
  }) as unknown as MediumsOfExchangeService;

describe('mediums of exchange store: a medium keeps the type the DHT holds', () => {
  it('a currency read from the DHT is a currency in the store', async () => {
    const pounds: MediumOfExchangeInDHT = {
      code: 'GBP',
      name: 'Pounds',
      description: null,
      resource_spec_hrea_id: null,
      exchange_type: 'currency'
    };
    const hours: MediumOfExchangeInDHT = {
      code: 'HRS',
      name: 'Hours',
      description: null,
      resource_spec_hrea_id: null,
      exchange_type: 'base'
    };
    const store = await E.runPromise(
      createMediumsOfExchangeStore().pipe(
        E.provideService(
          MediumsOfExchangeServiceTag,
          serviceWith([recordOf(pounds, 1), recordOf(hours, 2)])
        ),
        E.provide(CacheServiceLive)
      )
    );

    const read = await E.runPromise(store.getApprovedMediumsOfExchange());

    expect(read.map((m) => [m.code, m.exchange_type])).toEqual([
      ['GBP', 'currency'],
      ['HRS', 'base']
    ]);
  });
});
