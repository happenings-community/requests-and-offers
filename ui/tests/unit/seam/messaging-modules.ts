import { readFileSync, statSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

/**
 * What counts as messaging, named once.
 *
 * **The rule (R121, the seam): anything defined by messaging, its errors included, is
 * messaging.** Both seam tests read this list, so the two cannot drift apart.
 *
 * It is an explicit list rather than a match on the word "messaging", which missed
 * `routes/(public)/messages` — a whole feature's screens, named in the plural. A match is
 * also a silent thing to get wrong: it looks like it is working right up to the file it
 * does not cover. {@link everyMessagingFileIsListed} guards against the opposite mistake,
 * a new messaging file nobody adds here.
 */
export const MESSAGING_PATHS = [
  'src/lib/components/messaging/',
  'src/lib/composables/domain/messaging/',
  'src/lib/stores/messaging.store.svelte.ts',
  'src/lib/services/zomes/messaging.service.ts',
  'src/lib/schemas/messaging.schemas.ts',
  'src/lib/strings/messaging.strings.ts',
  'src/lib/errors/messaging.errors.ts',
  'src/lib/utils/messaging-threads.ts',
  'src/lib/utils/messaging-local.ts',
  'src/lib/utils/messaging-actions.ts',
  'src/routes/(public)/messages/'
] as const;

/** Is this file part of messaging? */
export const isMessaging = (file: string): boolean =>
  MESSAGING_PATHS.some((p) => (p.endsWith('/') ? file.startsWith(p) : file === p));

/**
 * `utils/error-shape.ts` is deliberately **not** messaging: it reads error shapes and
 * unwraps a guest error, and it moved out of messaging in H1a precisely so that
 * `$lib/errors` could stop dragging the feature in.
 */
export const NOT_MESSAGING_BUT_LOOKS_IT = [
  'src/lib/utils/error-shape.ts',
  /**
   * The module that answers whether messaging is here (H2).
   *
   * Its name says messaging and it is the opposite of a messaging module: it imports
   * nothing of the feature, and reads the answer from a list of the DNA's integrity zome
   * names, handed to it by the root layout's start-up step. If it ever imports messaging,
   * the test below it catches that separately — being on this list exempts it from the
   * name check, not from the seam.
   */
  'src/lib/services/messagingPresence.svelte.ts'
] as const;

// ---------------------------------------------------------------------------
// The import graph
// ---------------------------------------------------------------------------

/** Resolve an import specifier the way the aliases do, to a file and never a folder. */
export function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith('$lib/')) base = join('src/lib', spec.slice('$lib/'.length));
  else if (spec.startsWith('@/')) base = join('src', spec.slice(2));
  else if (spec.startsWith('@lib/')) base = join('src/lib', spec.slice('@lib/'.length));
  else if (spec.startsWith('.')) base = normalize(join(dirname(from), spec));
  else return null; // a package, not ours
  const spellings = [
    base,
    `${base}.ts`,
    `${base}.svelte`,
    `${base}.svelte.ts`,
    join(base, 'index.ts')
  ];
  for (const candidate of spellings) {
    try {
      // A file, never a directory: `$lib/errors` names a folder with an index in it, and
      // taking the folder would try to read it and throw.
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // not there under this spelling; try the next
    }
  }
  return null;
}

/**
 * Every file reachable from `entry` through our own imports.
 *
 * **The graph, not the import lines.** `errors/index.ts` re-exported messaging's errors,
 * which imported from `messaging-threads`, so every exchange page reached the feature
 * two hops away with no mention of messaging anywhere in its own source. A test reading
 * import lines would have passed.
 */
/**
 * Every module specifier in a file, in all four forms.
 *
 * `from '...'` alone missed three, each of which can carry a whole feature in:
 *
 * - **`import '...'`** — a side-effect import, no names, so no `from`.
 * - **`import('...')`** — loaded on demand. Still a dependency; it just arrives later.
 * - **`import('...')` in a type position** — never runs, but it is how a file names a
 *   type from another module, and it is indistinguishable from the runtime form here.
 *
 * `export ... from '...'` is caught by the `from` branch, which is what made the barrel
 * visible in the first place.
 */
export function importSpecifiers(source: string): string[] {
  const pattern = /(?:from\s*|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g;
  return [...source.matchAll(pattern)].map((m) => m[1]);
}

export function reachableFrom(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const spec of importSpecifiers(readFileSync(file, 'utf8'))) {
      const target = resolveImport(file, spec);
      if (target && !seen.has(target)) queue.push(target);
    }
  }
  return seen;
}

/** The messaging modules `entry` can reach, however many hops away. */
export function messagingReachedFrom(entry: string): string[] {
  return [...reachableFrom(entry)].filter(isMessaging).sort();
}

// ---------------------------------------------------------------------------
// Keeping the list honest
// ---------------------------------------------------------------------------

function walk(dir: string, out: string[] = []): string[] {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isDirectory()) walk(path, out);
    else if (/\.(ts|svelte)$/.test(item.name)) out.push(path);
  }
  return out;
}

/**
 * Anything whose path mentions messaging or messages, which the list does not claim.
 *
 * The list is the authority; this is the check that nobody adds a messaging file without
 * telling it. A deliberate exception goes in {@link NOT_MESSAGING_BUT_LOOKS_IT} with a
 * reason, rather than being left to a pattern to decide.
 */
export function everyMessagingFileIsListed(): string[] {
  return walk('src')
    .filter((f) => /messaging|messages/i.test(f))
    .filter((f) => !isMessaging(f))
    .filter((f) => !NOT_MESSAGING_BUT_LOOKS_IT.includes(f as never));
}
