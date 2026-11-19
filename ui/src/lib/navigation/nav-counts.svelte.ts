import messagingPresence from '$lib/services/messagingPresence.svelte';
import { getUnreadCount, unreadCountLabel } from '$lib/extensions/unread-count';
import exchangesStore from '$lib/stores/exchanges.store.svelte';
import usersStore from '$lib/stores/users.store.svelte';
import { turnOf } from '$lib/utils/exchange-ui';
import { isUserApproved } from '$lib/utils';

/**
 * The counts the nav bar, its menu button and the mobile drawer show, read in one place
 * so the three cannot disagree. Call it while a component is being set up: the unread
 * count comes through messaging's extension point, a Svelte context.
 *
 * **One count where there is messaging, another where there is not** (Sam, 4 October).
 * With messaging, a proposal arriving is counted once, as an unopened conversation on the
 * envelope, and My Exchanges carries no number. Without it nothing else counts a proposal,
 * so My Exchanges carries the exchanges waiting on the member.
 */
export function useNavCounts() {
  const unread = getUnreadCount();
  /**
   * **No counts for a member who is not accepted** (#349 review): every screen a count
   * leads to is behind the Members only wall, and the bar shows them no link to follow.
   */
  const accepted = $derived(isUserApproved(usersStore.currentUser));
  /** Unopened conversations; 0 before the first poll answers, or without messaging. */
  const unreadCount = $derived(accepted ? (unread() ?? 0) : 0);
  /** Exchanges waiting on this member, cleared by acting, not by looking. */
  const waiting = $derived(
    exchangesStore.exchanges.filter(
      (e) => turnOf(e, usersStore.currentUser?.original_action_hash) === 'you'
    ).length
  );
  const exchangesBadge = $derived(accepted && messagingPresence.isAbsent ? waiting : 0);
  /** What the collapsed bar's menu button carries: whichever count this network has. */
  const total = $derived(messagingPresence.isAbsent ? exchangesBadge : unreadCount);
  /** The same, in words, for a screen reader; empty at 0. */
  const totalLabel = $derived(
    total === 0
      ? ''
      : messagingPresence.isAbsent
        ? `${total} waiting on you`
        : unreadCountLabel(total)
  );

  return {
    get unreadCount() {
      return unreadCount;
    },
    get exchangesBadge() {
      return exchangesBadge;
    },
    get total() {
      return total;
    },
    get totalLabel() {
      return totalLabel;
    }
  };
}

/** A badge's number, capped so it stays one small pill. */
export const shownCount = (n: number) => (n > 9 ? '9+' : String(n));
