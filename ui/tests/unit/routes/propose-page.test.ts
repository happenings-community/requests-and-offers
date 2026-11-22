import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/svelte';
import { paths, readOrigin, routeAfterPublish, readProposeParams, routeAfter } from '$lib/paths';
import { visit } from '../../mocks/app-state';
import { goto } from '../../mocks/app-navigation';
import { EXCHANGE_STRINGS } from '$lib/strings/exchanges.strings';
import ProposePage from '../../../src/routes/(public)/exchanges/propose/+page.svelte';

/**
 * **A proposal may only be sent against terms and an interest that records back.**
 *
 * The page is opened with a listing and an interest in its address, and the hashes in a
 * link mean nothing until the records say they do. Everything asserted here is the guard
 * on Send, which is the one place where believing the address rather than the records
 * would write something nobody published.
 */

const hash = (n: number) => new Uint8Array(Array(39).fill(n));
const LISTING = hash(1);
const INTEREST = hash(2);
const STALE_INTEREST = hash(7);
const AUTHOR = hash(3);
const MEMBER = hash(4);

const getOffer = vi.fn();
const getInterestsForListing = vi.fn();
const getUserByActionHash = vi.fn();
const getServiceType = vi.fn();
const getMediumOfExchange = vi.fn();
const getUserActiveOffers = vi.fn();
const createAgreement = vi.fn();

vi.mock('@skeletonlabs/skeleton', () => ({
  getToastStore: () => ({ trigger: vi.fn() }),
  getModalStore: () => ({ trigger: vi.fn() })
}));

vi.mock('$lib/stores/exchanges.store.svelte', () => ({
  default: {
    getInterestsForListing: (...a: unknown[]) => getInterestsForListing(...a),
    createAgreement: (...a: unknown[]) => createAgreement(...a)
  }
}));

vi.mock('$lib/stores/users.store.svelte', () => ({
  default: {
    // The member who showed interest, not the author, so the page takes the ordinary path.
    // Spelled out rather than built: a mock factory is hoisted above every const here.
    currentUser: { original_action_hash: new Uint8Array(Array(39).fill(4)) },
    getUserByActionHash: (h: unknown) => getUserByActionHash(h)
  }
}));

vi.mock('$lib/stores/offers.store.svelte', () => ({
  default: {
    getOffer: (...a: unknown[]) => getOffer(...a),
    getUserActiveOffers: (...a: unknown[]) => getUserActiveOffers(...a)
  }
}));

const getRequest = vi.fn();
vi.mock('$lib/stores/requests.store.svelte', () => ({
  default: { getRequest: (...a: unknown[]) => getRequest(...a) }
}));

vi.mock('$lib/stores/serviceTypes.store.svelte', () => ({
  default: { getServiceType: (...a: unknown[]) => getServiceType(...a) }
}));

vi.mock('$lib/stores/mediums_of_exchange.store.svelte', () => ({
  default: { getMediumOfExchange: (...a: unknown[]) => getMediumOfExchange(...a) }
}));

vi.mock('$lib/utils/effect', () => ({ runEffect: <T>(value: T) => value }));

vi.mock('$lib/composables/connection/useConnectionGuard', () => ({
  useConnectionGuard: () => Promise.resolve(undefined)
}));

const openWith = (interest: Uint8Array) =>
  visit(paths.exchangePropose({ listing: LISTING, type: 'Offer', interest, from: AUTHOR }));

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  getOffer.mockResolvedValue({
    original_action_hash: LISTING,
    title: 'Garden clearance',
    description: 'A morning of it',
    creator: AUTHOR,
    service_type_hash: hash(5),
    medium_of_exchange_hashes: [hash(6)]
  });
  getInterestsForListing.mockResolvedValue([{ interest_hash: INTEREST, user: MEMBER }]);
  getUserByActionHash.mockResolvedValue({ name: 'Anita Rossi', original_action_hash: AUTHOR });
  getServiceType.mockResolvedValue({ name: 'Gardening' });
  getMediumOfExchange.mockResolvedValue({ name: 'CAD', exchange_type: 'currency' });
  getUserActiveOffers.mockResolvedValue([]);
});

