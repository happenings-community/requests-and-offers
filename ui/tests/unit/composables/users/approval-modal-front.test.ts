import { describe, it, expect, vi } from 'vitest';

/**
 * **F12, dogfooding 21 November: the approval waited behind the welcome dialog.**
 *
 * The watcher read the approval within one poll (14 s after the admin approved, in the
 * browser check for this fix), but Skeleton's modal store is a queue and shows its first
 * entry only. A new member who had not yet closed the welcome dialog ("A network
 * administrator will review your profile") saw nothing until they closed it, and then
 * the approval. The welcome is out of date once the member is accepted, so it is closed
 * first and the approval shows at once. A modal the member is acting in (a confirm, a
 * form) is never closed for it. **To make this go red:** trigger the approval without
 * closing the welcome.
 */

vi.mock('$lib/stores/users.store.svelte', () => ({ default: {} }));
vi.mock('$lib/stores/administration.store.svelte', () => ({ default: {} }));
vi.mock('$lib/utils/effect', () => ({ runEffect: async () => null }));

import { showApproval } from '$lib/composables/domain/users/useApprovalWatch.svelte';

type Entry = { meta?: { id?: string }; title?: string };

function fakeModalStore(queue: Entry[]) {
  return {
    queue,
    close: vi.fn(() => {
      queue.shift();
    }),
    trigger: vi.fn((settings: Entry) => {
      queue.push(settings);
    })
  };
}

const approval: Entry = { title: 'approved' };

describe('showApproval', () => {
  it('puts the approval in front of a welcome dialog still open', () => {
    const store = fakeModalStore([{ meta: { id: 'welcome-and-next-steps' } }]);
    showApproval(store, () => store.queue, approval);
    expect(store.queue).toEqual([approval]);
  });

  it('does the same for the first administrator’s welcome', () => {
    const store = fakeModalStore([{ meta: { id: 'progenitor-welcome' } }]);
    showApproval(store, () => store.queue, approval);
    expect(store.queue).toEqual([approval]);
  });

  it('leaves any other open dialog where it is', () => {
    const confirm = { meta: { id: 'some-confirm' } };
    const store = fakeModalStore([confirm]);
    showApproval(store, () => store.queue, approval);
    expect(store.close).not.toHaveBeenCalled();
    expect(store.queue).toEqual([confirm, approval]);
  });

  it('shows the approval when nothing is open', () => {
    const store = fakeModalStore([]);
    showApproval(store, () => store.queue, approval);
    expect(store.queue).toEqual([approval]);
  });
});
