/**
 * What a blocked member is told, by their status (#331 follow-up).
 *
 * The guard's pages were written for "no profile yet", so a suspended member
 * was told to create a profile. The heading and the line under it now follow
 * the status; the page supplies only what it blocks, as a verb phrase such as
 * "create requests". A missing profile keeps the page's own wording.
 *
 * An indefinite suspension reads as permanent to the member: the status
 * stays reversible by administrators as an escape hatch, but that is not a
 * promise the screen should make.
 */

export type BlockedState =
  | 'pending'
  | 'rejected'
  | 'suspended_temporarily'
  | 'suspended_indefinitely';

const BLOCKED: readonly BlockedState[] = [
  'pending',
  'rejected',
  'suspended_temporarily',
  'suspended_indefinitely'
];

export function isBlockedState(state: string): state is BlockedState {
  return (BLOCKED as readonly string[]).includes(state);
}

/** The heading for a member who has a profile but is not accepted. */
export function headingFor(state: BlockedState): string {
  switch (state) {
    case 'pending':
      return 'Your application is waiting for approval';
    case 'rejected':
      return "Your application wasn't accepted";
    case 'suspended_temporarily':
      return 'Your profile is suspended';
    case 'suspended_indefinitely':
      return 'Your profile is permanently suspended';
  }
}

/**
 * The line under the heading. `action` is what the page blocks ("create
 * requests", "view or create offers"); `suspendedUntil` is the RFC 3339 end of a
 * temporary suspension, when known.
 */
export function lineFor(
  state: BlockedState,
  action: string,
  suspendedUntil?: string | null
): string {
  switch (state) {
    case 'pending':
      return `You can't ${action} until an administrator approves your profile.`;
    case 'rejected':
    case 'suspended_indefinitely':
      return `You can't ${action}.`;
    case 'suspended_temporarily': {
      const base = `You can't ${action} while your profile is suspended.`;
      const ends = formatEnd(suspendedUntil);
      return ends ? `${base} Your suspension ends on ${ends}.` : base;
    }
  }
}

/** The status as a label, never the raw status string. */
export function statusLabel(statusType: string | undefined): string {
  switch (statusType) {
    case 'pending':
      return 'Pending';
    case 'accepted':
      return 'Accepted';
    case 'rejected':
      return 'Rejected';
    case 'suspended temporarily':
      return 'Suspended (temporary)';
    case 'suspended indefinitely':
      return 'Suspended (permanent)';
    default:
      return 'Unknown';
  }
}

/** A date in the member's own locale, or undefined when there is none to show. */
function formatEnd(suspendedUntil: string | null | undefined): string | undefined {
  if (!suspendedUntil) return undefined;
  const date = new Date(suspendedUntil);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}
