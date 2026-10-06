import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// renderMarkdown and normalizeHref have their own unit tests. These check that the
// components still route links through them (#300). The suite does not mount
// components (vitest resolves Svelte's server build here), so the check reads the source.
const read = (file: string): string => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('MarkdownRenderer link wiring', () => {
  it('renders its {@html} from renderMarkdown, not from marked or DOMPurify directly', () => {
    const source = read('src/lib/components/shared/MarkdownRenderer.svelte');
    expect(source).toMatch(/import\s*\{\s*renderMarkdown\s*\}\s*from\s*'\$lib\/utils\/markdown'/);
    expect(source).toMatch(/\$derived\(\s*renderMarkdown\(\s*content\s*\)\s*\)/);
    expect(source).toMatch(/\{@html\s+html\s*\}/);
    expect(source).not.toMatch(/from\s*'(?:marked|dompurify)'/);
  });
});

describe('Related Links call sites', () => {
  const callSites = [
    'src/lib/components/offers/OfferDetailsModal.svelte',
    'src/lib/components/requests/RequestDetailsModal.svelte',
    'src/routes/(public)/offers/[id]/+page.svelte',
    'src/routes/(public)/requests/[id]/+page.svelte'
  ];

  it.each(callSites)('%s passes every related link through normalizeHref', (file) => {
    const source = read(file);
    const loops = [...source.matchAll(/\{#each\s+\w+\.links\s+as\s+(\w+)\}([\s\S]*?)\{\/each\}/g)];
    expect(loops.length).toBeGreaterThan(0);
    for (const [, item, body] of loops) {
      const hrefs = [...body.matchAll(/href=\{([^}]*)\}/g)].map((m) => m[1].trim());
      expect(hrefs.length).toBeGreaterThan(0);
      for (const href of hrefs) expect(href).toBe(`normalizeHref(${item})`);
    }
  });
});
