import type { ActionHash } from '@holochain/client';
import type { UIExchange, UIStatus, UIUser } from '$lib/types/ui';
import { counterpartyOf } from '$lib/utils/exchange-ui';

/**
 * The member profile (#350), as the design system lays it out: the status
 * chip, the details line, and the exchanges you have had with this member.
 */

export type ProfileView = 'requests' | 'offers' | 'organisations';

export interface StatusChip {
  label: string;
  /** A Skeleton variant: success, warning or error, so the colour carries meaning. */
  variant: string;
  /** For a temporary suspension: when it ends. */
  until?: string;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Accepted is green; pending and an expired suspension waiting on review are
 * orange; rejected and suspended are red.
 */
export function statusChip(status: UIStatus | undefined, now = Date.now()): StatusChip | null {
  switch (status?.status_type) {
    case 'accepted':
      return { label: 'Accepted', variant: 'variant-soft-success' };
    case 'pending':
      return { label: 'Pending', variant: 'variant-soft-warning' };
    case 'rejected':
      return { label: 'Rejected', variant: 'variant-soft-error' };
    case 'archived':
      return { label: 'Archived', variant: 'variant-soft-surface' };
    case 'suspended indefinitely':
      return { label: 'Suspended', variant: 'variant-soft-error' };
    case 'suspended temporarily': {
      const until = status.suspended_until;
      if (until && new Date(until).getTime() <= now) {
        return { label: 'In review', variant: 'variant-soft-warning' };
      }
      return {
        label: 'Suspended',
        variant: 'variant-soft-error',
        until: until ? formatDate(until) : undefined
      };
    }
    default:
      return null;
  }
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Type, location and time zone, in that order, leaving out what is not set. */
export function detailsLine(user: UIUser): string[] {
  return [capitalise(user.user_type), user.location, user.time_zone].filter(
    (part): part is string => !!part
  );
}

const same = (a: Uint8Array | undefined, b: Uint8Array | undefined) =>
  !!a && !!b && a.toString() === b.toString();

/** My exchanges whose other member is `other`. */
export function exchangesWith(
  exchanges: UIExchange[],
  me: ActionHash | undefined,
  other: ActionHash | undefined
): UIExchange[] {
  if (!me || !other || same(me, other)) return [];
  return exchanges.filter((e) => same(counterpartyOf(e, me), other));
}

/** "1 exchange with you", "3 exchanges with you". */
export function exchangesWithLabel(count: number): string {
  return `${count} ${count === 1 ? 'exchange' : 'exchanges'} with you`;
}
