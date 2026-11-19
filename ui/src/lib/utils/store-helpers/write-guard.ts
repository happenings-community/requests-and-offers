/**
 * Keeps a background re-read from undoing a local write.
 *
 * A poll reads the DHT and replaces a store's list. If this member writes
 * while that read is on its way, the read answers with the state from before
 * the write, and applying it would undo the write on screen until the next
 * tick. So each read notes the write count when it starts, and its answer is
 * kept only if nothing was written meanwhile (#340's rule, for any list).
 *
 * ```ts
 * const guard = createWriteGuard();
 * // on every local write:
 * guard.wrote();
 * // around every background read:
 * const keep = guard.begin();
 * const fresh = await read();
 * if (keep()) list.splice(0, list.length, ...fresh);
 * ```
 */
export interface WriteGuard {
  /** Call when this member's write has changed the list locally. */
  wrote: () => void;
  /** Call as a background read starts; the returned function says whether its answer is still current. */
  begin: () => () => boolean;
}

export function createWriteGuard(): WriteGuard {
  let writes = 0;
  return {
    wrote: () => {
      writes += 1;
    },
    begin: () => {
      const at = writes;
      return () => writes === at;
    }
  };
}
