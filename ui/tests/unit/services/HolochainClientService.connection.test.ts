// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { HOLOCHAIN_CLIENT_CONTEXTS } from '../../../src/lib/errors/error-contexts';

vi.mock('@holochain/client', () => ({
  AppWebsocket: { connect: vi.fn() },
  AdminWebsocket: { connect: vi.fn() }
}));

type Service = typeof import('../../../src/lib/services/HolochainClientService.svelte').default;

// Resolves to the rejection reason, or the string 'resolved' if the promise
// settled successfully, so a test can await either outcome without try/catch.
const outcomeOf = (p: Promise<unknown>): Promise<unknown> =>
  p.then(
    () => 'resolved',
    (e: unknown) => e
  );

// vi.resetModules gives the service its own copy of the error class, so
// instanceof cannot be used across that boundary; the tag survives it.
const isClientError = (error: unknown): error is { _tag: string; context?: string } =>
  typeof error === 'object' &&
  error !== null &&
  '_tag' in error &&
  (error as { _tag: unknown })._tag === 'HolochainClientError';

const contextOf = (error: unknown): string | undefined =>
  isClientError(error) ? error.context : undefined;

describe('waitForConnection', () => {
  let service: Service;
  let connect: Mock;

  // Fake timers go in AFTER the dynamic imports: Vite's on-demand transform
  // awaits real timers, so installing them first deadlocks the import and the
  // hook times out at 10s. Neither module starts a timer at load, so the
  // service's own timers are still entirely under fake control.
  beforeEach(async () => {
    vi.resetModules();
    const client = await import('@holochain/client');
    connect = client.AppWebsocket.connect as unknown as Mock;
    connect.mockReset();
    service = (await import('../../../src/lib/services/HolochainClientService.svelte')).default;
    vi.useFakeTimers();
  }, 60_000);

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects with CONNECTION_TIMEOUT when the attempt never settles', async () => {
    connect.mockReturnValue(new Promise(() => undefined));

    const outcome = outcomeOf(service.waitForConnection(1_000));
    await vi.advanceTimersByTimeAsync(1_100);

    const error = await outcome;
    expect(isClientError(error)).toBe(true);
    expect(contextOf(error)).toBe(HOLOCHAIN_CLIENT_CONTEXTS.CONNECTION_TIMEOUT);
  });

  it('rejects with CONNECTION_FAILED when every attempt fails', async () => {
    connect.mockRejectedValue(new Error('connection refused'));

    const outcome = outcomeOf(service.waitForConnection(120_000));
    await vi.runAllTimersAsync();

    const error = await outcome;
    expect(isClientError(error)).toBe(true);
    expect(contextOf(error)).toBe(HOLOCHAIN_CLIENT_CONTEXTS.CONNECTION_FAILED);
  });

  it('rejects with CONNECTION_FAILED when the attempt it was waiting on fails', async () => {
    connect.mockRejectedValue(new Error('connection refused'));

    const first = outcomeOf(service.waitForConnection(120_000));
    const second = outcomeOf(service.waitForConnection(120_000));
    await vi.runAllTimersAsync();

    expect(contextOf(await first)).toBe(HOLOCHAIN_CLIENT_CONTEXTS.CONNECTION_FAILED);
    expect(contextOf(await second)).toBe(HOLOCHAIN_CLIENT_CONTEXTS.CONNECTION_FAILED);
  });

  it('resolves when the attempt succeeds', async () => {
    connect.mockResolvedValue({ appInfo: vi.fn() });

    const outcome = outcomeOf(service.waitForConnection(1_000));
    await vi.runAllTimersAsync();

    expect(await outcome).toBe('resolved');
  });
});

// U19: in web mode a reload after any in-app navigation has no hcPort/hcToken
// in its URL. The service must connect from what the tab stored on its first
// load, not fall back to the standalone branch.
describe('connectClient with dev launcher params', () => {
  let service: Service;
  let appConnect: Mock;
  let adminConnect: Mock;

  const cell = (n: number) => [new Uint8Array([n]), new Uint8Array([n, n])];
  const appInfo = {
    cell_info: {
      requests_and_offers: [{ type: 'provisioned', value: { cell_id: cell(1) } }],
      hrea: [{ type: 'provisioned', value: { cell_id: cell(2) } }]
    }
  };

  beforeEach(async () => {
    vi.resetModules();
    sessionStorage.clear();
    const client = await import('@holochain/client');
    appConnect = client.AppWebsocket.connect as unknown as Mock;
    adminConnect = client.AdminWebsocket.connect as unknown as Mock;
    appConnect.mockReset();
    adminConnect.mockReset();
    appConnect.mockResolvedValue({ appInfo: vi.fn().mockResolvedValue(appInfo) });
    service = (await import('../../../src/lib/services/HolochainClientService.svelte')).default;
  }, 60_000);

  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  const adminWith = (cellIds: unknown[]) => {
    const authorizeSigningCredentials = vi.fn().mockResolvedValue(undefined);
    adminConnect.mockResolvedValue({
      listCellIds: vi.fn().mockResolvedValue(cellIds),
      authorizeSigningCredentials,
      client: { close: vi.fn().mockResolvedValue(undefined) }
    });
    return authorizeSigningCredentials;
  };

  it('connects from the URL params on the first load', async () => {
    adminWith([cell(1), cell(2)]);
    window.history.replaceState({}, '', '/?hcPort=35689&hcToken=AQID&hcAdminPort=56101');

    await service.connectClient();

    expect(appConnect).toHaveBeenCalledWith({
      url: new URL('ws://localhost:35689'),
      token: [1, 2, 3]
    });
  });

  it('reconnects from the stored params on a reload with no params in the URL', async () => {
    adminWith([cell(1), cell(2)]);
    window.history.replaceState({}, '', '/?hcPort=35689&hcToken=AQID&hcAdminPort=56101');
    await service.connectClient();

    vi.resetModules();
    service = (await import('../../../src/lib/services/HolochainClientService.svelte')).default;
    appConnect.mockClear();
    window.history.replaceState({}, '', '/offers');

    await service.connectClient();

    expect(appConnect).toHaveBeenCalledWith({
      url: new URL('ws://localhost:35689'),
      token: [1, 2, 3]
    });
  });

  it('keeps the standalone branch when the tab has neither URL nor stored params', async () => {
    window.history.replaceState({}, '', '/offers');

    await service.connectClient();

    expect(appConnect).toHaveBeenCalledWith();
  });

  it("authorizes signing only for this app's cells, not other members' cells on the conductor", async () => {
    const otherMember = cell(9);
    const authorize = adminWith([cell(1), cell(2), otherMember]);
    window.history.replaceState({}, '', '/?hcPort=35689&hcToken=AQID&hcAdminPort=56101');

    await service.connectClient();

    expect(authorize.mock.calls.map(([id]) => id)).toEqual([cell(1), cell(2)]);
  });
});
