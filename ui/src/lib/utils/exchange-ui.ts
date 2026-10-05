import type { ActionHash } from '@holochain/client';
import type { ExchangeStatus, ExchangeTerm } from '$lib/types/holochain';
import type { UIExchange } from '$lib/types/ui';

export const EXCHANGE_STATUS_LABEL: Record<ExchangeStatus, string> = {
  Proposed: 'Proposed',
  Agreed: 'Agreed',
  OneSideDone: 'Partly complete',
  Complete: 'Awaiting reviews',
  Reviewed: 'Completed',
  Declined: 'Declined',
  Cancelled: 'Cancelled'
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

export const EXCHANGE_TABS = {
  proposals: ['Proposed', 'Declined'],
  active: ['Agreed', 'OneSideDone', 'Cancelled'],
  completed: ['Complete', 'Reviewed']
} as const satisfies Record<string, readonly ExchangeStatus[]>;

export type ExchangeTab = keyof typeof EXCHANGE_TABS;

/** A proposal withdrawn before anyone answered it belongs with proposals, not active. */
export function tabOf(exchange: UIExchange): ExchangeTab {
  if (exchange.status === 'Cancelled' && !exchange.response) return 'proposals';
  for (const [tab, states] of Object.entries(EXCHANGE_TABS)) {
    if ((states as readonly ExchangeStatus[]).includes(exchange.status)) return tab as ExchangeTab;
  }
  return 'active';
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

/** A proposal cancelled before anyone answered it was withdrawn, not cancelled. */
export function statusLabel(exchange: UIExchange): string {
  if (exchange.status === 'Cancelled' && !exchange.response) return 'Withdrawn';
  return EXCHANGE_STATUS_LABEL[exchange.status];
}

export type Turn = 'you' | 'them' | 'none';

/** Whose move it is, from the record alone. */
export function turnOf(exchange: UIExchange, myUserHash: ActionHash | undefined): Turn {
  const role = roleOf(exchange, myUserHash);
  if (!role) return 'none';
  switch (exchange.status) {
    case 'Proposed':
      return wroteIt(exchange, myUserHash) ? 'them' : 'you';
    case 'Agreed':
      return doneBy(exchange, role) ? 'them' : 'you';
    case 'OneSideDone':
      // Either side may have gone first, so whose turn it is depends on who
      // has not marked their part done, not on which role they hold.
      return doneBy(exchange, role) ? 'them' : 'you';
    case 'Complete':
      return reviewedBy(exchange, role) ? 'them' : 'you';
    default:
      return 'none';
  }
}

/** A proposal someone else sent me that I have not answered. */
export function awaitingMe(exchange: UIExchange, myUserHash: ActionHash | undefined): boolean {
  return turnOf(exchange, myUserHash) === 'you';
}

/** What the card's button says, by what the status asks of the reader. */
export function actionLabel(exchange: UIExchange, role: ExchangeRole | null): string {
  switch (exchange.status) {
    case 'Proposed':
    case 'Declined':
      return 'Open proposal';
    case 'OneSideDone':
      return doneBy(exchange, role) ? 'Open exchange' : 'Mark my part done';
    case 'Complete':
      return reviewedBy(exchange, role) ? 'Open exchange' : 'Leave a review';
    case 'Reviewed':
      return 'View summary';
    default:
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
