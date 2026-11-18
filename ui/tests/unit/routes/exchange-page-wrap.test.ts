import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';

/**
 * The exchange page shows three things members wrote: when, and the terms; a note given
 * with a decline or a cancellation; and each review's comment. A single word longer than
 * the card, such as a pasted link, ran out of it and widened the page.
 *
 * Each card sets `overflow-wrap: anywhere`, which every line in it inherits, so a word
 * wider than the card wraps inside it. `anywhere` rather than `break-words`, because only
 * `anywhere` lowers the width the page reserves for the word. **To make it go red:** drop
 * `[overflow-wrap:anywhere]` from the card.
 */

const long = 'x'.repeat(300);

vi.mock('$lib/composables/domain/exchanges/useExchangeDetails.svelte', () => ({
  useExchangeDetails: () => ({
    exchange: {
      agreement_hash: new Uint8Array(39),
      agreement: {
        primary: {},
        reciprocal: {},
        medium: null,
        terms: long,
        delivery_timeframe: long
      },
      status: 'Completed',
      created_at: 0
    },
    other: { name: 'Bea' },
    listingTitle: 'Hedge trimming',
    listingHref: '/offers/x',
    loadError: null,
    busy: false,
    me: undefined,
    role: undefined,
    iWroteIt: false,
    myDone: false,
    theirDone: false,
    myReview: undefined,
    myReviewText: { rating: 5, on_time: true, as_agreed: true, comment: long, created_at: 0 },
    theirReviewText: undefined,
    stale: false,
    watch: () => undefined,
    initialize: () => undefined,
    counter: () => Promise.resolve(undefined)
  })
}));

vi.mock('$lib/utils/exchange-ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/utils/exchange-ui')>()),
  // A reviewed exchange that also carries a closing note, so all three cards are drawn.
  exchangeState: () => 'reviewed',
  closureOf: () => ({ kind: 'cancelled', at: 0, note: long }),
  counterpartyOf: () => new Uint8Array(39),
  termLabel: () => 'One hour',
  statusLabel: () => 'Completed',
  exchangeStatusVariant: () => 'variant-soft-success'
}));

vi.mock('$lib/components/exchanges/ReachPerson.svelte', async () => ({
  default: (await import('../../mocks/Empty.svelte')).default
}));

beforeEach(() => cleanup());

describe("the members' words on the exchange page", () => {
  it('wrap a long word in the when and terms card', async () => {
    const { default: Page } = await import(
      '../../../src/routes/(public)/exchanges/[id]/+page.svelte'
    );
    render(Page);
    expect(screen.getByTestId('agreement-words').className).toContain('[overflow-wrap:anywhere]');
  });

  it('wrap a long word in a closing note', async () => {
    const { default: Page } = await import(
      '../../../src/routes/(public)/exchanges/[id]/+page.svelte'
    );
    render(Page);
    expect(screen.getByTestId('closure').className).toContain('[overflow-wrap:anywhere]');
  });

  it("wrap a long word in a review's comment", async () => {
    const { default: Page } = await import(
      '../../../src/routes/(public)/exchanges/[id]/+page.svelte'
    );
    render(Page);
    const cards = screen.getAllByTestId('review-card');
    expect(cards).toHaveLength(2);
    for (const card of cards) expect(card.className).toContain('[overflow-wrap:anywhere]');
  });
});
