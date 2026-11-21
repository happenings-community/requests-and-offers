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
import {
  actionForKind,
  carriesResource,
  rnoAgreementRef
} from '$lib/services/mappers/agreement-commitment.mapper';
import { exchangeState } from '$lib/utils/exchange-ui';
import { noteRefersTo } from '$lib/utils/hrea-ref';

/**
 * The admin hREA dashboard doubles as the mapping audit. Every hREA number
 * comes from a snapshot read from hREA itself; R&O numbers are only ever put
 * beside them. Nothing here derives an hREA count from an R&O one.
 */

export type HreaSnapshot = {
  agents: Agent[];
  specs: ResourceSpecification[];
  /** intentIds: the intents each proposal publishes, read from hREA. */
  proposals: Array<Proposal & { intentIds?: readonly string[] }>;
  intents: Intent[];
  agreements: Agreement[];
  commitments: Commitment[];
  events: EconomicEvent[];
};

/** Fulfillments are not entities here: hREA stores them as each event's fulfills links. */
export type VfCounts = {
  agents: number;
  specs: number;
  proposals: number;
  intents: number;
  agreements: number;
  commitments: number;
  events: number;
  fulfillments: number;
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
    fulfillments: s.events.reduce((n, e) => n + (e.fulfills?.length ?? 0), 0)
  };
}

const isAccepted = (ex: UIExchange) => ex.response?.accepted === true;
const isMapped = (kind: ResourceKind) => actionForKind(kind) !== null;

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
    // Same rule as mapAgreementToHrea: both clauses on every accepted exchange, and one
    // event for each side done, a gift's reciprocal side included.
    agreements++;
    commitments += 2;
    if (ex.provider_done) events++;
    if (ex.receiver_done) events++;
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
  /** What the R&O side of the row cannot see, when that can skew the comparison. */
  caveat?: string;
};

const notePrefix = (prefix: string) => (x: { note?: string }) =>
  x.note?.startsWith(prefix) ?? false;

/**
 * R&O has no list-all read for exchanges, so they are gathered per listing that
 * still exists. An exchange whose listing was deleted is not counted on the R&O
 * side, and hREA can then read higher without the mirror being wrong.
 */
