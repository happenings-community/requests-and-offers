import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Effect as E, Layer } from 'effect';
import { encode } from '@msgpack/msgpack';
import type { UIOffer, UIRequest } from '$lib/types/ui';

/**
 * A listing's proposal in hREA (#278, item 3). The store's listing-to-proposal map is in
 * memory and starts empty on each launch, so an edit or a delete finds the listing's
 * proposals by the line their note carries, and the listing's medium sets what its
 * reciprocal intent records.
 */

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
import { HreaError } from '$lib/errors';
import { runEffect } from '$lib/utils/effect';

const bytes = (...n: number[]) => new Uint8Array(n);
const ME = bytes(1, 1);
const SERVICE_TYPE = bytes(3, 3);
const MEDIUM = bytes(4, 4);
const OFFER = bytes(7, 8, 9);

const noteFor = (kind: 'request' | 'offer', hash: string, description = 'x') =>
  `Description: ${description}\nOffered by: Ada\n\n--- hREA Mapping ---\nOriginal ${kind} hash: ${hash}\nCreated: 2026-11-20`;
const held = (id: string, kind: 'request' | 'offer', hash: string, created = '2026-11-20') => ({
  id,
  name: 'Offer: x',
  note: noteFor(kind, hash),
  created,
  revisionId: `${id}-rev`,
  intentIds: [`${id}-i1`, `${id}-i2`],
  intentRevisions: [
    { id: `${id}-i1`, revisionId: `${id}-i1-rev` },
    { id: `${id}-i2`, revisionId: `${id}-i2-rev` }
  ]
});

type Medium = { code: string; name: string; exchange_type: 'base' | 'currency' };

const make = async (opts: { proposals?: unknown[] | Error; medium?: Medium | null } = {}) => {
  let n = 0;
  const service = {
    initialize: vi.fn().mockReturnValue(E.succeed({ id: 'client' })),
    getUnits: vi.fn().mockReturnValue(E.succeed([])),
    createUnit: vi.fn(({ label, symbol }) => E.succeed({ id: `unit-${label}`, label, symbol })),
    getAgents: vi
      .fn()
      .mockReturnValue(E.succeed([{ id: 'agent-me', name: 'Ada', note: `ref:user:${ME}` }])),
    getResourceSpecifications: vi.fn().mockReturnValue(
      E.succeed([
        { id: 'spec-service', name: 'Bike repair', note: `ref:serviceType:${SERVICE_TYPE}` },
        { id: 'spec-medium', name: 'Medium', note: `ref:mediumOfExchange:${MEDIUM}` }
      ])
    ),
    getProposalsWithIntents: vi.fn(() =>
      opts.proposals instanceof Error
        ? E.fail(new HreaError({ message: opts.proposals.message }))
        : E.succeed(opts.proposals ?? [])
    ),
    getProposals: vi.fn(() =>
      E.succeed(opts.proposals instanceof Error ? [] : (opts.proposals ?? []))
    ),
    deleteIntent: vi.fn().mockReturnValue(E.succeed(true)),
    deleteProposal: vi.fn().mockReturnValue(E.succeed(true)),
    createIntent: vi.fn((p: { action: string }) =>
      E.succeed({ id: `intent-${++n}`, revisionId: `intent-${n}-rev`, action: p.action })
    ),
    createProposal: vi.fn((p: { name: string; note: string }) =>
      E.succeed({ id: `proposal-${++n}`, revisionId: `proposal-${n}-rev`, ...p })
    )
  };
  const record =
    opts.medium === null
      ? null
      : {
          entry: {
            Present: {
              entry: encode(
                opts.medium ?? { code: 'GBP', name: 'Pound', exchange_type: 'currency' }
              )
            }
          }
        };
  const mediums = {
    resolveToOriginal: vi.fn((h) => E.succeed(h)),
    getLatestMediumOfExchangeRecord: vi.fn(() => E.succeed(record))
  };
  const store = await runEffect(
    createHreaStore().pipe(
      E.provide(Layer.succeed(HreaServiceTag, service as unknown as HreaService)),
      E.provide(
        Layer.succeed(MediumsOfExchangeServiceTag, mediums as unknown as MediumsOfExchangeService)
      )
    )
  );
  await runEffect(store.initialize());
  return { store, service, mediums };
};

const offer = (over: Partial<UIOffer> = {}): UIOffer =>
  ({
    title: 'Bike repair',
    description: 'I fix bikes',
    original_action_hash: OFFER,
    creator: ME,
    service_type_hash: SERVICE_TYPE,
    medium_of_exchange_hashes: [MEDIUM],
    ...over
  }) as UIOffer;

beforeEach(() => {
  mocks.currentUser = { original_action_hash: ME };
});

