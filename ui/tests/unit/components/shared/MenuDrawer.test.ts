import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import MenuDrawer from '$lib/components/shared/drawers/MenuDrawer.svelte';

/**
 * **The drawer is the only menu on a narrow screen**, so it carries the same My Messages
 * entry the nav bar's envelope is, present only when this network has messaging
 * (review of 16 October, F14).
 */

const { presence, unread, member, exchanges, admin } = vi.hoisted(() => ({
  member: { status: 'accepted' },
  admin: {
    agentIsAdministrator: false,
    allUsers: [] as unknown[],
    allOrganizations: [] as unknown[]
  },
  presence: { isAbsent: false },
  unread: { count: undefined as number | undefined },
  exchanges: { list: [] as unknown[] }
}));

vi.mock('@skeletonlabs/skeleton', () => ({
  getDrawerStore: () => ({ close: vi.fn() })
}));

vi.mock('$lib/services/messagingPresence.svelte', () => ({ default: presence }));

// The count reaches the drawer through the extension point, which is Svelte context and
// can only be set from inside a component; stood in for here.
vi.mock('$lib/extensions/unread-count', async (importActual) => ({
  ...(await importActual<typeof import('$lib/extensions/unread-count')>()),
  getUnreadCount: () => () => unread.count
}));

vi.mock('$lib/stores/users.store.svelte', () => ({
  default: {
    get currentUser() {
      return {
        original_action_hash: new Uint8Array(Array(39).fill(1)),
        status: { status_type: member.status }
      };
    }
  }
}));

vi.mock('$lib/stores/administration.store.svelte', () => ({
  default: admin
}));

vi.mock('$lib/stores/exchanges.store.svelte', () => ({
  default: {
    get exchanges() {
      return exchanges.list;
    }
  }
}));
vi.mock('$lib/utils/exchange-ui', () => ({
  // Whose turn it is, as `turnOf` would answer for these two: one waits on me.
  turnOf: (e: { waitsOnMe: boolean }) => (e.waitsOnMe ? 'you' : 'them')
}));

beforeEach(() => {
  cleanup();
  member.status = 'accepted';
  presence.isAbsent = false;
  unread.count = undefined;
  exchanges.list = [{ waitsOnMe: true }, { waitsOnMe: false }];
  admin.agentIsAdministrator = false;
  admin.allUsers = [];
});

describe('the mobile menu', () => {
  it('has My Messages when this network has messaging, with the unopened count', async () => {
    unread.count = 3;
    render(MenuDrawer);

    const link = await screen.findByTestId('drawer-messages');
    expect(link.getAttribute('href')).toBe('/messages');
    expect(link.textContent).toContain('My Messages');
    expect(link.textContent).toContain('3');
    // Said in words: a bare 3 told a screen reader nothing.
    expect(screen.getByText('3 unopened conversations')).toBeTruthy();
    expect(
      screen.getByText('3').getAttribute('aria-hidden'),
      'and the bare number is not read'
    ).toBe('true');
  });

  it('has no My Messages on a network without messaging', () => {
    presence.isAbsent = true;
    render(MenuDrawer);

    expect(screen.queryByTestId('drawer-messages')).toBeNull();
  });

  it('keeps Service Types under Community, as the nav bar does', () => {
    render(MenuDrawer);

    expect(screen.queryByRole('heading', { name: 'Resources' })).toBeNull();
    const community = screen.getByRole('heading', { name: 'Community' }).parentElement!;
    expect(community.textContent).toContain('Service Types');
  });

  it('has no My Activity for a member who is not accepted (#349 review)', () => {
    member.status = 'pending';
    render(MenuDrawer);

    expect(screen.queryByTestId('drawer-messages')).toBeNull();
    expect(screen.queryByText('My Activity')).toBeNull();
  });

  it('counts exchanges waiting on me on My Exchanges where there is no messaging, as the bar does', () => {
    presence.isAbsent = true;
    render(MenuDrawer);

    const link = screen.getByRole('link', { name: /My Exchanges/ });
    expect(link.textContent).toContain('1 waiting on you');
  });

  it('puts no count on My Exchanges where there is messaging', () => {
    render(MenuDrawer);

    expect(screen.getByRole('link', { name: /My Exchanges/ }).textContent).not.toMatch(
      /waiting on you/
    );
  });

  it('counts who is waiting on Members, in words, for an administrator (#359)', () => {
    admin.agentIsAdministrator = true;
    admin.allUsers = [
      { status: { status_type: 'pending' } },
      { status: { status_type: 'accepted' } }
    ];
    render(MenuDrawer);

    const members = screen.getByRole('link', { name: /Members/ });
    expect(members.textContent).toContain('1 waiting to be accepted');
  });

  it('keeps Administration for an administrator still waiting to be accepted, with no My Activity', () => {
    member.status = 'pending';
    admin.agentIsAdministrator = true;
    admin.allUsers = [{ status: { status_type: 'pending' } }];
    render(MenuDrawer);

    expect(screen.getByRole('link', { name: /Members/ }).textContent).toContain(
      '1 waiting to be accepted'
    );
    expect(screen.queryByText('My Activity')).toBeNull();
    expect(screen.queryByTestId('drawer-messages')).toBeNull();
  });
});
