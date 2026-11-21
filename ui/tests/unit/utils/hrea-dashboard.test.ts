import { describe, it, expect } from 'vitest';
import {
  countVfTypes,
  expectedFromExchanges,
  buildLedger,
  buildExchangeFlow,
  KNOWN_MAPPING_GAPS,
  type HreaSnapshot,
  type RoInventory
} from '$lib/utils/hrea-dashboard';
import type { UIExchange } from '$lib/types/ui';
import type { ExchangeTerm } from '$lib/types/holochain';

// U14: the admin hREA dashboard is also the mapping audit. Every hREA number
// comes from the snapshot read from hREA; the R&O side is only ever compared.

const hash = (n: number) =>
  new Uint8Array([132, 41, 36, n]) as unknown as UIExchange['agreement_hash'];

const term = (over: Partial<ExchangeTerm> = {}): ExchangeTerm => ({
  direction: 'Provide',
  resource_conforms_to: 'Bike repair',
  resource_kind: 'Service',
  quantity: null,
  ...over
});

const exchange = (over: Partial<UIExchange> = {}, agreementOver = {}): UIExchange =>
  ({
    created_at: 1,
    agreement_hash: hash(9),
    status: 'Agreed',
    response: { agreement: hash(9), accepted: true, note: '', created_at: 2 },
    agreement: {
      listing: hash(1),
      listing_type: 'Offer',
      interest: hash(2),
      counterparty: hash(3),
      provider: hash(4),
      receiver: hash(5),
      primary: term(),
      reciprocal: term({
        direction: 'Receive',
        resource_conforms_to: 'CAD',
        resource_kind: 'Currency'
      }),
      medium: 'CAD',
      terms: '',
      delivery_timeframe: { Preset: 'Flexible' },
      ...agreementOver
    },
    ...over
  }) as UIExchange;

const ref = (h: UIExchange['agreement_hash']) => h.toString();

const emptySnapshot = (): HreaSnapshot => ({
  agents: [],
  specs: [],
  proposals: [],
  intents: [],
  agreements: [],
  commitments: [],
  events: []
});

const fullSnapshot = (ex: UIExchange): HreaSnapshot => ({
  agents: [
    { id: 'ag-p', name: 'Ada', note: `ref:user:${ex.agreement.provider.toString()}` },
    { id: 'ag-r', name: 'Bob', note: `ref:user:${ex.agreement.receiver.toString()}` },
    { id: 'ag-o', name: 'Repair Café', note: 'ref:organization:xyz' }
  ],
  specs: [
    { id: 'sp-s', name: 'Bike repair', note: 'ref:serviceType:abc' },
    { id: 'sp-m', name: 'CAD', note: 'ref:mediumOfExchange:def' }
  ],
  proposals: [{ id: 'pr-1', name: 'Offer: Fix your bike', intentIds: ['in-1', 'in-2'] }],
  intents: [
    { id: 'in-1', action: 'work', provider: 'ag-p', resourceSpecifiedBy: 'sp-s' },
    { id: 'in-2', action: 'transfer', receiver: 'ag-p', resourceSpecifiedBy: 'sp-m' }
  ],
  agreements: [{ id: 'agr-1', name: 'Offer: Bike repair', note: ref(ex.agreement_hash) }],
  commitments: [
    {
      id: 'c-p',
      action: 'work',
      provider: 'ag-p',
      receiver: 'ag-r',
      agreedIn: ref(ex.agreement_hash),
      clauseOf: 'agr-1'
    },
    {
      id: 'c-r',
      action: 'transfer',
      provider: 'ag-r',
      receiver: 'ag-p',
      agreedIn: ref(ex.agreement_hash),
      clauseOf: 'agr-1'
    }
  ],
  events: [
    {
      id: 'e-p',
      action: 'work',
      provider: 'ag-p',
      receiver: 'ag-r',
      agreedIn: ref(ex.agreement_hash),
      realizationOf: 'agr-1',
      fulfills: ['c-p']
    }
  ]
});

