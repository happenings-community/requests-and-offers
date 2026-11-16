import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import MenuDrawer from '$lib/components/shared/drawers/MenuDrawer.svelte';

/**
 * **The drawer is the only menu on a narrow screen**, so it carries the same My Messages
 * entry the nav bar's envelope is, present only when this network has messaging
 * (review of 16 October, F14).
 */

const { presence, unread, member } = vi.hoisted(() => ({
  member: { status: 'accepted' },
  presence: { isAbsent: false },
  unread: { count: undefined as number | undefined }
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
  default: { agentIsAdministrator: false }
}));

beforeEach(() => {
  cleanup();
  member.status = 'accepted';
  presence.isAbsent = false;
  unread.count = undefined;
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
});
