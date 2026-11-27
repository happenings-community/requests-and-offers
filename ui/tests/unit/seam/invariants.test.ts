import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * **The architecture ratchet: each count is pinned, and may only go down.**
 *
 * The frontend refactoring plan (`documentation/architecture/frontend-refactoring/`) states
 * nine invariants. Five of them can be counted today, and one of those holds. This file counts
 * each and pins it to the count at the commit named beside the ceilings, so the build is
 * green now and red the moment a count moves: a new store-to-store import, a new `runEffect`
 * call in a component, a new component subscription, a new store that exposes `loading`, a
 * new zome call that hands the raw client a payload which is not plain data.
 *
 * **It is an equality, in both directions.** A rise fails, naming what to remove. A fall
 * fails too, naming the new ceiling, so the slack a conversion leaves behind cannot be spent
 * on a new violation elsewhere: swapping two removed calls for one added call would pass a
 * ceiling that only checked for a rise. The cost is that a pull request that removes
 * violations lowers the matching ceiling in the same commit, which is the intent.
 *
 * It is a test and not a lint rule because CI's lint step is non-blocking by design
 * (`.github/workflows/ci.yml`, "errors non-blocking") and the unit step blocks merges.
 * It sits beside the seam tests for the same reason they do: the repository already
 * enforces architecture as tests.
 *
 * **Lowering a ceiling.** Set it to the number the failure prints, in the same commit that
 * removed the violations. Never raise one to make a build pass; a rise names what to remove
 * or move instead. A ceiling that reaches 0 stays an equality: nothing else changes.
 *
 * **What counts.** Comments are stripped first, so a converted call left behind as a comment
 * does not count. Each count otherwise mirrors the `git grep` printed above it, run from the
 * repository root, and the README of the refactoring docs lists the same commands under
 * "Verified baseline". `git grep` does not skip comments, so its number can be higher than
 * the test's by the commented occurrences, and never lower.
 */
const CEILINGS = {
  /** INV1: store-to-store imports. Two cycles. */
  storeToStoreImports: 13,
  /** INV2, direct: `runPromise`, `runSync` and `runFork` in `.svelte` files. */
  directRunsInComponents: 19,
  /** INV2, widened: `runEffect(` in `.svelte` files. `runEffect` is `E.runPromise` under another name. */
  runEffectInComponents: 222,
  /** INV3, imports: production component and route files that mention `storeEvents`. */
  componentsImportingStoreEvents: 7,
  /** INV3, subscriptions: `storeEventBus.on` sites in production components and routes. */
  componentSubscriptions: 10,
  /** INV6: store files that expose `loading` in any form, a getter or a field. */
  storesExposingLoading: 11,
  /**
   * INV9: calls to a raw Holochain client (`.callZome({ ... })`) in `ui/src`. Three in
   * `HolochainClientService`, one in the client `hrea.service` hands the hREA adapter.
   * A new one is a new way out of the page, and has to pass the check below as well.
   */
  rawClientZomeCalls: 4,
  /** INV9, the rule itself: raw-client calls whose payload is neither `null` nor `toZomePayload(...)`. Holds. */
  rawClientCallsWithoutPlainPayload: 0
} as const;

/** Run from `ui/`, like the seam tests: paths are relative to it. */
const SRC = 'src';
const STORES = 'src/lib/stores';
const COMPONENT_ROOTS = ['src/lib/components', 'src/routes'];
/** INV3's one exemption, and nothing else is exempt. */
const TEST_PAGE = 'src/lib/components/hrea/test-page/';

/**
 * Blanks line, block and HTML comments, keeping every newline so line counts hold, and
 * leaves string, template and attribute literals alone: a `/*` in `accept="image/*"` or a
 * `//` in `'a // b'` is text, not a comment, and must not hide the code after it.
 *
 * A quoted literal ends at its closing quote or at the end of the line, whichever comes
 * first, so an apostrophe in markup prose ("don't") masks one line at most. A template
 * literal runs across lines, and the code inside its `${ }` is scanned as code. A `//`
 * right after a colon is a URL, not a comment.
 */
