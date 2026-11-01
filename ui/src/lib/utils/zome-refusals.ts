/**
 * Plain wording for refusals the zomes return on purpose.
 *
 * A zome refusal reaches the UI wrapped in the conductor's runtime error, e.g.
 * `Wasm runtime error while working with Ribosome: ... Guest("Entity not
 * accepted: user")`. Members get the plain message; the raw text stays
 * available as `details` so an admin can be sent exactly what happened.
 *
 * Only refusals listed here are rewritten. Anything else keeps its original
 * message, so an unexpected fault is never hidden behind friendly wording.
 */

const REFUSALS: ReadonlyArray<readonly [RegExp, string]> = [
  [
    /Entity not accepted: users?\b/,
    "Your membership hasn't been approved yet, so you can't do this. You'll be able to once an administrator approves you."
  ]
];

export interface PlainError {
  /** What the member sees. */
  message: string;
  /** The original error text, for an admin or a bug report. */
  details: string;
  /** True when the message was rewritten from a known refusal. */
  known: boolean;
}

export function plainZomeError(error: unknown): PlainError {
  const details = error instanceof Error ? error.message : String(error);
  for (const [pattern, message] of REFUSALS) {
    if (pattern.test(details)) return { message, details, known: true };
  }
  return { message: details, details, known: false };
}
