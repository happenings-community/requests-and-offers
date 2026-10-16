import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({
  currentUser: null as null | {
    original_action_hash: Uint8Array;
    status?: { status_type: string };
  },
  latest: null as null | { status_type: string },
  refreshed: 0
}));

vi.mock('$lib/stores/users.store.svelte', () => ({
  default: {
    get currentUser() {
      return state.currentUser;
    },
    refreshCurrentUser: () => {
      state.refreshed += 1;
      return 'refresh';
    }
  }
}));

vi.mock('$lib/stores/administration.store.svelte', () => ({
  default: { getLatestStatusForEntity: () => 'status' }
}));

// The store methods return effects; here they are tokens resolved by this stub.
vi.mock('$lib/utils/effect', () => ({
  runEffect: async (token: string) => (token === 'status' ? state.latest : null)
}));

import {
  approvalChange,
  useApprovalWatch
} from '$lib/composables/domain/users/useApprovalWatch.svelte';

const pendingUser = () => ({
  original_action_hash: new Uint8Array([1, 2, 3]),
  status: { status_type: 'pending' }
});

describe('approvalChange', () => {
  it('is accepted when a pending member is accepted', () => {
    expect(approvalChange('pending', 'accepted')).toBe('accepted');
  });

  it('is left-pending when a pending member is rejected or suspended', () => {
    expect(approvalChange('pending', 'rejected')).toBe('left-pending');
    expect(approvalChange('pending', 'suspended indefinitely')).toBe('left-pending');
  });

  it('is nothing while still pending, or for a member who was not pending', () => {
    expect(approvalChange('pending', 'pending')).toBeNull();
    expect(approvalChange('pending', undefined)).toBeNull();
    expect(approvalChange('accepted', 'suspended temporarily')).toBeNull();
    expect(approvalChange(undefined, 'accepted')).toBeNull();
  });
});

describe('useApprovalWatch', () => {
  beforeEach(() => {
    state.currentUser = pendingUser();
    state.latest = null;
    state.refreshed = 0;
  });

  it('calls onAccepted once when the pending member is accepted', async () => {
    const onAccepted = vi.fn();
    const watch = useApprovalWatch({ onAccepted });
    state.latest = { status_type: 'accepted' };
    await watch.check();
    await watch.check();
    expect(onAccepted).toHaveBeenCalledTimes(1);
  });

  it('does nothing while the member is still pending', async () => {
    const onAccepted = vi.fn();
    state.latest = { status_type: 'pending' };
    await useApprovalWatch({ onAccepted }).check();
    expect(onAccepted).not.toHaveBeenCalled();
    expect(state.refreshed).toBe(0);
  });

  it('refreshes the current user when the pending member is rejected', async () => {
    const onAccepted = vi.fn();
    state.latest = { status_type: 'rejected' };
    await useApprovalWatch({ onAccepted }).check();
    expect(onAccepted).not.toHaveBeenCalled();
    expect(state.refreshed).toBe(1);
  });

  it('never polls for a member who is not pending', async () => {
    const onAccepted = vi.fn();
    state.currentUser = { ...pendingUser(), status: { status_type: 'accepted' } };
    state.latest = { status_type: 'accepted' };
    await useApprovalWatch({ onAccepted }).check();
    expect(onAccepted).not.toHaveBeenCalled();
  });

  it('stops polling once the member is accepted', async () => {
    vi.useFakeTimers();
    try {
      const onAccepted = vi.fn();
      const watch = useApprovalWatch({ onAccepted });
      state.latest = { status_type: 'pending' };
      watch.start();
      expect(watch.watching).toBe(true);
      state.latest = { status_type: 'accepted' };
      await vi.advanceTimersByTimeAsync(15_000);
      expect(onAccepted).toHaveBeenCalledTimes(1);
      expect(watch.watching).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops straight away for a member who is not pending', async () => {
    vi.useFakeTimers();
    try {
      state.currentUser = { ...pendingUser(), status: { status_type: 'accepted' } };
      const watch = useApprovalWatch({ onAccepted: vi.fn() });
      watch.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(watch.watching).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps waiting while the profile is still loading', async () => {
    vi.useFakeTimers();
    try {
      state.currentUser = null;
      const watch = useApprovalWatch({ onAccepted: vi.fn() });
      const stop = watch.start();
      await vi.advanceTimersByTimeAsync(15_000);
      expect(watch.watching).toBe(true);
      // A second start must not add a second timer.
      watch.start();
      expect(vi.getTimerCount()).toBe(1);
      stop();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
