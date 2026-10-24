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

/**
 * The live tabs. A declined, withdrawn or cancelled exchange has ended and
 * belongs to none of them: it shows under All, with everything else.
 */
export const EXCHANGE_TABS = {
  proposals: ['Proposed'],
  active: ['Agreed', 'OneSideDone'],
  completed: ['Complete', 'Reviewed']
} as const satisfies Record<string, readonly ExchangeStatus[]>;

export type LiveTab = keyof typeof EXCHANGE_TABS;
export type ExchangeTab = LiveTab | 'all';

/** The live tab an exchange sits in, or null once it has ended. */
export function tabOf(exchange: UIExchange): LiveTab | null {
  for (const [tab, states] of Object.entries(EXCHANGE_TABS)) {
    if ((states as readonly ExchangeStatus[]).includes(exchange.status)) return tab as LiveTab;
  }
  return null;
}

export function inTab(exchange: UIExchange, tab: ExchangeTab): boolean {
  return tab === 'all' || tabOf(exchange) === tab;
}

export function termLabel(term: ExchangeTerm): string {
  if (term.resource_kind === 'Tbd') return 'To be discussed';
  if (term.resource_kind === 'Gift') return 'Gift, nothing owed';
  if (!term.quantity) return term.resource_conforms_to;
  if (term.resource_kind === 'Currency')
    return `${term.quantity.value} ${term.resource_conforms_to}`;
  const unit =
    term.quantity.value === 1 ? term.quantity.unit.replace(/s$/, '') : term.quantity.unit;
  return `${term.quantity.value} ${unit} of ${term.resource_conforms_to}`;
}

export type ExchangeRole = 'provider' | 'receiver';

const same = (a: Uint8Array | undefined, b: Uint8Array | undefined) =>
  !!a && !!b && a.toString() === b.toString();

export function roleOf(
  exchange: UIExchange,
  myUserHash: ActionHash | undefined
): ExchangeRole | null {
  if (same(exchange.agreement.provider, myUserHash)) return 'provider';
  if (same(exchange.agreement.receiver, myUserHash)) return 'receiver';
  return null;
}

export function counterpartyOf(
  exchange: UIExchange,
  myUserHash: ActionHash | undefined
): ActionHash {
  return same(exchange.agreement.provider, myUserHash)
    ? exchange.agreement.receiver
    : exchange.agreement.provider;
}

/** The agreement names the counterparty; whoever is not it wrote it up. */
export function wroteIt(exchange: UIExchange, myUserHash: ActionHash | undefined): boolean {
  return !same(exchange.agreement.counterparty, myUserHash);
}

export function doneBy(exchange: UIExchange, role: ExchangeRole | null): boolean {
  return role === 'provider'
    ? !!exchange.provider_done
    : role === 'receiver'
      ? !!exchange.receiver_done
      : false;
}

export function reviewedBy(exchange: UIExchange, role: ExchangeRole | null): boolean {
  return role === 'provider'
    ? !!exchange.provider_review
    : role === 'receiver'
      ? !!exchange.receiver_review
      : false;
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

/**
 * The line under the turn chip on the exchange page (#369): what the chip
 * means for the reader, in the state they are in. `null` where no chip shows,
 * which is for someone who is not a party and for a settled or stopped exchange.
 */
export function turnLine(
  exchange: UIExchange,
  myUserHash: ActionHash | undefined,
  otherName: string | undefined
): string | null {
  const role = roleOf(exchange, myUserHash);
  if (!role) return null;
  const them = otherName ?? 'them';
  switch (exchange.status) {
    case 'Proposed':
      return wroteIt(exchange, myUserHash)
        ? 'To accept, counter or decline.'
        : `${otherName ?? 'They'} sent this proposal.`;
    case 'Agreed':
    case 'OneSideDone':
      if (doneBy(exchange, role)) return 'To mark their part done.';
      return doneBy(exchange, otherRole(role))
        ? `Mark your part done when it is. ${otherName ? `${otherName} has` : 'They have'} marked their part done.`
        : 'Mark your part done when it is.';
    case 'Complete':
      return reviewedBy(exchange, role)
        ? 'Thanks for your review. Waiting for theirs.'
        : `Both parts are done. How was your exchange with ${them}?`;
    default:
      return null;
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
  return new Date(ms).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}
