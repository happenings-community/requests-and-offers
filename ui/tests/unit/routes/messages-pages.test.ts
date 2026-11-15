import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { Effect as E } from 'effect';
import { encodeHashToBase64 } from '@holochain/client';
import { localKey } from '$lib/utils/messaging-local';
import messagingStore from '$lib/stores/messaging.store.svelte';
import { cardsGoing, cardRefusals } from '$lib/composables/domain/messaging/useConversation.svelte';
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

const {
  hashes,
  getInbox,
  getSent,
  sendMessage,
  findSent,
  userByHash,
  myRequests,
  myExchanges,
  myInterests,
  requestByHash,
  respond,
  cancel,
  withdrawInterest
} = vi.hoisted(() => {
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
    findSent: vi.fn(),
    /** My own published requests, for the Share a listing picker. */
    myRequests: vi.fn(),
    /** My exchanges and interests, which are what put cards in a conversation. */
    myExchanges: vi.fn(),
    myInterests: vi.fn(),
    requestByHash: vi.fn(),
    respond: vi.fn(),
    cancel: vi.fn(),
    withdrawInterest: vi.fn(),
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
    findSent: (...a: unknown[]) => findSent(...a),
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
      getMyInterests: () => Effect.succeed(myInterests()),
      getInterestsForListing: () => Effect.succeed([]),
      loadMyExchanges: () => Effect.succeed(myExchanges()),
      respond: (...a: unknown[]) => respond(...a),
      cancel: (...a: unknown[]) => cancel(...a),
      withdrawInterest: (...a: unknown[]) => withdrawInterest(...a)
    }
  };
});

