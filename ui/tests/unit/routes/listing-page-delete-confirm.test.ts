import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/svelte';
import { Effect as E } from 'effect';
import { encodeHashToBase64 } from '@holochain/client';

/**
 * **Delete on an offer or request page asks in the app** (final alpha 2 dogfooding).
 *
 * The listing pages asked with the browser's own `confirm()`, which blocked the tab and
 * looked like no other dialog in the app, while My Listings asks through ConfirmModal.
 * Both pages now open that same dialog, and the delete runs only on confirm. **To make
 * these go red:** call `confirm()` again, or wire Delete straight to the store.
 */

const { trigger, me, listing, deleteOffer, deleteRequest } = vi.hoisted(() => {
  const me = new Uint8Array(39).fill(7);
  return {
    trigger: vi.fn(),
    me,
    listing: {
      title: 'Garden help',
      description: 'Weeding on weekends',
      original_action_hash: new Uint8Array(39).fill(3),
      previous_action_hash: new Uint8Array(39).fill(3),
      creator: me,
      created_at: 0,
      updated_at: 0,
      status: 'Active',
      links: []
    },
    deleteOffer: vi.fn(),
    deleteRequest: vi.fn()
  };
});

vi.mock('@skeletonlabs/skeleton', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@skeletonlabs/skeleton')>()),
  getModalStore: () => ({ trigger }),
  getToastStore: () => ({ trigger: vi.fn() })
}));

vi.mock('$app/state', () => ({
  page: {
    params: { id: encodeHashToBase64(new Uint8Array(39).fill(3)) },
    url: new URL('http://localhost/offers/x')
  }
}));

vi.mock('$lib/stores/offers.store.svelte', () => ({
  default: { getOffer: () => E.succeed(listing), deleteOffer }
}));
vi.mock('$lib/stores/requests.store.svelte', () => ({
  default: { getLatestRequest: () => E.succeed(listing), getRequest: () => E.succeed(listing), deleteRequest }
}));
vi.mock('$lib/stores/users.store.svelte', () => ({
  default: {
    currentUser: { name: 'Alice', original_action_hash: me, status: { status_type: 'accepted' } },
    getUserByActionHash: () => E.succeed(null)
  }
}));
vi.mock('$lib/stores/organizations.store.svelte', () => ({
  default: { getOrganizationByActionHash: () => E.succeed(null) }
}));
vi.mock('$lib/composables/connection/useConnectionGuard', () => ({
  useConnectionGuard: () => E.succeed(undefined)
}));
vi.mock('$lib/composables/connection/useAdminStatusGuard.svelte', () => ({
  useAdminStatusGuard: () => ({ agentIsAdministrator: false })
}));
vi.mock('$lib/components/exchanges/ListingInterest.svelte', async () => ({
  default: (await import('../../mocks/Empty.svelte')).default
}));
vi.mock('$lib/components/shared/BackButton.svelte', async () => ({
  default: (await import('../../mocks/Empty.svelte')).default
}));

type Page = typeof import('../../../src/routes/(public)/offers/[id]/+page.svelte').default;
const pages: { offer?: Page; request?: Page } = {};

beforeAll(async () => {
  pages.offer = (await import('../../../src/routes/(public)/offers/[id]/+page.svelte')).default;
  pages.request = (await import('../../../src/routes/(public)/requests/[id]/+page.svelte'))
    .default as unknown as Page;
}, 60_000);

beforeEach(() => {
  cleanup();
  trigger.mockReset();
  deleteOffer.mockReset().mockReturnValue(E.succeed(undefined));
  deleteRequest.mockReset().mockReturnValue(E.succeed(undefined));
});

const cases = [
  { kind: 'offer' as const, remove: deleteOffer },
  { kind: 'request' as const, remove: deleteRequest }
];

describe('Delete on a listing page', () => {
  it.each(cases)('asks for a $kind through ConfirmModal, never the browser', async ({ kind, remove }) => {
    const native = vi.spyOn(window, 'confirm');
    render(pages[kind]!);
    await fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    expect(native).not.toHaveBeenCalled();
    expect(trigger).toHaveBeenCalledTimes(1);
    const settings = trigger.mock.calls[0][0];
    expect(settings.type).toBe('component');
    expect(settings.meta.message).toBe(
      `Are you sure you want to delete this ${kind}? This action cannot be undone.`
    );
    expect(settings.meta.confirmLabel).toBe('Delete');
    expect(remove).not.toHaveBeenCalled();

    settings.response(true);
    await waitFor(() => expect(remove).toHaveBeenCalledTimes(1));
    native.mockRestore();
  });

  it.each(cases)('leaves the $kind alone when the member says no', async ({ kind, remove }) => {
    render(pages[kind]!);
    await fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    trigger.mock.calls[0][0].response(false);
    await new Promise((r) => setTimeout(r, 20));
    expect(remove).not.toHaveBeenCalled();
  });
});
