import type { ActionHash } from '@holochain/client';
import type { ExchangeStatus, ExchangeTerm } from '$lib/types/holochain';
import type { UIExchange } from '$lib/types/ui';

export const EXCHANGE_STATUS_LABEL: Record<ExchangeStatus, string> = {
  Proposed: 'Proposed',
  Agreed: 'Agreed',
  ProviderDelivered: 'Awaiting confirmation',
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
    case 'ProviderDelivered':
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
  active: ['Agreed', 'ProviderDelivered', 'Cancelled'],
  completed: ['Complete', 'Reviewed']
} as const satisfies Record<string, readonly ExchangeStatus[]>;

export type ExchangeTab = keyof typeof EXCHANGE_TABS;

export function tabOf(status: ExchangeStatus): ExchangeTab {
  for (const [tab, states] of Object.entries(EXCHANGE_TABS)) {
    if ((states as readonly ExchangeStatus[]).includes(status)) return tab as ExchangeTab;
  }
  return 'active';
}

export function termLabel(term: ExchangeTerm): string {
  if (term.resource_kind === 'Tbd') return 'To be agreed';
  if (term.resource_kind === 'Gift') return 'Gift, nothing owed';
  const q = term.quantity ? `${term.quantity.value} ${term.quantity.unit} ` : '';
  return `${q}${term.resource_conforms_to}`.trim();
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

export function formatWhen(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
