import { describe, it, expect } from 'vitest';
import { importSpecifiers, reachableFrom, resolveImport } from './messaging-modules';

/**
 * **The walk itself, tested.**
 *
 * The seam rests on this walk: if it cannot see an import, the rule it enforces is
 * narrower than it reads, and silently so. `from '...'` alone missed three forms, each
 * able to carry a whole feature in — a side-effect import, a dynamic one, and a dynamic
 * one in a type position. Each is shown separately here, so a regression names which
 * form broke rather than only that something did.
 */
const FIXTURES = 'tests/unit/seam/fixtures';
const ENTRY = `${FIXTURES}/entry.fixture.ts`;

describe('importSpecifiers reads every form', () => {
  const specs = importSpecifiers(
    [
      "import './side-effect';",
      "import { a } from './named';",
      "import type { B } from './named-type';",
      "export { c } from './re-exported';",
      "export * from './star';",
      "const d = await import('./dynamic');",
      "type E = import('./type-position').Shape;",
      "import('./spaced' );",
      'import "./double-quoted";'
    ].join('\n')
  );

  it.each([
    ['a side-effect import', './side-effect'],
    ['names', './named'],
    ['a type import', './named-type'],
    ['a re-export', './re-exported'],
    ['a star re-export', './star'],
    ['a dynamic import', './dynamic'],
    ['a dynamic import in a type position', './type-position'],
    ['a dynamic import with spaces', './spaced'],
    ['double quotes', './double-quoted']
  ])('%s', (_name, expected) => {
    expect(specs).toContain(expected);
  });

  it('and nothing it was not given', () => {
    expect(specs).toHaveLength(9);
  });

  it('ignores packages, which are not ours to walk', () => {
    expect(resolveImport(ENTRY, 'effect')).toBeNull();
    expect(resolveImport(ENTRY, '@holochain/client')).toBeNull();
  });
});

describe('reachableFrom follows all three of the forms it used to miss', () => {
  const reached = [...reachableFrom(ENTRY)];

  /**
   * **To make this go red:** narrow the pattern back to `from\s+['"]...['"]`. The
   * side-effect, dynamic and type-position fixtures all disappear from the walk, and
   * the three rows below fail while the `named` one still passes — which is exactly how
   * the gap hid.
   */
  it.each([
    ['a side-effect import', 'side-effect.fixture.ts'],
    ['a dynamic import', 'dynamic.fixture.ts'],
    ['a dynamic import in a type position', 'type-only.fixture.ts'],
    ['a plain re-export', 'named.fixture.ts']
  ])('%s is reached', (_name, file) => {
    expect(
      reached.some((f) => f.endsWith(file)),
      `${file} not in: ${reached.join(', ')}`
    ).toBe(true);
  });

  it('reaches the entry and the four it names, and stops there', () => {
    expect(reached).toHaveLength(5);
  });

  /** A cycle must not hang the walk, since `seen` is what stops it. */
  it('does not loop on a module that imports itself', () => {
    expect(() => reachableFrom(`${FIXTURES}/cyclic-a.fixture.ts`)).not.toThrow();
    expect([...reachableFrom(`${FIXTURES}/cyclic-a.fixture.ts`)]).toHaveLength(2);
  });
});
