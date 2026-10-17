import { encodeHashToBase64, type ActionHash } from '@holochain/client';
import type { ExchangeTerm } from '$lib/types/holochain';
import type { UIExchange } from '$lib/types/ui';
import { awaitingMe, counterpartyOf, termLabel } from '$lib/utils/exchange-ui';

/**
 * Negotiations as chains of rounds, grouped by the other person (#333).
 *
 * A chain follows the `counters` field: each counter names the proposal it
 * answers, so a negotiation is read from its first proposal to its latest round
 * as a record, not inferred. Two negotiations with the same person on the same
 * listing stay two chains.
 */

export interface ExchangeChain {
  /** The first proposal's hash, encoded: the chain's identity. */
  key: string;
  /** Every round, oldest first. */
  rounds: UIExchange[];
  /** The newest round. */
  latest: UIExchange;
  /**
   * True when the first visible round counters one that has not arrived yet.
   * Data reaches a node by gossip, so a newer round can land before an older
   * one; the chain says so rather than looking complete and growing later.
   */
  missingEarlier: boolean;
}

/** What My Exchanges can group negotiations by. */
export type GroupKey = 'person' | 'listing' | 'service' | 'medium';

export interface ChainGroup {
  /** The grouping value, encoded: a user or listing hash, or the service or medium name. */
  key: string;
  /** The chain the group is labelled from: its latest round names the person, listing or term. */
  sample: ExchangeChain;
  /** Negotiations in this group, most recently moved first. */
  chains: ExchangeChain[];
  /** When anything in the group last moved. */
  lastActivity: number;
  /** True when any of these chains is waiting on this member. */
  waitingOnMe: boolean;
}

const keyOf = (hash: ActionHash) => encodeHashToBase64(hash);

/** Builds chains from the exchanges a member can see. */
export function chainsOf(list: UIExchange[]): ExchangeChain[] {
  const byKey = new Map(list.map((e) => [keyOf(e.agreement_hash), e]));
  // The round that answers each exchange, by the answered exchange's key. A
  // forked chain cannot be written (validation refuses it), but if two answers
  // ever arrived, the earlier one continues the chain and the later starts its own.
  const next = new Map<string, UIExchange>();
  for (const e of [...list].sort((a, b) => a.created_at - b.created_at)) {
    const answers = e.agreement.counters?.agreement;
    if (!answers) continue;
    const parent = keyOf(answers);
    if (byKey.has(parent) && !next.has(parent)) next.set(parent, e);
  }
  const continues = new Set([...next.values()].map((e) => keyOf(e.agreement_hash)));

  const chains: ExchangeChain[] = [];
  for (const e of list) {
    const key = keyOf(e.agreement_hash);
    if (continues.has(key)) continue; // part of an earlier round's chain
    const rounds = [e];
    let at = next.get(key);
    while (at) {
      rounds.push(at);
      at = next.get(keyOf(at.agreement_hash));
    }
    const answers = e.agreement.counters?.agreement;
    chains.push({
      key,
      rounds,
      latest: rounds[rounds.length - 1],
      missingEarlier: !!answers && !byKey.has(keyOf(answers))
    });
  }
  return chains;
}

/** The chains waiting on this member's move, most recently moved first. */
export function waitingOnMe(
  chains: ExchangeChain[],
  me: ActionHash | undefined,
  activity: (e: UIExchange) => number
): ExchangeChain[] {
  return chains
    .filter((c) => awaitingMe(c.latest, me))
    .sort((a, b) => activity(b.latest) - activity(a.latest));
}

/**
 * The value a chain is grouped by. Service and medium cannot change between
 * rounds (validation refuses it), so a negotiation always sits in one group.
 */
export function groupValue(chain: ExchangeChain, by: GroupKey, me: ActionHash | undefined): string {
  const a = chain.latest.agreement;
  switch (by) {
    case 'person':
      return keyOf(counterpartyOf(chain.latest, me));
    case 'listing':
      return keyOf(a.listing);
    case 'service':
      return a.primary.resource_conforms_to || 'No service named';
    case 'medium':
      return a.medium || 'No medium';
  }
}

/** Chains grouped by `by`, most recently active group first. */
export function groupChains(
  chains: ExchangeChain[],
  by: GroupKey,
  me: ActionHash | undefined,
  activity: (e: UIExchange) => number
): ChainGroup[] {
  const groups = new Map<string, ChainGroup>();
  for (const chain of chains) {
    const key = groupValue(chain, by, me);
    const group = groups.get(key) ?? {
      key,
      sample: chain,
      chains: [],
      lastActivity: 0,
      waitingOnMe: false
    };
    group.chains.push(chain);
    group.lastActivity = Math.max(group.lastActivity, activity(chain.latest));
    group.waitingOnMe ||= awaitingMe(chain.latest, me);
    groups.set(key, group);
  }
  const list = [...groups.values()];
  for (const g of list) g.chains.sort((a, b) => activity(b.latest) - activity(a.latest));
  return list.sort((a, b) => b.lastActivity - a.lastActivity);
}

export type RoundField = 'primary' | 'reciprocal' | 'timeframe';

export interface RoundChange {
  field: RoundField;
  from: string;
  to: string;
}

function quantityText(term: ExchangeTerm): string {
  if (!term.quantity) return 'none';
  return `${term.quantity.value} ${term.quantity.unit}`;
}

/** What a round changed from the round before it. Empty for a first proposal. */
export function roundChanges(previous: UIExchange | undefined, round: UIExchange): RoundChange[] {
  if (!previous) return [];
  const a = previous.agreement;
  const b = round.agreement;
  const changes: RoundChange[] = [];
  if (quantityText(a.primary) !== quantityText(b.primary)) {
    changes.push({ field: 'primary', from: quantityText(a.primary), to: quantityText(b.primary) });
  }
  if (quantityText(a.reciprocal) !== quantityText(b.reciprocal)) {
    changes.push({
      field: 'reciprocal',
      from: quantityText(a.reciprocal),
      to: quantityText(b.reciprocal)
    });
  }
  if (a.delivery_timeframe !== b.delivery_timeframe) {
    changes.push({ field: 'timeframe', from: a.delivery_timeframe, to: b.delivery_timeframe });
  }
  return changes;
}

export type RoundOutcome =
  | 'countered'
  | 'declined'
  | 'accepted'
  | 'withdrawn'
  | 'cancelled'
  | 'completed'
  | 'open';

/**
 * How a round ended. A round followed by another in its chain was countered;
 * the countered round's decline is part of countering, not a separate refusal.
 */
export function roundOutcome(round: UIExchange, answered: boolean): RoundOutcome {
  if (answered) return 'countered';
  switch (round.status) {
    case 'Proposed':
      return 'open';
    case 'Declined':
      return 'declined';
    case 'Cancelled':
      return round.response ? 'cancelled' : 'withdrawn';
    case 'Complete':
    case 'Reviewed':
      return 'completed';
    case 'Agreed':
    case 'OneSideDone':
      return 'accepted';
  }
}

/** The latest round's terms in brief, for a collapsed chain card. */
export function termsInBrief(round: UIExchange): string {
  const a = round.agreement;
  return `${termLabel(a.primary)} ⇆ ${termLabel(a.reciprocal)}, ${a.delivery_timeframe}`;
}
