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
}

export interface PersonGroup {
  /** The other person's user hash, encoded. */
  key: string;
  person: ActionHash;
  /** Their negotiations with this member, most recently moved first. */
  chains: ExchangeChain[];
  /** When anything with this person last moved. */
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
    chains.push({ key, rounds, latest: rounds[rounds.length - 1] });
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

/** Chains grouped by the other person, most recently active person first. */
export function groupByPerson(
  chains: ExchangeChain[],
  me: ActionHash | undefined,
  activity: (e: UIExchange) => number
): PersonGroup[] {
  const groups = new Map<string, PersonGroup>();
  for (const chain of chains) {
    const person = counterpartyOf(chain.latest, me);
    const key = keyOf(person);
    const moved = activity(chain.latest);
    const group = groups.get(key) ?? {
      key,
      person,
      chains: [],
      lastActivity: 0,
      waitingOnMe: false
    };
    group.chains.push(chain);
    group.lastActivity = Math.max(group.lastActivity, moved);
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
