// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

/**
 * The path a zome signal takes into the app: one listener on the client, fanned out by
 * zome name to whoever subscribed with `onZomeSignal`.
 *
 * Every other test that uses signals replaces `onZomeSignal`, so nudges and receipts
 * arriving through the real client were never seen at any layer. Here only the conductor
 * connection is stood in for: a client whose `on` keeps its listeners, so a signal can be
 * sent in as the conductor would send one.
 */

vi.mock('@holochain/client', async () => {
  const actual = await vi.importActual<typeof import('@holochain/client')>('@holochain/client');
  return {
    SignalType: actual.SignalType,
    AppWebsocket: { connect: vi.fn() },
    AdminWebsocket: { connect: vi.fn() }
  };
});

type Service = typeof import('../../../src/lib/services/HolochainClientService.svelte').default;

/** A client as far as signals go: `on('signal')` keeps the listener and hands back its removal. */
const fakeClient = () => {
  const listeners = new Set<(signal: unknown) => void>();
  return {
    appInfo: vi.fn(),
    callZome: vi.fn(),
    on: vi.fn((event: string, listener: (signal: unknown) => void) => {
      if (event === 'signal') listeners.add(listener);
      return () => listeners.delete(listener);
    }),
    /** Send a signal in, as the conductor would. */
    emit: (signal: unknown) => listeners.forEach((l) => l(signal)),
    listening: () => listeners.size
  };
};
const app = (zome_name: string, payload: unknown) => ({
  type: 'app',
  value: { cell_id: [new Uint8Array(39), new Uint8Array(39)], zome_name, payload }
});

let service: Service;
let connect: Mock;

beforeEach(async () => {
  vi.resetModules();
  const client = await import('@holochain/client');
  connect = client.AppWebsocket.connect as unknown as Mock;
  connect.mockReset();
  service = (await import('../../../src/lib/services/HolochainClientService.svelte')).default;
}, 60_000);

describe('zome signals reaching the app', () => {
  it("reaches only the subscribers of the signal's own zome", async () => {
    const client = fakeClient();
    connect.mockResolvedValue(client);
    await service.connectClient();
    const messaging = vi.fn();
    const exchanges = vi.fn();
    service.onZomeSignal('messaging', messaging);
    service.onZomeSignal('exchanges', exchanges);

    client.emit(app('messaging', { type: 'Nudge' }));

    expect(messaging).toHaveBeenCalledWith({ type: 'Nudge' });
    expect(exchanges).not.toHaveBeenCalled();
  });

  it('ignores a signal that is not an app signal', async () => {
    const client = fakeClient();
    connect.mockResolvedValue(client);
    await service.connectClient();
    const messaging = vi.fn();
    service.onZomeSignal('messaging', messaging);

    client.emit({ type: 'system', value: { SuccessfulCountersigning: new Uint8Array(39) } });

    expect(messaging).not.toHaveBeenCalled();
  });

  /**
   * A system signal shaped like an app one. Without the type check it would reach the
   * messaging subscribers; the test above passes either way, because a real system signal
   * has no zome name today.
   */
  it('ignores a system signal even when it carries a zome name', async () => {
    const client = fakeClient();
    connect.mockResolvedValue(client);
    await service.connectClient();
    const messaging = vi.fn();
    service.onZomeSignal('messaging', messaging);

    client.emit({ type: 'system', value: { zome_name: 'messaging', payload: { type: 'Nudge' } } });

    expect(messaging).not.toHaveBeenCalled();
  });

  it('delivers to a subscriber who came before the connection', async () => {
    const messaging = vi.fn();
    service.onZomeSignal('messaging', messaging);
    const client = fakeClient();
    connect.mockResolvedValue(client);
    await service.connectClient();

    client.emit(app('messaging', 1));

    expect(messaging).toHaveBeenCalledWith(1);
  });

  it('keeps delivering to the others when one subscriber throws', async () => {
    const client = fakeClient();
    connect.mockResolvedValue(client);
    await service.connectClient();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    service.onZomeSignal('messaging', () => {
      throw new Error('a bad handler');
    });
    const second = vi.fn();
    service.onZomeSignal('messaging', second);

    client.emit(app('messaging', 2));

    expect(second).toHaveBeenCalledWith(2);
    error.mockRestore();
  });

  it('stops delivering to a subscriber that unsubscribed', async () => {
    const client = fakeClient();
    connect.mockResolvedValue(client);
    await service.connectClient();
    const messaging = vi.fn();
    const stop = service.onZomeSignal('messaging', messaging);

    stop();
    client.emit(app('messaging', 3));

    expect(messaging).not.toHaveBeenCalled();
  });

  /** A dropped connection makes a new client; the subscribers must follow it there. */
  it('follows the subscribers to the new client after a reconnect, and leaves the old one', async () => {
    const first = fakeClient();
    const second = fakeClient();
    connect.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    await service.connectClient();
    const messaging = vi.fn();
    service.onZomeSignal('messaging', messaging);

    // A call that fails on the socket marks the connection lost, as a dropped one does.
    first.callZome.mockRejectedValue(new Error('WebSocket closed'));
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await service.callZome('messaging', 'get_sent', null).catch(() => {});
    await service.connectClient();
    quiet.mockRestore();
    warn.mockRestore();

    second.emit(app('messaging', 'after'));
    expect(messaging).toHaveBeenCalledWith('after');
    expect(first.listening(), 'one listener at a time, on the current client').toBe(0);
    expect(second.listening()).toBe(1);
  });
});
