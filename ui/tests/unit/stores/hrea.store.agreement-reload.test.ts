import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Effect as E, Layer } from 'effect';
import type { UIExchange } from '$lib/types/ui';

// U15a: a completion after a reload must still find its hREA Agreement, and an
// acceptance mirrored before a reload must not be mirrored twice. The store's
// agreementMappings is in memory only, so both paths fall back to hREA itself.

const hash = (n: number) => new Uint8Array([n, n, n]) as unknown as UIExchange['agreement_hash'];
const PROVIDER = hash(5);
const RECEIVER = hash(6);

const mocks = vi.hoisted(() => ({ currentUser: null as unknown }));
vi.mock('$lib/stores/users.store.svelte', () => ({
  default: {
    get currentUser() {
      return mocks.currentUser;
    }
  }
}));

import { createHreaStore } from '$lib/stores/hrea.store.svelte';
import { HreaServiceTag, type HreaService } from '$lib/services/hrea.service';
import {
  MediumsOfExchangeServiceTag,
  type MediumsOfExchangeService
} from '$lib/services/zomes/mediums-of-exchange.service';
import { rnoAgreementRef } from '$lib/services/mappers/agreement-commitment.mapper';

const exchange = (): UIExchange =>
  ({
    agreement_hash: hash(1),
    created_at: 1_700_000_000,
    status: 'OneSideDone',
    provider_done: { created_at: 1_700_000_100 },
    agreement: {
      listing: hash(2),
      listing_type: 'Offer',
      interest: hash(3),
      counterparty: hash(4),
      provider: PROVIDER,
      receiver: RECEIVER,
      primary: {
        direction: 'Provide',
        resource_conforms_to: 'Bike repair',
        resource_kind: 'Service',
        quantity: null
      },
      reciprocal: {
        direction: 'Receive',
        resource_conforms_to: 'Time bank',
        resource_kind: 'Currency',
        quantity: null
      },
      medium: 'Time bank',
      terms: '',
      delivery_timeframe: ''
    }
  }) as unknown as UIExchange;

const ref = rnoAgreementRef(exchange());

const service = () => {
  const s = {
    initialize: vi.fn().mockReturnValue(E.succeed({ id: 'client' })),
    getUnits: vi.fn().mockReturnValue(E.succeed([])),
    createUnit: vi.fn(({ label, symbol }) => E.succeed({ id: `unit-${label}`, label, symbol })),
    getAgents: vi.fn().mockReturnValue(
      E.succeed([
        { id: 'agent-p', name: 'Ada', note: `ref:user:${PROVIDER.toString()}` },
        { id: 'agent-r', name: 'Bob', note: `ref:user:${RECEIVER.toString()}` }
      ])
    ),
    getResourceSpecifications: vi.fn().mockReturnValue(
      E.succeed([
        { id: 'spec-bike', name: 'Bike repair' },
        { id: 'spec-tb', name: 'Time bank' }
      ])
    ),
    // What hREA already holds from before the reload.
    getAgreements: vi
      .fn()
      .mockReturnValue(E.succeed([{ id: 'agr-1', revisionId: 'r1', note: ref }])),
    getCommitments: vi.fn().mockReturnValue(
      E.succeed([
        {
          id: 'c-prim',
          revisionId: 'c-prim-rev',
          action: 'work',
          provider: 'agent-p',
          receiver: 'agent-r',
          clauseOf: 'agr-1'
        },
        {
          id: 'c-recip',
          revisionId: 'c-recip-rev',
          action: 'transfer',
          provider: 'agent-r',
          receiver: 'agent-p',
          clauseOf: 'agr-1'
        }
      ])
    ),
    // Identity by default: each test says what the latest revisions hold.
    getLatestCommitments: vi.fn((cs: Array<{ id: string }>) =>
      E.succeed(cs as Array<{ id: string; revisionId?: string; finished?: boolean }>)
    ),
    createAgreement: vi.fn().mockReturnValue(E.succeed({ id: 'agr-NEW', revisionId: 'x' })),
    createCommitment: vi.fn().mockReturnValue(E.succeed({ id: 'c-NEW', revisionId: 'x' })),
    createEconomicEvent: vi.fn((input) => E.succeed({ id: 'ev-1', ...input })),
    updateCommitment: vi.fn().mockReturnValue(E.succeed({ id: 'c-prim' }))
  };
  return s as unknown as HreaService & typeof s;
};

const freshStore = (svc: HreaService) =>
  E.runPromise(
    createHreaStore().pipe(
      E.provide(Layer.succeed(HreaServiceTag, svc)),
      E.provide(
        Layer.succeed(MediumsOfExchangeServiceTag, {
          resolveToOriginal: vi.fn((h) => E.succeed(h))
        } as unknown as MediumsOfExchangeService)
      )
    )
  );

