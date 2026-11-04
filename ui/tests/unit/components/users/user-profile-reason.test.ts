import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// #353 review: the profile showed a suspension's reason only while the chip
// read "Suspended", so an ended suspension labelled "In review" hid it. The
// markup now takes the reason from the chip, which carries it for every
// suspension. The suite does not mount components (see ContactModal.test.ts),
// so this reads the markup.
const source = readFileSync(
  resolve(process.cwd(), 'src/lib/components/users/UserProfile.svelte'),
  'utf8'
);
const markup = source.slice(source.indexOf('</script>'));

describe('UserProfile shows the reason for an ended suspension (#353 review)', () => {
  it('takes the reason from the status chip, not from the label', () => {
    expect(markup).not.toMatch(/status\?\.label === 'Suspended' && user\.status\?\.reason/);
    expect(markup).toMatch(
      /\{#if status\?\.reason\}\s*<p[^>]*><strong>Reason:<\/strong> \{status\.reason\}<\/p>/
    );
  });
});