describe('the propose page’s guard on Send', () => {
  it('offers Send once the terms and the interest have been read', async () => {
    openWith(INTEREST);
    render(ProposePage);

    // Proof the read finished: the medium is named only once the records answered. Several
    // places show it — the picker, the preview badge, the terms — so all of them.
    expect((await screen.findAllByText('CAD')).length).toBeGreaterThan(0);
    const send = await screen.findByTestId('send-proposal');
    expect((send as HTMLButtonElement).disabled, 'everything it needs was read').toBe(false);
  });

  /**
   * **To make this go red:** drop `interestOnListing === 'found'` from the page's guard.
   * The address is believed again, Send is offered, and the zome's refusal that the
   * interest is for a different listing is the first anyone hears of it.
   */
  it('refuses to send against an interest the listing does not have', async () => {
    openWith(STALE_INTEREST);
    render(ProposePage);

    // This message renders only after the interests came back, so nothing below can pass
    // by being early: it is proof the read is over, not that it has not started.
    await screen.findByTestId('interest-missing');
    const send = await screen.findByTestId('send-proposal');
    expect((send as HTMLButtonElement).disabled, 'nothing to propose against').toBe(true);

    send.click();
    expect(createAgreement, 'and pressing it writes nothing').not.toHaveBeenCalled();
  });

  it('says nothing about a missing interest when the listing has it', async () => {
    openWith(INTEREST);
    render(ProposePage);

    await screen.findAllByText('CAD');
    expect(screen.queryByTestId('interest-missing')).toBeNull();
  });
});

/**
 * Where a proposal ends depends on where it began, and the listing's author is not where
 * it began. "Post an offer" carried the author as the conversation, so a proposal started
 * on the listing came back from "Continue your proposal" as one started in a conversation,
 * and sending it went to Messages: on a network without messaging, to the page that says
 * there is none.
 */
describe('a proposal that goes by way of posting an offer', () => {
  // "Post an offer" is offered where the other side is a service, so the medium is one.
  beforeEach(() => {
    getMediumOfExchange.mockResolvedValue({ name: 'Service Exchange', exchange_type: 'base' });
  });

  const followThrough = async () => {
    render(ProposePage);
    const post = (await screen.findByText(/post an offer/i)).closest('a')!;
    const origin = readOrigin(new URL(post.getAttribute('href')!, 'http://localhost'));
    const after = routeAfterPublish(origin, hash(9));
    expect(after.kind).toBe('continueProposal');
    const resumed = after.kind === 'continueProposal' ? after.href : '';
    const { from } = readProposeParams(new URL(resumed, 'http://localhost'));
    return routeAfter({ exchange: hash(10), from });
  };

  it('ends on the exchange when it was started on the listing', async () => {
    visit(paths.exchangePropose({ listing: LISTING, type: 'Offer', interest: INTEREST }));
    expect(await followThrough()).toBe(paths.exchangeDetail(hash(10)));
  });

  it('ends in the conversation when it was started in one', async () => {
    visit(
      paths.exchangePropose({ listing: LISTING, type: 'Offer', interest: INTEREST, from: AUTHOR })
    );
    expect(await followThrough()).toBe(paths.conversation(AUTHOR));
  });
});

/**
 * A label names one control and holds nothing a person presses. The medium's label held a
 * gift notice when there was no control, and the Service Exchange label held links,
 * `ReachPerson`'s buttons and warnings (Sacha, #308 review).
 * **To make them go red:** put either container back as a `<label>`; for the hint,
 * drop `aria-describedby` from the Service Exchange picker.
 */
