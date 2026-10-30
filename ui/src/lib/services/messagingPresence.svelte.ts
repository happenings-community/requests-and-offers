/**
 * One answer to "is messaging here?" (R121, brief H's rule 2), read from the DNA.
 *
 * The formal exchange route is the core of every R&O network; messaging is a layer a
 * network includes and may leave out. The interface asks this module, never the zome, so
 * there is one place that knows and one place to change when a network setting can also
 * switch messaging off.
 *
 * **It is read, not probed.** Whether a network has messaging is chosen at genesis and
 * fixed for the life of the DNA: integrity zomes are part of what the DNA hash is taken
 * over, so a network cannot gain or lose one. `get_network_info` names them, the start-up
 * step that already calls it hands the list here, and messaging is present when
 * `messaging_integrity` is in it.
 *
 * **A failed read is a fault, not absence.** Nothing here turns a call that did not answer
 * into "no messaging": until a list arrives the state is "not read yet", which reads as
 * present. A fault therefore shows messaging that may not work, rather than hiding
 * messaging that does — and no one has to ask again for absence to settle, because absence
 * is a property of the DNA rather than of a moment.
 */
export type Presence =
  /** No list has arrived yet. Reads as present. */
  | { state: 'notRead' }
  /** `messaging_integrity` is in the DNA. */
  | { state: 'present' }
  /** It is not, or the development switch is on. Fixed for the life of the DNA. */
  | { state: 'absent'; reason: 'notInDna' | 'forcedOff' };

/**
 * The integrity zome a network has when it has messaging.
 *
 * `dna_info()` lists integrity zomes only, which is the right list to read: they are
 * fixed for the life of the DNA, while coordinators can be swapped without changing its
 * hash. So this answers "does this network have messaging?" and not "is a particular
 * build of it installed right now?".
 */
export const MESSAGING_INTEGRITY_ZOME = 'messaging_integrity';

/** The development switch, so absent mode can be tested with a full DNA. */
export function forcedOff(): boolean {
  return import.meta.env.VITE_MESSAGING_DISABLED === 'true';
}

/**
 * The whole decision, as a function of the DNA's integrity zomes.
 *
 * No clock, no client, no error wording: given the list, the answer is the same every
 * time. The switch comes first, so absent mode can be tested against a DNA that does
 * have messaging.
 */
export function presenceFromIntegrityZomes(integrityZomeNames: readonly string[]): Presence {
  if (forcedOff()) return { state: 'absent', reason: 'forcedOff' };
  return integrityZomeNames.includes(MESSAGING_INTEGRITY_ZOME)
    ? { state: 'present' }
    : { state: 'absent', reason: 'notInDna' };
}

export function createMessagingPresence() {
  // The switch holds from the first frame, rather than from whenever the DNA is read.
  let presence = $state<Presence>(
    forcedOff() ? { state: 'absent', reason: 'forcedOff' } : { state: 'notRead' }
  );

  return {
    get presence() {
      return presence;
    },
    /** True only once a list has been read and messaging was not in it. */
    get isAbsent() {
      return presence.state === 'absent';
    },
    /**
     * Hand over the DNA's integrity zomes. The start-up step that already reads the
     * network does this; see the root layout's step 3.
     *
     * `undefined` is **not** an empty list: a call that did not answer, or a DNA built
     * before `get_network_info` named its zomes, leaves the state alone. Treating a
     * missing list as absence would hide messaging on a network that has it, which is the
     * one failure this design exists to rule out.
     */
    read(integrityZomeNames: readonly string[] | undefined): Presence {
      if (!integrityZomeNames) return presence;
      presence = presenceFromIntegrityZomes(integrityZomeNames);
      return presence;
    }
  };
}

// ---------------------------------------------------------------------------
// The one the interface asks
// ---------------------------------------------------------------------------

/**
 * **This module imports nothing of messaging, deliberately.**
 *
 * It takes a list of zome names, which is as much as it needs to know. If it reached the
 * messaging service to ask about itself, every page that asked "is messaging here?" would
 * reach the whole feature through it — the seam broken by the very module built to keep
 * it, and invisibly, since the walk follows a dynamic import as readily as a static one.
 *
 * Until the DNA is read the answer is "not read yet", which reads as present, so a page
 * that asks before start-up has finished shows messaging rather than hiding it.
 */
const presence = createMessagingPresence();

export default presence;
