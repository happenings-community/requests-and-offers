import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  MESSAGING_INTEGRITY_ZOME,
  createMessagingPresence,
  presenceFromIntegrityZomes
} from '$lib/services/messagingPresence.svelte';
import { messagingReachedFrom } from './messaging-modules';

/** What `get_network_info` returns on a network that has messaging. */
const WITH_MESSAGING = [
  'requests_and_offers_integrity',
  'misc_integrity',
  'messaging_integrity',
  'exchanges_integrity'
];

/** The same network, built without the messaging layer. */
const WITHOUT_MESSAGING = [
  'requests_and_offers_integrity',
  'misc_integrity',
  'exchanges_integrity'
];

afterEach(() => {
  vi.unstubAllEnvs();
});

/**
 * **Presence is a property of the DNA, so it is a function of the DNA's zome list.**
 *
 * Integrity zomes are chosen at genesis and part of what the DNA hash is taken over, so
 * the same list always gives the same answer. There is no clock, no client and no error
 * wording in this: the first version of H2 probed `find_sent` and read "zome doesn't
 * exist" as absence, which depended on all three — it ran before the client existed, it
 * matched on a conductor sentence, and its fix looped 300 times in 30ms when a call kept
 * failing for some other reason.
 *
 * **To make this go red:** compare against `'messaging'` rather than
 * `'messaging_integrity'` — the coordinator's name, which `dna_info()` does not list — and
 * every network loses its messaging.
 */
describe('presence, as a function of the DNA integrity zomes', () => {
  it.each([
    ['the list names the messaging integrity zome', WITH_MESSAGING, { state: 'present' }],
    [
      'it does not',
      WITHOUT_MESSAGING,
      {
        state: 'absent',
        reason: 'notInDna'
      }
    ],
    ['the list is empty', [], { state: 'absent', reason: 'notInDna' }],
    ['messaging is the only zome', [MESSAGING_INTEGRITY_ZOME], { state: 'present' }]
  ])('%s', (_name, names, expected) => {
    expect(presenceFromIntegrityZomes(names)).toEqual(expected);
  });

  /**
   * The list names integrity zomes, and `messaging` is the coordinator. Asserted so that
   * a future rename cannot quietly make a half-match pass.
   */
  it('does not accept the coordinator name, which the list does not carry', () => {
    expect(presenceFromIntegrityZomes(['messaging'])).toEqual({
      state: 'absent',
      reason: 'notInDna'
    });
  });

  it('is the same answer every time, given the same list', () => {
    const once = presenceFromIntegrityZomes(WITH_MESSAGING);
    const twice = presenceFromIntegrityZomes(WITH_MESSAGING);
    expect(once).toEqual(twice);
  });
});

describe('the development switch', () => {
  it('forces absent even on a DNA that has messaging', () => {
    vi.stubEnv('VITE_MESSAGING_DISABLED', 'true');
    expect(presenceFromIntegrityZomes(WITH_MESSAGING)).toEqual({
      state: 'absent',
      reason: 'forcedOff'
    });
  });

  it('holds from the first frame, before any DNA has been read', () => {
    vi.stubEnv('VITE_MESSAGING_DISABLED', 'true');
    const presence = createMessagingPresence();
    expect(presence.presence).toEqual({ state: 'absent', reason: 'forcedOff' });
    expect(presence.isAbsent).toBe(true);
  });

  it('is off unless it is exactly "true"', () => {
    vi.stubEnv('VITE_MESSAGING_DISABLED', '1');
    expect(presenceFromIntegrityZomes(WITH_MESSAGING)).toEqual({ state: 'present' });
  });
});

describe('the presence module', () => {
  it('has read nothing until it is given a list, and that reads as present', () => {
    const presence = createMessagingPresence();
    expect(presence.presence).toEqual({ state: 'notRead' });
    expect(presence.isAbsent, 'not read yet reads as present, so nothing is hidden').toBe(false);
  });

  it('is present once a list with messaging arrives', () => {
    const presence = createMessagingPresence();
    expect(presence.read(WITH_MESSAGING)).toEqual({ state: 'present' });
    expect(presence.isAbsent).toBe(false);
  });

  it('is absent once a list without messaging arrives', () => {
    const presence = createMessagingPresence();
    expect(presence.read(WITHOUT_MESSAGING)).toEqual({ state: 'absent', reason: 'notInDna' });
    expect(presence.isAbsent).toBe(true);
  });

  /**
   * **A failed read is a fault, not absence.**
   *
   * The start-up step that reads the network catches its own failures and marks itself
   * skipped, so on a fault nothing is handed over at all. Presence has to stay as it was
   * — which reads as present — because the alternative hides messaging on a network that
   * has it, with no way back but a reload. This is the failure mode H0 worried about, and
   * the reason the probe is gone.
   *
   * **To make this go red:** default the handover to `[]` when the list is missing. A
   * `get_network_info` that threw, or a DNA built before it named its zomes, then reads as
   * a network without messaging.
   */
  it('a read that did not answer leaves the state alone', () => {
    const presence = createMessagingPresence();
    expect(presence.read(undefined)).toEqual({ state: 'notRead' });
    expect(presence.isAbsent, 'a fault must not read as absence').toBe(false);
  });

  it('and does not undo an answer it already has', () => {
    const presence = createMessagingPresence();
    presence.read(WITH_MESSAGING);
    expect(presence.read(undefined)).toEqual({ state: 'present' });
  });

  /**
   * Nothing has to ask again, which is the point of reading rather than probing: a second
   * read of the same DNA cannot say anything different, so there is no timing to get
   * right and no effect to loop.
   */
  it('reading the same DNA again changes nothing', () => {
    const presence = createMessagingPresence();
    presence.read(WITHOUT_MESSAGING);
    expect(presence.read(WITHOUT_MESSAGING)).toEqual({ state: 'absent', reason: 'notInDna' });
  });
});

/**
 * **The module that answers "is messaging here?" must not itself reach messaging.**
 *
 * If it imported the messaging service to ask about itself, every page that asked it would
 * reach the whole feature through it — the seam broken by the module built to keep it, and
 * invisibly, since the walk follows a dynamic import as readily as a static one. It takes
 * a list of zome names instead, which is as much as it needs to know.
 */
describe('the presence module keeps the seam itself', () => {
  it('reaches no messaging module', () => {
    expect(messagingReachedFrom('src/lib/services/messagingPresence.svelte.ts')).toEqual([]);
  });
});
