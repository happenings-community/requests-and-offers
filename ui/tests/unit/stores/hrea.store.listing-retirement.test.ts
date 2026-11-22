import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Effect as E, Layer } from 'effect';
import { encode } from '@msgpack/msgpack';
import type { UIOffer } from '$lib/types/ui';

/**
 * Retiring a listing's proposals in hREA, against a stand-in hREA (from #564, for #580).
 *
 * The store's listing-to-proposal map is in memory and starts empty on each launch, so an
 * edit or a delete finds the listing's proposals by the hash line in their note's mapping
 * block. An edit retires the old ones before it writes the new one, writes nothing new if
 * they could not be retired, and runs one listing at a time; each proposal goes before its
 * intents. hREA keeps every record, so a second proposal could not be taken back.
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
import {
  HolochainClientServiceTag,
  type HolochainClientService
} from '$lib/services/HolochainClientService.svelte';
import { runEffect } from '$lib/utils/effect';

const bytes = (...n: number[]) => new Uint8Array(n);
const ME = bytes(1, 1);
const SERVICE_TYPE = bytes(3, 3);
const MEDIUM = bytes(4, 4);
const OFFER = bytes(7, 8, 9);
const MEDIUM_2 = bytes(5, 5);

const noteFor = (kind: 'request' | 'offer', hash: string, description = 'x') =>
  `Description: ${description}\nOffered by: Ada\n\n--- hREA Mapping ---\nOriginal ${kind} hash: ${hash}\nCreated: 2026-11-20`;
const held = (id: string, kind: 'request' | 'offer', hash: string, created = '2026-11-20') => ({
  id,
  name: 'Offer: x',
  note: noteFor(kind, hash),
  created,
  revisionId: `${id}-rev`,
  intentIds: [`${id}-i1`, `${id}-i2`]
});

type Medium = { code: string; name: string; exchange_type: 'base' | 'currency' };

/**
 * A revision's hash, and a stand-in for the zome read that walks it back to the listing's
 * original: My Listings hands the store a revision's hash, the listing's own page the
 * original's (see `chainRoot`).
 */
const REVISION = bytes(7, 8, 10);
const zomeReads = {
  callZome: vi.fn(async (_zome: string, _fn: string, hash: Uint8Array) =>
    hash.toString() === REVISION.toString()
      ? {
          signed_action: {
            hashed: { content: { data: { type: 'Update', original_action_address: OFFER } } }
          }
        }
      : { signed_action: { hashed: { content: { data: { type: 'Create' } } } } }
  )
};