vi.mock('$lib/stores/requests.store.svelte', async () => {
  const { Effect } = await import('effect');
  return {
    default: {
      getMyListings: () => Effect.succeed(myRequests()),
      getRequest: () => Effect.succeed(requestByHash()),
      getOffer: () => Effect.succeed(null)
    }
  };
});
vi.mock('$lib/stores/offers.store.svelte', async () => {
  const { Effect } = await import('effect');
  return {
    default: {
      getMyListings: () => Effect.succeed([]),
      getRequest: () => Effect.succeed(null),
      getOffer: () => Effect.succeed(null)
    }
  };
});

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
  cardsGoing.clear();
  cardRefusals.clear();
  getInbox.mockReturnValue(E.succeed([]));
  getSent.mockReturnValue(E.succeed([]));
  // The store is one object for the whole file: nothing held by one case reaches the next.
  for (const item of [...messagingStore.outbox]) messagingStore.discardUnsent(item.id);
  sendMessage.mockReset();
  sendMessage.mockReturnValue(E.succeed([]));
  findSent.mockReset();
  findSent.mockReturnValue(E.succeed(null));
  myRequests.mockReturnValue([]);
  myExchanges.mockReturnValue([]);
  myInterests.mockReturnValue([]);
  requestByHash.mockReturnValue(null);
  for (const call of [respond, cancel, withdrawInterest]) {
    call.mockReset();
    call.mockReturnValue(E.succeed(undefined));
  }
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

    // And it is not lost: back in Anita's conversation it is there, refused, with the reason.
    setPage({ user: anita });
    await screen.findByRole('heading', { name: 'Anita Rossi' });
    expect(await screen.findByText('to Anita')).toBeTruthy();
    expect(screen.getByText(/Only an accepted member can send/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send again' })).toBeTruthy();
  });

  it('sends a second message after a first', async () => {
    render(ConversationPage);
    const box = await composerFor('Anita Rossi');
    const send = () => screen.getByRole('button', { name: 'Send' });

    await fireEvent.input(box, { target: { value: 'one' } });
    await fireEvent.click(send());
    await waitFor(() => expect(box.value).toBe(''));
    await fireEvent.input(box, { target: { value: 'two' } });
    await fireEvent.click(send());

    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(2));
    expect(sendMessage.mock.calls.map(([input]) => (input as { content: string }).content)).toEqual(
      ['one', 'two']
    );
  });

  it('lets the member press Send again after a refusal', async () => {
    sendMessage.mockReturnValue(E.fail(refusal));
    render(ConversationPage);
    const box = await composerFor('Anita Rossi');
    await fireEvent.input(box, { target: { value: 'will be refused' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText(/Only an accepted member can send/);

    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(
      false
    );
  });

  it('does not send while a send is already going', async () => {
    sendMessage.mockReturnValue(E.sleep('40 millis').pipe(E.as([])));
    render(ConversationPage);
    const box = await composerFor('Anita Rossi');
    await fireEvent.input(box, { target: { value: 'once' } });
    const form = box.closest('form') as HTMLFormElement;

    await fireEvent.submit(form);
    await fireEvent.submit(form);
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  /** Leaving and coming back during a slow send must not free Send under a later one. */
  it('an answer to an earlier press does not free Send for a later one still going', async () => {
    sendMessage.mockReturnValue(E.sleep('60 millis').pipe(E.as([])));
    render(ConversationPage);
    let box = await composerFor('Anita Rossi');
    await fireEvent.input(box, { target: { value: 'one' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    setPage({ user: bela });
    await composerFor('Bela Kovac');
    setPage({ user: anita });
    box = await composerFor('Anita Rossi');
    await fireEvent.input(box, { target: { value: 'two' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    // The answer to "one" arrives about now; "two" is still on its way.
    await new Promise((resolve) => setTimeout(resolve, 50));
    await fireEvent.submit(box.closest('form') as HTMLFormElement);
    await new Promise((resolve) => setTimeout(resolve, 120));

    expect(sendMessage.mock.calls.map(([input]) => (input as { content: string }).content)).toEqual(
      ['one', 'two']
    );
  });

  /**
   * Leaving for another conversation was covered; leaving Messages altogether destroys
   * the page, and the refusal went to a screen nobody could see and was kept nowhere.
   */
  it('keeps a message refused after the member has left Messages altogether', async () => {
    sendMessage.mockReturnValue(E.sleep('40 millis').pipe(E.andThen(E.fail(refusal))));
    const { unmount } = render(ConversationPage);
    const box = await composerFor('Anita Rossi');
    await fireEvent.input(box, { target: { value: 'meant for Anita' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    unmount();

    await waitFor(() => expect(messagingStore.outbox).toHaveLength(1));
    expect(messagingStore.outbox[0]).toMatchObject({
      to: anita,
      content: 'meant for Anita',
      state: 'refused'
    });
  });

  it("does not carry one person's errors to the next person's screen", async () => {
    sendMessage.mockReturnValue(E.fail(refusal));
    render(ConversationPage);
    const box = await composerFor('Anita Rossi');
    await fireEvent.input(box, { target: { value: 'meant for Anita' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText(/Your message wasn't sent/);

    setPage({ user: bela });
    await composerFor('Bela Kovac');

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not carry an open Block question from one person to the next', async () => {
    render(ConversationPage);
    await composerFor('Anita Rossi');
    await fireEvent.click(screen.getByRole('button', { name: 'Block' }));
    expect(screen.getByRole('button', { name: 'Block Anita Rossi' })).toBeTruthy();

    setPage({ user: bela });
    await composerFor('Bela Kovac');

    expect(screen.queryByRole('button', { name: /^Block .+/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Block' })).toBeTruthy();
  });

  it('does not carry an open proposal picker from one person to the next', async () => {
    render(ConversationPage);
    await composerFor('Anita Rossi');
    await fireEvent.click(screen.getByRole('button', { name: 'Make a proposal' }));
    expect(screen.getByTestId('proposal-picker')).toBeTruthy();

    setPage({ user: bela });
    await composerFor('Bela Kovac');

    expect(screen.queryByTestId('proposal-picker')).toBeNull();
  });

  /**
   * The composer is on screen before this page's own read has finished when the store
   * already holds the conversation, so there can be a draft when that read fails.
   */
  it('keeps what was typed when the first read fails and is tried again', async () => {
    getInbox.mockReturnValue(E.succeed([fromAnita(hashes.M1, T, 'first')]));
    await E.runPromise(messagingStore.loadConversations());
    getInbox.mockReturnValue(
      E.sleep('40 millis').pipe(E.andThen(E.fail(new Error('get_inbox_delta: no answer'))))
    );
    render(ConversationPage);
    const box = (await screen.findByRole('textbox')) as HTMLTextAreaElement;
    await fireEvent.input(box, { target: { value: 'typed early' } });

    await screen.findByTestId('conversation-fault');
    getInbox.mockReturnValue(E.succeed([fromAnita(hashes.M1, T, 'first')]));
    await fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await screen.findByRole('heading', { name: 'Anita Rossi' });
    expect(((await screen.findByRole('textbox')) as HTMLTextAreaElement).value).toBe('typed early');
  });

  /** The poll or a nudge starts a read while this page's own is still under way. */
  it('shows the conversation, and marks it read, when another read starts during its own', async () => {
    getInbox.mockReturnValue(E.sleep('30 millis').pipe(E.as([fromAnita(hashes.M1, T, 'first')])));
    render(ConversationPage);
    await new Promise((resolve) => setTimeout(resolve, 5));
    void E.runPromise(messagingStore.loadConversations()).catch(() => {});

    expect(await screen.findByText('first')).toBeTruthy();
    await waitFor(() => expect(readMark()).toBe(T));
  });

  /** It showed a name, a working composer and an empty timeline, with no fault at all. */
  it('still shows the conversation when a read started during its own then fails', async () => {
    getInbox.mockReturnValueOnce(
      E.sleep('30 millis').pipe(E.as([fromAnita(hashes.M1, T, 'first')]))
    );
    render(ConversationPage);
    await new Promise((resolve) => setTimeout(resolve, 5));
    getInbox.mockReturnValue(E.fail(new Error('get_inbox_delta: no answer')));
    await E.runPromise(messagingStore.loadConversations()).catch(() => {});

    await composerFor('Anita Rossi');
    expect(await screen.findByText('first')).toBeTruthy();
  });

  /** Try again freed Send and kept the text, so the same message could be sent twice. */
  it('does not leave a message in the box to send twice when Try again is pressed as it goes', async () => {
    getInbox.mockReturnValue(E.succeed([fromAnita(hashes.M1, T, 'first')]));
    await E.runPromise(messagingStore.loadConversations());
    getInbox.mockReturnValue(
      E.sleep('30 millis').pipe(E.andThen(E.fail(new Error('get_inbox_delta: no answer'))))
    );
    sendMessage.mockReturnValue(E.sleep('120 millis').pipe(E.as([])));
    render(ConversationPage);
    const box = (await screen.findByRole('textbox')) as HTMLTextAreaElement;
    await fireEvent.input(box, { target: { value: 'hello once' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await screen.findByTestId('conversation-fault');
    getInbox.mockReturnValue(E.succeed([fromAnita(hashes.M1, T, 'first')]));
    await fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await composerFor('Anita Rossi');
    expect(
      (screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled,
      'the message is still going'
    ).toBe(true);

    await waitFor(() =>
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('')
    );
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(
      false
    );
  });

  /** SvelteKit speaks again on a change of hash, with the same address. */
  it('keeps the draft when the page store speaks again with the same address', async () => {
    render(ConversationPage);
    const box = await composerFor('Anita Rossi');
    await fireEvent.input(box, { target: { value: 'half a thought' } });

    setPage({ user: anita }, '/messages#top');
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(((await screen.findByRole('textbox')) as HTMLTextAreaElement).value).toBe(
      'half a thought'
    );
  });

  describe('sharing a listing', () => {
    const listing = hashes.M2;
    const openPicker = async () => {
      myRequests.mockReturnValue([{ original_action_hash: listing, title: 'Bike repair' }]);
      render(ConversationPage);
      await composerFor('Anita Rossi');
      await fireEvent.click(screen.getByRole('button', { name: 'Share a listing' }));
      return screen.findByRole('button', { name: /Bike repair/ });
    };

    it('sends the listing as a card, with no text', async () => {
      await fireEvent.click(await openPicker());

      await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
      expect(sendMessage.mock.calls[0][0]).toMatchObject({ content: '', listing });
    });

    /** Two clicks made two sends with two ids, so the other person got two cards. */
    it('sends one card for a double click', async () => {
      sendMessage.mockReturnValue(E.sleep('40 millis').pipe(E.as([])));
      const row = await openPicker();

      void fireEvent.click(row);
      await new Promise((resolve) => setTimeout(resolve, 10));
      void fireEvent.click(row);
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(sendMessage).toHaveBeenCalledTimes(1);
    });

    it('shows the reason when the zome refuses the card', async () => {
      sendMessage.mockReturnValue(E.fail(refusal));
      await fireEvent.click(await openPicker());

      expect(
        await screen.findByText(/That didn't go through: .*Only an accepted member can send/)
      ).toBeTruthy();
    });

    it('does not say the card failed because the read after it failed', async () => {
      const row = await openPicker();
      getInbox.mockReturnValue(E.fail(new Error('get_inbox_delta: no answer')));

      await fireEvent.click(row);
      await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
      await new Promise((resolve) => setTimeout(resolve, 30));

      expect(screen.queryByText(/didn't go through/)).toBeNull();
    });

    /**
     * The row stays on screen until the re-read after the send has finished, so a click
     * in that gap was a second card with a second id.
     */
    it('sends one card for a second click while the conversation is read again', async () => {
      const row = await openPicker();
      getSent.mockReturnValue(E.sleep('120 millis').pipe(E.as([])));

      void fireEvent.click(row);
      await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
      await new Promise((resolve) => setTimeout(resolve, 30));
      const again = screen.queryByRole('button', { name: /Bike repair/ }) as HTMLButtonElement;
      expect(again?.disabled, 'no row to press while the card is still being dealt with').not.toBe(
        false
      );
      if (again) void fireEvent.click(again);
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(sendMessage).toHaveBeenCalledTimes(1);
    });

    it('shares a second listing after a first', async () => {
      await fireEvent.click(await openPicker());
      await waitFor(() => expect(screen.queryByRole('button', { name: /Bike repair/ })).toBeNull());

      await fireEvent.click(screen.getByRole('button', { name: 'Share a listing' }));
      const row = (await screen.findByRole('button', { name: /Bike repair/ })) as HTMLButtonElement;
      expect(row.disabled).toBe(false);
      await fireEvent.click(row);

      await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(2));
    });

    it('leaves the picker open under the reason when the card is refused', async () => {
      sendMessage.mockReturnValue(E.fail(refusal));
      await fireEvent.click(await openPicker());

      await screen.findByText(/That didn't go through/);
      await new Promise((resolve) => setTimeout(resolve, 20));
      const row = screen.getByRole('button', { name: /Bike repair/ }) as HTMLButtonElement;
      expect(row.disabled, 'and free to press again').toBe(false);
    });

    /**
     * Send and the cards counted their presses together, so a card pressed while a
     * message was going made that message's answer look like nobody's.
     */
    it('frees Send and clears the box when a card is pressed while a message is going', async () => {
      const row = await openPicker();
      sendMessage.mockReturnValueOnce(E.sleep('60 millis').pipe(E.as([])));
      const box = screen.getByRole('textbox') as HTMLTextAreaElement;
      await fireEvent.input(box, { target: { value: 'hello' } });
      await fireEvent.click(screen.getByRole('button', { name: 'Send' }));

      await fireEvent.click(row);

      await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(box.value).toBe(''));
      expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(
        false
      );
    });

    it('says why a message was refused when a card was pressed while it was going', async () => {
      const row = await openPicker();
      sendMessage.mockReturnValueOnce(E.sleep('60 millis').pipe(E.andThen(E.fail(refusal))));
      const box = screen.getByRole('textbox') as HTMLTextAreaElement;
      await fireEvent.input(box, { target: { value: 'hello' } });
      await fireEvent.click(screen.getByRole('button', { name: 'Send' }));

      await fireEvent.click(row);

      expect(
        await screen.findByText(/Your message wasn't sent: .*Only an accepted member can send/)
      ).toBeTruthy();
      expect(box.value, 'the draft is kept').toBe('hello');
      expect(messagingStore.outbox, 'and not held as well').toHaveLength(0);
      expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(
        false
      );
    });

    it('says why a card was refused when Send was pressed while it was going', async () => {
      const row = await openPicker();
      sendMessage.mockReturnValueOnce(E.sleep('60 millis').pipe(E.andThen(E.fail(refusal))));
      void fireEvent.click(row);
      await new Promise((resolve) => setTimeout(resolve, 10));

      const box = screen.getByRole('textbox') as HTMLTextAreaElement;
      await fireEvent.input(box, { target: { value: 'hello' } });
      await fireEvent.click(screen.getByRole('button', { name: 'Send' }));

      expect(await screen.findByText(/That didn't go through/)).toBeTruthy();
    });

    it('does not carry an open picker from one person to the next', async () => {
      await openPicker();

      setPage({ user: bela });
      await composerFor('Bela Kovac');

      expect(screen.queryByTestId('share-listing')).toBeNull();
    });

    /** A card still going for the person just left must not lock the next person's cards. */
    it("does not lock the next person's cards on one still going for the last", async () => {
      const row = await openPicker();
      sendMessage.mockReturnValueOnce(E.sleep('150 millis').pipe(E.as([])));
      void fireEvent.click(row);
      await new Promise((resolve) => setTimeout(resolve, 10));

      setPage({ user: bela });
      await composerFor('Bela Kovac');
      await fireEvent.click(screen.getByRole('button', { name: 'Share a listing' }));
      const next = (await screen.findByRole('button', {
        name: /Bike repair/
      })) as HTMLButtonElement;

      expect(next.disabled).toBe(false);
    });

    /** And the other way: the last person's card finishing must not free the next one's. */
    it("does not free the next person's cards when one for the last person finishes", async () => {
      const row = await openPicker();
      sendMessage.mockReturnValue(E.sleep('60 millis').pipe(E.as([])));
      void fireEvent.click(row);
      await new Promise((resolve) => setTimeout(resolve, 10));

      setPage({ user: bela });
      await composerFor('Bela Kovac');
      await fireEvent.click(screen.getByRole('button', { name: 'Share a listing' }));
      const next = (await screen.findByRole('button', {
        name: /Bike repair/
      })) as HTMLButtonElement;
      sendMessage.mockReturnValue(E.sleep('200 millis').pipe(E.as([])));
      void fireEvent.click(next);
      // Anita's card has gone by now; Bela's is still on its way.
      await new Promise((resolve) => setTimeout(resolve, 110));

      expect(next.isConnected, "the next person's picker is still open").toBe(true);
      expect(next.disabled, 'and its card is still going').toBe(true);
    });

    it('keeps a card refused after the member has moved on, for the person it was for', async () => {
      const row = await openPicker();
      sendMessage.mockReturnValue(E.sleep('40 millis').pipe(E.andThen(E.fail(refusal))));
      void fireEvent.click(row);
      await new Promise((resolve) => setTimeout(resolve, 10));

      setPage({ user: bela });
      await composerFor('Bela Kovac');
      await waitFor(() => expect(messagingStore.outbox).toHaveLength(1));

      expect(messagingStore.outbox[0]).toMatchObject({
        to: anita,
        content: '',
        listing: encodeHashToBase64(listing),
        state: 'refused'
      });
      expect(
        screen.queryByRole('alert'),
        "and not reported on the next person's screen"
      ).toBeNull();
    });

    it('keeps a card refused after the member has left Messages altogether', async () => {
      myRequests.mockReturnValue([{ original_action_hash: listing, title: 'Bike repair' }]);
      const { unmount } = render(ConversationPage);
      await composerFor('Anita Rossi');
      await fireEvent.click(screen.getByRole('button', { name: 'Share a listing' }));
      sendMessage.mockReturnValue(E.sleep('40 millis').pipe(E.andThen(E.fail(refusal))));
      void fireEvent.click(await screen.findByRole('button', { name: /Bike repair/ }));
      await new Promise((resolve) => setTimeout(resolve, 10));

      unmount();

      await waitFor(() => expect(messagingStore.outbox).toHaveLength(1));
      expect(messagingStore.outbox[0]).toMatchObject({ to: anita, state: 'refused' });
    });

    /** Leaving and coming straight back freed the row while the first card was still going. */
    it('sends one card when the member leaves and comes back while it is going', async () => {
      const row = await openPicker();
      sendMessage.mockReturnValue(E.sleep('120 millis').pipe(E.as([])));
      void fireEvent.click(row);
      await new Promise((resolve) => setTimeout(resolve, 10));

      setPage({ user: bela });
      await composerFor('Bela Kovac');
      setPage({ user: anita });
      await composerFor('Anita Rossi');
      await fireEvent.click(screen.getByRole('button', { name: 'Share a listing' }));
      const again = (await screen.findByRole('button', {
        name: /Bike repair/
      })) as HTMLButtonElement;
      expect(again.disabled, 'still going').toBe(true);
      await fireEvent.click(again);

      // And free again once it has gone.
      await waitFor(() => expect(again.disabled).toBe(false));
      expect(sendMessage).toHaveBeenCalledTimes(1);
    });

    /** Leaving for the list and coming back made a new screen, which had forgotten it. */
    it('sends one card when the member leaves Messages and comes back while it is going', async () => {
      myRequests.mockReturnValue([{ original_action_hash: listing, title: 'Bike repair' }]);
      const first = render(ConversationPage);
      await composerFor('Anita Rossi');
      await fireEvent.click(screen.getByRole('button', { name: 'Share a listing' }));
      sendMessage.mockReturnValue(E.sleep('120 millis').pipe(E.as([])));
      void fireEvent.click(await screen.findByRole('button', { name: /Bike repair/ }));
      await new Promise((resolve) => setTimeout(resolve, 10));

      first.unmount();
      render(ConversationPage);
      await composerFor('Anita Rossi');
      await fireEvent.click(screen.getByRole('button', { name: 'Share a listing' }));
      const again = (await screen.findByRole('button', {
        name: /Bike repair/
      })) as HTMLButtonElement;
      expect(again.disabled, 'still going').toBe(true);
      await fireEvent.click(again);

      await waitFor(() => expect(again.disabled).toBe(false));
      expect(sendMessage).toHaveBeenCalledTimes(1);
    });

    it("does not carry a refused card's reason to the next person's screen", async () => {
      sendMessage.mockReturnValue(E.fail(refusal));
      await fireEvent.click(await openPicker());
      await screen.findByText(/That didn't go through/);

      setPage({ user: bela });
      await composerFor('Bela Kovac');

      expect(screen.queryByRole('alert')).toBeNull();

      // And it has been seen: it is not said again on coming back.
      setPage({ user: anita });
      await composerFor('Anita Rossi');
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('says why a card was refused in a conversation that already has messages', async () => {
      getInbox.mockReturnValue(E.succeed([fromAnita(hashes.M1, T, 'hello')]));
      sendMessage.mockReturnValue(E.fail(refusal));
      await fireEvent.click(await openPicker());

      expect(await screen.findByText(/That didn't go through/)).toBeTruthy();
      expect(screen.getByText('hello')).toBeTruthy();
    });

    it('takes the reason away when the card is pressed again', async () => {
      sendMessage.mockReturnValueOnce(E.fail(refusal));
      await fireEvent.click(await openPicker());
      await screen.findByText(/That didn't go through/);
      await new Promise((resolve) => setTimeout(resolve, 20));

      sendMessage.mockReturnValue(E.sleep('60 millis').pipe(E.as([])));
      void fireEvent.click(screen.getByRole('button', { name: /Bike repair/ }));

      await waitFor(() => expect(screen.queryByText(/That didn't go through/)).toBeNull());
      expect(sendMessage, 'while it is still going').toHaveBeenCalledTimes(2);
    });

    it('reads the conversation again once the card has gone', async () => {
      const row = await openPicker();
      const readsBefore = getSent.mock.calls.length;

      await fireEvent.click(row);

      await waitFor(() => expect(getSent.mock.calls.length).toBeGreaterThan(readsBefore));
    });
  });

  describe('a proposal in the conversation', () => {
    const AGREEMENT = hashes.M1;
    const term = { resource_kind: 'Gift', resource_conforms_to: 'Gift' };
    /** One Anita wrote and I have not answered. */
    const fromHer = {
      agreement_hash: AGREEMENT,
      status: 'Proposed',
      created_at: T,
      agreement: {
        counterparty: hashes.ME,
        provider: ANITA,
        receiver: hashes.ME,
        primary: term,
        reciprocal: term
      }
    };
    /** One I wrote and she has not answered. */
    const fromMe = {
      ...fromHer,
      agreement: { ...fromHer.agreement, counterparty: ANITA, provider: hashes.ME, receiver: ANITA }
    };
    const open = async (exchange: unknown) => {
      myExchanges.mockReturnValue([exchange]);
      render(ConversationPage);
      await composerFor('Anita Rossi');
      return screen.findByTestId('proposal-card');
    };
    const declineWith = async (reason: string) => {
      await fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
      const box = screen.getByLabelText(/Why are you declining/i) as HTMLTextAreaElement;
      await fireEvent.input(box, { target: { value: reason } });
      return box;
    };
    const confirmDecline = () =>
      screen.getByRole('button', { name: 'Decline proposal' }) as HTMLButtonElement;

    it('accepts with Accept', async () => {
      await open(fromHer);
      await fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

      await waitFor(() => expect(respond).toHaveBeenCalledTimes(1));
      expect(respond).toHaveBeenCalledWith(AGREEMENT, true, '');
    });

    it('declines with the reason the member gave', async () => {
      await open(fromHer);
      await declineWith('  Not this week  ');
      await fireEvent.click(confirmDecline());

      await waitFor(() => expect(respond).toHaveBeenCalledTimes(1));
      expect(respond).toHaveBeenCalledWith(AGREEMENT, false, 'Not this week');
    });

    it('withdraws with Withdraw', async () => {
      await open(fromMe);
      await fireEvent.click(screen.getByTestId('proposal-withdraw'));

      await waitFor(() => expect(cancel).toHaveBeenCalledTimes(1));
      expect(cancel.mock.calls[0][0]).toBe(AGREEMENT);
      expect(respond).not.toHaveBeenCalled();
    });

    /** The form closed and the reason went with it, under a line saying it had failed. */
    it('keeps the reason when the decline does not go through', async () => {
      respond.mockReturnValue(E.fail(new Error('respond: no answer')));
      await open(fromHer);
      const box = await declineWith('Not this week');
      await fireEvent.click(confirmDecline());

      expect(await screen.findByText(/That didn't go through: .*no answer/)).toBeTruthy();
      expect(box.isConnected, 'the form is still open').toBe(true);
      expect(box.value).toBe('Not this week');
    });

    /** Pressed while another card was going, it made no call and threw the reason away. */
    it('cannot be answered while another card is going, and keeps what was typed', async () => {
      myRequests.mockReturnValue([{ original_action_hash: hashes.M2, title: 'Bike repair' }]);
      await open(fromHer);
      const box = await declineWith('Not this week');
      await fireEvent.click(screen.getByRole('button', { name: 'Share a listing' }));
      sendMessage.mockReturnValueOnce(E.sleep('80 millis').pipe(E.as([])));
      void fireEvent.click(await screen.findByRole('button', { name: /Bike repair/ }));
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(confirmDecline().disabled).toBe(true);
      await fireEvent.click(confirmDecline());
      expect(respond).not.toHaveBeenCalled();
      expect(box.value).toBe('Not this week');

      // And free again once the card has gone.
      await waitFor(() => expect(confirmDecline().disabled).toBe(false));
    });

    /** They went to someone else and came back: this is the screen to say it on. */
    it('says an accept was refused when the member has gone away and come back by then', async () => {
      respond.mockReturnValue(
        E.sleep('60 millis').pipe(E.andThen(E.fail(new Error('respond: no answer'))))
      );
      await open(fromHer);
      void fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
      await new Promise((resolve) => setTimeout(resolve, 10));

      setPage({ user: bela });
      await composerFor('Bela Kovac');
      setPage({ user: anita });
      await composerFor('Anita Rossi');

      expect(await screen.findByText(/That didn't go through: .*no answer/)).toBeTruthy();
    });

    /** The other way of coming back: through the list, which makes a new screen. */
    it('says an accept was refused when the member has been to the list and back by then', async () => {
      respond.mockReturnValue(
        E.sleep('60 millis').pipe(E.andThen(E.fail(new Error('respond: no answer'))))
      );
      myExchanges.mockReturnValue([fromHer]);
      const first = render(ConversationPage);
      await composerFor('Anita Rossi');
      void fireEvent.click(await screen.findByRole('button', { name: 'Accept' }));
      await new Promise((resolve) => setTimeout(resolve, 10));

      first.unmount();
      render(ConversationPage);
      await composerFor('Anita Rossi');

      expect(await screen.findByText(/That didn't go through: .*no answer/)).toBeTruthy();
      expect(respond).toHaveBeenCalledTimes(1);
    });

    it('does not say an accept was refused on the screen of the person the member went to', async () => {
      respond.mockReturnValue(
        E.sleep('40 millis').pipe(E.andThen(E.fail(new Error('respond: no answer'))))
      );
      await open(fromHer);
      void fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
      await new Promise((resolve) => setTimeout(resolve, 10));

      setPage({ user: bela });
      await composerFor('Bela Kovac');
      await new Promise((resolve) => setTimeout(resolve, 80));
      expect(screen.queryByRole('alert'), 'nothing on Bela').toBeNull();

      setPage({ user: anita });
      await composerFor('Anita Rossi');
      expect(await screen.findByText(/That didn't go through: .*no answer/)).toBeTruthy();
    });

    /** "No answer" is the case where it may have landed after all. */
    it('does not say an accept failed once the proposal has been answered', async () => {
      respond.mockReturnValue(
        E.sleep('40 millis').pipe(E.andThen(E.fail(new Error('respond: no answer'))))
      );
      myExchanges.mockReturnValue([fromHer]);
      const first = render(ConversationPage);
      await composerFor('Anita Rossi');
      void fireEvent.click(await screen.findByRole('button', { name: 'Accept' }));
      await new Promise((resolve) => setTimeout(resolve, 10));
      first.unmount();
      await new Promise((resolve) => setTimeout(resolve, 80));

      myExchanges.mockReturnValue([
        { ...fromHer, status: 'Agreed', response: { accepted: true, created_at: T + 1 } }
      ]);
      render(ConversationPage);
      await composerFor('Anita Rossi');
      await new Promise((resolve) => setTimeout(resolve, 30));

      expect(screen.queryByText(/That didn't go through/)).toBeNull();
    });

    /** The visit showed the fault, not the reason, so the reason has not been seen. */
    it('still says it after a visit whose read failed', async () => {
      respond.mockReturnValue(
        E.sleep('40 millis').pipe(E.andThen(E.fail(new Error('respond: no answer'))))
      );
      myExchanges.mockReturnValue([fromHer]);
      const first = render(ConversationPage);
      await composerFor('Anita Rossi');
      void fireEvent.click(await screen.findByRole('button', { name: 'Accept' }));
      await new Promise((resolve) => setTimeout(resolve, 10));
      first.unmount();
      await new Promise((resolve) => setTimeout(resolve, 80));

      getInbox.mockReturnValue(E.fail(new Error('get_inbox_delta: no answer')));
      const second = render(ConversationPage);
      await screen.findByTestId('conversation-fault');
      second.unmount();

      getInbox.mockReturnValue(E.succeed([]));
      render(ConversationPage);
      await composerFor('Anita Rossi');
      expect(await screen.findByText(/That didn't go through: .*respond: no answer/)).toBeTruthy();
    });

    /** Press a card that is refused after the member has left Messages, and leave. */
    const refusedAfterLeaving = async (button: () => Promise<HTMLElement>) => {
      const first = render(ConversationPage);
      await composerFor('Anita Rossi');
      void fireEvent.click(await button());
      await new Promise((resolve) => setTimeout(resolve, 10));
      first.unmount();
      await new Promise((resolve) => setTimeout(resolve, 80));
    };
    const saysNothing = async () => {
      render(ConversationPage);
      await composerFor('Anita Rossi');
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(screen.queryByText(/That didn't go through/)).toBeNull();
    };

    /** On screen before this visit's own read had finished, from what the store held. */
    it('does not say it again after it was on screen, even before the visit had read', async () => {
      respond.mockReturnValue(
        E.sleep('40 millis').pipe(E.andThen(E.fail(new Error('respond: no answer'))))
      );
      myExchanges.mockReturnValue([fromHer]);
      await refusedAfterLeaving(() => screen.findByRole('button', { name: 'Accept' }));

      getInbox.mockReturnValue(E.sleep('150 millis').pipe(E.as([])));
      render(ConversationPage);
      expect(await screen.findByText(/That didn't go through: .*no answer/)).toBeTruthy();
      setPage({ user: bela });
      await new Promise((resolve) => setTimeout(resolve, 250));

      getInbox.mockReturnValue(E.succeed([]));
      setPage({ user: anita });
      await composerFor('Anita Rossi');
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(screen.queryByText(/That didn't go through/), 'said a second time').toBeNull();
    });

    it('still says it after a visit whose read failed and a move to someone else', async () => {
      respond.mockReturnValue(
        E.sleep('40 millis').pipe(E.andThen(E.fail(new Error('respond: no answer'))))
      );
      myExchanges.mockReturnValue([fromHer]);
      await refusedAfterLeaving(() => screen.findByRole('button', { name: 'Accept' }));

      getInbox.mockReturnValue(E.fail(new Error('get_inbox_delta: no answer')));
      render(ConversationPage);
      await screen.findByTestId('conversation-fault');
      getInbox.mockReturnValue(E.succeed([]));
      setPage({ user: bela });
      await composerFor('Bela Kovac');

      setPage({ user: anita });
      await composerFor('Anita Rossi');
      expect(await screen.findByText(/That didn't go through: .*respond: no answer/)).toBeTruthy();
    });

    it('is not said once the proposal has a response, whatever its status reads', async () => {
      respond.mockReturnValue(
        E.sleep('40 millis').pipe(E.andThen(E.fail(new Error('respond: no answer'))))
      );
      myExchanges.mockReturnValue([fromHer]);
      await refusedAfterLeaving(() => screen.findByRole('button', { name: 'Accept' }));

      myExchanges.mockReturnValue([
        {
          ...fromHer,
          response: { agreement: AGREEMENT, accepted: true, note: '', created_at: T + 1 }
        }
      ]);
      await saysNothing();
    });

    it('is not said once the proposal is no longer proposed, response or not', async () => {
      respond.mockReturnValue(
        E.sleep('40 millis').pipe(E.andThen(E.fail(new Error('respond: no answer'))))
      );
      myExchanges.mockReturnValue([fromHer]);
      await refusedAfterLeaving(() => screen.findByRole('button', { name: 'Accept' }));

      myExchanges.mockReturnValue([{ ...fromHer, status: 'Agreed' }]);
      await saysNothing();
    });

    it('does not say a withdrawal failed once the proposal has been answered', async () => {
      cancel.mockReturnValue(
        E.sleep('40 millis').pipe(E.andThen(E.fail(new Error('cancel: no answer'))))
      );
      myExchanges.mockReturnValue([fromMe]);
      await refusedAfterLeaving(() => screen.findByTestId('proposal-withdraw'));

      myExchanges.mockReturnValue([{ ...fromMe, status: 'Agreed' }]);
      await saysNothing();
    });

    it('does not say it again once the member has seen it and left', async () => {
      respond.mockReturnValue(E.fail(new Error('respond: no answer')));
      await open(fromHer);
      await fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
      await screen.findByText(/That didn't go through/);

      cleanup();
      render(ConversationPage);
      await composerFor('Anita Rossi');
      await screen.findByTestId('proposal-card');

      expect(screen.queryByText(/That didn't go through/)).toBeNull();
    });

    it('cannot be withdrawn while another card is going', async () => {
      myRequests.mockReturnValue([{ original_action_hash: hashes.M2, title: 'Bike repair' }]);
      await open(fromMe);
      await fireEvent.click(screen.getByRole('button', { name: 'Share a listing' }));
      sendMessage.mockReturnValueOnce(E.sleep('80 millis').pipe(E.as([])));
      void fireEvent.click(await screen.findByRole('button', { name: /Bike repair/ }));
      await new Promise((resolve) => setTimeout(resolve, 10));

      const withdraw = screen.getByTestId('proposal-withdraw') as HTMLButtonElement;
      expect(withdraw.disabled).toBe(true);
      await waitFor(() => expect(withdraw.disabled).toBe(false));
      expect(cancel).not.toHaveBeenCalled();
    });

    it('answers a second proposal after a first', async () => {
      const second = { ...fromHer, agreement_hash: hashes.M2, created_at: T + 1 };
      myExchanges.mockReturnValue([fromHer, second]);
      render(ConversationPage);
      await composerFor('Anita Rossi');
      const accepts = await screen.findAllByRole('button', { name: 'Accept' });

      await fireEvent.click(accepts[0]);
      await waitFor(() => expect(respond).toHaveBeenCalledTimes(1));
      await waitFor(() => expect((accepts[1] as HTMLButtonElement).disabled).toBe(false));
      await fireEvent.click(accepts[1]);

      await waitFor(() => expect(respond).toHaveBeenCalledTimes(2));
    });
  });

  describe('an interest in the conversation', () => {
    const INTEREST = hashes.M1;
    const LISTING = hashes.M2;
    const open = async (user: Uint8Array) => {
      myInterests.mockReturnValue([
        { interest_hash: INTEREST, listing: LISTING, listing_type: 'Request', user, created_at: T }
      ]);
      requestByHash.mockReturnValue({ title: 'Bike repair', creator: ANITA });
      render(ConversationPage);
      await composerFor('Anita Rossi');
      return screen.findByTestId('opening-card');
    };

    it('withdraws my interest with Withdraw', async () => {
      await open(hashes.ME);
      await fireEvent.click(screen.getByRole('button', { name: /withdraw/i }));

      await waitFor(() => expect(withdrawInterest).toHaveBeenCalledTimes(1));
      expect(withdrawInterest).toHaveBeenCalledWith(INTEREST);
    });

    const refusedAfterLeaving = async () => {
      withdrawInterest.mockReturnValue(
        E.sleep('40 millis').pipe(E.andThen(E.fail(new Error('withdraw: no answer'))))
      );
      await open(hashes.ME);
      void fireEvent.click(screen.getByRole('button', { name: /withdraw/i }));
      await new Promise((resolve) => setTimeout(resolve, 10));
      cleanup();
      await new Promise((resolve) => setTimeout(resolve, 80));
    };

    /** The interest was the whole conversation, so withdrawing it took the thread too. */
    it('does not say a withdrawal failed once the interest, and the conversation, have gone', async () => {
      await refusedAfterLeaving();

      myInterests.mockReturnValue([]);
      render(ConversationPage);
      await composerFor('Anita Rossi');
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(screen.queryByText(/That didn't go through/)).toBeNull();
    });

    it('says a withdrawal failed on the next visit while the interest is still there', async () => {
      await refusedAfterLeaving();

      render(ConversationPage);
      await composerFor('Anita Rossi');
      expect(await screen.findByText(/That didn't go through: .*withdraw: no answer/)).toBeTruthy();
    });

    it("offers no Withdraw on the other person's interest", async () => {
      await open(ANITA);

      expect(screen.queryByRole('button', { name: /withdraw/i })).toBeNull();
    });

    it('sends one withdrawal for a second click while the first is going', async () => {
      withdrawInterest.mockReturnValue(E.sleep('60 millis').pipe(E.as(undefined)));
      await open(hashes.ME);
      const button = screen.getByRole('button', { name: /withdraw/i }) as HTMLButtonElement;

      void fireEvent.click(button);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(button.disabled).toBe(true);
      void fireEvent.click(button);
      await new Promise((resolve) => setTimeout(resolve, 120));

      expect(withdrawInterest).toHaveBeenCalledTimes(1);
    });
  });

  describe('held messages on the page', () => {
    const hold = (items: unknown[]) =>
      localStorage.setItem(KEY, JSON.stringify({ schemaVersion: 2, outbox: items }));
    const item = (id: string, to: string, queuedAt: number, state = 'waiting') => ({
      id,
      to,
      content: `message ${id}`,
      queuedAt,
      state
    });

    it("shows this person's held messages only, oldest first", async () => {
      hold([
        item('later', anita, T + 10),
        item('for-bela', bela, T + 5),
        item('earlier', anita, T)
      ]);
      render(ConversationPage);
      await composerFor('Anita Rossi');

      const shown = (await screen.findAllByText(/^message /)).map((node) => node.textContent);
      expect(shown).toEqual(['message earlier', 'message later']);
    });

    it('sends one that may not have sent when the member says to', async () => {
      hold([item('held-9', anita, T, 'mayNotHaveSent')]);
      render(ConversationPage);
      await composerFor('Anita Rossi');

      await fireEvent.click(
        await screen.findByRole('button', { name: 'This may not have sent. Send again?' })
      );

      await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
      expect(sendMessage.mock.calls[0][0]).toMatchObject({ sendId: 'held-9' });
      await waitFor(() => expect(screen.queryByText('message held-9')).toBeNull());
    });
  });

  it('lets a message still waiting to send be taken back', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        schemaVersion: 2,
        outbox: [
          { id: 'held-2', to: anita, content: 'on second thoughts', queuedAt: T, state: 'waiting' }
        ]
      })
    );
    // Nothing gets through, so it stays waiting.
    sendMessage.mockReturnValue(E.fail(new Error('send_message: no answer')));
    render(ConversationPage);
    expect(await screen.findByText('on second thoughts')).toBeTruthy();

    await fireEvent.click(await screen.findByRole('button', { name: 'Discard' }));

    await waitFor(() => expect(screen.queryByText('on second thoughts')).toBeNull());
    const stored = JSON.parse(localStorage.getItem(KEY) ?? '{}') as { outbox: unknown[] };
    expect(stored.outbox, 'and gone from the device').toEqual([]);
  });

  /** A card that has not gone yet is a card, not an empty bubble. */
  it('draws a held card as a card', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        schemaVersion: 2,
        outbox: [
          {
            id: 'held-3',
            to: anita,
            content: '',
            listing: encodeHashToBase64(hashes.M2),
            queuedAt: T,
            state: 'refused',
            reason: 'no'
          }
        ]
      })
    );
    render(ConversationPage);
    await composerFor('Anita Rossi');

    expect(await screen.findByTestId('shared-listing-card')).toBeTruthy();
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

  /** The first name that failed to look up left every row after it unnamed. */
  it('names the other conversations when one name will not look up', async () => {
    const term = { resource_kind: 'Gift', resource_conforms_to: 'Gift' };
    myExchanges.mockReturnValue([
      {
        agreement_hash: hashes.M2,
        status: 'Proposed',
        created_at: T,
        agreement: {
          counterparty: hashes.ME,
          provider: hashes.BELA,
          receiver: hashes.ME,
          primary: term,
          reciprocal: term
        }
      }
    ]);
    // Anita's is the newer, so hers is looked up first, and it fails.
    getInbox.mockReturnValue(E.succeed([fromAnita(hashes.M1, T + 10, 'hello')]));
    const isBela = (user: Uint8Array) => user.every((byte, i) => byte === hashes.BELA[i]);
    userByHash.mockImplementation((user: Uint8Array) =>
      isBela(user)
        ? E.succeed({ name: 'Bela Kovac', original_action_hash: hashes.BELA })
        : E.fail(new Error('get_user: no answer'))
    );

    render(MessagesPage);

    expect(await screen.findByText('Bela Kovac')).toBeTruthy();
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
