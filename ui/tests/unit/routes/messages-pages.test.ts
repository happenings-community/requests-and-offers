import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { Effect as E } from 'effect';
import { encodeHashToBase64 } from '@holochain/client';
import { localKey } from '$lib/utils/messaging-local';
import messagingStore from '$lib/stores/messaging.store.svelte';
import messagingPresence from '$lib/services/messagingPresence.svelte';
import { setPage } from '../../mocks/app-stores';
import { signedIn } from '../../mocks/reactive-user.svelte';
import MessagesLayout from '../../../src/routes/(public)/messages/+layout.svelte';
import MessagesPage from '../../../src/routes/(public)/messages/+page.svelte';
import ConversationPage from '../../../src/routes/(public)/messages/[user]/+page.svelte';

/**
 * The Messages screens, mounted on the real store with only the zome stood in for.
 *
 * Each case here is something a member saw go wrong: the wrong person's conversation, a
 * message read on screen and still counted unread, a conversation with no name, a stuck
 * message with nothing to press, "no conversations" under an error, and Messages opened
 * by address on a network that has none.
 */

const { hashes, getInbox, getSent, sendMessage, userByHash } = vi.hoisted(() => {
  const hash = (n: number) => new Uint8Array(Array(39).fill(n));
  return {
    hashes: {
      ME: hash(1),
      MY_AGENT: hash(2),
      ANITA: hash(3),
      BELA: hash(4),
      ANITA_AGENT: hash(5),
      M1: hash(6),
      M2: hash(7)
    },
    getInbox: vi.fn(),
    getSent: vi.fn(),
    sendMessage: vi.fn(),
    /** Set to stand in for one lookup of a member by hash; otherwise the default below. */
    userByHash: vi.fn()
  };
});
const { MY_AGENT, ANITA, BELA, ANITA_AGENT } = hashes;

vi.mock('$lib/services/zomes/messaging.service', async () => {
  const { Context, Effect, Layer } = await import('effect');
  const MessagingServiceTag = Context.GenericTag<unknown>('MessagingService');
  const service = {
    sendMessage: (...a: unknown[]) => sendMessage(...a),
    findSent: () => Effect.succeed(null),
    getInbox: () => getInbox(),
    getInboxDelta: () =>
      Effect.map(getInbox(), (entries: Array<{ hash: unknown }>) => ({
        visible: entries.map((e) => e.hash),
        entries,
        skipped: []
      })),
    getSent: () => getSent(),
    sendReceipt: () => Effect.void
  };
  return { MessagingServiceTag, MessagingServiceLive: Layer.succeed(MessagingServiceTag, service) };
});

vi.mock('$lib/services/HolochainClientService.svelte', async () => {
  const { Context, Layer } = await import('effect');
  const HolochainClientServiceTag = Context.GenericTag<unknown>('HolochainClientService');
  const client = {
    isConnected: true,
    client: { myPubKey: hashes.MY_AGENT },
    getNetworkPeerStatus: () => Promise.resolve({ reachable: 1, known: 1 }),
    onZomeSignal: () => () => {}
  };
  return {
    default: client,
    HolochainClientServiceTag,
    HolochainClientServiceLive: Layer.succeed(HolochainClientServiceTag, client)
  };
});

vi.mock('$lib/stores/users.store.svelte', async () => {
  const { Effect } = await import('effect');
  const { signedIn } = await import('../../mocks/reactive-user.svelte');
  const same = (a: Uint8Array, b: Uint8Array) => a.every((byte, i) => byte === b[i]);
  return {
    default: {
      // Reactive, as the real store's is: read through the signal on every access.
      get currentUser() {
        return signedIn.current;
      },
      getUserByAgentPubKey: (agent: Uint8Array) =>
        Effect.succeed(
          same(agent, hashes.ANITA_AGENT) ? { original_action_hash: hashes.ANITA } : null
        ),
      getUserByActionHash: (user: Uint8Array) =>
        userByHash.getMockImplementation()
          ? userByHash(user)
          : Effect.succeed(
              same(user, hashes.BELA)
                ? { name: 'Bela Kovac', original_action_hash: hashes.BELA }
                : { name: 'Anita Rossi', original_action_hash: hashes.ANITA }
            )
    }
  };
});

vi.mock('$lib/stores/exchanges.store.svelte', async () => {
  const { Effect } = await import('effect');
  return {
    default: {
      getMyInterests: () => Effect.succeed([]),
      getInterestsForListing: () => Effect.succeed([]),
      loadMyExchanges: () => Effect.succeed([])
    }
  };
});

