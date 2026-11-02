import type { UIExchange } from '$lib/types/ui';
import type { ResourceKind } from '$lib/types/holochain';
import type {
  Agent,
  Agreement,
  Commitment,
  EconomicEvent,
  Intent,
  Proposal,
  ResourceSpecification
} from '$lib/types/hrea';
import { actionForKind, rnoAgreementRef } from '$lib/services/mappers/agreement-commitment.mapper';

/**
 * The admin hREA dashboard doubles as the mapping audit. Every hREA number
 * comes from a snapshot read from hREA itself; R&O numbers are only ever put
 * beside them. Nothing here derives an hREA count from an R&O one.
 */

export type HreaSnapshot = {
  agents: Agent[];
  specs: ResourceSpecification[];
  proposals: Proposal[];
  intents: Intent[];
  agreements: Agreement[];
  commitments: Commitment[];
  events: EconomicEvent[];
};

/** Fulfillment is null: R&O does not mirror it (see KNOWN_MAPPING_GAPS). */
export type VfCounts = {
  agents: number;
  specs: number;
  proposals: number;
  intents: number;
  agreements: number;
  commitments: number;
  events: number;
  fulfillments: null;
};

export function countVfTypes(s: HreaSnapshot): VfCounts {
  return {
    agents: s.agents.length,
    specs: s.specs.length,
    proposals: s.proposals.length,
    intents: s.intents.length,
    agreements: s.agreements.length,
    commitments: s.commitments.length,
    events: s.events.length,
    fulfillments: null
  };
}

const isAccepted = (ex: UIExchange) => ex.response?.accepted === true;
const isMapped = (kind: ResourceKind) => actionForKind(kind) !== null;
/** Same rule as mapAgreementToHrea: no reciprocal commitment for a gift or a Tbd. */
const reciprocalMapped = (ex: UIExchange) =>
  isMapped(ex.agreement.reciprocal.resource_kind) &&
  ex.agreement.reciprocal.resource_kind !== 'Gift';

/** What the mirror should hold for these exchanges, by the mapper's own rules. */
export function expectedFromExchanges(exchanges: UIExchange[]): {
  agreements: number;
  commitments: number;
  events: number;
} {
  let agreements = 0;
  let commitments = 0;
  let events = 0;
  for (const ex of exchanges) {
    if (!isAccepted(ex) || !isMapped(ex.agreement.primary.resource_kind)) continue;
    agreements++;
    commitments += reciprocalMapped(ex) ? 2 : 1;
    if (ex.provider_done) events++;
    if (ex.receiver_done && reciprocalMapped(ex)) events++;
  }
  return { agreements, commitments, events };
}

export type RoInventory = {
  users: number;
  organizations: number;
  serviceTypes: number;
  mediums: number;
  requests: number;
  offers: number;
  exchanges: UIExchange[];
};

export type LedgerRow = {
  ro: string;
  hrea: string;
  link: string;
  roCount: number;
  hreaCount: number;
  match: boolean;
};

const notePrefix = (prefix: string) => (x: { note?: string }) =>
  x.note?.startsWith(prefix) ?? false;

export function buildLedger(ro: RoInventory, s: HreaSnapshot): LedgerRow[] {
  const expected = expectedFromExchanges(ro.exchanges);
  const row = (r: Omit<LedgerRow, 'match'>): LedgerRow => ({
    ...r,
    match: r.roCount === r.hreaCount
  });
  return [
    row({
      ro: 'Users',
      hrea: 'Agent (Person)',
      link: 'note ref:user:<hash>',
      roCount: ro.users,
      hreaCount: s.agents.filter(notePrefix('ref:user:')).length
    }),
    row({
      ro: 'Organizations',
      hrea: 'Agent (Organization)',
      link: 'note ref:organization:<hash>',
      roCount: ro.organizations,
      hreaCount: s.agents.filter(notePrefix('ref:organization:')).length
    }),
    row({
      ro: 'Service types',
      hrea: 'ResourceSpecification',
      link: 'note ref:serviceType:<hash>',
      roCount: ro.serviceTypes,
      hreaCount: s.specs.filter(notePrefix('ref:serviceType:')).length
    }),
    row({
      ro: 'Mediums of exchange',
      hrea: 'ResourceSpecification',
      link: 'note ref:mediumOfExchange:<hash>',
      roCount: ro.mediums,
      hreaCount: s.specs.filter(notePrefix('ref:mediumOfExchange:')).length
    }),
    row({
      ro: 'Requests',
      hrea: 'Proposal + Intents',
      link: 'name "Request: <title>" (no ref note)',
      roCount: ro.requests,
      hreaCount: s.proposals.filter((p) => p.name.startsWith('Request: ')).length
    }),
    row({
      ro: 'Offers',
      hrea: 'Proposal + Intents',
      link: 'name "Offer: <title>" (no ref note)',
      roCount: ro.offers,
      hreaCount: s.proposals.filter((p) => p.name.startsWith('Offer: ')).length
    }),
    row({
      ro: 'Accepted exchanges',
      hrea: 'Agreement',
      link: 'note = R&O agreement hash',
      roCount: expected.agreements,
      hreaCount: s.agreements.length
    }),
    row({
      ro: 'Commitments',
      hrea: 'Commitment',
      link: 'clauseOf Agreement, agreedIn R&O hash',
      roCount: expected.commitments,
      hreaCount: s.commitments.length
    }),
    row({
      ro: 'Completions',
      hrea: 'EconomicEvent',
      link: 'realizationOf Agreement (no Fulfillment)',
      roCount: expected.events,
      hreaCount: s.events.length
    })
  ];
}

