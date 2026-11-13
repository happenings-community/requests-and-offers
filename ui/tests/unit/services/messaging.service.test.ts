import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Effect as E, Layer } from 'effect';
import {
  MessagingServiceLive,
  MessagingServiceTag,
  type MessagingService
} from '$lib/services/zomes/messaging.service';
import { HolochainClientServiceTag } from '$lib/services/HolochainClientService.svelte';

/**
 * The wire contract with the `messaging` zome: each method calls the extern it says it
 * does, with the payload the zome reads. Every other messaging test stands the service
 * in whole, so without this a renamed function or field would pass the suite.
 */

const hash = (n: number) => new Uint8Array(Array(39).fill(n));
const callZome = vi.fn();

const client = {
  appId: 'test-app',
  client: null,
  isConnected: true,
  isConnecting: false,
  waitForConnection: vi.fn(() => Promise.resolve()),
  callZome: (...args: unknown[]) => callZome(...args),
  onZomeSignal: vi.fn(() => () => {})
};

const run = <A>(use: (service: MessagingService) => E.Effect<A, unknown>): Promise<A> =>
  E.runPromise(
    E.gen(function* () {
      const service = yield* MessagingServiceTag;
      return yield* use(service);
    }).pipe(
      E.provide(MessagingServiceLive),
      E.provide(Layer.succeed(HolochainClientServiceTag, client as never))
    )
  );

/** The zome, the function and the payload of the one call made. */
const theCall = () => {
  expect(callZome).toHaveBeenCalledTimes(1);
  const [zome, fn, payload] = callZome.mock.calls[0];
  return { zome, fn, payload };
};

beforeEach(() => {
  callZome.mockReset();
  callZome.mockResolvedValue(null);
});

describe('the messaging service calls the zome as the zome is written', () => {
  it('send_message takes the input as given', async () => {
    const input = { toUser: hash(1), content: 'hello', sendId: 'send-1' };
    callZome.mockResolvedValue([]);
    await run((s) => s.sendMessage(input as never));
    expect(theCall()).toEqual({ zome: 'messaging', fn: 'send_message', payload: input });
  });

  it('get_inbox_delta sends what is held and what was skipped, under those names', async () => {
    const delta = { visible: [hash(1)], entries: [], skipped: [hash(2)] };
    callZome.mockResolvedValue(delta);
    const result = await run((s) => s.getInboxDelta([hash(1)], [hash(2)]));
    expect(theCall()).toEqual({
      zome: 'messaging',
      fn: 'get_inbox_delta',
      payload: { known: [hash(1)], skipped: [hash(2)] }
    });
    expect(result, 'handed back as the zome gave it').toEqual(delta);
  });

  it('find_sent takes the send id and the time to look from', async () => {
    const input = { sendId: 'send-1', since: 1_760_000_000_000_000 };
    await run((s) => s.findSent(input as never));
    expect(theCall()).toEqual({ zome: 'messaging', fn: 'find_sent', payload: input });
  });

  it('send_receipt takes the person and the mark', async () => {
    const input = { toUser: hash(1), readUpTo: 1_760_000_000_000_000 };
    await run((s) => s.sendReceipt(input as never));
    expect(theCall()).toEqual({ zome: 'messaging', fn: 'send_receipt', payload: input });
  });

  it('the reads that take nothing send null', async () => {
    callZome.mockResolvedValue([]);
    await run((s) => s.getInbox());
    expect(theCall()).toEqual({ zome: 'messaging', fn: 'get_inbox', payload: null });

    callZome.mockClear();
    await run((s) => s.getSent());
    expect(theCall()).toEqual({ zome: 'messaging', fn: 'get_sent', payload: null });

    callZome.mockClear();
    await run((s) => s.getMyRoleCorrespondence());
    expect(theCall()).toEqual({
      zome: 'messaging',
      fn: 'get_my_role_correspondence',
      payload: null
    });
  });

  it('get_message takes the hash bare, and get_role_inbox the role bare', async () => {
    await run((s) => s.getMessage(hash(3)));
    expect(theCall()).toEqual({ zome: 'messaging', fn: 'get_message', payload: hash(3) });

    callZome.mockClear();
    callZome.mockResolvedValue([]);
    await run((s) => s.getRoleInbox('Admin' as never));
    expect(theCall()).toEqual({ zome: 'messaging', fn: 'get_role_inbox', payload: 'Admin' });
  });

  it('a failed call becomes a MessagingError that keeps what was thrown as its cause', async () => {
    const thrown = { name: 'ribosome_error', message: 'Only an accepted member can send' };
    callZome.mockRejectedValue(thrown);
    const error = await run((s) => E.flip(s.sendMessage({ toUser: hash(1) } as never)));
    expect(error).toMatchObject({ _tag: 'MessagingError', cause: thrown });
  });
});