const { listings } = vi.hoisted(() => ({
  listings: async () => {
    const { Effect } = await import('effect');
    return {
      default: {
        getMyListings: () => Effect.succeed([]),
        getRequest: () => Effect.succeed(null),
        getOffer: () => Effect.succeed(null)
      }
    };
  }
}));
vi.mock('$lib/stores/requests.store.svelte', listings);
vi.mock('$lib/stores/offers.store.svelte', listings);

vi.mock('@skeletonlabs/skeleton', () => ({
  getModalStore: () => ({ trigger: vi.fn() }),
  getToastStore: () => ({ trigger: vi.fn() })
}));

const KEY = localKey(encodeHashToBase64(MY_AGENT));
const anita = encodeHashToBase64(ANITA);
const bela = encodeHashToBase64(BELA);
const T = 1_760_000_000_000;

/** One of Anita's to me, as the inbox returns it. */
const fromAnita = (hash: Uint8Array, atMs: number, content: string) => ({
  type: 'Read',
  hash,
  from: ANITA_AGENT,
  to: MY_AGENT,
  at: atMs * 1000,
  content
});
const readMark = () =>
  (JSON.parse(localStorage.getItem(KEY) ?? '{}') as { readUpTo?: Record<string, number> })
    .readUpTo?.[anita] ?? 0;

beforeEach(() => {
  cleanup();
  localStorage.clear();
  getInbox.mockReturnValue(E.succeed([]));
  getSent.mockReturnValue(E.succeed([]));
  sendMessage.mockReset();
  sendMessage.mockReturnValue(E.succeed([]));
  userByHash.mockReset();
  signedIn.current = { original_action_hash: hashes.ME, status: { status_type: 'accepted' } };
  setPage({ user: anita });
});

