import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Walk findings, 20 November 2026. Read from the source rather than rendered: these
 * components need the modal store and five domain stores to mount, and what is pinned
 * here is markup, not behaviour.
 *
 * - A listing names every medium it accepts. "+1 more" hid the second one's name, and
 *   in the tables it sat under the first chip like a stray label.
 * - On My Exchanges, an exchange and its Go to chat share one hover.
 * - The four group counts on My Exchanges start at the top of their card, whatever the
 *   length of the line under them.
 */

const read = (p: string) => readFileSync(resolve(__dirname, '../../../../src', p), 'utf8');

describe('every medium a listing accepts is shown', () => {
  const files = [
    'lib/components/offers/OffersTable.svelte',
    'lib/components/requests/RequestsTable.svelte',
    'lib/components/offers/OfferCard.svelte',
    'lib/components/requests/RequestCard.svelte'
  ];

  it.each(files)('%s draws a chip for each medium and never "+N more"', (file) => {
    const src = read(file);
    expect(src).not.toMatch(/medium_of_exchange_hashes\.length - \d\} more/);
    expect(src).not.toMatch(/medium_of_exchange_hashes\.slice\(/);
    expect(src).not.toMatch(/medium_of_exchange_hashes\[0\]/);
    // Unkeyed on purpose: nothing stops a listing naming one medium twice, and a keyed
    // each with a repeated key throws in development.
    expect(src).not.toMatch(/medium_of_exchange_hashes as \w+ \(/);
    expect(src).toMatch(
      /\{#each (offer|request)\.medium_of_exchange_hashes as mediumHash\}\s*<MediumOfExchangeTag mediumOfExchangeActionHash=\{mediumHash\} \/>/
    );
  });

  it('stacks the chips in both table layouts, so each starts on its own line', () => {
    for (const file of files.slice(0, 2)) {
      const cells = read(file).match(
        /<div class="flex flex-col items-start gap-1">\s*\{#each \w+\.medium_of_exchange_hashes/g
      );
      expect(cells, file).toHaveLength(2);
    }
  });
});

describe('My Exchanges', () => {
  it('gives an exchange and its Go to chat one hover', () => {
    const chain = read('lib/components/exchanges/ExchangeChainCard.svelte');
    const wrapper = chain.indexOf('data-testid="exchange-chain-hover"');
    const card = chain.indexOf('<ExchangeCard');
    const chat = chain.indexOf('<ReachPerson');
    const earlier = chain.indexOf('{#if earlier.length > 0');
    expect(wrapper).toBeGreaterThan(-1);
    expect(card).toBeGreaterThan(wrapper);
    expect(chat).toBeGreaterThan(card);
    // The wrapper closes after Go to chat and before the earlier proposals.
    const between = chain.slice(chat, earlier);
    expect(between).toMatch(/<\/div>\s*<\/div>/);
    expect(chain.slice(0, card)).toMatch(/hover:bg-surface-100 dark:hover:bg-surface-700/);

    // The unframed card no longer tints itself, or the link alone would light up again.
    const exchangeCard = read('lib/components/exchanges/ExchangeCard.svelte');
    expect(exchangeCard).toMatch(
      /framed\s*\?\s*'card transition-colors hover:bg-surface-100 dark:hover:bg-surface-700'\s*:\s*'rounded-container-token'\} block space-y-3 p-4"/
    );
  });

  it('starts every group count at the top of its card', () => {
    const page = read('routes/(public)/exchanges/+page.svelte');
    expect(page).toMatch(/class="card flex flex-col space-y-2 p-4 text-left/);
  });
});
