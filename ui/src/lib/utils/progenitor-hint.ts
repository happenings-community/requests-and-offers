import type { StatusType } from '$lib/types/holochain';

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

/** The label the Admin button carries while the hint shows. */
export const SELF_ACCEPTANCE_LABEL = 'Accept your membership to finish setup';