describe('the propose page’s labels', () => {
  /**
   * A guard on the new structure rather than a proof of the fix: with a medium to pick,
   * the old page already named its select. Red if the medium's `<label for>` stops
   * pointing at the select, or if the block becomes a `<label>` again.
   */
  it('names the medium picker, and puts nothing pressable inside a label', async () => {
    openWith(INTEREST);
    const { container } = render(ProposePage);
    await screen.findAllByText('CAD');

    expect(screen.getByLabelText('Requested medium of exchange').tagName).toBe('SELECT');
    expect(container.querySelectorAll('label a, label button, label label').length).toBe(0);
  });

  it('has no label without a control when the listing names no medium', async () => {
    getOffer.mockResolvedValue({
      original_action_hash: LISTING,
      title: 'Garden clearance',
      description: 'A morning of it',
      creator: AUTHOR,
      service_type_hash: hash(5),
      medium_of_exchange_hashes: []
    });
    openWith(INTEREST);
    const { container } = render(ProposePage);
    await screen.findByText(/names no medium of exchange/);

    const labels = [...container.querySelectorAll('label')] as HTMLLabelElement[];
    expect(labels.filter((label) => label.control === null)).toEqual([]);
  });

  /**
   * The case the review named: the other side has offers, the member picks "None of
   * these", and the way to reach them (`ReachPerson`) and a warning appear beside the
   * picker. They sat inside its label before.
   */
  it('keeps the way to reach them out of the label when none of their offers suits', async () => {
    getMediumOfExchange.mockResolvedValue({ name: 'Service Exchange', exchange_type: 'base' });
    getUserActiveOffers.mockResolvedValue([{ title: 'Hedge trimming' }]);
    openWith(INTEREST);
    const { container } = render(ProposePage);
    // Found by its option, not its label, so this reaches the assertions below whatever
    // the label's shape: the label is what is under test.
    const picker = (await screen.findByRole('option', { name: 'Hedge trimming' })).closest(
      'select'
    ) as HTMLSelectElement;
    await fireEvent.change(picker, { target: { value: '__none__' } });
    await screen.findByText(/Nothing here suits/);

    expect(container.querySelectorAll('label a, label button, label p, label div').length).toBe(0);
    const hint = document.getElementById(picker.getAttribute('aria-describedby') ?? '');
    expect(hint?.textContent, 'the picker is described by its hint').toMatch(/already offer/);
  });

  it('keeps links out of labels when a Service Exchange needs an offer posted', async () => {
    getMediumOfExchange.mockResolvedValue({ name: 'Service Exchange', exchange_type: 'base' });
    openWith(INTEREST);
    const { container } = render(ProposePage);
    await screen.findByText(/post an offer/i);

    expect(container.querySelectorAll('label a, label button, label p, label div').length).toBe(0);
  });
});

/**
 * **A listing's figures start the proposal** (#380, #525).
 *
 * The estimate is an exact decimal string, so it reaches the term as written: 1.1 stays
 * 1.1. An estimate of none is allowed on a listing, but a quantity is above zero, so the
 * proposal carries no hours. The listing's amount becomes the return's when it is in the
 * medium chosen, and the listing's timeframe is the starting one while it can be met.
 *
 * **To make these go red:** route the hours through `Math.fround(Number(h))` (the page
 * then shows and sends "1.100000023841858"); drop the `hasEnded` guard (a window that
 * ended yesterday is sent, and validation refuses it); or drop the unit check in
 * `amountIn` (a figure in another unit is carried).
 */
