import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// renderMarkdown has its own unit tests. This checks that MarkdownRenderer still renders
// through it (#300). The suite does not mount components (vitest resolves Svelte's server
// build here), so the check reads the source.
describe('MarkdownRenderer link wiring', () => {
  it('renders its {@html} from renderMarkdown, not from marked or DOMPurify directly', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/lib/components/shared/MarkdownRenderer.svelte'),
      'utf8'
    );
    expect(source).toMatch(/import\s*\{\s*renderMarkdown\s*\}\s*from\s*'\$lib\/utils\/markdown'/);
    expect(source).toMatch(/\$derived\(\s*renderMarkdown\(\s*content\s*\)\s*\)/);
    expect(source).toMatch(/\{@html\s+html\s*\}/);
    expect(source).not.toMatch(/from\s*'(?:marked|dompurify)'/);
  });
});
