import { describe, it, expect } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  MESSAGING_PATHS,
  everyMessagingFileIsListed,
  isMessaging,
  messagingReachedFrom,
  reachableFrom
} from './messaging-modules';

/**
 * The one module the interface asks whether messaging is here (H2).
 *
 * **It is not a messaging module**, and must not become one: it imports nothing of the
 * feature and is handed the DNA's integrity zome names by the root layout's start-up step.
 * That is what lets shared chrome ask the question without reaching the answer's subject.
 */
const PRESENCE_MODULE = 'src/lib/services/messagingPresence.svelte.ts';

/**
 * **The seam, as a test** (R121, brief H's three rules).
 *
 * 1. Exchange code never imports messaging, directly or through another module.
 * 2. Shared chrome — the nav bar — may ask whether messaging is present, through H2's one
 *    module, and shows nothing of messaging when it is absent.
 * 3. Messaging extends the exchange pages: it supplies Go to chat, counts and cards, and
 *    the pages work without them.
 *
 * Rule 3 is not a test about imports; it is what the later steps build and what the hand
 * test checks. Rules 1 and 2 are here.
 *
 * **This now guards the seam rather than describing where it is going.** It ran red from
 * the day it was written, naming every file that had to move, and was skipped while they
 * moved: ten files, then nine, then one, then none. From here a red run means something
 * new has reached across, and the name it prints is the file that did it.
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

describe('the seam', () => {
  /**
   * **Rule 1.** The formal route is the core and must work whole without messaging, so
   * nothing on it may reach the feature, at any number of hops.
   *
   * **To make this go red:** write a sentence about conversations on a formal page, or
   * read the messaging store for a count one of them shows. Either is a single line, which
   * is the point of having this.
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
   * whether this network has conversations, and to show what one supplies. It may not
   * reach the store, the thread rules or any component: it asks the module that answers
   * the question, and renders what is plugged into the neutral modules beside it.
   */
  it('the nav bar reaches only the module that answers "is messaging here?"', () => {
    const navBar = 'src/lib/components/shared/NavBar.svelte';

    // Nothing of the feature: not the store, not the thread rules, not a component.
    expect(messagingReachedFrom(navBar), 'the nav bar should ask H2, not the feature').toEqual([]);

    // And it does ask. A nav bar that reached nothing at all would pass the line above
    // while showing a messaging badge that never turns off, so what it *may* reach is
    // asserted as well as what it may not.
    expect([...reachableFrom(navBar)], 'the nav bar asks the presence module').toContain(
      PRESENCE_MODULE
    );
  });
});

/**
 * The list has to stay honest, or the two tests above check less than they appear to: a
 * messaging file nobody added to it is a file the walk does not recognise as messaging.
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
