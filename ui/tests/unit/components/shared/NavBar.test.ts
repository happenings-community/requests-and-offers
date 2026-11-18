import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';
import NavBar from '$lib/components/shared/NavBar.svelte';

/**
 * The two counts in the member's menus (#344 split them: My Exchanges under My Activity,
 * My Messages under the member's picture).
 *
 * With messaging, a proposal arriving is counted once, as an unopened conversation on My
 * Messages, and My Exchanges carries no number. **Without messaging nothing else counts
 * it**, so My Exchanges keeps the number of exchanges waiting on the member: removing it
 * on every network left a network without messaging with no sign of a proposal at all.
 */

const { presence, unread, exchanges } = vi.hoisted(() => ({
  presence: { isAbsent: false },
  unread: { count: undefined as number | undefined },
  exchanges: { list: [] as unknown[] }
}));

vi.mock('@skeletonlabs/skeleton', () => ({
  getDrawerStore: () => ({ open: vi.fn(), close: vi.fn() }),
  popup: () => ({ destroy: vi.fn() })
}));
vi.mock('$lib/services/messagingPresence.svelte', () => ({ default: presence }));
vi.mock('$lib/extensions/unread-count', async (importActual) => ({
  ...(await importActual<typeof import('$lib/extensions/unread-count')>()),
  getUnreadCount: () => () => unread.count
}));
vi.mock('$lib/components/network/NetworkStatusPopup.svelte', async () => ({
  default: (await import('../../../mocks/Empty.svelte')).default
}));
// Accepted, because My Activity is for accepted members only (#349).
vi.mock('$lib/stores/users.store.svelte', () => ({
  default: {
    currentUser: {
      name: 'Sam',
      original_action_hash: new Uint8Array(Array(39).fill(1)),
      status: { status_type: 'accepted' }
    }
  }
}));
vi.mock('$lib/stores/administration.store.svelte', () => ({
  default: { agentIsAdministrator: false }
}));
vi.mock('$lib/stores/exchanges.store.svelte', () => ({
  default: {
    get exchanges() {
      return exchanges.list;
    },
    refreshMyExchanges: () => ({})
  }
}));
vi.mock('$lib/utils/effect', () => ({ runEffect: () => Promise.resolve() }));
vi.mock('$lib/utils/exchange-ui', () => ({
  // Whose turn it is, as `turnOf` would answer for these two: one waits on me.
  turnOf: (e: { waitsOnMe: boolean }) => (e.waitsOnMe ? 'you' : 'them')
}));

const openMenu = async (name: RegExp) => {
  await fireEvent.click(screen.getByRole('button', { name }));
};

beforeEach(() => {
  cleanup();
  presence.isAbsent = false;
  unread.count = undefined;
  exchanges.list = [{ waitsOnMe: true }, { waitsOnMe: false }];
});

describe("the member's menus", () => {
  it('counts unopened conversations on My Messages, and nothing on My Exchanges', async () => {
    unread.count = 2;
    render(NavBar);
    await openMenu(/^Sam menu/);

    expect(screen.getByText('2 unopened conversations')).toBeTruthy();

    await openMenu(/^My Activity menu/);

    expect(screen.queryByText(/waiting on you/)).toBeNull();
  });

  it('counts exchanges waiting on me on My Exchanges when there is no messaging', async () => {
    presence.isAbsent = true;
    render(NavBar);
    await openMenu(/^My Activity menu/);

    expect(screen.getByText('1 waiting on you')).toBeTruthy();

    await openMenu(/^Sam menu/);

    expect(screen.queryByText('My Messages')).toBeNull();
  });
});
