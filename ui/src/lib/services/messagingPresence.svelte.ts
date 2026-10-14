import { errorShape } from '$lib/utils/error-shape';

/**
 * One answer to "is messaging here?" (R121, brief H's rule 2).
 *
 * The formal exchange route is the core of every R&O network; messaging is a layer a
 * network includes and may leave out. The interface asks this module, never the zome, so
 * there is one place that knows and one place to change when a network setting can also
 * switch messaging off.
 *
 * **Absent is not the same as unavailable.** A zome that is not in the DNA is absent, and
 * nothing will change that for the life of the session, so it is cached. A call that
 * failed for any other reason — not connected yet, unauthorised, a slow conductor — says
 * nothing about whether messaging exists, so it is *not* cached: the next ask probes
 * again. Caching a transient failure would disable messaging for a whole session with no
 * way back but a reload, which is the thing I was most worried about in H0.
 */
export type Presence =
  /** Nobody has asked yet. */
  | { state: 'unknown' }
  /** The messaging zome answered, or failed in a way that means it is there. */
  | { state: 'present' }
  /** The messaging zome is not in this DNA. Settled for the session. */
  | { state: 'absent'; reason: 'notInDna' | 'forcedOff' };

/**
 * How the conductor says a zome is not in the DNA.
 *
 * `ZomeNotExists` renders as "Referenced a zome that doesn't exist: Zome: {name}"
 * (`holochain` 0.6.1 and 0.7.0, `src/core/ribosome/error.rs:30-32`), and reaches the
 * client inside `ExternalApiWireError::RibosomeError(String)`
 * (`holochain_conductor_api` 0.6.1 `src/admin_interface.rs:630`).
 *
 * **The variant alone cannot answer this.** `RibosomeError` also carries a guest error
 * from a zome that is perfectly present, so the sentence is what distinguishes them. That
 * is matching on wire text, which I would rather not do; the alternative was
 * `getDnaDefinition`, which names the DNA's zomes outright, but the admin websocket is
 * connected only in e2e runs (`HolochainClientService.svelte.ts:213-216`), so it is not
 * available to a running app.
 *
 * Matched loosely, on the distinctive part rather than the whole sentence, so a change of
 * punctuation upstream does not turn absence into presence. If it ever stops matching the
 * result is "present", and messaging appears where it should not rather than vanishing
 * where it should be.
 */
const NOT_IN_DNA = /referenced a zome that doesn't exist/i;

/**
 * A zome function that is missing is **not** absence.
 *
 * `ZomeFnNotExists` means the zome is there and this build expected a function it does
 * not have, which is a version mismatch and a different problem. Named here so it is
 * clearly a decision rather than an oversight.
 */
const ZOME_PRESENT_FN_MISSING = /attempted to call a zome function that doesn't exist/i;

export function readsAsAbsent(error: unknown): boolean {
  const { message } = errorShape(error);
  if (ZOME_PRESENT_FN_MISSING.test(message)) return false;
  return NOT_IN_DNA.test(message);
}

/** The development switch, so absent mode can be tested without a second build. */
export function forcedOff(): boolean {
  return import.meta.env.VITE_MESSAGING_DISABLED === 'true';
}

/**
 * The cheapest honest probe.
 *
 * `find_sent` is a read, bounded by `since`, so asking for sends since now walks almost
 * nothing and commits nothing. It needs no records to exist and is safe to call before a
 * member has done anything.
 *
 * I considered calling a function that deliberately does not exist, which would do no work
 * at all and still tell the two cases apart. It is cheaper and reads like a trick, and a
 * probe that lies about what it wants is a poor thing to leave for the next person.
 */
export type Probe = () => Promise<unknown>;

export function createMessagingPresence(probe: Probe) {
  let presence = $state<Presence>({ state: 'unknown' });
  let inFlight: Promise<Presence> | null = null;

  async function ask(): Promise<Presence> {
    if (forcedOff()) {
      presence = { state: 'absent', reason: 'forcedOff' };
      return presence;
    }
    // Absence is settled; presence is not re-probed either, since a zome does not leave
    // a running DNA.
    if (presence.state !== 'unknown') return presence;
    // One probe at a time, however many callers ask at start-up.
    if (inFlight) return inFlight;

    inFlight = (async () => {
      try {
        await probe();
        presence = { state: 'present' };
      } catch (error) {
        if (readsAsAbsent(error)) {
          presence = { state: 'absent', reason: 'notInDna' };
        } else {
          // Present but unavailable: say nothing, and leave it unknown so the next ask
          // probes again. The send path already handles a call that fails.
          presence = { state: 'unknown' };
        }
      } finally {
        inFlight = null;
      }
      return presence;
    })();
    return inFlight;
  }

  return {
    get presence() {
      return presence;
    },
    /** True only once the probe has settled on absent. Unknown reads as present. */
    get isAbsent() {
      return presence.state === 'absent';
    },
    ask
  };
}

// ---------------------------------------------------------------------------
// The one the interface asks
// ---------------------------------------------------------------------------

/**
 * **This module imports nothing of messaging, deliberately.**
 *
 * The probe is given to it rather than reached for. If it imported the messaging service
 * to do its own probing, every page that asked "is messaging here?" would reach the whole
 * feature through it — the seam broken by the very module built to keep it, and invisibly,
 * since the walk follows a dynamic import as readily as a static one.
 *
 * So whoever can already see both sides does the wiring: the root layout, at start-up.
 * Until it is installed the answer is "unknown", which reads as present, so a page that
 * asks too early shows messaging rather than hiding it.
 */
const presence = createMessagingPresence(async () => {
  if (!installed) throw new Error('messaging presence probe not installed');
  return installed();
});

let installed: Probe | null = null;

/** Give the presence module its probe. Called once, at start-up. */
export function installProbe(probe: Probe): void {
  installed = probe;
}

export default presence;
