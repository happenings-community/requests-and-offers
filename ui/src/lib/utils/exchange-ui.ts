import type { ActionHash } from '@holochain/client';
import type { ExchangeStatus, ExchangeTerm } from '$lib/types/holochain';
import type { UIExchange } from '$lib/types/ui';

/**
 * What an exchange's record means to a member, in one name.
 *
 * The label on a card, the group it sits in, whose turn it is and whether a conversation
 * shows it as an agreement are four readings of one fact. Each used to read the status
 * for itself, and two of them carried their own workaround for a status that cannot say
 * "withdrawn": one asked `Cancelled && !response`, the other asked `response.accepted`.
 * The same question spelled two ways is how two screens come to disagree about one
 * record, so it is asked here, once.
 */
export type ExchangeState =
  | 'proposed'
  | 'declined'
  | 'withdrawn'
  | 'agreed'
  | 'partlyDone'
  | 'awaitingReviews'
  | 'reviewed'
  | 'cancelled';

/**
 * The record read once.
 *
 * **A status alone cannot say what happened.** The zome answers `Cancelled` both for a
 * proposal taken back before anyone replied and for an agreement stopped after it was
 * made, short-circuiting before it reads the response
 * (`zomes/coordinator/exchanges/src/exchange.rs`, `derive_status`), so the response is
 * what tells those two apart. A refusal stays a refusal: either party may cancel at any
 * time, so a cancellation can land on a proposal that was already declined, and the
 * decline is the thing that happened to it.
 *
 * No `default:` arm anywhere below, here or in the readers: a status added to the zome
 * fails `bun run check` until someone says what it means, rather than quietly reading as
 * whatever the fallback happened to be.
 */
export function exchangeState(exchange: {
  status: ExchangeStatus;
  response?: { accepted: boolean } | null;
}): ExchangeState {
  switch (exchange.status) {
    case 'Proposed':
      return 'proposed';
    case 'Declined':
      return 'declined';
    case 'Agreed':
      return 'agreed';
    case 'OneSideDone':
      return 'partlyDone';
    case 'Complete':
      return 'awaitingReviews';
    case 'Reviewed':
      return 'reviewed';
    case 'Cancelled':
      if (!exchange.response) return 'withdrawn';
      return exchange.response.accepted ? 'cancelled' : 'declined';
  }
}

export const EXCHANGE_STATE_LABEL: Record<ExchangeState, string> = {
  proposed: 'Proposed',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
  agreed: 'Agreed',
  partlyDone: 'Partly complete',
  awaitingReviews: 'Awaiting reviews',
  reviewed: 'Completed',
  cancelled: 'Cancelled'
};

export function exchangeStatusVariant(status: ExchangeStatus): string {
  switch (status) {
    case 'Proposed':
      return 'variant-filled-secondary';
    case 'Agreed':
      return 'variant-filled-primary';
    case 'OneSideDone':
      return 'variant-filled-tertiary';
    case 'Complete':
      return 'variant-filled-warning';
    case 'Reviewed':
      return 'variant-filled-success';
    case 'Declined':
    case 'Cancelled':
      return 'variant-filled-surface';
  }
}

export type ExchangeTab = 'proposals' | 'active' | 'completed';

/**
 * Which group each state belongs to.
 *
 * One entry per state rather than a list per tab, so a new state fails to compile here
 * instead of falling through to whichever tab the old loop ended on. A proposal taken
 * back belongs with proposals: it never became an exchange.
 */
export const TAB_OF_STATE: Record<ExchangeState, ExchangeTab> = {
  proposed: 'proposals',
  declined: 'proposals',
  withdrawn: 'proposals',
  agreed: 'active',
  partlyDone: 'active',
  cancelled: 'active',
  awaitingReviews: 'completed',
  reviewed: 'completed'
};

export function tabOf(exchange: UIExchange): ExchangeTab {
  return TAB_OF_STATE[exchangeState(exchange)];
}

