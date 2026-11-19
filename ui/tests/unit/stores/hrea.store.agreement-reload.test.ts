import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { Cause, Effect as E, Exit, Fiber, Layer } from 'effect';
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

import hreaStore, { createHreaStore } from '$lib/stores/hrea.store.svelte';
import { HreaServiceTag, type HreaService } from '$lib/services/hrea.service';
import {
  MediumsOfExchangeServiceTag,
  type MediumsOfExchangeService
} from '$lib/services/zomes/mediums-of-exchange.service';
import {
  rnoAgreementRef,
  setUnitRegistry
} from '$lib/services/mappers/agreement-commitment.mapper';
import { HreaError } from '$lib/errors';
import { storeEventBus } from '$lib/stores/storeEvents';

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
      delivery_timeframe: { Preset: 'Flexible' }
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

// Every store made here listens on the shared event bus until it is disposed, and so
// does the app's own store, made with the live service when the module loads.
const made: Array<{ dispose: () => void }> = [];
beforeAll(() => hreaStore.dispose());
afterEach(() => {
  while (made.length) made.pop()!.dispose();
  mocks.currentUser = null;
});

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
  ).then((store) => {
    made.push(store);
    return store;
  });

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

  /**
   * #380: a commitment's due date comes from the agreement's timeframe, counted from
   * acceptance, and is written with the commitment in one write.
   * **To make this go red:** drop the dates from the mapped input.
   */
  it('dates both commitments from acceptance, in one write each', async () => {
    const svc = service();
    svc.getAgreements.mockReturnValue(E.succeed([]));
    svc.getCommitments.mockReturnValue(E.succeed([]));
    svc.createCommitment.mockReturnValue(E.succeed({ id: 'c-NEW', revisionId: 'x' }));
    const store = await freshStore(svc);
    const accepted = Date.UTC(2026, 9, 1);
    const dated = {
      ...exchange(),
      agreement: { ...exchange().agreement, delivery_timeframe: { Preset: 'WithinTwoWeeks' } },
      response: { agreement: hash(1), accepted: true, note: '', created_at: accepted }
    } as unknown as UIExchange;

    await E.runPromise(store.createAgreementFromExchange(dated));

    const due = new Date(accepted + 14 * 24 * 60 * 60 * 1000).toISOString();
    const inputs = svc.createCommitment.mock.calls.map((c) => c[0]);
    expect(inputs.map((i) => i.due)).toEqual([due, due]);
  });

  /**
   * A refused commitment fails the mirror and is not written again, with or without
   * its dates: the refusal hREA returns cannot say which field it was about, and after a
   * timeout the first write may have landed.
   * **To make this go red:** retry `createCommitment` on failure.
   */
  it('writes a refused commitment once, and the mirror fails', async () => {
    const svc = service();
    svc.getAgreements.mockReturnValue(E.succeed([]));
    svc.getCommitments.mockReturnValue(E.succeed([]));
    // The shape a zome's refusal of its input takes: the input's bytes, not its field names.
    const refusal = new HreaError({
      message: 'Deserialize([130, 163, 100, 117, 101]) at rea_commitment.rs',
      cause: { name: 'ribosome_error', message: 'Deserialize([130, 163, 100, 117, 101])' }
    });
    svc.createCommitment.mockReturnValue(E.fail(refusal));
    const store = await freshStore(svc);
    const dated = {
      ...exchange(),
      agreement: { ...exchange().agreement, delivery_timeframe: { Preset: 'WithinTwoWeeks' } },
      response: { agreement: hash(1), accepted: true, note: '', created_at: Date.UTC(2026, 9, 1) }
    } as unknown as UIExchange;

    const exit = await E.runPromiseExit(store.createAgreementFromExchange(dated));

    expect(Exit.isFailure(exit)).toBe(true);
    expect(svc.createCommitment).toHaveBeenCalledTimes(1);
  });

  /**
   * hREA answers an input it cannot decode with the input's bytes, so the mirror checks
   * what it built first. **To make this go red:** call `hreaService.createCommitment`
   * without `commitmentProblem`.
   */
  it('stops a malformed Commitment before hREA, with the reason in words', async () => {
    const svc = service();
    svc.getAgreements.mockReturnValue(E.succeed([]));
    svc.getCommitments.mockReturnValue(E.succeed([]));
    const store = await freshStore(svc);
    setUnitRegistry({ hours: 'unit-hours' });
    const bad = {
      ...exchange(),
      agreement: {
        ...exchange().agreement,
        primary: { ...exchange().agreement.primary, quantity: { value: 'abc', unit: 'hours' } }
      },
      response: { agreement: hash(1), accepted: true, note: '', created_at: Date.UTC(2026, 9, 1) }
    } as unknown as UIExchange;

    const exit = await E.runPromiseExit(store.createAgreementFromExchange(bad));

    expect(Exit.isFailure(exit)).toBe(true);
    expect(JSON.stringify(exit)).toContain(
      "the Commitment's quantity NaN is not a number above zero"
    );
    // Checked before the Agreement too: one written ahead of a refused Commitment would
    // stay in hREA with nothing in it, and the repair would add another each session.
    expect(svc.createAgreement).not.toHaveBeenCalled();
    expect(svc.createCommitment).not.toHaveBeenCalled();
  });

  it('an acceptance whose hREA read fails is not mirrored, so no duplicate Agreement can be minted', async () => {
    const svc = service();
    svc.getAgreements.mockReturnValue(E.fail(new HreaError({ message: 'conductor away' })));
    const store = await freshStore(svc);

    const exit = await E.runPromiseExit(store.createAgreementFromExchange(exchange()));

    expect(Exit.isFailure(exit)).toBe(true);
    expect(svc.createAgreement).not.toHaveBeenCalled();
    expect(svc.createCommitment).not.toHaveBeenCalled();
    expect(store.agreementMappings.has(ref)).toBe(false);
  });

  it('a completion whose hREA read fails still records its event, without the Agreement', async () => {
    const svc = service();
    svc.getCommitments.mockReturnValue(E.fail(new HreaError({ message: 'conductor away' })));
    const store = await freshStore(svc);
    await E.runPromise(store.getAllAgents());
    await E.runPromise(store.getAllResourceSpecifications());

    const event = await E.runPromise(store.recordCompletionEvent(exchange()));

    expect(event).not.toBeNull();
    expect(svc.createEconomicEvent).toHaveBeenCalledTimes(1);
    expect(svc.createEconomicEvent.mock.calls[0][0].realizationOf).toBeUndefined();
    expect(svc.createEconomicEvent.mock.calls[0][0].fulfills).toBeUndefined();
    expect(svc.updateCommitment).not.toHaveBeenCalled();
    expect(store.agreementMappings.has(ref)).toBe(false);
  });

  it("the receiver's completion finishes the reciprocal Commitment, not the primary", async () => {
    mocks.currentUser = { original_action_hash: RECEIVER };
    const svc = service();
    const store = await freshStore(svc);
    await E.runPromise(store.getAllAgents());
    await E.runPromise(store.getAllResourceSpecifications());
    const ex = {
      ...exchange(),
      provider_done: null,
      receiver_done: { created_at: 1_700_000_200 }
    } as unknown as UIExchange;

    await E.runPromise(store.recordCompletionEvent(ex));

    expect(svc.createEconomicEvent.mock.calls[0][0].realizationOf).toBe('agr-1');
    expect(svc.createEconomicEvent.mock.calls[0][0].fulfills).toEqual(['c-recip']);
    expect(svc.updateCommitment).toHaveBeenCalledWith({
      revisionId: 'c-recip-rev',
      finished: true
    });
  });

  it('reads hREA once per R&O agreement, then answers from the cached mapping', async () => {
    const svc = service();
    const store = await freshStore(svc);
    await E.runPromise(store.getAllAgents());
    await E.runPromise(store.getAllResourceSpecifications());

    await E.runPromise(store.createAgreementFromExchange(exchange()));
    await E.runPromise(store.recordCompletionEvent(exchange()));

    expect(svc.getAgreements).toHaveBeenCalledTimes(1);
    expect(svc.getCommitments).toHaveBeenCalledTimes(1);
  });

  it("a completion whose side's Commitment is not in hREA fulfills nothing", async () => {
    mocks.currentUser = { original_action_hash: RECEIVER };
    const svc = service();
    // hREA holds the Agreement and its primary Commitment, but no reciprocal one.
    svc.getCommitments.mockReturnValue(
      E.succeed([
        {
          id: 'c-prim',
          revisionId: 'c-prim-rev',
          action: 'work',
          provider: 'agent-p',
          receiver: 'agent-r',
          clauseOf: 'agr-1'
        }
      ])
    );
    const store = await freshStore(svc);
    await E.runPromise(store.getAllAgents());
    await E.runPromise(store.getAllResourceSpecifications());
    const ex = {
      ...exchange(),
      provider_done: null,
      receiver_done: { created_at: 1_700_000_200 }
    } as unknown as UIExchange;

    await E.runPromise(store.recordCompletionEvent(ex));

    expect(svc.createEconomicEvent.mock.calls[0][0].realizationOf).toBe('agr-1');
    expect(svc.createEconomicEvent.mock.calls[0][0].fulfills).toBeUndefined();
    expect(svc.updateCommitment).not.toHaveBeenCalled();
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

describe('repairing an accepted exchange whose mirror never landed', () => {
  const COUNTERPARTY = hash(4);
  // Accepted and not yet marked done by either side.
  const accepted = (extra: Partial<UIExchange> = {}) =>
    ({
      ...exchange(),
      status: 'Accepted',
      provider_done: undefined,
      response: { agreement: hash(1), accepted: true, note: '', created_at: Date.UTC(2026, 9, 1) },
      ...extra
    }) as unknown as UIExchange;
  const loaded = (exchanges: UIExchange[]) => storeEventBus.emit('exchanges:loaded', { exchanges });
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  /**
   * **To make this go red:** stop the hREA store listening for `exchanges:loaded`.
   */
  it('mirrors one this member accepted that hREA does not hold, and only once a session', async () => {
    mocks.currentUser = { original_action_hash: COUNTERPARTY };
    const svc = service();
    svc.getAgreements.mockReturnValue(E.succeed([]));
    svc.getCommitments.mockReturnValue(E.succeed([]));
    await freshStore(svc);

    loaded([accepted()]);
    await vi.waitFor(() => expect(svc.createCommitment).toHaveBeenCalledTimes(2));
    expect(svc.createAgreement).toHaveBeenCalledTimes(1);

    loaded([accepted()]);
    await settle();
    expect(svc.createAgreement).toHaveBeenCalledTimes(1);
  });

  /**
   * A failed repair waits for the next session, so the nav bar's polling does not ask
   * hREA about it on every reload. **To make this go red:** drop `repairTried`.
   */
  it('tries a failing one once a session, not on every reload', async () => {
    mocks.currentUser = { original_action_hash: COUNTERPARTY };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const svc = service();
    svc.getAgreements.mockReturnValue(E.succeed([]));
    svc.getCommitments.mockReturnValue(E.succeed([]));
    svc.createAgreement.mockReturnValue(E.fail(new HreaError({ message: 'conductor away' })));
    await freshStore(svc);

    loaded([accepted()]);
    await vi.waitFor(() => expect(svc.createAgreement).toHaveBeenCalledTimes(1));
    loaded([accepted()]);
    await settle();
    expect(svc.createAgreement).toHaveBeenCalledTimes(1);
  });

  it('leaves alone one it did not accept, without asking hREA', async () => {
    mocks.currentUser = { original_action_hash: PROVIDER };
    const svc = service();
    await freshStore(svc);

    loaded([accepted()]);
    await settle();
    expect(svc.getAgreements).not.toHaveBeenCalled();
    expect(svc.createAgreement).not.toHaveBeenCalled();
  });

  it('writes nothing for one hREA already holds', async () => {
    mocks.currentUser = { original_action_hash: COUNTERPARTY };
    const svc = service(); // hREA holds agr-1 with both Commitments for this exchange
    await freshStore(svc);

    loaded([accepted()]);
    await vi.waitFor(() => expect(svc.getAgreements).toHaveBeenCalled());
    await settle();
    expect(svc.createAgreement).not.toHaveBeenCalled();
    expect(svc.createCommitment).not.toHaveBeenCalled();
  });

  /**
   * Accepting from Messages fires the live mirror, then reloads the member's exchanges,
   * which starts the repair on the same exchange a moment later. hREA keeps every record,
   * so a second Agreement would be permanent. **To make this go red:** drop `mirroring`.
   */
  it('does not write a second Agreement when the repair starts while the live mirror runs', async () => {
    mocks.currentUser = { original_action_hash: COUNTERPARTY };
    const svc = service();
    svc.getAgreements.mockReturnValue(E.succeed([]));
    svc.getCommitments.mockReturnValue(E.succeed([]));
    // Slow enough that the repair's read comes before the live mirror's writes.
    svc.createAgreement.mockReturnValue(
      E.delay(E.succeed({ id: 'agr-NEW', revisionId: 'x' }), '20 millis')
    );
    await freshStore(svc);

    storeEventBus.emit('exchange:accepted', { exchange: accepted() });
    loaded([accepted()]);
    await vi.waitFor(() => expect(svc.createCommitment).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(svc.createAgreement).toHaveBeenCalledTimes(1);
  });

  /**
   * A repair after a cancellation writes the Commitments open, so it finishes them as the
   * cancellation would have. **To make this go red:** drop the `mirrorCancellation` tap.
   */
  it('finishes the Commitments of one cancelled since it was accepted', async () => {
    mocks.currentUser = { original_action_hash: COUNTERPARTY };
    const svc = service();
    svc.getAgreements
      .mockReturnValueOnce(E.succeed([]))
      .mockReturnValue(E.succeed([{ id: 'agr-NEW', revisionId: 'x', note: ref }]));
    // Empty for the repair's read; then the two it wrote, for the cancellation's.
    svc.getCommitments.mockReturnValueOnce(E.succeed([])).mockReturnValue(
      E.succeed([
        { id: 'c-NEW', revisionId: 'x', clauseOf: 'agr-NEW', finished: false },
        { id: 'c-NEW2', revisionId: 'y', clauseOf: 'agr-NEW', finished: false }
      ])
    );
    await freshStore(svc);

    loaded([
      accepted({
        cancellation: { reason: 'moved away', created_at: 1 }
      } as unknown as Partial<UIExchange>)
    ]);
    await vi.waitFor(() => expect(svc.updateCommitment).toHaveBeenCalledTimes(2));
    expect(svc.updateCommitment.mock.calls.map(([u]) => u)).toEqual([
      { revisionId: 'x', finished: true },
      { revisionId: 'y', finished: true }
    ]);
  });

  /**
   * Exchanges mirrored long ago cost one read of hREA's lists for the whole pass, and
   * nothing more: not two full reads each, every session. **To make this go red:** call
   * `createAgreementFromExchange` for every exchange instead of sorting them out first.
   */
  it('reads hREA once for the pass and writes nothing for what it holds', async () => {
    mocks.currentUser = { original_action_hash: COUNTERPARTY };
    const second = accepted({ agreement_hash: hash(11) } as Partial<UIExchange>);
    const svc = service(); // hREA holds agr-1 with both Commitments for the first
    svc.getAgreements.mockReturnValue(
      E.succeed([
        { id: 'agr-1', revisionId: 'r1', note: ref },
        { id: 'agr-2', revisionId: 'r2', note: rnoAgreementRef(second) }
      ])
    );
    svc.getCommitments.mockReturnValue(
      E.succeed([
        {
          id: 'c-prim',
          revisionId: 'a',
          action: 'work',
          provider: 'agent-p',
          receiver: 'agent-r',
          clauseOf: 'agr-1'
        },
        {
          id: 'c-recip',
          revisionId: 'b',
          action: 'transfer',
          provider: 'agent-r',
          receiver: 'agent-p',
          clauseOf: 'agr-1'
        },
        {
          id: 'c2-prim',
          revisionId: 'c',
          action: 'work',
          provider: 'agent-p',
          receiver: 'agent-r',
          clauseOf: 'agr-2'
        },
        {
          id: 'c2-recip',
          revisionId: 'd',
          action: 'transfer',
          provider: 'agent-r',
          receiver: 'agent-p',
          clauseOf: 'agr-2'
        }
      ])
    );
    await freshStore(svc);

    loaded([accepted(), second]);
    await vi.waitFor(() => expect(svc.getAgreements).toHaveBeenCalled());
    await settle();
    expect(svc.getAgreements).toHaveBeenCalledTimes(1);
    expect(svc.getCommitments).toHaveBeenCalledTimes(1);
    expect(svc.getLatestCommitments).not.toHaveBeenCalled();
    expect(svc.createAgreement).not.toHaveBeenCalled();
  });

  /**
   * The pass's read can land while the live mirror has written its Agreement and primary
   * Commitment but not the reciprocal. The live mirror's own ids are the ones to keep.
   * **To make this go red:** cache what the read finds when the store already has the
   * live mirror's ids.
   */
  it("keeps the live mirror's ids, not a half-written read of hREA", async () => {
    mocks.currentUser = { original_action_hash: COUNTERPARTY };
    const svc = service();
    // The live mirror's own read: nothing yet. The pass's read: Agreement and primary only.
    svc.getAgreements
      .mockReturnValueOnce(E.succeed([]))
      // Taken while the reciprocal is being written, and answered after the live
      // mirror has finished: the case where a stale read would overwrite its ids.
      .mockReturnValue(
        E.delay(E.succeed([{ id: 'agr-NEW', revisionId: 'x', note: ref }]), '40 millis')
      );
    svc.getCommitments.mockReturnValueOnce(E.succeed([])).mockReturnValue(
      E.succeed([
        {
          id: 'c-NEW',
          revisionId: 'x',
          action: 'work',
          provider: 'agent-p',
          receiver: 'agent-r',
          clauseOf: 'agr-NEW'
        }
      ])
    );
    svc.createAgreement.mockReturnValue(E.succeed({ id: 'agr-NEW', revisionId: 'x' }));
    svc.createCommitment
      .mockReturnValueOnce(E.succeed({ id: 'c-NEW', revisionId: 'x' }))
      .mockReturnValueOnce(E.delay(E.succeed({ id: 'c-RECIP', revisionId: 'y' }), '30 millis'));
    const store = await freshStore(svc);
    await E.runPromise(store.getAllAgents());
    await E.runPromise(store.getAllResourceSpecifications());

    const live = E.runPromise(store.createAgreementFromExchange(accepted()));
    await new Promise((resolve) => setTimeout(resolve, 10));
    loaded([accepted()]);
    await live;
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(store.agreementMappings.get(ref)?.reciprocalCommitmentId).toBe('c-RECIP');
  });

  /**
   * A cancel can come while the mirror is still writing; it waits, then closes what the
   * mirror wrote. **To make this go red:** drop the wait in `mirrorCancellation`.
   */
  it('a cancel during the mirror waits for it, then closes its Commitments', async () => {
    mocks.currentUser = { original_action_hash: COUNTERPARTY };
    const svc = service();
    svc.getAgreements.mockReturnValue(E.succeed([]));
    svc.getCommitments.mockReturnValueOnce(E.succeed([])).mockReturnValue(
      E.succeed([
        { id: 'c-NEW', revisionId: 'x', clauseOf: 'agr-NEW', finished: false },
        { id: 'c-NEW2', revisionId: 'y', clauseOf: 'agr-NEW', finished: false }
      ])
    );
    svc.createAgreement.mockReturnValue(
      E.delay(E.succeed({ id: 'agr-NEW', revisionId: 'x' }), '20 millis')
    );
    const store = await freshStore(svc);

    const mirror = E.runPromise(store.createAgreementFromExchange(accepted()));
    const closed = await E.runPromise(store.mirrorCancellation(accepted()));
    await mirror;
    expect(closed).toBe(2);
  });

  /**
   * **To make this go red:** answer the waiter with `E.exit` then `E.tap`, which does not
   * run when the first fiber is interrupted.
   */
  it('a caller waiting on an interrupted mirror is answered, not left waiting', async () => {
    mocks.currentUser = { original_action_hash: COUNTERPARTY };
    const svc = service();
    svc.getAgreements.mockReturnValue(E.succeed([]));
    svc.getCommitments.mockReturnValue(E.succeed([]));
    svc.createAgreement.mockReturnValue(E.never);
    const store = await freshStore(svc);

    const first = E.runFork(store.createAgreementFromExchange(accepted()));
    await settle();
    const second = E.runPromiseExit(
      E.timeout(store.createAgreementFromExchange(accepted()), '200 millis')
    );
    await settle();
    await E.runPromise(Fiber.interrupt(first));
    const exit = await second;
    // Answered with the interruption, not by the timeout.
    expect(Exit.isInterrupted(exit)).toBe(true);
  });

  /**
   * While the live mirror is still writing, the pass leaves that exchange to it rather
   * than remembering the half it can read. **To make this go red:** drop
   * `mirroring.has(ref)` from the pass.
   */
  it('remembers nothing for an exchange whose mirror is still writing', async () => {
    mocks.currentUser = { original_action_hash: COUNTERPARTY };
    const svc = service();
    svc.getAgreements
      .mockReturnValueOnce(E.succeed([]))
      .mockReturnValue(E.succeed([{ id: 'agr-NEW', revisionId: 'x', note: ref }]));
    svc.getCommitments.mockReturnValueOnce(E.succeed([])).mockReturnValue(
      E.succeed([
        {
          id: 'c-NEW',
          revisionId: 'x',
          action: 'work',
          provider: 'agent-p',
          receiver: 'agent-r',
          clauseOf: 'agr-NEW'
        }
      ])
    );
    svc.createCommitment
      .mockReturnValueOnce(E.succeed({ id: 'c-NEW', revisionId: 'x' }))
      .mockReturnValueOnce(E.delay(E.succeed({ id: 'c-RECIP', revisionId: 'y' }), '60 millis'));
    const store = await freshStore(svc);
    await E.runPromise(store.getAllAgents());
    await E.runPromise(store.getAllResourceSpecifications());

    const live = E.runPromise(store.createAgreementFromExchange(accepted()));
    await new Promise((resolve) => setTimeout(resolve, 10));
    loaded([accepted()]);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(store.agreementMappings.get(ref)).toBeUndefined();
    await live;
    expect(store.agreementMappings.get(ref)?.reciprocalCommitmentId).toBe('c-RECIP');
  });

  /**
   * **To make this go red:** wait with `E.ignore(Deferred.await(...))`, which passes the
   * mirror's interruption on, so the cancellation stops before it closes anything.
   */
  it('a cancel waiting on an interrupted mirror still goes on to close', async () => {
    mocks.currentUser = { original_action_hash: COUNTERPARTY };
    const svc = service();
    svc.getAgreements.mockReturnValue(E.succeed([]));
    svc.getCommitments.mockReturnValue(E.succeed([]));
    svc.createAgreement.mockReturnValue(E.never);
    const store = await freshStore(svc);

    const mirror = E.runFork(store.createAgreementFromExchange(accepted()));
    await settle();
    const cancel = E.runPromiseExit(store.mirrorCancellation(accepted()));
    await settle();
    const readsBefore = svc.getAgreements.mock.calls.length;
    await E.runPromise(Fiber.interrupt(mirror));
    const exit = await cancel;
    expect(Exit.isSuccess(exit)).toBe(true);
    // It went on to look for the Agreement to close, after the mirror ended.
    expect(svc.getAgreements.mock.calls.length).toBeGreaterThan(readsBefore);
  });

  /**
   * **To make this go red:** build the mirror outside `E.suspend`, so a throw while it
   * is built leaves the lock set and its answer never given.
   */
  it('a mirror that throws while it is built still answers the next caller', async () => {
    mocks.currentUser = { original_action_hash: COUNTERPARTY };
    const svc = service();
    const store = await freshStore(svc);
    // No provider: reading the parties throws, after the lock is taken.
    const broken = accepted();
    (broken.agreement as { provider: unknown }).provider = undefined;

    const first = await E.runPromiseExit(store.createAgreementFromExchange(broken));
    const second = await E.runPromiseExit(
      E.timeout(store.createAgreementFromExchange(broken), '200 millis')
    );
    expect(Exit.isFailure(first)).toBe(true);
    // Answered by its own attempt (the same throw), not left waiting until the timeout.
    expect(Exit.isFailure(second) && Cause.isDie(second.cause)).toBe(true);
  });
});