const make = async (
  opts: {
    proposals?: unknown[] | Error;
    medium?: Medium | null;
    medium2?: Medium;
    /** Read listing records through the stand-in zome, so a revision finds its root. */
    chains?: boolean;
  } = {}
) => {
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
        { id: 'spec-medium', name: 'Medium', note: `ref:mediumOfExchange:${MEDIUM}` },
        { id: 'spec-medium-2', name: 'Medium 2', note: `ref:mediumOfExchange:${MEDIUM_2}` }
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
    getMediumOfExchange: vi.fn((h: Uint8Array) =>
      E.succeed(
        h.toString() === MEDIUM_2.toString() && opts.medium2
          ? { entry: { Present: { entry: encode(opts.medium2) } } }
          : record
      )
    )
  };
  const built = createHreaStore().pipe(
    E.provide(Layer.succeed(HreaServiceTag, service as unknown as HreaService)),
    E.provide(
      Layer.succeed(MediumsOfExchangeServiceTag, mediums as unknown as MediumsOfExchangeService)
    )
  );
  const store = await runEffect(
    opts.chains
      ? built.pipe(
          E.provide(
            Layer.succeed(HolochainClientServiceTag, zomeReads as unknown as HolochainClientService)
          )
        )
      : built
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

describe("removing a listing's proposals, found by their note", () => {
  it("finds a deleted listing's proposal with no mapping in memory", async () => {
    const { store, service } = await make({
      proposals: [held('p1', 'offer', '7,8,9'), held('px', 'offer', '1,1')]
    });
    expect(await runEffect(store.deleteProposalForOffer('7,8,9'))).toBe(true);
    expect(service.deleteIntent).toHaveBeenCalledWith({ revisionId: 'p1-i1' });
    expect(service.deleteIntent).toHaveBeenCalledWith({ revisionId: 'p1-i2' });
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

  /**
   * A delete still retires the proposal this session mapped when hREA cannot be read, but
   * says not retired, since what else hREA holds is unknown. **To make this go red:** count
   * the read failure as nothing.
   */
  it('retires the mapped proposal, and says not retired, when hREA cannot be read', async () => {
    const { store, service } = await make({ proposals: new Error('conductor away') });
    await runEffect(store.getAllAgents());
    await runEffect(store.getAllResourceSpecifications());
    await runEffect(store.createProposalFromOffer(offer()));
    expect(await runEffect(store.deleteProposalForOffer(OFFER.toString()))).toBe(false);
    expect(service.deleteProposal).toHaveBeenCalledTimes(1);
    expect(store.offerProposalMappings.has(OFFER.toString()), 'the map forgets it').toBe(false);
  });

  it('says not removed, and deletes nothing it does not know, when hREA cannot be read', async () => {
    const { store, service } = await make({ proposals: new Error('conductor away') });
    expect(await runEffect(store.deleteProposalForOffer('7,8,9'))).toBe(false);
    expect(service.deleteProposal).not.toHaveBeenCalled();
  });
});

describe("replacing an edited listing's proposal", () => {
  /**
   * The headline of #580's first finding: after a reload an edit wrote a second proposal
   * beside the first. **To make this go red:** retire only a proposal the map names, as
   * dev did.
   */
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

  /**
   * An edit that cannot see what hREA holds retires nothing either, so the listing keeps
   * the proposal it has: retiring the mapped one and writing nothing would leave it none.
   * **To make this go red:** let an edit retire from the map when hREA cannot be read.
   */
  it('writes nothing new, and retires nothing, when hREA could not be read', async () => {
    const { store, service } = await make({ proposals: new Error('conductor away') });
    await runEffect(store.getAllAgents());
    await runEffect(store.getAllResourceSpecifications());
    await runEffect(store.createProposalFromOffer(offer()));
    expect(service.createProposal).toHaveBeenCalledTimes(1);
    expect(await runEffect(store.handleOfferUpdatedEffect(offer()))).toBeNull();
    expect(service.deleteProposal).not.toHaveBeenCalled();
    expect(service.createProposal).toHaveBeenCalledTimes(1);
  });

  it('writes nothing new when the old proposal would not delete', async () => {
    const { store, service } = await make({ proposals: [held('p1', 'offer', '7,8,9')] });
    await runEffect(store.getAllAgents());
    await runEffect(store.getAllResourceSpecifications());
    service.deleteProposal.mockImplementationOnce(() =>
      E.fail(new HreaError({ message: 'timed out' }))
    );
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

/**
 * The same listing reaches the store under its original hash from its own page and under
 * a revision's hash from My Listings (#580 review). An edit under one must not leave the
 * map naming a proposal the other already retired: deleting it again fails, and an edit
 * that then writes nothing would leave the listing with no proposal at all.
 */
describe('a listing edited under more than one of its hashes', () => {
  const ready = async () => {
    const proposals: ReturnType<typeof held>[] = [];
    const { store, service } = await make({ chains: true });
    liveHrea(service, proposals);
    await runEffect(store.getAllAgents());
    await runEffect(store.getAllResourceSpecifications());
    return { store, service, proposals };
  };

  /** **To make this go red:** clear only the map entry under the hash the caller named, and do not take a stale one as gone. */
  it('created, edited from My Listings, then edited from its page: one proposal, the latest', async () => {
    const { store, proposals } = await ready();
    await runEffect(store.createProposalFromOffer(offer()));
    await runEffect(
      store.handleOfferUpdatedEffect(
        offer({ original_action_hash: REVISION, title: 'Bike repair, v2' })
      )
    );
    await runEffect(store.handleOfferUpdatedEffect(offer({ title: 'Bike repair, v3' })));
    expect(proposals.map((p) => p.name)).toEqual(['Offer: Bike repair, v3']);
  });

  /** **To make this go red:** count a failed delete of a proposal known only from the map as a failure. */
  it('takes a mapped proposal hREA no longer lists as gone, and still writes the new one', async () => {
    const { store, service, proposals } = await ready();
    await runEffect(store.createProposalFromOffer(offer()));
    // Retired elsewhere (another session, another hash): hREA lists it no more.
    proposals.splice(0, proposals.length);
    await runEffect(store.handleOfferUpdatedEffect(offer({ title: 'Bike repair, again' })));
    expect(proposals.map((p) => p.name)).toEqual(['Offer: Bike repair, again']);
    const intentDeletes = service.deleteIntent.mock.calls.map(([i]) => i.revisionId);
    expect(intentDeletes, 'a proposal taken as gone took its intents with it').toEqual([]);
  });

  /** **To make this go red:** key the lock by the hash the caller names. */
  it('runs two quick edits under different hashes one after the other, so one proposal is left', async () => {
    const { store, proposals } = await ready();
    await Promise.all([
      runEffect(store.handleOfferUpdatedEffect(offer({ title: 'From its page' }))),
      runEffect(
        store.handleOfferUpdatedEffect(
          offer({ original_action_hash: REVISION, title: 'From My Listings' })
        )
      )
    ]);
    expect(proposals).toHaveLength(1);
  });
});