export type FlowKind =
  | 'agent'
  | 'spec'
  | 'proposal'
  | 'intent'
  | 'agreement'
  | 'commitment'
  | 'event';

/**
 * present: hREA holds it. missing: this exchange's stage expects it and hREA
 * does not hold it, so the mirror is incomplete. not-yet: the stage does not
 * call for it. not-mapped: R&O never mirrors it for this kind of term.
 */
export type FlowState = 'present' | 'missing' | 'not-yet' | 'not-mapped';

export type FlowNode = {
  id: string;
  kind: FlowKind;
  title: string;
  sub: string;
  state: FlowState;
  fields: [string, string][];
};

export type FlowContext = { listingTitle: string; providerName: string; receiverName: string };

export function buildExchangeFlow(ex: UIExchange, ctx: FlowContext, s: HreaSnapshot): FlowNode[] {
  const a = ex.agreement;
  const ref = rnoAgreementRef(ex);
  const accepted = isAccepted(ex);
  const primaryMapped = isMapped(a.primary.resource_kind);
  const recipMapped = reciprocalMapped(ex);

  const agentA = s.agents.find((g) => g.note === `ref:user:${a.provider.toString()}`);
  const agentB = s.agents.find((g) => g.note === `ref:user:${a.receiver.toString()}`);
  const proposalName = `${a.listing_type}: ${ctx.listingTitle}`;
  const proposal = s.proposals.find((p) => p.name === proposalName);
  const specS = s.specs.find((x) => x.name === a.primary.resource_conforms_to);
  const specM = s.specs.find((x) => x.name === a.medium);
  const parties = new Set([agentA?.id, agentB?.id].filter(Boolean));
  const involves = (i: Intent) => parties.has(i.provider) || parties.has(i.receiver);
  const intentP = specS
    ? s.intents.find((i) => i.resourceSpecifiedBy === specS.id && involves(i))
    : undefined;
  const intentR = specM
    ? s.intents.find((i) => i.resourceSpecifiedBy === specM.id && involves(i))
    : undefined;
  const agreement = s.agreements.find((g) => g.note === ref);
  const clauses = s.commitments.filter(
    (c) => c.agreedIn === ref || (agreement && c.clauseOf === agreement.id)
  );
  const commitP = clauses.find((c) => agentA && c.provider === agentA.id);
  const commitR = clauses.find((c) => agentB && c.provider === agentB.id);
  const realized = s.events.filter(
    (e) => e.agreedIn === ref || (agreement && e.realizationOf === agreement.id)
  );
  const eventP = realized.find((e) => agentA && e.provider === agentA.id);
  const eventR = realized.find((e) => agentB && e.provider === agentB.id);

  const found = (x: unknown, expected: boolean): FlowState =>
    x ? 'present' : expected ? 'missing' : 'not-yet';
  const stage = (x: unknown, mapped: boolean, expected: boolean): FlowState =>
    !mapped ? 'not-mapped' : found(x, expected);
  const idField = (x?: { id: string }): [string, string][] => (x ? [['hREA id', x.id]] : []);

  return [
    {
      id: 'agentA',
      kind: 'agent',
      title: ctx.providerName,
      sub: 'Agent · provider',
      state: found(agentA, true),
      fields: [...idField(agentA), ['matched by', 'note ref:user:<provider hash>']]
    },
    {
      id: 'agentB',
      kind: 'agent',
      title: ctx.receiverName,
      sub: 'Agent · receiver',
      state: found(agentB, true),
      fields: [...idField(agentB), ['matched by', 'note ref:user:<receiver hash>']]
    },
    {
      id: 'proposal',
      kind: 'proposal',
      title: 'Proposal',
      sub: proposalName,
      state: found(proposal, true),
      fields: [
        ...idField(proposal),
        ['matched by', `name "${proposalName}" (proposals carry no ref note)`]
      ]
    },
    {
      id: 'intentP',
      kind: 'intent',
      title: `Intent · ${actionForKind(a.primary.resource_kind) ?? 'none'}`,
      sub: a.primary.resource_conforms_to,
      state: stage(intentP, primaryMapped, true),
      fields: [
        ...idField(intentP),
        ['matched by', 'conforms to the service spec, involves a party']
      ]
    },
    {
      id: 'intentR',
      kind: 'intent',
      title: 'Intent · reciprocal',
      sub: a.medium,
      state: stage(intentR, recipMapped, true),
      fields: [...idField(intentR), ['matched by', 'conforms to the medium spec, involves a party']]
    },
    {
      id: 'specS',
      kind: 'spec',
      title: 'ResourceSpecification',
      sub: a.primary.resource_conforms_to,
      state: stage(specS, primaryMapped, true),
      fields: [...idField(specS), ['matched by', 'name'], ['note', specS?.note ?? '—']]
    },
    {
      id: 'specM',
      kind: 'spec',
      title: 'ResourceSpecification',
      sub: a.medium,
      state: stage(specM, recipMapped, true),
      fields: [
        ...idField(specM),
        ['matched by', 'name of the medium'],
        ['note', specM?.note ?? '—']
      ]
    },
    {
      id: 'agreement',
      kind: 'agreement',
      title: 'Agreement',
      sub: accepted ? 'accepted' : 'created on accept',
      state: stage(agreement, primaryMapped, accepted),
      fields: [...idField(agreement), ['matched by', 'note = R&O agreement hash']]
    },
    {
      id: 'commitP',
      kind: 'commitment',
      title: 'Commitment',
      sub: `provide ${a.primary.resource_conforms_to}`,
      state: stage(commitP, primaryMapped, accepted),
      fields: [...idField(commitP), ['matched by', 'agreedIn R&O hash, provider']]
    },
    {
      id: 'commitR',
      kind: 'commitment',
      title: 'Commitment',
      sub: `reciprocal in ${a.medium || '—'}`,
      state: stage(commitR, recipMapped, accepted),
      fields: [...idField(commitR), ['matched by', 'agreedIn R&O hash, provider']]
    },
    {
      id: 'eventP',
      kind: 'event',
      title: 'EconomicEvent',
      sub: 'service delivered',
      state: stage(eventP, primaryMapped, accepted && !!ex.provider_done),
      fields: [...idField(eventP), ['linked by', 'realizationOf Agreement, no Fulfillment']]
    },
    {
      id: 'eventR',
      kind: 'event',
      title: 'EconomicEvent',
      sub: 'reciprocal delivered',
      state: stage(eventR, recipMapped, accepted && !!ex.receiver_done),
      fields: [...idField(eventR), ['linked by', 'realizationOf Agreement, no Fulfillment']]
    }
  ];
}

/** Known gaps in the R&O to hREA mapping, shown on the dashboard rather than hidden. Fixing them is U15. */
export const KNOWN_MAPPING_GAPS: { title: string; detail: string; where: string }[] = [
  {
    title: 'No Fulfillment',
    detail:
      'An EconomicEvent links to the Agreement through realizationOf, never to the Commitment it satisfies through a Fulfillment, so hREA cannot tell which promise a delivery kept.',
    where: 'mapCompletionToEvent, services/mappers/agreement-commitment.mapper.ts'
  },
  {
    title: 'Agreement mapping lives in memory',
    detail:
      'agreementMappings (R&O agreement hash to hREA ids) is held in the store only. After a reload a completion cannot find its Agreement, so its event carries no realizationOf and its Commitment is not marked finished.',
    where: 'agreementMappings, stores/hrea.store.svelte.ts'
  },
  {
    title: 'Cancel, decline and review are not mirrored',
    detail:
      'A cancelled or declined exchange leaves its hREA Agreement and Commitments as they were, and a review writes nothing to hREA.',
    where: 'stores/hrea.store.svelte.ts listens to exchange:accepted and exchange:completed only'
  }
];
