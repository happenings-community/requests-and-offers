import type { StatusType } from '$lib/types/holochain';
import { lineFor } from '$lib/utils/profile-status';

/**
 * The first-run hint for the network's first administrator.
 *
 * Creating a profile makes the progenitor an administrator, but their own membership still
 * starts as pending, like everyone else's. Until they accept it themselves the app treats them
 * as a new member, and nothing else tells them so. The progenitor is the usual case; an
 * administrator who promotes a pending member (`add_administrator` checks the caller, not the
 * member's status) gives them the same hint, and it is as true for them.
 *
 * The hint follows the state rather than a one-off event, so it survives a reload and goes
 * away by itself once the membership is accepted.
 */
export function needsSelfAcceptance(isAdministrator: boolean, statusType?: StatusType): boolean {
  return isAdministrator && statusType === 'pending';
}

/** The label the Admin menu carries while the hint shows. */
export const SELF_ACCEPTANCE_LABEL = 'Accept your membership to finish setup';

/** The step itself, in the words of the first administrator's welcome dialog. */
export const SELF_ACCEPTANCE_STEP =
  'Accept your own membership. Until you do, your status is pending and the app treats you as a new member.';

export type PendingWall = {
  line: string;
  next: string;
  action: { label: string; href: string | null };
};

/**
 * What the pending wall says. An administrator whose own membership is pending (the first
 * administrator, usually) is the one who accepts it, so they are not told to wait for the
 * administrators or to contact them (dogfooding of 21 November, F14). `action` is what the
 * page blocks ("create offers"); a null href opens the administrators' contact details.
 */
export function pendingWall(isAdministrator: boolean, action: string): PendingWall {
  if (isAdministrator) {
    return {
      line: `You can't ${action} until you accept your own membership.`,
      next: SELF_ACCEPTANCE_STEP,
      action: { label: 'Open the members page', href: '/admin/users' }
    };
  }
  return {
    line: lineFor('pending', action),
    next: "Your profile is currently under review by administrators. This typically takes 24-48 hours. You'll be notified once your profile is approved.",
    action: { label: 'Contact the administrators', href: null }
  };
}
