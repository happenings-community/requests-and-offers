/**
 * Reading an error, and the zome's own sentence out of it.
 *
 * **Nothing here is about messaging**, which is why it lives on its own. It used to sit
 * in `messaging-threads`, and `errors/messaging.errors.ts` imported `reasonOf` from
 * there, so **every file importing `$lib/errors` pulled the messaging feature in**: its
 * store, its local state and its schemas, including on every exchange page. That is the
 * seam's first rule broken somewhere nobody would look for it.
 *
 * `isTooLong` stayed behind, because it matches `message.rs`'s own wording and is
 * genuinely about messages.
 */

/**
 * Read `name` and `message` off whatever was thrown, **without `instanceof`**.
 *
 * `instanceof` is the wrong tool here for two reasons, and the first is not theoretical.
 * This worktree holds **ten copies of `@holochain/client`**: ours at 0.20.5 and nine at
 * 0.20.0, under `@theweave/*`, `@holochain-open-dev/*` and `vf-graphql-holochain`. Inside
 * Moss the error may be built by one of those, and `instanceof HolochainError` against
 * our copy would miss it. Even `instanceof Error` is not safe: an error crossing a realm,
 * or arriving structured-cloned from a worker, is a plain object with the right fields
 * and the wrong prototype.
 *
 * So the shape is what is read, never the class. The fields are the contract that every
 * copy shares; the constructor is not.
 */
export function errorShape(error: unknown): { name: string; message: string } {
  if (typeof error === 'string') return { name: '', message: error };
  if (error !== null && typeof error === 'object') {
    const shape = error as { name?: unknown; message?: unknown };
    return {
      name: typeof shape.name === 'string' ? shape.name : '',
      // **Not `String(error)`.** An object made with `Object.create(null)` has no
      // `toString`, so converting it throws `Cannot convert object to primitive value` —
      // and this runs inside a catch handler, where throwing would lose the member's
      // message rather than queue it. A null-prototype object is exactly what a
      // structured clone can produce, which is the case this whole function exists for.
      message: typeof shape.message === 'string' ? shape.message : ''
    };
  }
  return { name: '', message: error === null || error === undefined ? '' : String(error) };
}

/**
 * The message off whatever was thrown, read by shape and never by class.
 *
 * The one-liner this replaces, `e instanceof Error ? e.message : String(e)`, is wrong
 * twice over: `instanceof` misses an error from another copy of a library or one that has
 * crossed a realm, and `String(e)` **throws** on an object made with
 * `Object.create(null)`, which is what a structured clone can produce. Two of the places
 * it was used show their result to a member.
 */
export function reasonOf(error: unknown): string {
  return guestReason(errorShape(error).message);
}

/**
 * The zome's own sentence, pulled out of whatever the conductor wrapped it in.
 *
 * A `wasm_error!(Guest("..."))` does not reach the client as that sentence. `catchError`
 * in `@holochain/client` builds `HolochainError(response.value.type,
 * response.value.value)`, and for a guest error the value is the conductor's own
 * rendering of a ribosome error, with our text inside it. Showing that to a member means
 * showing them wire text.
 *
 * So the innermost `Guest("...")` is unwrapped when it is there, and anything else is
 * returned untouched. **Written to tolerate not knowing the wrapper's exact shape**: the
 * one thing it must never do is lose the message, so an unrecognised shape passes
 * straight through rather than being replaced by a guess.
 */
export function guestReason(raw: string): string {
  const match = /Guest\((?:"((?:[^"\\]|\\.)*)"|'([^']*)')\)/.exec(raw);
  const inner = match?.[1] ?? match?.[2];
  if (inner === undefined) return raw;
  // Rust's Debug escaping, undone: the text was a plain sentence before it was wrapped.
  return inner.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
}