describe('countVfTypes', () => {
  it("counts each VF type from the hREA snapshot, Fulfillments as the events' fulfills links", () => {
    const ex = exchange();
    const counts = countVfTypes(fullSnapshot(ex));
    expect(counts).toEqual({
      agents: 3,
      specs: 2,
      proposals: 1,
      intents: 2,
      agreements: 1,
      commitments: 2,
      events: 1,
      fulfillments: 1
    });
  });
});

describe('expectedFromExchanges', () => {
  it('expects one agreement per accepted exchange, two commitments for a paid one, one per completed side', () => {
    const accepted = exchange({ provider_done: { created_at: 3 } });
    const gift = exchange(
      { agreement_hash: hash(10) },
      {
        reciprocal: term({ direction: 'Receive', resource_conforms_to: '', resource_kind: 'Gift' })
      }
    );
    const proposed = exchange({
      agreement_hash: hash(11),
      status: 'Proposed',
      response: undefined
    });
    const declined = exchange({
      agreement_hash: hash(12),
      status: 'Declined',
      response: { agreement: hash(12), accepted: false, note: '', created_at: 2 }
    });
    const tbd = exchange({ agreement_hash: hash(13) }, { primary: term({ resource_kind: 'Tbd' }) });
    expect(expectedFromExchanges([accepted, gift, proposed, declined, tbd])).toEqual({
      agreements: 2,
      commitments: 3,
      events: 1
    });
  });

  it('does not expect a receiver event for a gift', () => {
    const gift = exchange(
      { receiver_done: { created_at: 4 } },
      {
        reciprocal: term({ direction: 'Receive', resource_conforms_to: '', resource_kind: 'Gift' })
      }
    );
    expect(expectedFromExchanges([gift]).events).toBe(0);
  });
});

describe('buildLedger', () => {
  const inventory = (ex: UIExchange[]): RoInventory => ({
    users: 2,
    organizations: 1,
    serviceTypes: 1,
    mediums: 1,
    requests: 0,
    offers: 1,
    exchanges: ex
  });

  it('puts the R&O count beside the hREA count on every row and flags only the rows that differ', () => {
    const ex = exchange({ provider_done: { created_at: 3 } });
    const rows = buildLedger(inventory([ex]), fullSnapshot(ex));
    const byRo = Object.fromEntries(rows.map((r) => [r.ro, r]));
    expect(byRo['Users'].roCount).toBe(2);
    expect(byRo['Users'].hreaCount).toBe(2);
    expect(byRo['Organizations'].hreaCount).toBe(1);
    expect(byRo['Offers'].hreaCount).toBe(1);
    expect(byRo['Accepted exchanges'].hreaCount).toBe(1);
    expect(byRo['Commitments'].hreaCount).toBe(2);
    expect(byRo['Completions'].hreaCount).toBe(1);
    expect(rows.every((r) => r.match)).toBe(true);
  });

  it('flags a mismatch when hREA is missing what R&O has', () => {
    const ex = exchange({ provider_done: { created_at: 3 } });
    const snap = { ...fullSnapshot(ex), agreements: [], commitments: [], events: [] };
    const rows = buildLedger(inventory([ex]), snap);
    const mismatched = rows.filter((r) => !r.match).map((r) => r.ro);
    expect(mismatched).toEqual(['Accepted exchanges', 'Commitments', 'Completions']);
  });

  it('says on the exchange rows that exchanges of deleted listings are not counted on the R&O side', () => {
    const ex = exchange();
    const rows = buildLedger(inventory([ex]), fullSnapshot(ex));
    for (const r of rows.filter((x) =>
      ['Accepted exchanges', 'Commitments', 'Completions'].includes(x.ro)
    )) {
      expect(r.caveat).toMatch(/deleted listing/);
    }
    expect(rows.find((r) => r.ro === 'Users')!.caveat).toBeUndefined();
  });

  it('never derives an hREA count from R&O', () => {
    const ex = exchange();
    const rows = buildLedger(inventory([ex]), emptySnapshot());
    expect(rows.every((r) => r.hreaCount === 0)).toBe(true);
  });
});

