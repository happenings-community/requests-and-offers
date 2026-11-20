import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * **The architecture ratchet: counts may only go down.**
 *
 * The frontend refactoring plan (`documentation/architecture/frontend-refactoring/`) states
 * eight invariants. Four of them can be counted today, and none holds yet. This file counts
 * each against a ceiling equal to the count at `f5c799ad`, so the build is green now and
 * fails the moment a count rises: a new store-to-store import, a new `runEffect` call in a
 * component, a new component subscription, a new `loading: boolean`.
 *
 * It is a test and not a lint rule because CI's lint step is non-blocking by design
 * (`.github/workflows/ci.yml`, "errors non-blocking") and the unit step blocks merges.
 * It sits beside the seam tests for the same reason they do: the repository already
 * enforces architecture as tests.
 *
 * **Lowering a ceiling.** A pull request that removes violations lowers the matching
 * ceiling in the same commit. When a count reaches zero, make that ceiling an equality
 * by leaving it at 0: nothing else changes. Never raise a ceiling to make a build pass;
 * a failing count names what to remove or move instead.
 *
 * Each count mirrors the `git grep` printed above it, run from the repository root, so the
 * number in a failure can be reproduced by hand. The README of the refactoring docs lists
 * the same commands under "Verified baseline".
 */
const CEILINGS = {
  /** INV1: store-to-store imports. 13 at `f5c799ad`, forming two cycles. */
  storeToStoreImports: 13,
  /** INV2, direct: `runPromise`, `runSync` and `runFork` in `.svelte` files. 23 in 14 files. */
  directRunsInComponents: 23,
  /** INV2, widened: `runEffect(` in `.svelte` files. `runEffect` is `E.runPromise` under another name. */
  runEffectInComponents: 222,
  /** INV3, imports: production `.svelte` files that mention `storeEvents`. 7. */
  componentsImportingStoreEvents: 7,
  /** INV3, subscriptions: `storeEventBus.on` sites in production components and routes. 10. */
  componentSubscriptions: 10,
  /** INV6: store files that declare `loading: boolean`. 10. */
  storesWithLoadingBoolean: 10
} as const;

/** Run from `ui/`, like the seam tests: paths are relative to it. */
const SRC = 'src';
const STORES = 'src/lib/stores';
/** INV3's one exemption, and nothing else is exempt. */
const TEST_PAGE = 'src/lib/components/hrea/test-page/';

function filesUnder(dir: string, pattern: RegExp): string[] {
  const out: string[] = [];
  const walk = (current: string) => {
    for (const item of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, item.name);
      if (item.isDirectory()) walk(path);
      else if (pattern.test(item.name)) out.push(path.split('\\').join('/'));
    }
  };
  walk(dir);
  return out.sort();
}

/** Lines in `files` that match `pattern`, like `git grep -n ... | wc -l`. */
function countLines(files: string[], pattern: RegExp): number {
  let total = 0;
  for (const file of files) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (pattern.test(line)) total += 1;
    }
  }
  return total;
}

/** Files in `files` with at least one matching line, like `git grep -l`. */
function countFiles(files: string[], pattern: RegExp): number {
  return files.filter((file) =>
    readFileSync(file, 'utf8')
      .split('\n')
      .some((line) => pattern.test(line))
  ).length;
}

const svelteFiles = filesUnder(SRC, /\.svelte$/);
const productionSvelteFiles = svelteFiles.filter((file) => !file.startsWith(TEST_PAGE));
const storeFiles = filesUnder(STORES, /\.ts$/);

/** What to do about a rise, printed with the number so a red build says it. */
const advice = (name: string) =>
  `${name} rose above its ceiling. Remove or move the new occurrence; ` +
  `a ceiling only ever goes down (see the header of this file).`;

describe('architecture ratchet: counts may only go down', () => {
  it('the scan sees the files it is meant to count', () => {
    // A walk that finds nothing would pass every ceiling and prove nothing.
    expect(svelteFiles.length).toBeGreaterThan(100);
    expect(productionSvelteFiles.length).toBeLessThan(svelteFiles.length);
    expect(storeFiles.length).toBeGreaterThan(10);
  });

  it('INV1: no store imports another store', () => {
    // git grep -nE "from '[^']*\.store\.svelte'" -- ui/src/lib/stores | wc -l
    const count = countLines(storeFiles, /from '[^']*\.store\.svelte'/);
    expect(count, advice('Store-to-store imports')).toBeLessThanOrEqual(
      CEILINGS.storeToStoreImports
    );
  });

  it('INV2: no component runs an Effect it cannot cancel (run*)', () => {
    // git grep -nE 'run(Promise|Sync|Fork)' -- 'ui/src/**/*.svelte' | wc -l
    const count = countLines(svelteFiles, /run(Promise|Sync|Fork)/);
    expect(
      count,
      advice('Direct runPromise/runSync/runFork calls in components')
    ).toBeLessThanOrEqual(CEILINGS.directRunsInComponents);
  });

  it('INV2: no component runs an Effect it cannot cancel (runEffect)', () => {
    // git grep -nE 'runEffect\(' -- 'ui/src/**/*.svelte' | wc -l
    const count = countLines(svelteFiles, /runEffect\(/);
    expect(count, advice('runEffect calls in components')).toBeLessThanOrEqual(
      CEILINGS.runEffectInComponents
    );
  });

  it('INV3: components do not import storeEvents', () => {
    // git grep -l 'storeEvents' -- 'ui/src/**/*.svelte' ':!ui/src/lib/components/hrea/test-page' | wc -l
    const count = countFiles(productionSvelteFiles, /storeEvents/);
    expect(count, advice('Components importing storeEvents')).toBeLessThanOrEqual(
      CEILINGS.componentsImportingStoreEvents
    );
  });

  it('INV3: components do not subscribe to the store event bus', () => {
    // git grep -n 'storeEventBus\.on' -- ui/src/lib/components ui/src/routes ':!ui/src/lib/components/hrea/test-page' | wc -l
    const count = countLines(productionSvelteFiles, /storeEventBus\.on/);
    expect(
      count,
      advice('storeEventBus.on subscriptions in components and routes')
    ).toBeLessThanOrEqual(CEILINGS.componentSubscriptions);
  });

  it('INV6: no store exposes loading: boolean', () => {
    // git grep -l 'loading: boolean' -- ui/src/lib/stores | wc -l
    const count = countFiles(storeFiles, /loading: boolean/);
    expect(count, advice('Stores declaring loading: boolean')).toBeLessThanOrEqual(
      CEILINGS.storesWithLoadingBoolean
    );
  });
});