const DELETED_LISTINGS_CAVEAT =
  'R&O side counts exchanges of existing listings only; one on a deleted listing is still in hREA but not counted here.';

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
      link: 'name "Request: <title>", one per active request, note "Original request hash"',
      roCount: ro.requests,
      hreaCount: s.proposals.filter((p) => p.name.startsWith('Request: ')).length
    }),
    row({
      ro: 'Offers',
      hrea: 'Proposal + Intents',
      link: 'name "Offer: <title>", one per active offer, note "Original offer hash"',
      roCount: ro.offers,
      hreaCount: s.proposals.filter((p) => p.name.startsWith('Offer: ')).length
    }),
    row({
      ro: 'Accepted exchanges',
      hrea: 'Agreement',
      link: 'note = R&O agreement hash',
      caveat: DELETED_LISTINGS_CAVEAT,
      roCount: expected.agreements,
      hreaCount: s.agreements.length
    }),
    row({
      ro: 'Commitments',
      hrea: 'Commitment',
      link: 'clauseOf Agreement, agreedIn R&O hash',
      caveat: DELETED_LISTINGS_CAVEAT,
      roCount: expected.commitments,
      hreaCount: s.commitments.length
    }),
    row({
      ro: 'Completions',
      hrea: 'EconomicEvent',
      link: 'realizationOf Agreement, fulfills its Commitment',
      caveat: DELETED_LISTINGS_CAVEAT,
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
 * does not hold it, so the mirror is incomplete. not-yet: the stage has not reached
 * it. ended: the exchange was cancelled, declined or withdrawn before it, so it will
 * never be created. no-resource: the reciprocal moves no resource (a gift or a term
 * to be discussed), so there is no specification for it to conform to. not-mapped:
 * R&O does not mirror an exchange whose service is still to be discussed.
 */
export type FlowState = 'present' | 'missing' | 'not-yet' | 'ended' | 'no-resource' | 'not-mapped';

export type FlowNode = {
  id: string;
  kind: FlowKind;
  title: string;
  sub: string;
  state: FlowState;
  /**
   * A Commitment's progress as hREA holds it: finished, open, or unknown when its
   * latest revision could not be read. Undefined for every other kind of node.
   */
  progress?: 'finished' | 'open' | 'unknown';
  /** Open in hREA though R&O says this side is over: hREA is behind R&O. */
  behind?: boolean;
  fields: [string, string][];
};

export type FlowContext = { listingTitle: string; providerName: string; receiverName: string };

export function buildExchangeFlow(ex: UIExchange, ctx: FlowContext, s: HreaSnapshot): FlowNode[] {
  const a = ex.agreement;
  const ref = rnoAgreementRef(ex);
  const accepted = isAccepted(ex);
  const primaryMapped = isMapped(a.primary.resource_kind);
  const recipResource = carriesResource(a.reciprocal.resource_kind);
  const state = exchangeState(ex);
  // Ended before agreeing (declined, withdrawn) or after (cancelled): what it had not
  // reached by then will not happen.
  const ended = state === 'declined' || state === 'withdrawn' || state === 'cancelled';

  const agentA = s.agents.find((g) => noteRefersTo(g.note, 'user', a.provider));
  const agentB = s.agents.find((g) => noteRefersTo(g.note, 'user', a.receiver));
  const proposalName = `${a.listing_type}: ${ctx.listingTitle}`;
  const proposal = s.proposals.find((p) => p.name === proposalName);
  const specS = s.specs.find((x) => x.name === a.primary.resource_conforms_to);
  const specM = s.specs.find((x) => x.name === a.medium);
  // Only the intents this listing's proposal publishes: the same member's
  // intent on another listing of the same service must not stand in for it.
  const published = new Set(proposal?.intentIds ?? []);
  const ownIntents = s.intents.filter((i) => published.has(i.id));
  const intentP = specS ? ownIntents.find((i) => i.resourceSpecifiedBy === specS.id) : undefined;
  // The reciprocal intent conforms to the medium's spec when it names one; one framed by a
  // base category conforms to nothing, and is the proposal's other intent.
  const intentR =
    (specM ? ownIntents.find((i) => i.resourceSpecifiedBy === specM.id) : undefined) ??
    ownIntents.find((i) => i.id !== intentP?.id);
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
    x ? 'present' : expected ? 'missing' : ended ? 'ended' : 'not-yet';
  const stage = (x: unknown, mapped: boolean, expected: boolean): FlowState =>
    !mapped ? 'not-mapped' : found(x, expected);
  const reciprocalLabel = recipResource
    ? a.medium || a.reciprocal.resource_conforms_to
    : a.reciprocal.resource_kind === 'Tbd'
      ? `to be discussed, framed by ${a.medium || 'no medium'}`
      : `nothing owed, framed by ${a.medium || 'no medium'}`;
  const idField = (x?: { id: string }): [string, string][] => (x ? [['hREA id', x.id]] : []);
  const cancelled = !!ex.cancellation;
  // A Commitment's progress, and whether it trails R&O: over in R&O (that side done,
  // or the exchange cancelled) but still open in hREA.
  const progressOf = (c: Commitment): NonNullable<FlowNode['progress']> =>
    c.finished === undefined ? 'unknown' : c.finished ? 'finished' : 'open';
  const commitmentProgress = (c: Commitment | undefined, over: boolean) => {
    if (!c) return {};
    const progress = progressOf(c);
    return { progress, behind: progress === 'open' && over };
  };
  const progressFields = (
    c: Commitment | undefined,
    isCancelled: boolean,
    sideDone: boolean
  ): [string, string][] => {
    if (!c) return [];
    const progress = progressOf(c);
    const over = isCancelled || sideDone;
    const ro = isCancelled ? 'cancelled' : sideDone ? 'this side done' : 'under way';
    return [
      ['hREA state', progress === 'unknown' ? 'state unread' : progress],
      ['R&O state', ro],
      ...(progress === 'open' && over
        ? ([['behind R&O', 'over in R&O, still open in hREA']] as [string, string][])
        : [])
    ];
  };

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
        ['matched by', `name "${proposalName}" (its note carries the listing hash)`]
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
        ['matched by', 'published by the proposal, conforms to the service spec']
      ]
    },
    {
      id: 'intentR',
      kind: 'intent',
      title: 'Intent · reciprocal',
      sub: a.medium,
      state: stage(intentR, primaryMapped, true),
      fields: [
        ...idField(intentR),
        [
          'conformsTo',
          intentR?.resourceSpecifiedBy ?? `(none, framed by ${a.medium || 'no medium'})`
        ],
        ['matched by', 'published by the proposal, its reciprocal intent']
      ]
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
      // Drawn only when the reciprocal moves a resource (the DS model): a base category
      // frames the deal and nothing conforms to it.
      state: recipResource ? stage(specM, primaryMapped, true) : 'no-resource',
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
      ...commitmentProgress(commitP, cancelled || !!ex.provider_done),
      fields: [
        ...idField(commitP),
        ...progressFields(commitP, cancelled, !!ex.provider_done),
        ['matched by', 'agreedIn R&O hash, provider']
      ]
    },
    {
      id: 'commitR',
      kind: 'commitment',
      title: 'Commitment',
      sub: recipResource ? `reciprocal in ${reciprocalLabel}` : reciprocalLabel,
      state: stage(commitR, primaryMapped, accepted),
      ...commitmentProgress(commitR, cancelled || !!ex.receiver_done),
      fields: [
        ...idField(commitR),
        ...progressFields(commitR, cancelled, !!ex.receiver_done),
        ['matched by', 'agreedIn R&O hash, provider']
      ]
    },
    {
      id: 'eventP',
      kind: 'event',
      title: 'EconomicEvent',
      sub: 'service delivered',
      state: stage(eventP, primaryMapped, accepted && !!ex.provider_done),
      fields: [
        ...idField(eventP),
        ['fulfills', eventP?.fulfills?.join(', ') || '—'],
        ['linked by', 'realizationOf Agreement, fulfills its Commitment']
      ]
    },
    {
      id: 'eventR',
      kind: 'event',
      title: 'EconomicEvent',
      sub: 'reciprocal fulfilled',
      state: stage(eventR, primaryMapped, accepted && !!ex.receiver_done),
      fields: [
        ...idField(eventR),
        ['fulfills', eventR?.fulfills?.join(', ') || '—'],
        ['linked by', 'realizationOf Agreement, fulfills its Commitment']
      ]
    }
  ];
}