describe('buildExchangeFlow', () => {
  const ctx = { listingTitle: 'Fix your bike', providerName: 'Ada', receiverName: 'Bob' };

  it('marks every node present when the mirror is complete for the stage', () => {
    const ex = exchange({ provider_done: { created_at: 3 } });
    const nodes = buildExchangeFlow(ex, ctx, fullSnapshot(ex));
    const state = Object.fromEntries(nodes.map((n) => [n.id, n.state]));
    expect(state).toEqual({
      agentA: 'present',
      agentB: 'present',
      proposal: 'present',
      intentP: 'present',
      intentR: 'present',
      specS: 'present',
      specM: 'present',
      agreement: 'present',
      commitP: 'present',
      commitR: 'present',
      eventP: 'present',
      eventR: 'not-yet'
    });
  });

  describe("a Commitment's progress, read from its latest revision", () => {
    const progressOf = (ex: UIExchange, snap: HreaSnapshot) =>
      Object.fromEntries(
        buildExchangeFlow(ex, ctx, snap)
          .filter((n) => n.kind === 'commitment')
          .map((n) => [n.id, { progress: n.progress, behind: !!n.behind, fields: n.fields }])
      );
    const withFinished = (ex: UIExchange, p?: boolean, r?: boolean): HreaSnapshot => {
      const snap = fullSnapshot(ex);
      snap.commitments = snap.commitments.map((c) =>
        c.id === 'c-p' ? { ...c, finished: p } : { ...c, finished: r }
      );
      return snap;
    };

    it('marks each Commitment finished or open, from its latest revision', () => {
      const ex = exchange({ provider_done: { created_at: 3 } });
      const got = progressOf(ex, withFinished(ex, true, false));
      expect(got.commitP.progress).toBe('finished');
      expect(got.commitP.behind, 'finished, and its side done: not behind').toBe(false);
      expect(got.commitR.progress).toBe('open');
      expect(got.commitR.behind, 'open, but its side is not done').toBe(false);
      expect(got.commitP.fields).toContainEqual(['hREA state', 'finished']);
      expect(got.commitP.fields).toContainEqual(['R&O state', 'this side done']);
      expect(got.commitR.fields).toContainEqual(['R&O state', 'under way']);
    });

    it('flags an open Commitment R&O says is over as behind R&O', () => {
      // The cancellation record, not the status, is what says it was cancelled after acceptance.
      const cancelled = exchange({ cancellation: { created_at: 4 } } as never);
      const got = progressOf(cancelled, withFinished(cancelled, false, false));
      expect(got.commitP).toMatchObject({ progress: 'open', behind: true });
      expect(got.commitR).toMatchObject({ progress: 'open', behind: true });
      expect(got.commitP.fields).toContainEqual(['R&O state', 'cancelled']);
      expect(got.commitP.fields.map(([k]) => k)).toContain('behind R&O');

      const done = exchange({ provider_done: { created_at: 3 } });
      expect(progressOf(done, withFinished(done, false, false)).commitP.behind).toBe(true);
    });

    it('says unread, never open, when the latest revision was not read', () => {
      const ex = exchange({ provider_done: { created_at: 3 } });
      const got = progressOf(ex, withFinished(ex, undefined, undefined));
      expect(got.commitP.progress).toBe('unknown');
      expect(got.commitP.behind, 'unread is not open, so not behind').toBe(false);
      expect(got.commitP.fields).toContainEqual(['hREA state', 'state unread']);
    });

    it('gives no progress to a Commitment hREA does not hold', () => {
      const ex = exchange();
      const got = progressOf(ex, { ...fullSnapshot(ex), commitments: [] });
      expect(got.commitP.progress).toBeUndefined();
      expect(got.commitP.fields.some(([k]) => k === 'hREA state')).toBe(false);
    });
  });

  it('marks a node missing when the stage expects it and hREA does not have it', () => {
    const ex = exchange({ provider_done: { created_at: 3 } });
    const snap = { ...fullSnapshot(ex), agreements: [], commitments: [], events: [] };
    const nodes = buildExchangeFlow(ex, ctx, snap);
    const state = Object.fromEntries(nodes.map((n) => [n.id, n.state]));
    expect(state.agreement).toBe('missing');
    expect(state.commitP).toBe('missing');
    expect(state.commitR).toBe('missing');
    expect(state.eventP).toBe('missing');
    expect(state.eventR).toBe('not-yet');
  });

  it('does not expect agreement nodes before acceptance, nor reciprocal nodes for a gift', () => {
    const proposed = exchange({ status: 'Proposed', response: undefined });
    const p = Object.fromEntries(
      buildExchangeFlow(proposed, ctx, emptySnapshot()).map((n) => [n.id, n.state])
    );
    expect(p.agreement).toBe('not-yet');
    expect(p.commitP).toBe('not-yet');
    expect(p.agentA).toBe('missing');

    const gift = exchange(
      {},
      {
        reciprocal: term({ direction: 'Receive', resource_conforms_to: '', resource_kind: 'Gift' })
      }
    );
    const g = Object.fromEntries(
      buildExchangeFlow(gift, ctx, emptySnapshot()).map((n) => [n.id, n.state])
    );
    expect(g.commitR).toBe('not-mapped');
    expect(g.specM).toBe('not-mapped');
    expect(g.eventR).toBe('not-mapped');
  });

  it('matches intents only among the ones the listing proposal publishes', () => {
    const ex = exchange();
    const snap = fullSnapshot(ex);
    // The same provider's intent on another listing, same spec, listed first.
    snap.intents = [
      { id: 'in-other', action: 'work', provider: 'ag-p', resourceSpecifiedBy: 'sp-s' },
      ...snap.intents
    ];
    const nodes = buildExchangeFlow(ex, ctx, snap);
    const intentP = nodes.find((n) => n.id === 'intentP')!;
    expect(intentP.fields).toContainEqual(['hREA id', 'in-1']);

    const orphan = { ...snap, proposals: [{ id: 'pr-1', name: 'Offer: Fix your bike' }] };
    const state = Object.fromEntries(
      buildExchangeFlow(ex, ctx, orphan).map((n) => [n.id, n.state])
    );
    expect(state.intentP).toBe('missing');
    expect(state.intentR).toBe('missing');
  });

  it('carries the hREA id of a found node in its inspector fields', () => {
    const ex = exchange();
    const agreement = buildExchangeFlow(ex, ctx, fullSnapshot(ex)).find(
      (n) => n.id === 'agreement'
    )!;
    expect(agreement.fields).toContainEqual(['hREA id', 'agr-1']);
  });
});

describe('KNOWN_MAPPING_GAPS', () => {
  it('names the gap the audit must not hide', () => {
    const text = KNOWN_MAPPING_GAPS.map((g) => `${g.title} ${g.detail}`).join(' ');
    expect(text).toMatch(/[Cc]ancel/);
    expect(text).toMatch(/[Dd]ecline/);
    expect(text).toMatch(/[Rr]eview/);
  });

  it('no longer lists Fulfillment (#439) or the agreement mapping lost on reload (#437), both mirrored on dev', () => {
    const text = KNOWN_MAPPING_GAPS.map((g) => `${g.title} ${g.detail}`).join(' ');
    expect(text).not.toMatch(/Fulfillment/);
    expect(text).not.toMatch(/agreementMappings/);
    expect(KNOWN_MAPPING_GAPS).toHaveLength(2);
  });

  it('names what the repair of a failed mirror leaves', () => {
    const text = KNOWN_MAPPING_GAPS.map((g) => `${g.title} ${g.detail}`).join(' ');
    expect(text).toMatch(/marked it done/);
    expect(text).toMatch(/not its reciprocal/);
  });
});
