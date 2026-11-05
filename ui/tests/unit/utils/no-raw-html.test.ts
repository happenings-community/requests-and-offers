import { describe, expect, it } from 'vitest';
import { globSync, readFileSync } from 'node:fs';

/**
 * Every {@html} in the app goes through a sanitiser (#211). The unit suite
 * does not mount components, so this reads the source: any {@html x} whose
 * expression is not safeHtml(...) or a value sanitised by DOMPurify fails.
 */
const files = globSync('src/**/*.svelte');

describe('raw HTML in components', () => {
  it('finds the components to check', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('renders {@html} only through a sanitiser', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/\{@html\s+([^}]+)\}/g)) {
        const expr = match[1].trim();
        // renderMarkdown (utils/markdown.ts) returns DOMPurify.sanitize's output.
        const sanitised =
          /^safeHtml\(/.test(expr) ||
          new RegExp(
            `\\b${expr}\\s*=\\s*\\$derived\\(\\s*(?:DOMPurify\\.sanitize|renderMarkdown)\\(`
          ).test(source);
        if (!sanitised) offenders.push(`${file}: {@html ${expr}}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  // Skeleton's own confirm, alert and prompt dialogs render their title and body
  // with {@html} inside the library, where the check above cannot see. Every
  // dialog goes through our components (AlertModal, ConfirmModal, PromptModal),
  // which sanitise with safeHtml.
  it("never opens Skeleton's built-in dialogs", () => {
    const sources = [...files, ...globSync('src/**/*.ts')];
    const offenders: string[] = [];
    for (const file of sources) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/type:\s*['"](confirm|alert|prompt)['"]/g)) {
        offenders.push(`${file}: type: '${match[1]}'`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