function stripComments(source: string): string {
  let out = '';
  let i = 0;
  const n = source.length;
  /** Depth of `{` inside each open `${ }`, innermost last: a `}` at depth 0 returns to the template. */
  const templateBraces: number[] = [];
  const blank = (text: string) => text.replace(/[^\n]/g, '');

  const copyQuoted = (quote: string) => {
    out += source[i++];
    while (i < n && source[i] !== quote && source[i] !== '\n') {
      if (source[i] === '\\' && i + 1 < n && source[i + 1] !== '\n') out += source[i++];
      out += source[i++];
    }
    if (i < n && source[i] === quote) out += source[i++];
  };

  /** Copies a template literal up to its closing backtick, or up to a `${` that opens code. */
  const copyTemplate = () => {
    while (i < n && source[i] !== '`') {
      if (source[i] === '\\' && i + 1 < n) out += source[i++];
      else if (source[i] === '$' && source[i + 1] === '{') {
        out += source[i++] + source[i++];
        templateBraces.push(0);
        return;
      }
      out += source[i++];
    }
    if (i < n) out += source[i++];
  };

  while (i < n) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === "'" || ch === '"') copyQuoted(ch);
    else if (ch === '`') {
      out += source[i++];
      copyTemplate();
    } else if (ch === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      out += blank(source.slice(i, stop));
      i = stop;
    } else if (ch === '<' && source.startsWith('<!--', i)) {
      const end = source.indexOf('-->', i + 4);
      const stop = end === -1 ? n : end + 3;
      out += blank(source.slice(i, stop));
      i = stop;
    } else if (ch === '/' && next === '/' && source[i - 1] !== ':') {
      while (i < n && source[i] !== '\n') i++;
    } else {
      if (templateBraces.length > 0) {
        if (ch === '{') templateBraces[templateBraces.length - 1]++;
        else if (ch === '}') {
          if (templateBraces[templateBraces.length - 1] === 0) {
            templateBraces.pop();
            out += source[i++];
            copyTemplate();
            continue;
          }
          templateBraces[templateBraces.length - 1]--;
        }
      }
      out += source[i++];
    }
  }
  return out;
}

/** Lines of `source` that match `pattern`, comments stripped, like `git grep -n ... | wc -l`. */
function countLines(source: string, pattern: RegExp): number {
  return stripComments(source)
    .split('\n')
    .filter((line) => pattern.test(line)).length;
}

/**
 * A line that imports a store module, in any form: `from` with either quote, the
 * `.store.svelte` suffix with or without `.ts`, a dynamic `import()`, a side-effect `import`.
 */