describe('a listing’s figures on the proposal', () => {
  const DAY_MICROS = 24 * 60 * 60 * 1_000_000;
  const openRequest = (figures: Record<string, unknown>) => {
    getRequest.mockResolvedValue({
      original_action_hash: LISTING,
      title: 'Help with a fence',
      description: 'An afternoon',
      creator: AUTHOR,
      service_type_hash: hash(5),
      medium_of_exchange_hashes: [hash(6)],
      ...figures
    });
    createAgreement.mockResolvedValue({ agreement_hash: hash(10) });
    visit(paths.exchangePropose({ listing: LISTING, type: 'Request', interest: INTEREST }));
    render(ProposePage);
  };
  const sent = async () => {
    // The medium is named only once the records answered, so Send is live after this.
    await screen.findAllByText('CAD');
    const send = screen.getByTestId('send-proposal') as HTMLButtonElement;
    // The interest is checked against the listing after the terms are read.
    await waitFor(() => expect(send.disabled).toBe(false));
    await fireEvent.click(send);
    expect(createAgreement).toHaveBeenCalledTimes(1);
    return createAgreement.mock.calls[0][0];
  };

  it('sends the estimate as written, and shows the same', async () => {
    openRequest({ time_estimate_hours: '1.1' });
    await screen.findAllByText('CAD');
    expect(screen.getByText('1.1')).toBeTruthy();
    expect((await sent()).primary.quantity).toEqual({ value: '1.1', unit: 'hours' });
  });

  it('sends no hours, and says so, when the request states none', async () => {
    openRequest({});
    await screen.findAllByText('CAD');
    expect(screen.getByText(/not stated on the listing/)).toBeTruthy();
    expect((await sent()).primary.quantity).toBeNull();
  });

  it('sends no hours, and says why, when the estimate is none', async () => {
    openRequest({ time_estimate_hours: '0' });
    await screen.findAllByText('CAD');
    expect(screen.getByText(/estimated at none/)).toBeTruthy();
    expect((await sent()).primary.quantity).toBeNull();
  });

  it('carries the listing’s amount when it is in the medium chosen, and not otherwise', async () => {
    openRequest({ amount: { value: '40.50', unit: 'CAD' } });
    expect((await sent()).reciprocal.quantity).toEqual({ value: '40.50', unit: 'CAD' });
    cleanup();
    createAgreement.mockClear();
    openRequest({ amount: { value: '40', unit: 'EUR' } });
    expect((await sent()).reciprocal.quantity).toBeNull();
  });

  it('starts from the listing’s timeframe while it can be met', async () => {
    openRequest({ timeframe: { Preset: 'WithinAMonth' } });
    await screen.findAllByText('CAD');
    const select = screen.getByTestId('propose-timeframe') as HTMLSelectElement;
    expect(select.options[select.selectedIndex].text).toBe('Within a month of agreeing');
    expect((await sent()).delivery_timeframe).toEqual({ Preset: 'WithinAMonth' });
  });

  it('starts from the default, never from a window that has ended', async () => {
    const yesterday = Date.now() * 1000 - DAY_MICROS;
    openRequest({ timeframe: { Dates: { start: null, end: yesterday } } });
    expect((await sent()).delivery_timeframe).toEqual({ Preset: 'WithinTwoWeeks' });
  });

  it('keeps a window still to come as a choice of its own, and sends the one chosen', async () => {
    const end = Date.now() * 1000 + 10 * DAY_MICROS;
    const window = { Dates: { start: null, end } };
    openRequest({ timeframe: window });
    await screen.findAllByText('CAD');
    const select = screen.getByTestId('propose-timeframe') as HTMLSelectElement;
    expect(select.options).toHaveLength(5);
    expect(select.selectedIndex).toBe(0);
    select.selectedIndex = [...select.options].findIndex((o) => o.text === 'Flexible');
    await fireEvent.change(select);
    expect((await sent()).delivery_timeframe).toEqual({ Preset: 'Flexible' });
  });
});

/**
 * **When the page cannot open, it says so calmly and leads somewhere** (Soushi, alpha 2
 * dogfooding, 21 November). Opened with no listing it showed a saturated red bar and
 * nothing else. To make this go red: put the old `alert variant-filled-error` back.
 */
