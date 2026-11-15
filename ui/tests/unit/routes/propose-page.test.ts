import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';
import { paths, readOrigin, routeAfterPublish, readProposeParams, routeAfter } from '$lib/paths';
import { visit } from '../../mocks/app-state';
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

vi.mock('$lib/stores/requests.store.svelte', () => ({ default: { getRequest: vi.fn() } }));

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