/** `runEffect(`, with a type argument or a space before the parenthesis. */
const RUN_EFFECT = /\brunEffect\s*(?:<[^()]*>)?\s*\(/;
/** `storeEventBus.on`, or the optional-chained `storeEventBus?.on`. */
const BUS_ON = /\bstoreEventBus\s*\??\.\s*on\b/;

/**
 * Each raw-client zome call in `source`: the text from `.callZome({` to the end of its object.
 * The service's own `callZome(zome, fn, payload)` takes positional arguments, so it never
 * matches; only a request object handed straight to `@holochain/client` does.
 */
function rawZomeCalls(source: string): string[] {
  const code = stripComments(source);
  const calls: string[] = [];
  const start = /\.callZome\s*\(\s*\{/g;
  for (let match = start.exec(code); match; match = start.exec(code)) {
    let depth = 0;
    let end = match.index + match[0].length - 1;
    for (; end < code.length; end++) {
      if (code[end] === '{') depth++;
      else if (code[end] === '}' && --depth === 0) break;
    }
    calls.push(code.slice(match.index, end + 1));
  }
  return calls;
}

/** A raw-client call whose payload leaves the page as plain data: `null`, or through `toZomePayload`. */
const sendsPlainPayload = (call: string): boolean =>
  /\bpayload\s*:\s*(?:null\b|toZomePayload\s*\()/.test(call);

const STORE_IMPORT = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"][^'"]*\.store\.svelte(?:\.ts)?['"]/;

/** A store that exposes `loading`: the interface field, the getter, or the rune it reads. */
const EXPOSES_LOADING = [/\bloading\s*:\s*boolean\b/, /\bget\s+loading\s*\(/, /\blet\s+loading\b/];

function exposesLoading(source: string): boolean {
  const code = stripComments(source);
  return EXPOSES_LOADING.some((pattern) => pattern.test(code));
}

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

const read = (file: string) => readFileSync(file, 'utf8');
const total = (files: string[], count: (source: string) => number) =>
  files.reduce((sum, file) => sum + count(read(file)), 0);

const svelteFiles = filesUnder(SRC, /\.svelte$/);
const storeFiles = filesUnder(STORES, /\.ts$/);
const productionComponentFiles = COMPONENT_ROOTS.flatMap((root) =>
  filesUnder(root, /\.(svelte|ts)$/)
).filter((file) => !file.startsWith(TEST_PAGE));

/** Pins `count` to its ceiling, and says which way it moved and what to do about it. */
function pinned(name: string, count: number, ceiling: number) {
  const message =
    count > ceiling
      ? `${name} rose from ${ceiling} to ${count}. Remove or move the new occurrence; a ceiling only ever goes down.`
      : count < ceiling
        ? `${name} fell from ${ceiling} to ${count}: lower the ceiling to ${count} in this PR.`
        : '';
  expect(count, message).toBe(ceiling);
}

describe('architecture ratchet: each count is pinned, and may only go down', () => {
  it('the scan sees the files it is meant to count', () => {
    // A walk that finds nothing would pass every ceiling at zero and prove nothing.
    expect(svelteFiles.length).toBeGreaterThan(100);
    expect(productionComponentFiles.length).toBeGreaterThan(100);
    expect(productionComponentFiles.length).toBeLessThan(
      filesUnder('src/lib/components', /\.(svelte|ts)$/).length +
        filesUnder('src/routes', /\.(svelte|ts)$/).length
    );
    expect(storeFiles.length).toBeGreaterThan(10);
  });

  it('INV1: no store imports another store', () => {
    // git grep -nE "(from|import)[^']*['\"][^'\"]*\.store\.svelte" -- ui/src/lib/stores | wc -l
    pinned(
      'Store-to-store imports',
      total(storeFiles, (source) => countLines(source, STORE_IMPORT)),
      CEILINGS.storeToStoreImports
    );
  });

  it('INV2: no component runs an Effect it cannot cancel (run*)', () => {
    // git grep -nE 'run(Promise|Sync|Fork)' -- 'ui/src/**/*.svelte' | wc -l
    pinned(
      'Direct runPromise/runSync/runFork calls in components',
      total(svelteFiles, (source) => countLines(source, /run(Promise|Sync|Fork)/)),
      CEILINGS.directRunsInComponents
    );
  });

  it('INV2: no component runs an Effect it cannot cancel (runEffect)', () => {
    // git grep -nE 'runEffect\(' -- 'ui/src/**/*.svelte' | wc -l
    pinned(
      'runEffect calls in components',
      total(svelteFiles, (source) => countLines(source, RUN_EFFECT)),
      CEILINGS.runEffectInComponents
    );
  });

  it('INV3: components do not import storeEvents', () => {
    // git grep -l 'storeEvents' -- ui/src/lib/components ui/src/routes ':!ui/src/lib/components/hrea/test-page' | wc -l
    pinned(
      'Component and route files importing storeEvents',
      productionComponentFiles.filter((file) => countLines(read(file), /storeEvents/) > 0).length,
      CEILINGS.componentsImportingStoreEvents
    );
  });

  it('INV3: components do not subscribe to the store event bus', () => {
    // git grep -n 'storeEventBus\.on' -- ui/src/lib/components ui/src/routes ':!ui/src/lib/components/hrea/test-page' | wc -l
    pinned(
      'storeEventBus.on subscriptions in components and routes',
      total(productionComponentFiles, (source) => countLines(source, BUS_ON)),
      CEILINGS.componentSubscriptions
    );
  });

  it('INV9: every payload handed to the raw client is plain data', () => {
    // git grep -n 'callZome({' -- ui/src
    const calls = filesUnder(SRC, /\.(svelte|ts)$/).flatMap((file) => rawZomeCalls(read(file)));
    pinned('Raw-client zome calls', calls.length, CEILINGS.rawClientZomeCalls);
    pinned(
      'Raw-client zome calls whose payload is not null or toZomePayload(...)',
      calls.filter((call) => !sendsPlainPayload(call)).length,
      CEILINGS.rawClientCallsWithoutPlainPayload
    );
  });

  it('INV6: no store exposes loading', () => {
    // git grep -lE 'loading: boolean|get loading\(|let loading\b' -- ui/src/lib/stores | wc -l
    pinned(
      'Stores exposing loading',
      storeFiles.filter((file) => exposesLoading(read(file))).length,
      CEILINGS.storesExposingLoading
    );
  });
});

/**
 * **The counters, tested.** The ratchet rests on these patterns: if one cannot see a form,
 * the rule it enforces is narrower than it reads, and silently so. Each form is shown
 * separately, so a regression names which one broke.
 */
describe('the counters see every form', () => {
  it.each([
    ['a single-quoted import', "import usersStore from '$lib/stores/users.store.svelte';"],
    ['a double-quoted import', 'import usersStore from "$lib/stores/users.store.svelte";'],
    ['the .ts suffix', "import usersStore from './users.store.svelte.ts';"],
    ['a type import', "import type { UsersStore } from './users.store.svelte';"],
    ['a re-export', "export { default } from './users.store.svelte';"],
    ['a dynamic import', "const m = await import('./users.store.svelte');"],
    ['a side-effect import', "import './users.store.svelte';"]
  ])('INV1 counts %s', (_form, line) => {
    expect(countLines(line, STORE_IMPORT)).toBe(1);
  });

  it('INV1 ignores a commented import and a non-store import', () => {
    expect(countLines("// import x from './users.store.svelte';", STORE_IMPORT)).toBe(0);
    expect(countLines("/* import x from './users.store.svelte'; */", STORE_IMPORT)).toBe(0);
    expect(countLines("import { E } from './storeEvents';", STORE_IMPORT)).toBe(0);
  });

  it.each([
    ['the interface field', 'interface S { readonly loading: boolean; }'],
    ['a getter', 'return { get loading() { return loading; } };'],
    ['the rune', 'let loading = $state(false);']
  ])('INV6 counts a store that exposes loading as %s', (_form, source) => {
    expect(exposesLoading(source)).toBe(true);
  });

  it('INV6 ignores a comment and a store with no loading', () => {
    expect(exposesLoading('// let loading = $state(false);')).toBe(false);
    expect(exposesLoading('const cache = new Map();')).toBe(false);
  });

  it('comments are stripped, newlines are kept, and a URL survives', () => {
    const source = [
      'runEffect(a); // runEffect(b)',
      '/* runEffect(c)',
      'runEffect(d) */',
      "const u = 'https://x.y/runEffect(';"
    ].join('\n');
    const stripped = stripComments(source);
    expect(stripped.split('\n')).toHaveLength(4);
    expect(countLines(source, RUN_EFFECT)).toBe(2);
  });

  it('a /* inside an attribute does not open a comment, so the call after it still counts', () => {
    const source = [
      '<input accept="image/*" />',
      '<button onclick={() => runEffect(save())}>Save</button>',
      '/* a real comment */'
    ].join('\n');
    expect(countLines(source, RUN_EFFECT)).toBe(1);
  });

  it.each([
    ['a single-quoted string', "const a = 'x // y'; runEffect(save());"],
    ['a double-quoted string', 'const a = "x // y"; runEffect(save());'],
    ['a string holding /*', "const a = '/*'; runEffect(save()); // */"],
    ['a template literal', 'const a = `x // y`; runEffect(save());'],
    ['code inside a template', 'const a = `${runEffect(save())} // y`;']
  ])('a comment marker inside %s is text, not a comment', (_form, source) => {
    expect(countLines(source, RUN_EFFECT)).toBe(1);
  });

  it('a real comment after a literal is still stripped', () => {
    expect(countLines("const a = 'x'; // runEffect(gone)", RUN_EFFECT)).toBe(0);
    expect(countLines('const a = `x`; /* runEffect(gone) */', RUN_EFFECT)).toBe(0);
  });

  it('an apostrophe in markup prose masks one line at most', () => {
    const source = [
      "<p>don't</p>",
      'runEffect(a); // runEffect(gone)',
      '/* runEffect(gone) */'
    ].join('\n');
    expect(countLines(source, RUN_EFFECT)).toBe(1);
  });

  it.each([
    ['a type argument', 'runEffect<Foo>(x)'],
    ['a nested type argument', 'runEffect<Array<Foo>>(x)'],
    ['a space before the parenthesis', 'runEffect (x)']
  ])('runEffect is counted with %s', (_form, source) => {
    expect(countLines(source, RUN_EFFECT)).toBe(1);
  });

  it('runEffect is not counted when it is only imported', () => {
    expect(countLines("import { runEffect } from '$lib/utils/effect';", RUN_EFFECT)).toBe(0);
  });

  it.each([
    ['a plain call', 'storeEventBus.on("a", f)'],
    ['an optional chain', 'storeEventBus?.on("a", f)'],
    ['a space before the dot', 'storeEventBus .on("a", f)']
  ])('storeEventBus.on is counted as %s', (_form, source) => {
    expect(countLines(source, BUS_ON)).toBe(1);
  });

  it.each([
    ['a null payload', "client.callZome({ zome_name: 'misc', fn_name: 'f', payload: null })", true],
    ['a plain payload', 'client.callZome({ fn_name: f, payload: toZomePayload(payload) })', true],
    [
      'a spread request',
      'c.callZome({ ...request, payload: toZomePayload(request.payload) }, t)',
      true
    ],
    ['a shorthand payload', 'client.callZome({ zome_name: z, fn_name: f, payload })', false],
    ['a bare payload', 'client.callZome({ zome_name: z, payload: input.timeframe })', false]
  ])('INV9 reads %s', (_form, source, plain) => {
    const calls = rawZomeCalls(source);
    expect(calls).toHaveLength(1);
    expect(sendsPlainPayload(calls[0])).toBe(plain);
  });

  it('INV9 does not count the service call, which takes positional arguments', () => {
    expect(rawZomeCalls("holochainClient.callZome('requests', 'get_request', hash)")).toHaveLength(
      0
    );
  });

  it('emit is not a subscription', () => {
    expect(countLines("storeEventBus.emit('a', {})", BUS_ON)).toBe(0);
  });
});
