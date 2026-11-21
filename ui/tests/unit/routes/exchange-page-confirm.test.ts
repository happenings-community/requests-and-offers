import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';

/**
 * **Decline, Withdraw proposal and Cancel agreement ask first** (dogfooding 21 November).
 *
 * All three are final: nothing in the app undoes them. They ran on one click, while
 * archiving or deleting a listing, which can be undone more easily, asks through the
 * app's ConfirmModal. Each now opens that same dialog, and the write runs only on
 * confirm. The note typed for a decline or a cancellation stays in the field while the
 * dialog is open, so it still goes with the write. **To make these go red:** wire a
 * button straight to its action again.
 */

const { view, actions, trigger } = vi.hoisted(() => ({
  view: { state: 'proposed', iWroteIt: false },
  actions: {
    decline: vi.fn(async () => true),
    withdraw: vi.fn(async () => true),
    cancel: vi.fn(async () => true),
    accept: vi.fn(async () => true)
  },
  trigger: vi.fn()
}));

vi.mock('@skeletonlabs/skeleton', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@skeletonlabs/skeleton')>()),
  getModalStore: () => ({ trigger }),
  getToastStore: () => ({ trigger: vi.fn() })
}));

vi.mock('$lib/composables/domain/exchanges/useExchangeDetails.svelte', () => ({
  useExchangeDetails: () => ({
    exchange: {
      agreement_hash: new Uint8Array(39),
      agreement: {
        primary: {},
        reciprocal: {},
        medium: null,
        terms: '',
        delivery_timeframe: { Preset: 'Flexible' }
      },
      status: 'Proposed',
      created_at: 0
    },
    other: { name: 'Bob' },
    listingTitle: 'Garden help',
    listingHref: '/offers/x',
    loadError: null,
    busy: false,
    me: new Uint8Array(39),
    role: 'provider',
    get iWroteIt() {
      return view.iWroteIt;
    },
    myDone: false,
    theirDone: false,
    myReview: undefined,
    myReviewText: undefined,
    theirReviewText: undefined,
    stale: false,
    note: '',
    comment: '',
    rating: 0,
    watch: () => undefined,
    initialize: () => undefined,
    counter: () => Promise.resolve(undefined),
    complete: vi.fn(),
    review: vi.fn(),
    ...actions
  })
}));

vi.mock('$lib/utils/exchange-ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/utils/exchange-ui')>()),
  exchangeState: () => view.state,
  closureOf: () => null,
  counterpartyOf: () => new Uint8Array(39),
  termLabel: () => 'One hour',
  statusLabel: () => 'Proposed',
  exchangeStatusVariant: () => 'variant-soft'
}));

vi.mock('$lib/components/exchanges/ReachPerson.svelte', async () => ({
  default: (await import('../../mocks/Empty.svelte')).default
}));

let Page: typeof import('../../../src/routes/(public)/exchanges/[id]/+page.svelte').default;

beforeAll(async () => {
  ({ default: Page } = await import('../../../src/routes/(public)/exchanges/[id]/+page.svelte'));
}, 60_000);

beforeEach(() => {
  cleanup();
  trigger.mockReset();
  for (const fn of Object.values(actions)) fn.mockClear();
});

/** The dialog the click opened, answered as the member would. */
function answer(confirmed: boolean) {
  expect(trigger).toHaveBeenCalledTimes(1);
  const settings = trigger.mock.calls[0][0];
  settings.response(confirmed);
  return settings.meta as { message: string; confirmLabel: string };
}

describe('irreversible exchange actions', () => {
  it.each([
    { name: 'Decline', state: 'proposed', iWroteIt: false, action: 'decline' as const },
    { name: 'Withdraw proposal', state: 'proposed', iWroteIt: true, action: 'withdraw' as const },
    { name: 'Cancel agreement', state: 'agreed', iWroteIt: false, action: 'cancel' as const }
  ])(
    '$name asks before it runs, and runs on confirm',
    async ({ name, state, iWroteIt, action }) => {
      view.state = state;
      view.iWroteIt = iWroteIt;
      render(Page);
      await fireEvent.click(screen.getByRole('button', { name }));
      expect(actions[action]).not.toHaveBeenCalled();
      const meta = answer(true);
      expect(meta.message).toContain('cannot be undone');
      expect(actions[action]).toHaveBeenCalledTimes(1);
    }
  );

  it('does nothing when the member says no', async () => {
    view.state = 'proposed';
    view.iWroteIt = false;
    render(Page);
    await fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    answer(false);
    expect(actions.decline).not.toHaveBeenCalled();
  });

  it('leaves Accept to run at once: it is the step the member came to take', async () => {
    view.state = 'proposed';
    view.iWroteIt = false;
    render(Page);
    await fireEvent.click(screen.getByRole('button', { name: 'Accept and form agreement' }));
    expect(trigger).not.toHaveBeenCalled();
    expect(actions.accept).toHaveBeenCalledTimes(1);
  });
});