describe('the conversation page', () => {
  /** SvelteKit keeps the component when only `[user]` changes; the page read it once. */
  it('follows its address from one person to another', async () => {
    render(ConversationPage);
    expect(await screen.findByRole('heading', { name: 'Anita Rossi' })).toBeTruthy();

    setPage({ user: bela });

    expect(await screen.findByRole('heading', { name: 'Bela Kovac' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Anita Rossi' })).toBeNull();
  });

  /** A message that lands while the conversation is open has been seen. */
  it('keeps the conversation read as messages arrive in it', async () => {
    getInbox.mockReturnValue(E.succeed([fromAnita(hashes.M1, T, 'first')]));
    render(ConversationPage);
    expect(await screen.findByText('first')).toBeTruthy();
    await waitFor(() => expect(readMark()).toBe(T));

    // The poll, or a nudge, brings a second one while the page is still open.
    getInbox.mockReturnValue(
      E.succeed([fromAnita(hashes.M1, T, 'first'), fromAnita(hashes.M2, T + 60_000, 'second')])
    );
    await E.runPromise(messagingStore.loadConversations());

    expect(await screen.findByText('second')).toBeTruthy();
    await waitFor(() => expect(readMark(), 'read up to the new one').toBe(T + 60_000));
  });

  /** A send with no answer takes a full timeout, and the box stays open meanwhile. */
  it('keeps what is typed while a send is still going', async () => {
    sendMessage.mockReturnValue(E.sleep('60 millis').pipe(E.as([])));
    render(ConversationPage);
    await screen.findByRole('heading', { name: 'Anita Rossi' });
    const box = (await screen.findByRole('textbox')) as HTMLTextAreaElement;

    await fireEvent.input(box, { target: { value: 'first message' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await fireEvent.input(box, { target: { value: 'and a second thought' } });
    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 120));

    expect(box.value, 'not wiped when the first send finished').toBe('and a second thought');
  });

  /** The composer, once the page has loaded for whoever the address names. */
  const composerFor = async (name: string) => {
    await screen.findByRole('heading', { name });
    return (await screen.findByRole('textbox')) as HTMLTextAreaElement;
  };
  const refusal = { name: 'ribosome_error', message: 'Only an accepted member can send' };

  it('does not carry a draft from one person to the next', async () => {
    render(ConversationPage);
    const box = await composerFor('Anita Rossi');
    await fireEvent.input(box, { target: { value: 'meant for Anita' } });

    setPage({ user: bela });

    expect((await composerFor('Bela Kovac')).value).toBe('');
  });

  /** A late answer about the last address must not write over the next one. */
  it('is not overwritten by a late answer about the person it was showing before', async () => {
    let release: (user: unknown) => void = () => {};
    const anitaLookup = new Promise((resolve) => (release = resolve));
    userByHash.mockImplementation((user: Uint8Array) =>
      user.every((byte, i) => byte === ANITA[i])
        ? E.promise(() => anitaLookup)
        : E.succeed({ name: 'Bela Kovac', original_action_hash: BELA })
    );
    render(ConversationPage);
    await new Promise((resolve) => setTimeout(resolve, 20));

    setPage({ user: bela });
    await screen.findByRole('heading', { name: 'Bela Kovac' });
    release({ name: 'Anita Rossi', original_action_hash: ANITA });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(screen.getByRole('heading', { name: 'Bela Kovac' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Anita Rossi' })).toBeNull();
  });

  /** The page sets itself up for its address, not whenever a store it reads changes. */
  it('keeps the draft when the signed-in member is re-read', async () => {
    render(ConversationPage);
    const box = await composerFor('Anita Rossi');
    await fireEvent.input(box, { target: { value: 'half a thought' } });

    signedIn.current = { original_action_hash: hashes.ME, status: { status_type: 'accepted' } };
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(((await screen.findByRole('textbox')) as HTMLTextAreaElement).value).toBe(
      'half a thought'
    );
  });

  it('keeps the draft and shows the reason when the zome refuses', async () => {
    sendMessage.mockReturnValue(E.fail(refusal));
    render(ConversationPage);
    const box = await composerFor('Anita Rossi');
    await fireEvent.input(box, { target: { value: 'will be refused' } });

    await fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText(/Only an accepted member can send/)).toBeTruthy();
    expect(box.value, 'nothing the member typed is lost to an error').toBe('will be refused');
  });

  /** A failed re-read after a send is a read fault, never "your message wasn't sent". */
  it('does not say a message was not sent because the read after it failed', async () => {
    render(ConversationPage);
    const box = await composerFor('Anita Rossi');
    await fireEvent.input(box, { target: { value: 'this one goes' } });
    getInbox.mockReturnValue(E.fail(new Error('get_inbox_delta: no answer')));

    await fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(screen.queryByText(/wasn't sent/)).toBeNull();
    expect(box.value, 'and the box is cleared, because it went').toBe('');
  });

  /** A slow send's answer belongs to the conversation it was pressed in. */
  it("does not show one person's refused send on the next person's screen", async () => {
    sendMessage.mockReturnValue(E.sleep('60 millis').pipe(E.zipRight(E.fail(refusal))));
    render(ConversationPage);
    const box = await composerFor('Anita Rossi');
    await fireEvent.input(box, { target: { value: 'to Anita' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    setPage({ user: bela });
    await composerFor('Bela Kovac');
    expect(
      (screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled,
      'Bela can be written to while the send to Anita is still out'
    ).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 120));

    expect(screen.queryByText(/Only an accepted member can send/)).toBeNull();
  });

  /** "May not have sent" had only "send again": if that kept failing it could not be cleared. */
  it('lets a message that may not have sent be discarded', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        schemaVersion: 2,
        outbox: [
          { id: 'held-1', to: anita, content: 'did this go?', queuedAt: T, state: 'mayNotHaveSent' }
        ]
      })
    );
    render(ConversationPage);
    expect(await screen.findByText('did this go?')).toBeTruthy();

    await fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

    await waitFor(() => expect(screen.queryByText('did this go?')).toBeNull());
    const stored = JSON.parse(localStorage.getItem(KEY) ?? '{}') as { outbox: unknown[] };
    expect(stored.outbox, 'and gone from the device').toEqual([]);
  });
});

describe('the list of conversations', () => {
  /** Names were resolved once, after the first read. */
  it('names a conversation that first appears after the page has opened', async () => {
    render(MessagesPage);
    expect(await screen.findByText('No conversations yet')).toBeTruthy();

    getInbox.mockReturnValue(E.succeed([fromAnita(hashes.M1, T, 'hello')]));
    await E.runPromise(messagingStore.loadConversations());

    expect(await screen.findByText('Anita Rossi')).toBeTruthy();
  });

  /** A failed read is not an empty inbox. */
  it('does not say there are no conversations when the read failed', async () => {
    // A store that has shown nothing yet: clear whatever an earlier case left in it.
    getInbox.mockReturnValue(E.succeed([]));
    await E.runPromise(messagingStore.loadConversations());
    getInbox.mockReturnValue(E.fail(new Error('get_inbox_delta: no answer')));

    render(MessagesPage);

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText('No conversations yet')).toBeNull();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});

describe('Messages on a network without messaging', () => {
  const child = createRawSnippet(() => ({ render: () => '<p>the page beneath</p>' }));

  /** A typed address or an old link must not mount a page that reads the inbox. */
  it('renders nothing beneath it, and says why', async () => {
    messagingPresence.read(['users_organizations_integrity']);
    render(MessagesLayout, { props: { children: child } });

    expect(await screen.findByText('This network does not have messaging.')).toBeTruthy();
    expect(screen.queryByText('the page beneath')).toBeNull();
  });

  it('renders the page where the network has it', async () => {
    messagingPresence.read(['messaging_integrity']);
    render(MessagesLayout, { props: { children: child } });

    expect(await screen.findByText('the page beneath')).toBeTruthy();
  });
});
