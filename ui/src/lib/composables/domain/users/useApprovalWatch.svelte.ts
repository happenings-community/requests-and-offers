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
  /**
   * Called when an administrator asks the still-pending member for more
   * information (a pending status with a new reason, #331), once per request.
   */
  onInformationRequested?: (request: string) => void;
}

/** The request to show, when a pending status now carries one the member hasn't seen. */
export function newInformationRequest(
  seen: string | undefined,
  latestType: string | undefined,
  latestReason: string | undefined
): string | null {
  if (latestType !== 'pending') return null;
  const request = latestReason?.trim();
  if (!request || request === seen?.trim()) return null;
  return request;
}

export function useApprovalWatch({ onAccepted, onInformationRequested }: UseApprovalWatchOptions) {
  let settled = false;
  // The last request announced, so a failed profile refresh can't repeat it every tick.
  let announced: string | undefined;
  let stopWatching: (() => void) | null = null;

  /** Stops the poll and the focus listener. Safe to call more than once. */
  function stop(): void {
    settled = true;
    stopWatching?.();
    stopWatching = null;
  }

  async function check(): Promise<void> {
    if (settled) return;
    const user = usersStore.currentUser;
    // The profile may still be loading at start-up: wait for it.
    if (!user?.original_action_hash || !user.status) return;
    // A member who is not pending never needs watching; nothing in the app returns them to pending.
    if (user.status.status_type !== 'pending') {
      stop();
      return;
    }
    try {
      const latest = await runEffect(
        administrationStore.getLatestStatusForEntity(
          user.original_action_hash,
          AdministrationEntity.Users
        )
      );
      const change = approvalChange(user.status?.status_type, latest?.status_type);
      if (change === 'accepted') {
        stop();
        onAccepted();
      } else if (change === 'left-pending') {
        // Rejected or suspended: refresh so the profile guards show the right screen.
        stop();
        await runEffect(usersStore.refreshCurrentUser());
      } else {
        // Still pending: has an administrator asked for more information?
        const request = newInformationRequest(
          announced ?? user.status.reason,
          latest?.status_type,
          latest?.reason
        );
        if (request) {
          announced = request;
          // Refresh first so every screen shows the request, then announce it.
          await runEffect(usersStore.refreshCurrentUser()).catch(() => {});
          onInformationRequested?.(request);
        }
      }
    } catch {
      // Network hiccup: the next tick tries again.
    }
  }

  /** Starts watching; returns the function that stops it. */
  function start(): () => void {
    if (settled || stopWatching) return stop;
    const interval = setInterval(check, APPROVAL_POLL_MS);
    const onFocus = () => check();
    window.addEventListener('focus', onFocus);
    stopWatching = () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
    check();
    return stop;
  }

  return {
    check,
    start,
    get watching() {
      return stopWatching !== null;
    }
  };
}
