import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import { flushSync, tick } from 'svelte';
import { Effect as E } from 'effect';

/**
 * The request form reads four things in the background when it opens: the author's offers (for
 * the Service Exchange gate), the author's coordinated organizations, the organization a
 * published request belongs to, and the approved mediums of exchange. Each read is a fiber the
 * form owns: leaving the form interrupts it, so a late response cannot write into a form that
 * is gone, and a read started again replaces one still in flight.
 *
 * Before, each read was `E.runPromise`, which returns a Promise and no fiber.
 */

const reads = vi.hoisted(() => ({
  started: [] as Array<{ name: string; interrupted: boolean }>,
  /** `'pending'` never finishes; `'done'` finishes at once; `'failed'` fails at once. */
  mode: 'pending' as 'pending' | 'done' | 'failed'
}));

const read = <A>(name: string, value: A) => {
  const record = { name, interrupted: false };
  reads.started.push(record);
  if (reads.mode === 'done') return E.succeed(value);
  if (reads.mode === 'failed') return E.fail(new Error('refused')) as E.Effect<A, Error>;
  return E.never.pipe(
    E.onInterrupt(() =>
      E.sync(() => {
        record.interrupted = true;
      })
    )
  ) as E.Effect<A, Error>;
};

const stub = vi.hoisted(() => async () => ({
  default: (await import('../../mocks/Empty.svelte')).default
}));

vi.mock('@skeletonlabs/skeleton', async () => {
  const { default: Empty } = await import('../../mocks/Empty.svelte');
  return {
    InputChip: Empty,
    getToastStore: () => ({ trigger: vi.fn() }),
    getModalStore: () => ({ trigger: vi.fn(), close: vi.fn() })
  };
});
vi.mock('$lib/components/shared/TimeZoneSelect.svelte', stub);
vi.mock('$lib/components/shared/MarkdownToolbar.svelte', stub);
vi.mock('@/lib/components/service-types/ServiceTypeSelector.svelte', stub);
vi.mock('@/lib/components/mediums-of-exchange/MediumOfExchangeSelector.svelte', stub);
vi.mock('@/lib/components/mediums-of-exchange/MediumOfExchangeSuggestionForm.svelte', stub);
vi.mock('$lib/services/devFeatures.service', () => ({ shouldShowMockButtons: () => false }));
vi.mock('$lib/stores/users.store.svelte', () => ({
  default: { currentUser: { original_action_hash: new Uint8Array(39).fill(1) } }
}));
vi.mock('$lib/stores/organizations.store.svelte', () => ({
  default: {
    getUserOrganizations: () => read('coordinated', []),
    getOrganizationByActionHash: () => read('published', { name: 'Acme' })
  }
}));
vi.mock('$lib/stores/offers.store.svelte', () => ({
  default: { getUserOffers: () => read('offers', []) }
}));
vi.mock('$lib/stores/mediums_of_exchange.store.svelte', () => ({
  default: {
    approvedMediumsOfExchange: [],
    getApprovedMediumsOfExchange: () => read('mediums', [])
  }
}));

const { default: RequestForm } = await import('$lib/components/requests/RequestForm.svelte');

const settle = async () => {
  flushSync();
  await tick();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const names = () => reads.started.map((r) => r.name).sort();

beforeEach(() => {
  cleanup();
  reads.started.length = 0;
  reads.mode = 'pending';
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('the request form reads as tasks', () => {
  it('starts its reads when it opens, and interrupts every one when it closes', async () => {
    const { unmount } = render(RequestForm, { props: { mode: 'create', onSubmit: vi.fn() } });
    await settle();

    // A new request has no published organization to resolve.
    expect(names()).toEqual(['coordinated', 'mediums', 'offers']);
    expect(reads.started.every((r) => !r.interrupted)).toBe(true);

    unmount();
    await settle();
    expect(reads.started.every((r) => r.interrupted)).toBe(true);
  });

  it('resolves the published organization when editing, and interrupts that read too', async () => {
    const request = {
      title: 'Hedge',
      description: 'Two hours',
      organization: new Uint8Array(39).fill(2)
    } as never;
    const { unmount } = render(RequestForm, {
      props: {
        mode: 'edit',
        request,
        onSubmit: vi.fn(),
        preselectedOrganization: new Uint8Array(39).fill(2)
      }
    });
    await settle();
    expect(names()).toContain('published');

    unmount();
    await settle();
    expect(reads.started.every((r) => r.interrupted)).toBe(true);
  });

  it('a failing read is logged and does not stop the form', async () => {
    reads.mode = 'failed';
    const { container } = render(RequestForm, { props: { mode: 'create', onSubmit: vi.fn() } });
    await settle();

    expect(console.error).toHaveBeenCalled();
    expect(container.querySelector('form')).not.toBeNull();
  });
});
