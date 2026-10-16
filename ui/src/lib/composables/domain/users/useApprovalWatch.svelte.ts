import administrationStore from '$lib/stores/administration.store.svelte';
import usersStore from '$lib/stores/users.store.svelte';
import { AdministrationEntity } from '$lib/types/holochain';
import { runEffect } from '$lib/utils/effect';

/**
 * Watches a pending member's own status so an administrator's decision shows
 * without a reload (#329).
 *
 * The member's status is otherwise read only at start-up and on a few pages,
 * and the administration zome's signals reach only the admin who acted. So
 * while the member is pending, the status is re-read on a short poll and when
 * the window regains focus. Nothing runs for anyone who is not pending. A
 * remote signal can replace the poll later (#12, #51); the poll stays as the
 * fallback for a member who was offline when the admin acted.
 */

export const APPROVAL_POLL_MS = 15_000;

export type ApprovalChange = 'accepted' | 'left-pending' | null;

/** What a status change means for a member who was pending. */
export function approvalChange(before?: string, after?: string): ApprovalChange {
  if (before !== 'pending' || !after || after === 'pending') return null;
  return after === 'accepted' ? 'accepted' : 'left-pending';
}

export interface UseApprovalWatchOptions {
  /** Called once when the member is accepted. */
  onAccepted: () => void;
}

export function useApprovalWatch({ onAccepted }: UseApprovalWatchOptions) {
  let settled = false;

  async function check(): Promise<void> {
    const user = usersStore.currentUser;
    if (settled || !user?.original_action_hash || user.status?.status_type !== 'pending') return;
    try {
      const latest = await runEffect(
        administrationStore.getLatestStatusForEntity(
          user.original_action_hash,
          AdministrationEntity.Users
        )
      );
      const change = approvalChange(user.status?.status_type, latest?.status_type);
      if (change === 'accepted') {
        settled = true;
        onAccepted();
      } else if (change === 'left-pending') {
        // Rejected or suspended: refresh so the profile guards show the right screen.
        settled = true;
        await runEffect(usersStore.refreshCurrentUser());
      }
    } catch {
      // Network hiccup: the next tick tries again.
    }
  }

  /** Starts watching; returns the function that stops it. */
  function start(): () => void {
    check();
    const interval = setInterval(check, APPROVAL_POLL_MS);
    const onFocus = () => check();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }

  return { check, start };
}