/** Known gaps in the R&O to hREA mapping, shown on the dashboard rather than hidden. Fixing them is U15. */
export const KNOWN_MAPPING_GAPS: { title: string; detail: string; where: string }[] = [
  {
    title: 'A cancellation only closes Commitments; decline and review are not mirrored',
    detail:
      'A cancelled exchange marks its open hREA Commitments finished, with no record of why: hREA has no cancellation of its own, and a close that fails leaves them open. A declined proposal was never mirrored, so hREA holds nothing for it, and a review writes nothing to hREA.',
    where:
      'stores/hrea.store.svelte.ts mirrors acceptance, completion and cancellation only (mirrorCancellation)'
  },
  {
    title: 'A mirror that failed is repaired only before completion, and only whole',
    detail:
      'An exchange whose mirror failed is mirrored again when the member who accepted it next reads their exchanges, unless either side has already marked it done: its completion was recorded without an Agreement. A mirror that wrote its Agreement and primary Commitment but not its reciprocal is taken as mirrored, and one that failed on the primary Commitment leaves an empty Agreement behind the repaired one.',
    where:
      'exchangesToMirror and agreementRefsFromHrea in services/mappers/agreement-commitment.mapper.ts'
  },
  {
    title: 'What was mirrored before alpha 2 is read, not rewritten',
    detail:
      'A gift exchange accepted before alpha 2 holds one Commitment and no reciprocal event, so it reads as missing its reciprocal clause. A proposal an earlier edit, archive or delete left behind stays in hREA until that listing is next edited, archived or deleted, when every proposal noted with its hash is retired. Notes written with a hash as a list of byte values are still matched. An exchange whose listing was archived or deleted draws its Proposal and Intents as missing: archiving or deleting a listing retires them.',
    where:
      'mapAgreementToHrea in services/mappers/agreement-commitment.mapper.ts; retireListingProposals in stores/hrea.store.svelte.ts; utils/hrea-ref.ts'
  }
];
