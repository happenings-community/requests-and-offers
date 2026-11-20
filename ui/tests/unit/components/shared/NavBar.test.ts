import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/svelte';
import NavBar from '$lib/components/shared/NavBar.svelte';
import { visit } from '../../../mocks/app-state';

/**
 * The nav bar's own screens (Sam, 16 November): My Exchanges and My Listings are links on
 * the bar, and Messages is an envelope beside the status and the member's picture.
 *
 * With messaging, a proposal arriving is counted once, as an unopened conversation on the
 * envelope, and My Exchanges carries no number. **Without messaging nothing else counts
 * it**, so My Exchanges keeps the number of exchanges waiting on the member: removing it
 * on every network left a network without messaging with no sign of a proposal at all.
 */

const { presence, unread, exchanges, member, admin } = vi.hoisted(() => ({
  member: { status: 'accepted' },
  admin: {
    agentIsAdministrator: false,
    allUsers: [] as unknown[],
    allOrganizations: [] as unknown[],
    refreshLists: () => ({})
  },
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
vi.mock('$lib/stores/users.store.svelte', () => ({
  default: {
    get currentUser() {
      return {
        name: 'Sam',
        original_action_hash: new Uint8Array(Array(39).fill(1)),
        status: { status_type: member.status }
      };
    }
  }
}));
vi.mock('$lib/stores/administration.store.svelte', () => ({ default: admin }));
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

// A pointer click: the menu ignores a click with detail 0, which is what a keyboard
// activation synthesises and is handled on keydown instead (#204).
const openCommunityMenu = async () => {
  await fireEvent.click(screen.getByRole('button', { name: /^community menu/i }), { detail: 1 });
};

const envelope = () => screen.queryByRole('link', { name: /^Messages/ });
const exchangesLink = () => screen.getByRole('link', { name: /^My Exchanges/ });

beforeEach(() => {
  cleanup();
  visit('/');
  member.status = 'accepted';
  admin.agentIsAdministrator = false;
  admin.allUsers = [];
  presence.isAbsent = false;
  unread.count = undefined;
  exchanges.list = [{ waitsOnMe: true }, { waitsOnMe: false }];
});

describe('the nav bar', () => {
  it('counts unopened conversations on the envelope, in words, and nothing on My Exchanges', () => {
    unread.count = 2;
    render(NavBar);

    const link = envelope();
    expect(link?.getAttribute('href')).toBe('/messages');
    expect(link?.getAttribute('aria-label')).toBe('Messages, 2 unopened conversations');
    // The app draws the tooltip: Electron on macOS does not show a title reliably.
    expect(link?.querySelector('[data-testid="nav-tip"]')?.textContent).toBe(
      'Messages, 2 unopened conversations'
    );
    expect(exchangesLink().textContent).not.toMatch(/waiting on you/);
  });

  it('names the envelope with no count when nothing is unopened', () => {
    render(NavBar);

    expect(envelope()?.getAttribute('aria-label')).toBe('Messages');
  });

  it('has no envelope without messaging, and counts exchanges waiting on me instead', () => {
    presence.isAbsent = true;
    render(NavBar);

    expect(envelope()).toBeNull();
    expect(exchangesLink().textContent).toContain('1 waiting on you');
  });

  it('gives a member who is not accepted none of the members-only screens (#349 review)', () => {
    member.status = 'pending';
    unread.count = 2;
    render(NavBar);

    expect(screen.queryByRole('link', { name: /My Exchanges/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /My Listings/ })).toBeNull();
    expect(screen.queryByTestId('nav-messages')).toBeNull();
    // Nor a count on the menu button that stands in for the bar on a narrow screen.
    expect(screen.getByRole('button', { name: 'Open navigation menu' })).toBeTruthy();
  });

  it('puts My Exchanges and My Listings on the bar, with no My Activity or Resources menu', () => {
    render(NavBar);

    expect(exchangesLink().getAttribute('href')).toBe('/exchanges');
    expect(screen.getByRole('link', { name: 'My Listings' }).getAttribute('href')).toBe(
      '/my-listings'
    );
    // Below xl the bar shows the icons only: the words stay for a screen reader, and the
    // app's own tooltip says them on hover and on keyboard focus.
    for (const link of [exchangesLink(), screen.getByRole('link', { name: 'My Listings' })]) {
      expect(link.querySelector('.sr-only.xl\\:not-sr-only')).toBeTruthy();
      expect(link.querySelector('[data-testid="nav-tip"]')?.textContent).toMatch(
        /^My (Exchanges|Listings)$/
      );
    }
    expect(screen.queryByRole('button', { name: /my activity/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /resources/i })).toBeNull();
  });

  /**
   * My Exchanges, My Listings and Messages left this menu for the bar (#521); this keeps
   * them from drifting back. **To make this go red:** add any item to `myProfileItems`.
   */
  it('keeps the menu under your picture to your profile', async () => {
    unread.count = 2;
    render(NavBar);
    await fireEvent.click(screen.getByRole('button', { name: /^Sam menu/ }), { detail: 1 });

    // Named by its button since #352, so found by that name.
    const menu = screen.getByRole('menu', { name: /^Sam menu/ });
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((i) => i.textContent?.trim())
    ).toEqual([expect.stringContaining('My Profile')]);
  });

  it('keeps Service Types under Community', async () => {
    render(NavBar);
    await openCommunityMenu();

    expect(screen.getByRole('menuitem', { name: /Service Types/ })).toBeTruthy();
  });

  it('marks the link for the page that is open, and for the pages beneath it', () => {
    visit('/messages/uhCAk');
    render(NavBar);

    expect(envelope()?.getAttribute('aria-current')).toBe('page');
    expect(exchangesLink().getAttribute('aria-current')).toBeNull();
  });

  it('marks My Exchanges on its own page and not on a page that only starts the same', () => {
    visit('/exchanges');
    render(NavBar);
    expect(exchangesLink().getAttribute('aria-current')).toBe('page');
    cleanup();

    visit('/exchangesx');
    render(NavBar);
    expect(exchangesLink().getAttribute('aria-current')).toBeNull();
  });

  it('draws the connection status as a dot rather than an emoji', () => {
    render(NavBar);

    const status = screen.getByRole('button', { name: /^Connection status/ });
    expect(status.querySelector('[data-status]')).toBeTruthy();
    expect(status.textContent?.trim()).toBe('');
  });

  it('puts the unopened count on the menu button, which is the whole bar on a narrow window', () => {
    unread.count = 3;
    render(NavBar);

    const button = screen.getByTestId('menu-button');
    expect(button.getAttribute('aria-label')).toBe(
      'Open navigation menu, 3 unopened conversations'
    );
    expect(button.textContent).toContain('3');
  });

  it('puts the exchanges waiting on me on the menu button where there is no messaging', () => {
    presence.isAbsent = true;
    unread.count = 3;
    render(NavBar);

    expect(screen.getByTestId('menu-button').getAttribute('aria-label')).toBe(
      'Open navigation menu, 1 waiting on you'
    );
  });

  it('leaves the menu button plain when nothing is waiting', () => {
    render(NavBar);

    const button = screen.getByTestId('menu-button');
    expect(button.getAttribute('aria-label')).toBe('Open navigation menu');
    expect(button.textContent?.trim()).toBe('');
  });

  describe('as an administrator with one member waiting', () => {
    beforeEach(() => {
      admin.agentIsAdministrator = true;
      admin.allUsers = [
        { status: { status_type: 'pending' } },
        { status: { status_type: 'accepted' } }
      ];
    });

    it('counts who is waiting on the Admin menu, with no aria-keyshortcuts and the Alt+A hint as its description', () => {
      render(NavBar);

      const button = screen.getByRole('button', { name: 'Admin menu, 1 waiting to be accepted' });
      // Alt+A moves between a page and its admin view; it does not open this menu.
      expect(button.hasAttribute('aria-keyshortcuts')).toBe(false);
      expect(document.getElementById(button.getAttribute('aria-describedby')!)?.textContent).toBe(
        'Alt+A switches between a page and its admin view'
      );
    });

    it("adds who is waiting to the menu button, after the member's own count", () => {
      unread.count = 2;
      render(NavBar);

      const menuButton = screen.getByTestId('menu-button');
      expect(menuButton.getAttribute('aria-label')).toBe(
        'Open navigation menu, 2 unopened conversations, 1 waiting to be accepted'
      );
      expect(menuButton.textContent).toContain('3');
    });

    it('keeps the Admin menu, its count and the hint for an administrator still waiting to be accepted, and nothing members only', () => {
      // The progenitor before accepting their own membership: an administrator, pending.
      member.status = 'pending';
      unread.count = 2;
      render(NavBar);

      expect(
        screen.getByRole('button', {
          name: 'Admin menu, 1 waiting to be accepted. Accept your membership to finish setup'
        })
      ).toBeTruthy();
      expect(screen.queryByTestId('nav-exchanges')).toBeNull();
      expect(screen.queryByTestId('nav-messages')).toBeNull();
      // The member's own counts are for accepted members; who is waiting is the admin's.
      expect(screen.getByTestId('menu-button').getAttribute('aria-label')).toBe(
        'Open navigation menu, 1 waiting to be accepted'
      );
    });
  });
});