export function termLabel(term: ExchangeTerm): string {
  if (term.resource_kind === 'Tbd') return 'To be discussed';
  if (term.resource_kind === 'Gift') return 'Gift, nothing owed';
  if (!term.quantity) return term.resource_conforms_to;
  if (term.resource_kind === 'Currency') return `${term.quantity.value} ${term.resource_conforms_to}`;
  const unit = term.quantity.value === 1 ? term.quantity.unit.replace(/s$/, '') : term.quantity.unit;
  return `${term.quantity.value} ${unit} of ${term.resource_conforms_to}`;
}

export type ExchangeRole = 'provider' | 'receiver';

const same = (a: Uint8Array | undefined, b: Uint8Array | undefined) =>
  !!a && !!b && a.toString() === b.toString();

/**
 * The interest a link names, found among the ones the listing actually has.
 *
 * **A hash in an address means nothing until a record says it does.** The propose page
 * is opened with one, and only the listing's own interests can answer whether it is one
 * of them; read and absent is its own answer, distinct from a read that failed, and the
 * page stops either way rather than filling itself in from the query string.
 *
 * Hashes compare by what they hold. Two `Uint8Array`s with the same bytes are different
 * objects, so `===` is always false and `includes` never finds anything.
 */
export function namedInterest<T extends { interest_hash: ActionHash }>(
  interests: readonly T[],
  wanted: ActionHash | null | undefined
): T | undefined {
  if (!wanted) return undefined;
  return interests.find((i) => same(i.interest_hash, wanted));
}

export function roleOf(exchange: UIExchange, myUserHash: ActionHash | undefined): ExchangeRole | null {
  if (same(exchange.agreement.provider, myUserHash)) return 'provider';
  if (same(exchange.agreement.receiver, myUserHash)) return 'receiver';
  return null;
}

export function counterpartyOf(exchange: UIExchange, myUserHash: ActionHash | undefined): ActionHash {
  return same(exchange.agreement.provider, myUserHash)
    ? exchange.agreement.receiver
    : exchange.agreement.provider;
}

/** The agreement names the counterparty; whoever is not it wrote it up. */
export function wroteIt(exchange: UIExchange, myUserHash: ActionHash | undefined): boolean {
  return !same(exchange.agreement.counterparty, myUserHash);
}

export function doneBy(exchange: UIExchange, role: ExchangeRole | null): boolean {
  return role === 'provider' ? !!exchange.provider_done : role === 'receiver' ? !!exchange.receiver_done : false;
}

export function reviewedBy(exchange: UIExchange, role: ExchangeRole | null): boolean {
  return role === 'provider' ? !!exchange.provider_review : role === 'receiver' ? !!exchange.receiver_review : false;
}

export function otherRole(role: ExchangeRole | null): ExchangeRole | null {
  return role === 'provider' ? 'receiver' : role === 'receiver' ? 'provider' : null;
}

export function statusLabel(exchange: UIExchange): string {
  return EXCHANGE_STATE_LABEL[exchangeState(exchange)];
}

/**
 * Whether the record is still a proposal: nobody accepted it. Proposed, declined and
 * withdrawn all read "Proposal" over the terms and "Proposed by" on the card; the three
 * agreement stages and what follows them do not.
 */
export function isProposal(state: ExchangeState): boolean {
  return state === 'proposed' || state === 'declined' || state === 'withdrawn';
}

export interface Closure {
  kind: 'declined' | 'withdrawn' | 'cancelled';
  at: number;
  note: string;
}

export const CLOSURE_LABEL: Record<Closure['kind'], string> = {
  declined: 'Declined',
  withdrawn: 'Withdrawn',
  cancelled: 'Cancelled'
};

/**
 * How a record was closed, if it was: what closed it, when, and its note.
 *
 * A declined proposal is closed by its decline, even when a cancellation landed on it
 * afterwards; a withdrawal and a stopped agreement are closed by the cancellation. The
 * open and finished states have no closure. No `default:` arm, as above.
 */
