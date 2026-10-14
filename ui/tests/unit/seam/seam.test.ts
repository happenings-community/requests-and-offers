import { describe, it, expect } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  MESSAGING_PATHS,
  everyMessagingFileIsListed,
  isMessaging,
  messagingReachedFrom
} from './messaging-modules';

/**
 * **The seam, as a test** (R121, brief H's three rules).
 *
 * 1. Exchange code never imports messaging, directly or through another module.
 * 2. Shared chrome — the nav bar — may ask whether messaging is present, through H2's one
 *    module, and shows nothing of messaging when it is absent.
 * 3. Messaging extends the exchange pages: it supplies Go to chat, counts and cards, and
 *    the pages work without them.
 *
 * Rule 3 is not a test about imports; it is what H4 to H6 build and what Sam's hand test
 * checks. Rules 1 and 2 are here.
 *
 * **This file is skipped until H4.** It is red today on purpose: H3 moves the interest
 * components, H4 moves the way of reaching the other person, and H5 makes the propose
 * page stand alone. Each unskipped run is the step's own evidence, which is why the red
 * output is in the H1 report rather than only in the history.
 *
 * It reads the **import graph**, not import lines. `errors/index.ts` used to re-export
 * messaging's errors, which imported from `messaging-threads`, so an exchange page reached
 * the feature two hops away without mentioning messaging in its own source.
 */

/** Every page and component on the formal route, which rule 1 governs. */
function exchangeAndListingFiles(): string[] {
  const roots = [
    'src/routes/(public)/exchanges',
    'src/routes/(public)/offers',
    'src/routes/(public)/requests',
    'src/lib/components/exchanges',
    'src/lib/components/offers',
    'src/lib/components/requests'
  ];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, item.name);
      if (item.isDirectory()) walk(path);
      else if (/\.(ts|svelte)$/.test(item.name)) out.push(path);
    }
  };
  for (const root of roots) {
    try {
      if (statSync(root).isDirectory()) walk(root);
    } catch {
      // a root that does not exist yet is not a failure
    }
  }
  return out.sort();
}

describe.skip('the seam', () => {
  /**
   * **Rule 1.** The formal route is the core and must work whole without messaging, so
   * nothing on it may reach the feature, at any number of hops.
   *
   * **To make this go red:** it is red now. It goes green as H3 to H5 move each piece.
   */
  it('no exchange page, listing page or exchange component reaches messaging', () => {
    const offenders = exchangeAndListingFiles()
      .map((file) => ({ file, reached: messagingReachedFrom(file) }))
      .filter((row) => row.reached.length > 0);

    const report = offenders
      .map((row) => `${row.file}\n    ${row.reached.join('\n    ')}`)
      .join('\n');
    expect(offenders, `files on the formal route that reach messaging:\n${report}`).toEqual([]);
  });

  /**
   * **Rule 2.** The nav bar is shared chrome, not exchange code, so it is allowed to ask
   * whether messaging is present — but only that, through H2's module. It may not reach
   * the store, the thread rules or any component.
   */
  it('the nav bar reaches only the module that answers "is messaging here?"', () => {
    const reached = messagingReachedFrom('src/lib/components/shared/NavBar.svelte');
    expect(reached, 'the nav bar should ask H2, not the feature').toEqual([]);
  });
});

/**
 * These two hold today and are not part of the skip: the list has to stay honest while
 * the rest of H is built, or every later run tests less than it appears to.
 */
describe('the list of messaging modules', () => {
  it('claims every file whose path says messaging or messages', () => {
    const unlisted = everyMessagingFileIsListed();
    expect(unlisted, `not in MESSAGING_PATHS: ${unlisted.join(', ')}`).toEqual([]);
  });

  it('includes the messages routes, which a word match missed', () => {
    expect(MESSAGING_PATHS).toContain('src/routes/(public)/messages/');
    expect(isMessaging('src/routes/(public)/messages/[user]/+page.svelte')).toBe(true);
  });

  it('and does not claim the neutral error helper', () => {
    expect(isMessaging('src/lib/utils/error-shape.ts')).toBe(false);
  });
});