describe('hREA agreement mirror after a reload (agreementMappings empty)', () => {
  beforeEach(() => {
    mocks.currentUser = { original_action_hash: PROVIDER };
  });

  it('a completion still names its Agreement and finishes the right Commitment', async () => {
    const svc = service();
    const store = await freshStore(svc);
    await E.runPromise(store.getAllAgents());
    await E.runPromise(store.getAllResourceSpecifications());

    const event = await E.runPromise(store.recordCompletionEvent(exchange()));

    expect(svc.createEconomicEvent).toHaveBeenCalledTimes(1);
    expect(svc.createEconomicEvent.mock.calls[0][0].realizationOf).toBe('agr-1');
    // U15b: the event also fulfills the provider's Commitment.
    expect(svc.createEconomicEvent.mock.calls[0][0].fulfills).toEqual(['c-prim']);
    expect(event).not.toBeNull();
    expect(svc.updateCommitment).toHaveBeenCalledWith({ revisionId: 'c-prim-rev', finished: true });
    expect(store.agreementMappings.get(ref)?.agreementId).toBe('agr-1');
  });

  it('an acceptance already mirrored is not mirrored a second time', async () => {
    const svc = service();
    const store = await freshStore(svc);

    const refs = await E.runPromise(store.createAgreementFromExchange(exchange()));

    expect(refs?.agreementId).toBe('agr-1');
    expect(svc.createAgreement).not.toHaveBeenCalled();
    expect(svc.createCommitment).not.toHaveBeenCalled();
  });

  it('mirrors a new acceptance when hREA holds nothing for it', async () => {
    const svc = service();
    svc.getAgreements.mockReturnValue(E.succeed([]));
    svc.getCommitments.mockReturnValue(E.succeed([]));
    const store = await freshStore(svc);

    const refs = await E.runPromise(store.createAgreementFromExchange(exchange()));

    expect(svc.createAgreement).toHaveBeenCalledTimes(1);
    expect(refs?.agreementId).toBe('agr-NEW');
  });
});

// U15c: a cancellation after acceptance ends the mirrored Commitments; before
// acceptance hREA holds nothing for the exchange, so nothing is written.
describe('hREA mirror of a cancellation', () => {
  const accepted = (): UIExchange =>
    ({
      ...exchange(),
      status: 'Cancelled',
      provider_done: undefined,
      response: { agreement: hash(1), accepted: true, note: '', created_at: 1 }
    }) as unknown as UIExchange;

  it('marks the still-open Commitments finished, from their current revision in hREA', async () => {
    const svc = service();
    svc.getCommitments.mockReturnValue(
      E.succeed([
        {
          id: 'c-prim',
          revisionId: 'c-prim-rev2',
          action: 'work',
          provider: 'agent-p',
          receiver: 'agent-r',
          clauseOf: 'agr-1',
          finished: false
        },
        {
          id: 'c-recip',
          revisionId: 'c-recip-rev2',
          action: 'transfer',
          provider: 'agent-r',
          receiver: 'agent-p',
          clauseOf: 'agr-1',
          finished: true
        },
        {
          id: 'c-other',
          revisionId: 'x',
          action: 'work',
          provider: 'agent-p',
          receiver: 'agent-r',
          clauseOf: 'agr-other',
          finished: false
        }
      ])
    );
    const store = await freshStore(svc);
    await E.runPromise(store.getAllAgents());

    const ended = await E.runPromise(store.mirrorCancellation(accepted()));

    expect(ended).toBe(1);
    expect(svc.updateCommitment).toHaveBeenCalledTimes(1);
    expect(svc.updateCommitment).toHaveBeenCalledWith({
      revisionId: 'c-prim-rev2',
      finished: true
    });
  });

  // hREA's list returns the original revision after an update, so the list says
  // open while the commitment was already closed: the latest revision decides.
  it('reads the latest revision, so a commitment the list still shows open is not closed again', async () => {
    const svc = service();
    svc.getLatestCommitments.mockImplementation((cs: Array<{ id: string }>) =>
      E.succeed(
        cs.map((c) =>
          c.id === 'c-prim'
            ? { ...c, revisionId: 'c-prim-rev2', finished: true }
            : { ...c, revisionId: `${c.id}-rev2` }
        )
      )
    );
    const store = await freshStore(svc);
    await E.runPromise(store.getAllAgents());

    const ended = await E.runPromise(store.mirrorCancellation(accepted()));

    expect(svc.getLatestCommitments).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'c-prim' }),
      expect.objectContaining({ id: 'c-recip' })
    ]);
    expect(ended).toBe(1);
    expect(svc.updateCommitment).toHaveBeenCalledTimes(1);
    expect(svc.updateCommitment).toHaveBeenCalledWith({
      revisionId: 'c-recip-rev2',
      finished: true
    });
  });

  it('writes nothing for an exchange that was never accepted', async () => {
    const svc = service();
    const store = await freshStore(svc);
    await E.runPromise(store.getAllAgents());

    const ended = await E.runPromise(
      store.mirrorCancellation({ ...accepted(), response: undefined } as unknown as UIExchange)
    );

    expect(ended).toBe(0);
    expect(svc.getAgreements).not.toHaveBeenCalled();
    expect(svc.updateCommitment).not.toHaveBeenCalled();
  });
});
