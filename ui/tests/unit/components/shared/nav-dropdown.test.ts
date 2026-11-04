import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// #352 review: two things a reader of NavDropdown.svelte can check without
// mounting it (the suite does not mount components, see ContactModal.test.ts).
// The keyboard behaviour itself is held by the e2e step in smoke.spec.ts.
const source = readFileSync(
  resolve(process.cwd(), 'src/lib/components/shared/NavDropdown.svelte'),
  'utf8'
);
const markup = source.slice(source.indexOf('</script>'));

describe('NavDropdown (#352 review)', () => {
  it('names its panel in aria-controls only while the panel exists', () => {
    // The panel is inside {#if open}, so a closed trigger must not point at an
    // id that is not in the document.
    expect(markup).toMatch(/aria-controls=\{open \? id : undefined\}/);
    expect(markup).not.toMatch(/aria-controls=\{id\}/);
  });

  it('does not close on mouse leave while a menu item has keyboard focus', () => {
    // onmouseleave goes through a handler that checks the focused element
    // against the items, rather than closing unconditionally.
    expect(markup).not.toMatch(/onmouseleave=\{\(\) => \(open = false\)\}/);
    expect(markup).toMatch(/onmouseleave=\{onMouseLeave\}/);
    const handler = source.slice(source.indexOf('function onMouseLeave'));
    expect(handler.slice(0, handler.indexOf('}\n'))).toMatch(/document\.activeElement/);
  });
});