export function closureOf(exchange: UIExchange): Closure | null {
  const state = exchangeState(exchange);
  switch (state) {
    case 'declined':
      return exchange.response
        ? { kind: state, at: exchange.response.created_at, note: exchange.response.note }
        : null;
    case 'withdrawn':
    case 'cancelled':
      return exchange.cancellation
        ? { kind: state, at: exchange.cancellation.created_at, note: exchange.cancellation.note }
        : null;
    case 'proposed':
    case 'agreed':
    case 'partlyDone':
    case 'awaitingReviews':
    case 'reviewed':
      return null;
  }
}

export type Turn = 'you' | 'them' | 'none';

/** Whose move it is, from the record alone. */
export function turnOf(exchange: UIExchange, myUserHash: ActionHash | undefined): Turn {
  const role = roleOf(exchange, myUserHash);
  if (!role) return 'none';
  switch (exchangeState(exchange)) {
    case 'proposed':
      return wroteIt(exchange, myUserHash) ? 'them' : 'you';
    case 'agreed':
    case 'partlyDone':
      // Either side may have gone first, so whose turn it is depends on who
      // has not marked their part done, not on which role they hold.
      return doneBy(exchange, role) ? 'them' : 'you';
    case 'awaitingReviews':
      return reviewedBy(exchange, role) ? 'them' : 'you';
    case 'declined':
    case 'withdrawn':
    case 'cancelled':
    case 'reviewed':
      // Settled or stopped: nothing is asked of either side.
      return 'none';
  }
}

/** A proposal someone else sent me that I have not answered. */
export function awaitingMe(exchange: UIExchange, myUserHash: ActionHash | undefined): boolean {
  return turnOf(exchange, myUserHash) === 'you';
}

/** What the card's button says, by what the status asks of the reader. */
export function actionLabel(exchange: UIExchange, role: ExchangeRole | null): string {
  switch (exchangeState(exchange)) {
    // A proposal taken back is still a proposal: there is no exchange behind it to open.
    case 'proposed':
    case 'declined':
    case 'withdrawn':
      return 'Open proposal';
    case 'partlyDone':
      return doneBy(exchange, role) ? 'Open exchange' : 'Mark my part done';
    case 'awaitingReviews':
      return reviewedBy(exchange, role) ? 'Open exchange' : 'Leave a review';
    case 'reviewed':
      return 'View summary';
    case 'agreed':
    case 'cancelled':
      return 'Open exchange';
  }
}

export function formatWhen(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * What comes back, derived from the medium the listing named.
 *
 * **A listing that names no medium is still proposable, and the exchange is a gift**
 * (Sam, 4 October). Nothing published says a medium is required, so refusing to propose
 * without one invented a rule the data does not have, and it blocked the simplest kind of
 * exchange there is: someone offering to help for nothing.
 *
 * The empty medium is the same shape as "Free/Pay it Forward" on purpose. Both mean
 * nothing is expected back, and giving them one shape means the exchange reads the same
 * either way rather than depending on whether the author happened to tick a box.
 *
 * `Tbd` is gone from this path. It was what an unrecognised medium fell through to, and
 * "to be decided" is a term no listing published either.
 */
export function reciprocalTermFor(input: {
  medium: string;
  isCurrency: boolean;
  returnService: string;
}): ExchangeTerm {
  const { medium, isCurrency, returnService } = input;

  if (isCurrency) {
    return {
      direction: 'Receive',
      resource_conforms_to: medium,
      resource_kind: 'Currency',
      // No amount: a listing does not publish one, and a typed figure would be a term no
      // record backs.
      quantity: null
    };
  }

  if (medium === 'Service Exchange') {
    return {
      direction: 'Receive',
      // The sentinel for "none of these suit" is never a term; the page blocks sending
      // while it is chosen.
      resource_conforms_to: returnService === '__none__' ? '' : returnService,
      resource_kind: 'Service',
      quantity: null
    };
  }

  // No medium at all, or Free/Pay it Forward: nothing is expected back.
  return { direction: 'Receive', resource_conforms_to: '', resource_kind: 'Gift', quantity: null };
}
