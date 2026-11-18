import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync } from 'svelte';
import { Effect as E } from 'effect';
import { signedIn } from '../../../mocks/reactive-user.svelte';

/**
 * Messaging's background work, started by the root layout while a member is signed in.
 *
 * The case here is one nobody saw on screen: reading the member again replaced the user
 * record, and the layout's effect tracked the record, so the poll, the retry timer and the
 * listener were all stopped and started again each time.
 */

const { presence, store } = vi.hoisted(() => ({
  presence: { isAbsent: false },
  store: {
    loadConversations: vi.fn(),
    startRetrying: vi.fn(),
    listen: vi.fn(),
    stopRetrying: vi.fn(),
    stopListening: vi.fn()
  }
}));

vi.mock('$lib/services/messagingPresence.svelte', () => ({ default: presence }));
vi.mock('$lib/stores/messaging.store.svelte', () => ({ default: store }));
vi.mock('$lib/stores/users.store.svelte', async () => {
  const { signedIn } = await import('../../../mocks/reactive-user.svelte');
  return {
    default: {
      get currentUser() {
        return signedIn.current;
      }
    }
  };
});

const { useMessagingWhileSignedIn, MESSAGING_POLL_MS } = await import(
  '$lib/composables/domain/messaging/useMessagingWhileSignedIn.svelte'
);

/** Something reactive that starting reads, as the real store's state is. */
const storeState = $state({ round: 0 });

const member = () => ({ original_action_hash: new Uint8Array(39), status: 'accepted' });

let stop: () => void = () => {};
const run = (onCounted = vi.fn()) => {
  stop = $effect.root(() => useMessagingWhileSignedIn(onCounted));
  flushSync();
  return onCounted;
};

beforeEach(() => {
  vi.useFakeTimers();
  presence.isAbsent = false;
  signedIn.current = null;
  store.loadConversations.mockReset().mockReturnValue(E.succeed([]));
  store.startRetrying.mockReset().mockImplementation(() => {
    void storeState.round;
    return store.stopRetrying;
  });
  store.listen.mockReset().mockReturnValue(store.stopListening);
  store.stopRetrying.mockReset();
  store.stopListening.mockReset();
});

afterEach(() => {
  stop();
  vi.useRealTimers();
});

describe('messaging while a member is signed in', () => {
  it('starts once someone signs in, and says when the conversations have been counted', async () => {
    const onCounted = run();
    expect(store.startRetrying).not.toHaveBeenCalled();

    signedIn.current = member();
    flushSync();

    expect(store.startRetrying).toHaveBeenCalledTimes(1);
    expect(store.listen).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(onCounted).toHaveBeenCalled());
  });

  it('carries on through the member being read again', () => {
    signedIn.current = member();
    run();

    signedIn.current = member();
    flushSync();
    signedIn.current = member();
    flushSync();

    expect(store.startRetrying).toHaveBeenCalledTimes(1);
    expect(store.listen).toHaveBeenCalledTimes(1);
    expect(store.stopRetrying).not.toHaveBeenCalled();
    expect(store.stopListening).not.toHaveBeenCalled();
  });

  it('reads the conversations again on its own schedule, not each time the member is read', () => {
    signedIn.current = member();
    run();
    expect(store.loadConversations).toHaveBeenCalledTimes(1);

    signedIn.current = member();
    flushSync();
    expect(store.loadConversations).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(MESSAGING_POLL_MS);
    expect(store.loadConversations).toHaveBeenCalledTimes(2);
  });

  it('is not restarted by a change in what starting it read', () => {
    signedIn.current = member();
    run();

    storeState.round++;
    flushSync();

    expect(store.startRetrying).toHaveBeenCalledTimes(1);
    expect(store.stopRetrying).not.toHaveBeenCalled();
  });

  it('stops when the member signs out', () => {
    signedIn.current = member();
    run();

    signedIn.current = null;
    flushSync();

    expect(store.stopRetrying).toHaveBeenCalledTimes(1);
    expect(store.stopListening).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(MESSAGING_POLL_MS * 2);
    expect(store.loadConversations).toHaveBeenCalledTimes(1);
  });

  it('does nothing on a network without messaging', () => {
    presence.isAbsent = true;
    signedIn.current = member();
    run();

    expect(store.loadConversations).not.toHaveBeenCalled();
    expect(store.startRetrying).not.toHaveBeenCalled();
  });
});
