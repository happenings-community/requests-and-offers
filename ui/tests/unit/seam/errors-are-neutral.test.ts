import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { messagingReachedFrom } from './messaging-modules';

/**
 * **`$lib/errors` must not reach messaging.**
 *
 * `errors/index.ts` re-exported `messaging.errors`, which imported `reasonOf` from
 * `utils/messaging-threads`. So every file importing `$lib/errors` pulled the whole
 * messaging feature in transitively — its thread rules, its local state, its schemas —
 * including eleven offer and request components that never mention messaging. That is the
 * seam's first rule broken in a place nobody would look.
 *
 * Two changes answer it. `reasonOf`, `errorShape` and `guestReason` moved to a neutral
 * helper, because they are about error shapes rather than messaging (H1a). And the barrel
 * no longer re-exports a feature's errors at all, because anything defined by messaging,
 * its errors included, is messaging (H1).
 *
 * `isTooLong` stayed with messaging: it matches `message.rs`'s own wording.
 *
 * What counts as messaging, and how the graph is walked, are defined once in
 * `./messaging-modules` and shared with the seam test, so the two cannot drift apart.
 */

describe('the error helpers are neutral', () => {
  /**
   * **To make this go red:** put `reasonOf` back in `utils/messaging-threads` and import
   * it from `errors/messaging.errors.ts`. The chain reappears and this names it.
   */
  it('$lib/errors reaches no messaging module', () => {
    const reached = messagingReachedFrom('src/lib/errors/index.ts');
    // **Nothing, including messaging's own errors.** The rule is that anything defined
    // by messaging is messaging, so the barrel no longer re-exports them: a feature's
    // errors are imported from the feature.
    expect(reached, `$lib/errors reaches: ${reached.join(', ')}`).toEqual([]);
  });

  it('the neutral helper exists and holds the three functions', () => {
    const source = readFileSync('src/lib/utils/error-shape.ts', 'utf8');
    for (const name of ['errorShape', 'reasonOf', 'guestReason']) {
      expect(source, name).toContain(`export function ${name}`);
    }
  });

  it('and it reaches nothing of messaging itself', () => {
    const reached = messagingReachedFrom('src/lib/utils/error-shape.ts');
    expect(reached).toEqual([]);
  });

  /** `isTooLong` matches message.rs's own wording, so it stays with messaging. */
  it('leaves the messaging-specific helper where it is', () => {
    expect(readFileSync('src/lib/utils/messaging-threads.ts', 'utf8')).toContain(
      'export function isTooLong'
    );
  });
});