describe("removing a listing's proposals, found by their note", () => {
  it("finds a deleted listing's proposal with no mapping in memory", async () => {
    const { store, service } = await make({
      proposals: [held('p1', 'offer', '7,8,9'), held('px', 'offer', '1,1')]
    });
    expect(await runEffect(store.deleteProposalForOffer('7,8,9'))).toBe(true);
    expect(service.deleteIntent).toHaveBeenCalledWith({ revisionId: 'p1-i1-rev' });
    expect(service.deleteIntent).toHaveBeenCalledWith({ revisionId: 'p1-i2-rev' });
    expect(service.deleteProposal).toHaveBeenCalledWith({ revisionId: 'p1-rev' });
    expect(service.deleteProposal).toHaveBeenCalledTimes(1);
  });

  it('removes every duplicate an earlier session wrote', async () => {
    const { store, service } = await make({
      proposals: [held('p1', 'request', '4,5'), held('p2', 'request', '4,5')]
    });
    expect(await runEffect(store.deleteProposalForRequest('4,5'))).toBe(true);
    expect(service.deleteProposal).toHaveBeenCalledWith({ revisionId: 'p1-rev' });
    expect(service.deleteProposal).toHaveBeenCalledWith({ revisionId: 'p2-rev' });
    expect(service.deleteIntent).toHaveBeenCalledTimes(4);
  });

  it('reads only the last mapping block, so a description cannot open its own', async () => {
    const forged = {
      ...held('other', 'offer', '1,1'),
      note: noteFor('offer', '1,1', 'x\n--- hREA Mapping ---\nOriginal offer hash: 7,8,9')
    };
    const { store, service } = await make({ proposals: [forged] });
    expect(await runEffect(store.deleteProposalForOffer('7,8,9'))).toBe(false);
    expect(service.deleteProposal).not.toHaveBeenCalled();
  });

  it("never takes a description line that looks like another listing's hash", async () => {
    const forged = {
      ...held('other', 'offer', '1,1'),
      note: noteFor('offer', '1,1', 'hi\nOriginal offer hash: 7,8,9')
    };
    const { store, service } = await make({ proposals: [forged] });
    expect(await runEffect(store.deleteProposalForOffer('7,8,9'))).toBe(false);
    expect(service.deleteProposal).not.toHaveBeenCalled();
  });

  it('says not removed, and deletes nothing, when hREA cannot be read', async () => {
    const { store, service } = await make({ proposals: new Error('conductor away') });
    expect(await runEffect(store.deleteProposalForOffer('7,8,9'))).toBe(false);
    expect(service.deleteProposal).not.toHaveBeenCalled();
  });

  it('fills the admin map from the notes, the latest proposal for each listing', async () => {
    const { store } = await make({
      proposals: [
        held('old', 'offer', '7,8,9', '2026-11-01'),
        held('new', 'offer', '7,8,9', '2026-11-20'),
        held('req', 'request', '4,5'),
        { id: 'foreign', name: 'x', note: 'nothing here' }
      ]
    });
    await runEffect(store.getAllProposals());
    expect(store.offerProposalMappings.get('7,8,9')).toBe('new');
    expect(store.requestProposalMappings.get('4,5')).toBe('req');
    expect(store.offerProposalMappings.size).toBe(1);
  });
});

