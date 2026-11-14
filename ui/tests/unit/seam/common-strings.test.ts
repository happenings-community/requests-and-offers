import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { COMMON_STRINGS } from '$lib/strings/common.strings';

/**
 * **The same word, written out in a dozen places, drifts.**
 *
 * A listing's type and the stand-ins for a name or title that is not there appear on the
 * formal pages and in conversations alike. Written where each was needed, the same fallback
 * turned up as "A member" in one place and "a member" in another, and a copy review would
 * have had to find every one of them. They live in one module now, and this keeps them
 * there.
 */

/** Where these words are allowed to be written out: the one module that holds them. */
const HOME = 'src/lib/strings/common.strings.ts';

/**
 * Two that were written out before this work began, in files it did not otherwise touch.
 *
 * **Named rather than swept up**, because a change about one thing should not quietly
 * rewrite another, and because naming them is what makes the check below mean something:
 * it fails on a new one just as readily as on these. Both are on the post-alpha-2 tidy
 * list, and this list shrinks to nothing when they are done.
 */
const LEFT_FOR_THE_TIDY_LIST = [
  'src/lib/components/exchanges/ListingInterest.svelte',
  'src/routes/(public)/exchanges/[id]/+page.svelte'
];

const ROOTS = [
  'src/lib/components/messaging',
  'src/lib/components/exchanges',
  'src/lib/composables/domain/messaging',
  'src/routes/(public)/messages',
  'src/routes/(public)/exchanges'
];

const WORDS = [
  COMMON_STRINGS.someone,
  COMMON_STRINGS.someoneInSentence,
  COMMON_STRINGS.something,
  COMMON_STRINGS.loading,
  COMMON_STRINGS.listingType.offer,
  COMMON_STRINGS.listingType.request
];

function filesUnder(roots: string[]): string[] {
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

/**
 * The words are read from the module itself, so this cannot drift from what it guards: a
 * reworded fallback is searched for in its new wording.
 *
 * **Only where the word is the thing shown**, which means a quoted literal or a line of
 * markup, never prose. "A member who has just published a listing" is a sentence in a
 * comment explaining why a component exists, and counting it would make this test noise
 * that everyone learns to ignore.
 */
function writesOneOut(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  // A unicode escape renders as the same character, so both spellings count.
  const rendered = source.replace(/\\u\{([0-9a-fA-F]+)\}/g, (_m, hex) =>
    String.fromCodePoint(parseInt(hex, 16))
  );
  const withoutComments = rendered
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  return WORDS.filter((word) => {
    const quoted = new RegExp(`['\`"]${word.replace(/[.*+?^$()|[\]\\]/g, '\\$&')}['\`"]`);
    const shown = new RegExp(`>\\s*${word.replace(/[.*+?^$()|[\]\\]/g, '\\$&')}\\s*<`);
    return quoted.test(withoutComments) || shown.test(withoutComments);
  });
}

describe('the words that belong to no feature are written in one place', () => {
  /**
   * **To make this go red:** write `'A member'` into a component as a fallback again,
   * rather than reading it from the common strings. It names the file and the word.
   */
  it('no page, component or composable writes one out', () => {
    const offenders = filesUnder(ROOTS)
      .filter((file) => file !== HOME && !LEFT_FOR_THE_TIDY_LIST.includes(file))
      .map((file) => ({ file, words: writesOneOut(file) }))
      .filter((row) => row.words.length > 0);

    const report = offenders.map((row) => `${row.file}: ${row.words.join(', ')}`).join('\n');
    expect(offenders, `written out instead of read:\n${report}`).toEqual([]);
  });

  /** And the two that were left are still only those two, with nothing added to the list. */
  it('and the two left for the tidy list are still just those two', () => {
    const stillThere = LEFT_FOR_THE_TIDY_LIST.filter((file) => writesOneOut(file).length > 0);
    expect(stillThere, 'a name on this list that is already tidy should come off it').toEqual(
      LEFT_FOR_THE_TIDY_LIST
    );
  });
});
