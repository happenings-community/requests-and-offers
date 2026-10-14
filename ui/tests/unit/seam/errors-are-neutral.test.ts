import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

/**
 * **`$lib/errors` must not reach messaging.**
 *
 * `errors/index.ts` re-exports `messaging.errors`, which imported `reasonOf` from
 * `utils/messaging-threads`. So every file importing `$lib/errors` pulled the whole
 * messaging module in transitively, including every exchange page. That is rule 1 of the
 * seam broken in a place nobody would look, and it would have made H1's test either fail
 * everywhere or be written to miss it.
 *
 * `reasonOf`, `errorShape` and `guestReason` are about error shapes rather than
 * messaging, so they belong in a neutral helper. `isTooLong` matches `message.rs`'s own
 * wording and stays where it is.
 *
 * **This follows the import graph, not the import lines**, which is what H1 needs too.
 */
const ROOT = 'src';

/** Resolve an import specifier to a file, as the aliases do. */
function resolve(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith('$lib/')) base = join(ROOT, 'lib', spec.slice('$lib/'.length));
  else if (spec.startsWith('@/')) base = join(ROOT, spec.slice(2));
  else if (spec.startsWith('.')) base = normalize(join(dirname(from), spec));
  else return null; // a package, not ours
  // A file, never a directory: `$lib/errors` names a folder with an index, and taking
  // the folder itself would try to read it and throw.
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.svelte`,
    `${base}.svelte.ts`,
    join(base, 'index.ts')
  ]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // not there; try the next spelling
    }
  }
  return null;
}

function importsOf(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  return [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
}

/** Every file reachable from `entry`, following our own imports only. */
function reachableFrom(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const spec of importsOf(file)) {
      const target = resolve(file, spec);
      if (target && !seen.has(target)) queue.push(target);
    }
  }
  return seen;
}

const isMessaging = (file: string) =>
  /(^|\/)(components|stores|utils|strings|schemas|composables\/domain)\/messaging/.test(file) ||
  /messaging[-.]/.test(file.split('/').pop() ?? '');

describe('the error helpers are neutral', () => {
  /**
   * **To make this go red:** put `reasonOf` back in `utils/messaging-threads` and import
   * it from `errors/messaging.errors.ts`. The chain reappears and this names it.
   */
  it('$lib/errors reaches no messaging module', () => {
    const reached = [...reachableFrom('src/lib/errors/index.ts')].filter(isMessaging);
    // messaging.errors.ts is itself named for messaging and is allowed to exist; what
    // must not be reachable is the messaging feature's own store, utils and components.
    const feature = reached.filter((f) => !f.endsWith('errors/messaging.errors.ts'));
    expect(feature, `$lib/errors reaches: ${feature.join(', ')}`).toEqual([]);
  });

  it('the neutral helper exists and holds the three functions', () => {
    const source = readFileSync('src/lib/utils/error-shape.ts', 'utf8');
    for (const name of ['errorShape', 'reasonOf', 'guestReason']) {
      expect(source, name).toContain(`export function ${name}`);
    }
  });

  it('and it reaches nothing of messaging itself', () => {
    const reached = [...reachableFrom('src/lib/utils/error-shape.ts')].filter(isMessaging);
    expect(reached).toEqual([]);
  });

  /** `isTooLong` matches message.rs's own wording, so it stays with messaging. */
  it('leaves the messaging-specific helper where it is', () => {
    expect(readFileSync('src/lib/utils/messaging-threads.ts', 'utf8')).toContain(
      'export function isTooLong'
    );
  });
});