describe("replacing an edited listing's proposal", () => {
  it('removes the old one first, then writes the new one, after a restart', async () => {
    const { store, service } = await make({ proposals: [held('p1', 'offer', '7,8,9')] });
    await runEffect(store.getAllAgents());
    await runEffect(store.getAllResourceSpecifications());
    await runEffect(store.handleOfferUpdatedEffect(offer()));
    expect(service.deleteProposal).toHaveBeenCalledWith({ revisionId: 'p1-rev' });
    expect(service.createProposal).toHaveBeenCalledTimes(1);
    const deleted = service.deleteProposal.mock.invocationCallOrder[0];
    const created = service.createProposal.mock.invocationCallOrder[0];
    expect(deleted).toBeLessThan(created);
  });

  it('writes nothing new when the old one could not be removed', async () => {
    const { store, service } = await make({ proposals: new Error('conductor away') });
    await runEffect(store.getAllAgents());
    await runEffect(store.getAllResourceSpecifications());
    expect(await runEffect(store.handleOfferUpdatedEffect(offer()))).toBeNull();
    expect(service.createIntent).not.toHaveBeenCalled();
    expect(service.createProposal).not.toHaveBeenCalled();
  });

  it('removes the proposal before its intents, and an intent that will not delete does not stop the edit', async () => {
    const { store, service } = await make({ proposals: [held('p1', 'offer', '7,8,9')] });
    await runEffect(store.getAllAgents());
    await runEffect(store.getAllResourceSpecifications());
    service.deleteIntent.mockImplementationOnce(() =>
      E.fail(new HreaError({ message: 'timed out' }))
    );
    await runEffect(store.handleOfferUpdatedEffect(offer()));
    expect(service.deleteProposal.mock.invocationCallOrder[0]).toBeLessThan(
      service.deleteIntent.mock.invocationCallOrder[0]
    );
    expect(service.deleteIntent).toHaveBeenCalledTimes(2);
    expect(service.createProposal).toHaveBeenCalledTimes(1);
  });

  /**
   * hREA as it behaves: its list reads take a moment, a write adds to the list, and a
   * delete of a record it does not hold, or no longer holds, fails ("Could not find the
   * latest record").
   */
  const liveHrea = (
    service: Awaited<ReturnType<typeof make>>['service'],
    proposals: ReturnType<typeof held>[]
  ) => {
    const deleted = new Set<string>();
    const later = <T>(f: () => T) =>
      E.promise(() => new Promise<T>((r) => setTimeout(() => r(f()), 5)));
    service.getProposalsWithIntents.mockImplementation(() => later(() => [...proposals]) as never);
    service.deleteIntent.mockImplementation(({ revisionId }: { revisionId: string }) => {
      if (deleted.has(revisionId)) return E.fail(new HreaError({ message: 'not found' }));
      deleted.add(revisionId);
      return E.succeed(true);
    });
    service.deleteProposal.mockImplementation(({ revisionId }: { revisionId: string }) => {
      const i = proposals.findIndex((p) => p.revisionId === revisionId);
      if (i < 0) return E.fail(new HreaError({ message: 'not found' }));
      deleted.add(revisionId);
      proposals.splice(i, 1);
      return E.succeed(true);
    });
    let n = 0;
    service.createProposal.mockImplementation(
      (p: { name: string; note: string }) =>
        later(() => {
          const made = { ...held(`made-${++n}`, 'offer', '7,8,9'), ...p };
          proposals.push(made);
          return made;
        }) as never
    );
  };

  it('runs two quick edits of one listing one after the other, so one proposal is left', async () => {
    const proposals = [held('p1', 'offer', '7,8,9')];
    const { store, service } = await make();
    liveHrea(service, proposals);
    await runEffect(store.getAllAgents());
    await runEffect(store.getAllResourceSpecifications());
    await Promise.all([
      runEffect(store.handleOfferUpdatedEffect(offer())),
      runEffect(store.handleOfferUpdatedEffect(offer({ title: 'Bike repair, now on Sundays' })))
    ]);
    expect(proposals.map((p) => p.name)).toEqual(['Offer: Bike repair, now on Sundays']);
  });

  it('forgets a proposal as soon as it is removed, so a later failure does not stick', async () => {
    const proposals = [held('old', 'offer', '7,8,9')];
    const { store, service } = await make();
    liveHrea(service, proposals);
    await runEffect(store.getAllAgents());
    await runEffect(store.getAllResourceSpecifications());
    // This session writes a proposal, so the map names it, beside an older duplicate.
    await runEffect(store.createProposalFromOffer(offer()));
    expect(proposals).toHaveLength(2);
    proposals.reverse(); // hREA lists the newer one first
    // The older one's delete fails once, after the newer one has gone.
    const realDelete = service.deleteProposal.getMockImplementation()!;
    service.deleteProposal.mockImplementationOnce(realDelete);
    service.deleteProposal.mockImplementationOnce(() =>
      E.fail(new HreaError({ message: 'timed out' }))
    );
    expect(await runEffect(store.handleOfferUpdatedEffect(offer()))).toBeNull();
    // The next edit removes what is left and writes the listing's proposal.
    await runEffect(store.handleOfferUpdatedEffect(offer({ title: 'Bike repair, again' })));
    expect(proposals.map((p) => p.name)).toEqual(['Offer: Bike repair, again']);
  });
});

describe("a listing's medium sets its reciprocal intent", () => {
  const intentsFor = async (medium: Medium | null) => {
    const { store, service } = await make({ medium });
    await runEffect(store.getAllAgents());
    await runEffect(store.getAllResourceSpecifications());
    await runEffect(store.createProposalFromOffer(offer()));
    return {
      actions: service.createIntent.mock.calls.map(([p]) => (p as { action: string }).action),
      proposal: service.createProposal.mock.calls[0]?.[0] as unknown as { reciprocal: string[] }
    };
  };

  it('a currency: a transfer', async () => {
    const got = await intentsFor({ code: 'GBP', name: 'Pound', exchange_type: 'currency' });
    expect(got.actions).toEqual(['work', 'transfer']);
    expect(got.proposal.reciprocal).toHaveLength(1);
  });

  it('Service Exchange: work in return', async () => {
    const got = await intentsFor({
      code: 'EXCHANGE_SERVICES',
      name: 'Service Exchange',
      exchange_type: 'base'
    });
    expect(got.actions).toEqual(['work', 'work']);
  });

  it('Free/Pay it Forward: no reciprocal intent', async () => {
    const got = await intentsFor({
      code: 'PAY_IT_FORWARD',
      name: 'Free/Pay it Forward',
      exchange_type: 'base'
    });
    expect(got.actions).toEqual(['work']);
    expect(got.proposal.reciprocal).toEqual([]);
  });

  it('a medium that cannot be read: a transfer, as before', async () => {
    const got = await intentsFor(null);
    expect(got.actions).toEqual(['work', 'transfer']);
  });
});