describe('the propose page when it cannot open', () => {
  it('opened with no listing, explains where proposals start and offers ways on', async () => {
    visit('/exchanges/propose');
    const { container } = render(ProposePage);

    await screen.findByRole('heading', { name: EXCHANGE_STRINGS.unavailable.noListing.title });
    const href = (name: string) => screen.getByRole('link', { name }).getAttribute('href');
    expect(href(EXCHANGE_STRINGS.unavailable.myExchanges)).toBe(paths.exchanges());
    expect(href(EXCHANGE_STRINGS.unavailable.browseRequests)).toBe(paths.requests());
    expect(href(EXCHANGE_STRINGS.unavailable.browseOffers)).toBe(paths.offers());
    expect(screen.getByRole('button', { name: /Back/ })).toBeTruthy();
    expect(container.querySelector('.variant-filled-error'), 'no alarm block').toBeNull();
    expect(getOffer, 'nothing to look up').not.toHaveBeenCalled();
  });

  it('leads back to the listing, and retries, when reading it failed', async () => {
    getOffer.mockRejectedValueOnce(new Error('Connection closed'));
    openWith(INTEREST);
    render(ProposePage);

    await screen.findByRole('heading', { name: EXCHANGE_STRINGS.unavailable.failed.title });
    expect(
      screen
        .getByRole('link', { name: EXCHANGE_STRINGS.unavailable.backToListing })
        .getAttribute('href')
    ).toBe(paths.offerDetail(LISTING));
    expect(screen.getByText('Connection closed')).toBeTruthy();

    await fireEvent.click(screen.getByRole('button', { name: EXCHANGE_STRINGS.unavailable.retry }));
    expect((await screen.findAllByText('CAD')).length, 'the retry loaded it').toBeGreaterThan(0);
  });

  /**
   * The page, not only `proposeUnavailable`, has to pick the right reason. **To make these
   * go red:** send a link without its type to `no-listing`, or a listing that was not
   * found to `failed` (#577 review).
   */
  it('names the missing part when the link has a listing but not its type', async () => {
    const url = new URL(
      paths.exchangePropose({ listing: LISTING, type: 'Offer', interest: INTEREST }),
      'http://localhost'
    );
    url.searchParams.delete('type');
    visit(url.pathname + url.search);
    render(ProposePage);

    await screen.findByRole('heading', { name: EXCHANGE_STRINGS.unavailable.noType.title });
    expect(getOffer, 'nothing it could look up').not.toHaveBeenCalled();
  });

  it('points a listing that is not there at the list of its own kind', async () => {
    getOffer.mockResolvedValueOnce(null);
    openWith(INTEREST);
    render(ProposePage);

    await screen.findByRole('heading', { name: EXCHANGE_STRINGS.unavailable.notFound.title });
    const browse = screen.getByRole('link', { name: EXCHANGE_STRINGS.unavailable.browseOffers });
    expect(browse.getAttribute('href')).toBe(paths.offers());
    expect(screen.getAllByRole('link')[0], 'the primary way on').toBe(browse);
    expect(screen.queryByRole('button', { name: EXCHANGE_STRINGS.unavailable.retry })).toBeNull();
  });

  /**
   * The listing was read and a later read failed: the page must not say the listing could
   * not be loaded. **To make this go red:** report every failure as `failed` again.
   */
  it('says the proposal could not be prepared when a read after the listing failed', async () => {
    getInterestsForListing.mockRejectedValueOnce(new Error('Interests unreadable'));
    openWith(INTEREST);
    render(ProposePage);

    await screen.findByRole('heading', { name: EXCHANGE_STRINGS.unavailable.unprepared.title });
    expect(
      screen.queryByRole('heading', { name: EXCHANGE_STRINGS.unavailable.failed.title })
    ).toBeNull();
    expect(screen.getByText('Interests unreadable')).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: EXCHANGE_STRINGS.unavailable.backToListing })
        .getAttribute('href')
    ).toBe(paths.offerDetail(LISTING));
  });

  /**
   * A bare address opened directly has no history to go back to, which is the case this
   * error state is for. **To make this go red:** put `history.back()` back on the button.
   */
  it('goes back somewhere real when the page was opened directly', async () => {
    visit('/exchanges/propose');
    render(ProposePage);

    await screen.findByRole('heading', { name: EXCHANGE_STRINGS.unavailable.noListing.title });
    await fireEvent.click(screen.getByRole('button', { name: /Back/ }));
    expect(goto).toHaveBeenCalledWith(paths.exchanges());
  });

  it('goes back to the listing when the page was opened directly for one', async () => {
    getOffer.mockRejectedValueOnce(new Error('Connection closed'));
    openWith(INTEREST);
    render(ProposePage);

    await screen.findByRole('heading', { name: EXCHANGE_STRINGS.unavailable.failed.title });
    await fireEvent.click(screen.getByRole('button', { name: /Back/ }));
    expect(goto).toHaveBeenCalledWith(paths.offerDetail(LISTING));
  });

  it('does not go back to a listing that was not found', async () => {
    getOffer.mockResolvedValueOnce(null);
    openWith(INTEREST);
    render(ProposePage);

    await screen.findByRole('heading', { name: EXCHANGE_STRINGS.unavailable.notFound.title });
    await fireEvent.click(screen.getByRole('button', { name: /Back/ }));
    expect(goto).toHaveBeenCalledWith(paths.exchanges());
  });
});
