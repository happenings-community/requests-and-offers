import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// #368: the interest modal's copy from alpha.1 testing. The suite does not mount
// components (vitest compiles them for the client and resolves Svelte's server build,
// so a render throws effect_orphan), so these checks read the source, as
// markdown-wiring.test.ts does.
const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const modal = read('src/lib/components/shared/listings/ContactModal.svelte');
const markup = modal.slice(modal.indexOf('</script>'));

describe('ContactModal copy (#368)', () => {
  it('titles the modal "Get in touch", not "Interested in this {listingType}?"', () => {
    expect(markup).toMatch(/<h4[^>]*>\s*✍️ Get in touch\s*<\/h4>/);
    expect(markup).not.toContain('Interested in this');
  });

  it('invites a short introduction to the contact by name, then a proposal', () => {
    expect(markup).toContain(
      'Feel free to send {contactName} a quick introduction by email, then submit a proposal on the next screen.'
    );
    expect(markup).not.toContain('Get in touch directly with the contact information below');
  });

  it('names the organization when there is one, else the user', () => {
    expect(modal).toMatch(
      /const contactName = \$derived\(\s*organization\?\.name \|\| \(user \? formatUserName\(user\.name\) : ''\)/
    );
  });

  it('keeps the proposal clause for an interest, the default context', () => {
    expect(modal).toMatch(/context = 'interest'/);
    expect(markup).toMatch(
      /\{#if context === 'interest'\}\s*Feel free to send \{contactName\} a quick introduction by email, then submit a proposal on the next screen\./
    );
  });

  it('drops the proposal clause in the exchange context, where no proposal screen follows', () => {
    const exchangeBranch = markup.slice(
      markup.indexOf('{:else}', markup.indexOf("{#if context === 'interest'}"))
    );
    expect(exchangeBranch).toMatch(
      /^\{:else\}\s*Feel free to send \{contactName\} a message by email\.\s*\{\/if\}/
    );
    // The exchange page reaches the person through ReachPerson, which opens this pop-up
    // when no messaging is plugged in, and passes the context through.
    const page = read('src/routes/(public)/exchanges/[id]/+page.svelte');
    expect(page).toMatch(/<ReachPerson[^>]*context="exchange"/);
    const reach = read('src/lib/components/exchanges/ReachPerson.svelte');
    expect(reach).toMatch(/ref: ContactModal,\s*props: \{[^}]*context/s);
  });

  it('never leaves a gap when the contact has no name', () => {
    expect(modal).toMatch(/\|\| 'them'\)/);
  });

  it('drops the guide line at the bottom', () => {
    expect(markup).not.toContain('Please contact directly using the information above');
  });

  it('has a labelled close button in the header that closes through the modal store', () => {
    expect(modal).toMatch(/const modalStore = getModalStore\(\);/);
    const header = markup.slice(markup.indexOf('<header'), markup.indexOf('</header>'));
    expect(header).toMatch(
      /<button[^>]*aria-label="Close"[^>]*onclick=\{\(\) => modalStore\.close\(\)\}/s
    );
  });
});

describe('Listing detail pages (#368)', () => {
  it.each([
    'src/routes/(public)/offers/[id]/+page.svelte',
    'src/routes/(public)/requests/[id]/+page.svelte'
  ])('%s no longer carries the "use the contact information below" card', (path) => {
    expect(read(path)).not.toMatch(/Use the contact information below to get in touch/);
  });
});
