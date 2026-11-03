/**
 * #441: two members seeding at once each build their Unit registry from their
 * own Units, before gossip shows them the other's. The registry must converge:
 * once the other member's Unit is visible, a write picks the same Unit on both.
 */
import { describe, it, expect, vi } from 'vitest';
import { Effect as E, Layer } from 'effect';
import { createHreaStore, type HreaStore } from '$lib/stores/hrea.store.svelte';
import {
  MediumsOfExchangeServiceTag,
  type MediumsOfExchangeService
} from '$lib/services/zomes/mediums-of-exchange.service';
import { HreaServiceTag, type HreaService } from '@/lib/services/hrea.service';
import { measureOf } from '$lib/services/mappers/agreement-commitment.mapper';
import { runEffect } from '$lib/utils/effect';
import { HreaError } from '$lib/errors';
import type { ExchangeTerm } from '$lib/types/holochain';
import type { UIExchange } from '$lib/types/ui';

type Unit = { id: string; label: string; symbol: string };

const MINE: Unit = { id: 'uhCkkB:dna', label: 'hours', symbol: 'h' };
const THEIRS: Unit = { id: 'uhCkkA:dna', label: 'hours', symbol: 'h' };
const OTHER_SEEDS: Unit[] = [
  { id: 'uhCkkD:dna', label: 'days', symbol: 'd' },
  { id: 'uhCkkE:dna', label: 'each', symbol: 'ea' }
];

const hoursTerm = {
  direction: 'Provide',
  resource_conforms_to: 'Mentoring',
  resource_kind: 'Service',
  quantity: { value: 2, unit: 'hours' }
} as ExchangeTerm;

const hash = (n: number) => new Uint8Array([n, n, n]) as unknown as UIExchange['agreement_hash'];

/** An exchange whose parties have no hREA agents: the write path returns early, after the refresh. */
const exchange = {
  agreement_hash: hash(1),
  agreement: { provider: hash(2), receiver: hash(3), primary: hoursTerm, reciprocal: hoursTerm }
} as unknown as UIExchange;

/** Every service method the test does not name answers with an empty list. */
const serviceWith = (getUnits: () => E.Effect<Unit[], HreaError>): HreaService =>
  new Proxy(
    {
      initialize: vi.fn(() => E.succeed({})),
      getUnits: vi.fn(getUnits),
      createUnit: vi.fn((seed: { label: string; symbol: string }) =>
        E.succeed({ id: `created-${seed.label}`, label: seed.label, symbol: seed.symbol })
      )
    } as Record<string, unknown>,
    { get: (target, key: string) => target[key] ?? vi.fn(() => E.succeed([])) }
  ) as unknown as HreaService;

const storeWith = (service: HreaService): Promise<HreaStore> => {
  const mediums = {
    resolveToOriginal: vi.fn((h) => E.succeed(h))
  } as unknown as MediumsOfExchangeService;
  return runEffect(
    createHreaStore().pipe(
      E.provide(Layer.succeed(HreaServiceTag, service)),
      E.provide(Layer.succeed(MediumsOfExchangeServiceTag, mediums))
    )
  );
};

describe('hREA unit registry converges across members (#441)', () => {
  it('switches to the lower id once the other member’s Unit is visible, before writing', async () => {
    // Before gossip this member sees only the Units it seeded itself.
    let visible: Unit[] = [MINE, ...OTHER_SEEDS];
    const store = await storeWith(serviceWith(() => E.succeed(visible)));
    await runEffect(store.initialize());
    await vi.waitFor(() => expect(measureOf(hoursTerm)?.hasUnit).toBe(MINE.id));

    // Gossip arrives: the other member's `hours` is now on the network too.
    visible = [MINE, THEIRS, ...OTHER_SEEDS];
    await runEffect(store.createAgreementFromExchange(exchange));
    expect(measureOf(hoursTerm)?.hasUnit).toBe(THEIRS.id);

    // The completion path refreshes the same way (the order no longer matters).
    visible = [THEIRS, MINE, ...OTHER_SEEDS].reverse();
    await runEffect(store.recordCompletionEvent(exchange));
    expect(measureOf(hoursTerm)?.hasUnit).toBe(THEIRS.id);
  });

  it('keeps the registry it has when the refresh read fails', async () => {
    let fail = false;
    const store = await storeWith(
      serviceWith(() =>
        fail
          ? E.fail(new HreaError({ message: 'conductor gone' }))
          : E.succeed([MINE, ...OTHER_SEEDS])
      )
    );
    await runEffect(store.initialize());
    await vi.waitFor(() => expect(measureOf(hoursTerm)?.hasUnit).toBe(MINE.id));

    fail = true;
    await runEffect(store.createAgreementFromExchange(exchange));
    expect(measureOf(hoursTerm)?.hasUnit).toBe(MINE.id);
  });
});
