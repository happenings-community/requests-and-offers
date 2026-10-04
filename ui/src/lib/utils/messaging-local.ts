/**
 * A member's local messaging state: everything this device remembers that the network
 * does not.
 *
 * **One namespace with a version**, rather than a key per thing, because a future
 * migration exports this as versioned JSON for import into a new network (Sam,
 * 4 October), and a scatter of keys is something that has to be enumerated correctly at
 * exactly the wrong moment. Blocks, read state and receipt settings join it as they move
 * off the chain.
 *
 * Kept here rather than inside the store so the version rules can be tested against a
 * fake storage. They are the kind of rule that fails silently and expensively.
 */

/**
 * A message that has not gone out yet.
 *
 * Lives here rather than in the store because it is part of what this device remembers,
 * and so part of what a migration exports.
 */
export type OutboxItem = {
  /**
   * This message's identity, kept across every retry and across a reload.
   *
   * An item leaves the outbox only when its own send has succeeded, matched by this id
   * rather than by position or content, so a retry cannot drop the wrong one and two
   * identical messages to the same person stay two messages.
   */
  id: string;
  /** The counterparty's `User`, base64, which is also the thread key. */
  to: string;
  content: string;
  /** When the member pressed Send, in milliseconds. */
  queuedAt: number;
  /**
   * What the app may do next, which follows from whether the message may already have
   * been written (Sam, 4 October).
   *
   * - `waiting` — the zome refused before committing, so retrying is safe and automatic.
   * - `mayNotHaveSent` — no answer came back. It **may** have committed, so it is never
   *   retried by itself; the member is asked.
   * - `refused` — the zome answered no. Nothing was written and trying again would fail
   *   the same way, so `reason` is shown and there is no retry.
   */
  state: 'waiting' | 'mayNotHaveSent' | 'refused';
  /** The zome's own words, on `refused`, or the transport's, on `mayNotHaveSent`. */
  reason?: string;
};

export const LOCAL_SCHEMA_VERSION = 1;

export const localKey = (agentB64: string) => `messaging.v${LOCAL_SCHEMA_VERSION}.${agentB64}`;

export type MessagingLocalState = {
  schemaVersion: number;
  /** Thread keys the member has archived. */
  archived: string[];
  outbox: OutboxItem[];
};

export const EMPTY_LOCAL: MessagingLocalState = {
  schemaVersion: LOCAL_SCHEMA_VERSION,
  archived: [],
  outbox: []
};

/** The slice of `localStorage` this needs, so a test can pass a fake. */
export type LocalStore = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * Read this agent's local state, or empty when there is none we can understand.
 *
 * An unrecognised `schemaVersion` reads as empty, because guessing at a shape we do not
 * know is how an archive marker becomes an outbox entry. **Reading it as empty is not the
 * same as it being absent**, and `writeLocal` is where that distinction is kept.
 */
export function readLocal(store: LocalStore | undefined, key: string): MessagingLocalState {
  if (!store) return EMPTY_LOCAL;
  try {
    const raw = store.getItem(key);
    if (!raw) return EMPTY_LOCAL;
    const parsed = JSON.parse(raw) as Partial<MessagingLocalState>;
    if (parsed.schemaVersion !== LOCAL_SCHEMA_VERSION) return EMPTY_LOCAL;
    return {
      schemaVersion: LOCAL_SCHEMA_VERSION,
      archived: Array.isArray(parsed.archived) ? parsed.archived : [],
      outbox: Array.isArray(parsed.outbox) ? parsed.outbox : []
    };
  } catch {
    // Corrupt JSON, or a store that throws. Neither should take the screen down.
    return EMPTY_LOCAL;
  }
}

/**
 * Merge a patch into this agent's local state.
 *
 * **A version we do not recognise is left completely alone** (Sam, 4 October). The
 * tempting shortcut is to treat it as absent and write over it, and that destroys real
 * data: a newer build's outbox holds messages the member typed and has not sent, and
 * overwriting it loses them silently with no way back. Older code meeting newer data
 * should degrade, not delete.
 *
 * So this returns `false` without writing, and the caller carries on with an in-memory
 * view that simply does not persist.
 */
export function writeLocal(
  store: LocalStore | undefined,
  key: string,
  patch: Partial<MessagingLocalState>
): boolean {
  if (!store) return false;
  try {
    const raw = store.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<MessagingLocalState>;
      if (parsed.schemaVersion !== undefined && parsed.schemaVersion !== LOCAL_SCHEMA_VERSION) {
        return false;
      }
    }
    const next = { ...readLocal(store, key), ...patch, schemaVersion: LOCAL_SCHEMA_VERSION };
    store.setItem(key, JSON.stringify(next));
    return true;
  } catch {
    // Private browsing, or a full quota. Losing an archive marker is survivable; losing
    // the screen is not.
    return false;
  }
}
