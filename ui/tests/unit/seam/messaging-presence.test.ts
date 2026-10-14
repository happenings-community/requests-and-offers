import { describe, it, expect, vi } from 'vitest';
import { createMessagingPresence, readsAsAbsent } from '$lib/services/messagingPresence.svelte';
import { messagingReachedFrom } from './messaging-modules';

/** The conductor's own sentences, from holochain 0.6.1 and 0.7.0. */
const NOT_IN_DNA = new Error(
  "ribosome_error: Referenced a zome that doesn't exist: Zome: messaging"
);
const FN_NOT_IN_ZOME = new Error(
  "ribosome_error: Attempted to call a zome function that doesn't exist: Zome: messaging Fn find_sent"
);
const A_GUEST_ERROR = new Error('ribosome_error: Guest("You must be accepted to send a message")');
const NOT_CONNECTED = new Error('Client not connected');

describe('absent is not the same as unavailable', () => {
  /**
   * **This is the distinction H2 exists for.** A zome that is not in the DNA is absent,
   * and nothing will change that for the session. Anything else says nothing about
   * whether messaging exists, and caching it would disable messaging for a whole session
   * with no way back but a reload.
   *
   * `RibosomeError` carries both cases, so the variant cannot answer it and the sentence
   * has to. **To make this go red:** match on the variant instead, or drop the
   * `ZomeFnNotExists` guard — the guest error and the missing function both read as
   * absence, and messaging disappears from a network that has it.
   */
  it.each([
    ['a zome that is not in the DNA', NOT_IN_DNA, true],
    ['a function this build expected but the zome lacks', FN_NOT_IN_ZOME, false],
    ['a guest error from a zome that is plainly there', A_GUEST_ERROR, false],
    ['not connected yet', NOT_CONNECTED, false],
    ['a bare string', 'something went wrong', false],
    ['an object with no prototype', Object.assign(Object.create(null), { message: 'x' }), false]
  ])('%s', (_name, error, expected) => {
    expect(readsAsAbsent(error)).toBe(expected);
  });
});

describe('the presence module', () => {
  it('is present when the probe resolves', async () => {
    const presence = createMessagingPresence(async () => undefined);
    expect(await presence.ask()).toEqual({ state: 'present' });
    expect(presence.isAbsent).toBe(false);
  });

  it('is absent, and settled, when the zome is not in the DNA', async () => {
    const probe = vi.fn(async () => {
      throw NOT_IN_DNA;
    });
    const presence = createMessagingPresence(probe);
    expect(await presence.ask()).toEqual({ state: 'absent', reason: 'notInDna' });
    await presence.ask();
    expect(probe, 'absence is settled, so it is not probed again').toHaveBeenCalledTimes(1);
  });

  /**
   * The failure mode I was most worried about in H0: one bad moment at start-up turning
   * messaging off for the session.
   */
  it('stays unknown after a failure that is not absence, and probes again', async () => {
    let attempt = 0;
    const presence = createMessagingPresence(async () => {
      attempt += 1;
      if (attempt === 1) throw NOT_CONNECTED;
      return undefined;
    });

    expect(await presence.ask()).toEqual({ state: 'unknown' });
    expect(presence.isAbsent, 'unknown reads as present, so nothing is hidden').toBe(false);
    expect(await presence.ask()).toEqual({ state: 'present' });
    expect(attempt).toBe(2);
  });

  it('probes once however many callers ask at start-up', async () => {
    let started = 0;
    const presence = createMessagingPresence(async () => {
      started += 1;
      await new Promise((r) => setTimeout(r, 5));
      return undefined;
    });
    await Promise.all([presence.ask(), presence.ask(), presence.ask()]);
    expect(started).toBe(1);
  });

  it('does not probe at all until it is asked', async () => {
    const probe = vi.fn(async () => undefined);
    const presence = createMessagingPresence(probe);
    expect(presence.presence).toEqual({ state: 'unknown' });
    expect(probe).not.toHaveBeenCalled();
  });
});

/**
 * **The module that answers "is messaging here?" must not itself reach messaging.**
 *
 * If it imported the messaging service to do its own probing, every page that asked it
 * would reach the whole feature through it — the seam broken by the module built to keep
 * it, and invisibly, since the walk follows a dynamic import as readily as a static one.
 * So the probe is given to it by whoever can already see both sides, which is the root
 * layout at start-up.
 */
describe('the presence module keeps the seam itself', () => {
  it('reaches no messaging module', () => {
    expect(messagingReachedFrom('src/lib/services/messagingPresence.svelte.ts')).toEqual([]);
  });
});
