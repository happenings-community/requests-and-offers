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

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const client = await import('@holochain/client');
    connect = client.AppWebsocket.connect as unknown as Mock;
    connect.mockReset();
    service = (await import('../../../src/lib/services/HolochainClientService.svelte')).default;
  });

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
