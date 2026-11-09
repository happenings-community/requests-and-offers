import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import GoToChat from '$lib/components/messaging/GoToChat.svelte';

/**
 * **Where the unread count shows, and where it does not** (Sam, 6 November).
 *
 * Go to chat is one button rendered in five places. On My Exchanges the member is scanning
 * people, so an unopened message from this one is worth a number on the button's corner.
 * On a listing, an exchange page or the propose page it stays plain: the one place that
 * counts unopened conversations is My Messages.
 */

const PERSON = new Uint8Array(Array(39).fill(7));
let threads: { key: string; unread: number }[] = [];

vi.mock('@skeletonlabs/skeleton', () => ({
  getModalStore: () => ({ trigger: vi.fn() })
}));
vi.mock('$lib/stores/messaging.store.svelte', () => ({
  default: {
    get threads() {
      return threads;
    }
  }
}));
vi.mock('$lib/utils/messaging-threads', () => ({
  threadKeyOf: () => 'them'
}));
vi.mock('$lib/utils/messaging-first-contact', () => ({
  firstContactNeeded: () => false,
  openFirstContact: vi.fn()
}));
vi.mock('$lib/paths', () => ({
  paths: { conversation: () => '/messages/them' }
}));

beforeEach(() => {
  cleanup();
  threads = [{ key: 'them', unread: 3 }];
});

describe('Go to chat', () => {
  it('counts on its corner where it is asked to', () => {
    render(GoToChat, { props: { person: PERSON, count: true } });
    const badge = screen.getByTestId('go-to-chat-unread');
    expect(badge.textContent?.trim()).toBe('3');
    expect(screen.getByTestId('go-to-chat').contains(badge), 'on the button itself').toBe(true);
    expect(screen.getByTestId('go-to-chat').getAttribute('aria-label')).toBe(
      'Go to chat, 3 unread'
    );
  });

  it('stays plain where it is not, even with messages waiting', () => {
    render(GoToChat, { props: { person: PERSON } });
    expect(screen.queryByTestId('go-to-chat-unread')).toBeNull();
    expect(screen.getByTestId('go-to-chat').getAttribute('aria-label')).toBeNull();
  });

  it('shows no count when nothing is unread', () => {
    threads = [{ key: 'them', unread: 0 }];
    render(GoToChat, { props: { person: PERSON, count: true } });
    expect(screen.queryByTestId('go-to-chat-unread')).toBeNull();
  });

  it('fills its row only as a block', () => {
    render(GoToChat, { props: { person: PERSON, block: true } });
    const link = screen.getByTestId('go-to-chat');
    expect(link.className).toContain('w-full');
    expect(link.className).not.toContain('btn-sm');
  });
});
