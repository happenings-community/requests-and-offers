import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';
import { encodeHashToBase64 } from '@holochain/client';
import { setPage } from '../../mocks/app-stores';
import ConversationPage from '../../../src/routes/(public)/messages/[user]/+page.svelte';

/**
 * **A conversation that could not be read is a fault, never an empty chat.**
 *
 * The same empty timeline and working composer are what a brand-new conversation looks
 * like, so a failed read shown that way tells a member with forty messages that there is
 * nothing there. The page must say what happened and offer to read again.
 */

const hash = (n: number) => new Uint8Array(Array(39).fill(n));
const ANITA = hash(3);

const { loadConversations, me, userByHash } = vi.hoisted(() => ({
  loadConversations: vi.fn(),
  /** Who is signed in; a test may change their status. */
  me: {
    original_action_hash: new Uint8Array(Array(39).fill(4)),
    status: { status_type: 'accepted' } as { status_type: string } | undefined
  },
  userByHash: vi.fn()
}));

vi.mock('$lib/stores/messaging.store.svelte', () => ({
  default: {
    threads: [],
    outbox: [],
    loading: false,
    error: null,
    loadConversations: () => loadConversations(),
    isBlocked: () => false,
    setBlocked: vi.fn(),
    receiptSettingFor: () => 'inherit',
    setReceiptsForChat: vi.fn(),
    theirReadUpTo: () => 0,
    markThreadRead: vi.fn(),
    send: vi.fn(),
    retryUnsent: vi.fn()
  }
}));

vi.mock('$lib/stores/users.store.svelte', () => ({
  default: {
    get currentUser() {
      return me;
    },
    getUserByActionHash: () => userByHash()
  }
}));

vi.mock('$lib/stores/exchanges.store.svelte', () => ({ default: {} }));
vi.mock('$lib/stores/requests.store.svelte', () => ({ default: {} }));
vi.mock('$lib/stores/offers.store.svelte', () => ({ default: {} }));

vi.mock('$lib/utils/effect', () => ({ runEffect: <T>(value: T) => value }));

vi.mock('@skeletonlabs/skeleton', () => ({
  getModalStore: () => ({ trigger: vi.fn() }),
  getToastStore: () => ({ trigger: vi.fn() })
}));

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  me.status = { status_type: 'accepted' };
  userByHash.mockResolvedValue({ name: 'Anita Rossi' });
  setPage({ user: encodeHashToBase64(ANITA) });
});

describe('the conversation page when the read fails', () => {
  it('shows the fault with its reason, and no composer', async () => {
    loadConversations.mockRejectedValue(new Error('get_inbox: the conductor did not answer'));
    render(ConversationPage);

    const fault = await screen.findByRole('alert');
    expect(fault.textContent).toContain("couldn't be loaded");
    expect(fault.textContent, 'the reason, not a shrug').toContain('did not answer');
    expect(
      screen.queryByRole('textbox'),
      'nothing to write into on a chat nobody could read'
    ).toBeNull();
  });

  /**
   * **To make this go red:** have Try again reload the page, or call nothing. The second
   * read never happens and the composer never appears.
   */
  it('Try again reads again, and the conversation appears once that works', async () => {
    loadConversations.mockRejectedValueOnce(new Error('once')).mockResolvedValue([]);
    render(ConversationPage);

    await fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('textbox')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(loadConversations).toHaveBeenCalledTimes(2);
  });
});

/**
 * **The address is checked, not trusted** (review of 16 October, F16). Read and absent
 * is its own state, told apart from not yet read and from a read that failed, and none
 * of them is a conversation with "A member".
 */
describe('the conversation page and its address', () => {
  it('says so when no member answers to the address, and offers no composer', async () => {
    loadConversations.mockResolvedValue([]);
    userByHash.mockResolvedValue(null);
    render(ConversationPage);

    const notice = await screen.findByRole('alert');
    expect(notice.textContent).toContain("couldn't be found");
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('says so when the address is not a hash at all, without throwing', async () => {
    setPage({ user: 'not-a-hash' });
    render(ConversationPage);

    const notice = await screen.findByRole('alert');
    expect(notice.textContent).toContain("isn't a member's address");
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(
      loadConversations,
      'nothing read for an address that names nobody'
    ).not.toHaveBeenCalled();
  });
});

/**
 * **A pending or suspended member reads and does not reply** (rule 7; review F12). The
 * zome refuses them anyway, but a composer that works until Send is a promise the page
 * cannot keep.
 */
describe('the conversation page for a member who may not send', () => {
  it('shows why instead of the composer', async () => {
    loadConversations.mockResolvedValue([]);
    me.status = { status_type: 'pending' };
    render(ConversationPage);

    const notice = await screen.findByTestId('cannot-send');
    expect(notice.textContent).toContain("hasn't been accepted");
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('does not call a member whose status has not been read "not accepted"', async () => {
    loadConversations.mockResolvedValue([]);
    me.status = undefined;
    render(ConversationPage);

    const notice = await screen.findByTestId('cannot-send');
    expect(notice.textContent).toContain("couldn't be read");
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});
