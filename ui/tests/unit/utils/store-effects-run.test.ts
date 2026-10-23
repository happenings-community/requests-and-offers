import { describe, expect, it } from 'vitest';
import { globSync, readFileSync } from 'node:fs';

/**
 * Store methods return an Effect: a description of the work, which does
 * nothing until it is run (`runEffect`, `yield*`, or an error boundary).
 * TypeScript lets code `await` an Effect or drop it, and both fail silently:
 * no zome call, no error, and the success message still shows. This reads the
 * source, like no-raw-html.test.ts, and fails on a store call that returns an
 * Effect and is awaited directly, used as a bare statement, or put in
 * Promise.all. An Effect returned through a local function and dropped by its
 * caller is past what a source read can see; that needs type-aware linting.
 */

const storeFiles = globSync('src/lib/stores/*.store.svelte.ts');

// Store name (file stem) -> methods its interface declares as returning an Effect.
const effectMethods = new Map<string, Set<string>>();
for (const file of storeFiles) {
  const source = readFileSync(file, 'utf8');
  const names = new Set<string>();
  for (const m of source.matchAll(/^\s+(\w+)\s*:\s*\([^;]*?\)\s*=>\s*E\.Effect</gms)) names.add(m[1]);
  const stem = file.split('/').pop()!.split('.')[0];
  effectMethods.set(stem, names);
}

const sources = [
  ...globSync('src/**/*.svelte'),
  ...globSync('src/**/*.ts').filter((f) => !f.endsWith('.store.svelte.ts'))
];

describe('store Effects are run', () => {
  it('finds the stores and their Effect methods', () => {
    expect(storeFiles.length).toBeGreaterThan(5);
    expect(effectMethods.get('organizations')?.has('removeMember')).toBe(true);
  });

  it('never awaits or drops an Effect returned by a store', () => {
    const offenders: string[] = [];
    for (const file of sources) {
      const source = readFileSync(file, 'utf8');
      const imports = source.matchAll(/import\s+(\w+)\s+from\s+'\$lib\/stores\/(\w+)\.store\.svelte'/g);
      for (const [, alias, stem] of imports) {
        const methods = effectMethods.get(stem) ?? new Set();
        for (const call of source.matchAll(new RegExp(`\\b${alias}\\.(\\w+)\\(`, 'g'))) {
          if (!methods.has(call[1])) continue;
          const before = source.slice(0, call.index).trimEnd();
          const awaited = /\bawait$/.test(before);
          const bareStatement = /[;{}]$/.test(before);
          // An Effect in Promise.all([...]) is never run either: Promise.all
          // passes anything that is not a promise straight through.
          const inPromiseAll =
            /[[,]$/.test(before) && /Promise\.all\(\s*\[[^\]]*$/.test(before);
          if (awaited || bareStatement || inPromiseAll) {
            const line = source.slice(0, call.index).split('\n').length;
            offenders.push(`${file}:${line}: ${alias}.${call[1]}(`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
