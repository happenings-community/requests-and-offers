import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import { flushSync, tick } from 'svelte';
import { Effect as E } from 'effect';

/**
 * Four components read from a store in the background: the two detail modals read a status, and
 * the offer and request cards read their organization. Each read is a fiber the component owns:
 * unmounting interrupts it, so a late response cannot write into a component that is gone
 * (#134's class), and a changed input replaces a read still in flight.
 *
 * Before, each read was `E.runPromise`, which returns a Promise and no fiber: nothing could
 * interrupt it.
 */

/** One entry per started read, in order: `interrupted` flips when its fiber is interrupted. */
const reads = vi.hoisted(() => ({
  started: [] as Array<{ name: string; interrupted: boolean }>,
  /** What the organization read returns: `'pending'` never finishes, or an organization, or a failure. */
  organization: 'pending' as 'pending' | 'found' | 'failed'
}));

const pending = (name: string) => {
  const record = { name, interrupted: false };
  reads.started.push(record);
  return E.never.pipe(
    E.onInterrupt(() =>
      E.sync(() => {
        record.interrupted = true;
      })
    )
  );
};

const stub = vi.hoisted(() => async () => ({
  default: (await import('../../mocks/Empty.svelte')).default
}));

vi.mock('@skeletonlabs/skeleton', async () => {
  const { default: Empty } = await import('../../mocks/Empty.svelte');
  const user = { name: 'Ada', nickname: 'ada', email: 'a@b.c', user_type: 'creator' };
  const organization = { name: 'Acme', description: '', status: {} };
  const meta = { user, organization };
  return {
    Avatar: Empty,
    getToastStore: () => ({ trigger: vi.fn() }),
    // A modal store, as the components read it with `$modalStore[0].meta`.
    getModalStore: () => ({
      subscribe: (run: (value: unknown) => void) => {
        run([{ meta }]);
        return () => undefined;
      },
      trigger: vi.fn(),
      close: vi.fn()
    })
  };
});
vi.mock('$lib/components/shared/ActionBar.svelte', stub);
vi.mock('$lib/components/shared/MarkdownRenderer.svelte', stub);
vi.mock('$lib/components/shared/ExternalLink.svelte', stub);
vi.mock('$lib/components/users/UserName.svelte', stub);
vi.mock('$lib/components/mediums-of-exchange/MediumOfExchangeTag.svelte', stub);
vi.mock('$lib/components/service-types/ServiceTypeTag.svelte', stub);
vi.mock('$lib/components/shared/dialogs/ConfirmModal.svelte', stub);
vi.mock('$lib/stores/administration.store.svelte', () => ({
  default: { getLatestStatusForEntity: () => pending('status') }
}));
vi.mock('$lib/stores/users.store.svelte', () => ({
  default: { getUserByActionHash: () => E.succeed(null) }
}));
vi.mock('$lib/stores/offers.store.svelte', () => ({ default: {} }));
vi.mock('$lib/stores/organizations.store.svelte', () => ({
  default: {
    getOrganizationByActionHash: () => {
      if (reads.organization === 'found') return E.succeed({ name: 'Acme Ltd' });
      if (reads.organization === 'failed') return E.fail(new Error('refused'));
      return pending('organization');
    }
  }
}));

const { default: UserDetailsModal } = await import(
  '$lib/components/users/UserDetailsModal.svelte'
);
const { default: OrganizationDetailsModal } = await import(
  '$lib/components/organizations/OrganizationDetailsModal.svelte'
);
const { default: OfferCard } = await import('$lib/components/offers/OfferCard.svelte');
const { default: RequestCard } = await import('$lib/components/requests/RequestCard.svelte');

const hash = (fill: number) => new Uint8Array(39).fill(fill);

const settle = async () => {
  flushSync();
  await tick();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

beforeEach(() => {
  cleanup();
  reads.started.length = 0;
  reads.organization = 'pending';
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('the detail modals read their status as a task', () => {
  it('UserDetailsModal interrupts the read when the modal closes', async () => {
    const { unmount } = render(UserDetailsModal);
    await settle();
    expect(reads.started).toEqual([{ name: 'status', interrupted: false }]);

    unmount();
    await settle();
    expect(reads.started[0].interrupted).toBe(true);
  });

  it('OrganizationDetailsModal interrupts the read when the modal closes', async () => {
    const { unmount } = render(OrganizationDetailsModal);
    await settle();
    expect(reads.started).toEqual([{ name: 'status', interrupted: false }]);

    unmount();
    await settle();
    expect(reads.started[0].interrupted).toBe(true);
  });
});

describe.each([
  ['OfferCard', OfferCard, 'offer'],
  ['RequestCard', RequestCard, 'request']
] as const)('%s reads its organization as a task', (_name, Card, prop) => {
  const props = () => ({
    [prop]: {
      title: 'Hedge trimming',
      description: 'Two hours',
      creator: hash(1),
      organization: hash(2),
      original_action_hash: hash(3),
      service_type_hashes: [],
      medium_of_exchange_hashes: [],
      time_preference: 'Anytime',
      contact_preference: 'Email',
      interaction_type: 'Virtual',
      links: [],
      status: 'Active'
    }
  });

  it('interrupts the read when the card unmounts', async () => {
    const { unmount } = render(Card as never, { props: props() as never });
    await settle();
    expect(reads.started).toEqual([{ name: 'organization', interrupted: false }]);
    expect(screen.getByText('Loading organization...')).toBeTruthy();

    unmount();
    await settle();
    expect(reads.started[0].interrupted).toBe(true);
  });

  it('shows the organization once the read finishes', async () => {
    reads.organization = 'found';
    render(Card as never, { props: props() as never });
    await settle();
    expect(screen.getByText('Acme Ltd')).toBeTruthy();
    expect(screen.queryByText('Loading organization...')).toBeNull();
  });

  it('shows an unknown organization when the read fails, as before', async () => {
    reads.organization = 'failed';
    render(Card as never, { props: props() as never });
    await settle();
    expect(screen.getByText('Unknown organization')).toBeTruthy();
  });
});
