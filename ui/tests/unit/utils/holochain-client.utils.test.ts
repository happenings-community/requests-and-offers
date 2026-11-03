import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// A stand-in for the client service: the slow part of a web-mode first load is
// the signing grant inside connectClient, which took 14 s for two cells on a
// fresh conductor. The service's own waitForConnection decides success or
// failure; connectToHolochain must report that outcome, not race it.
const fake = vi.hoisted(() => ({
  isConnected: false,
  client: null as unknown,
  connectClient: vi.fn(),
  waitForConnection: vi.fn()
}));

vi.mock('$lib/services/HolochainClientService.svelte', () => ({ default: fake }));

import { connectToHolochain, CONNECTION_DEADLINE_MS } from '$lib/utils/holochain-client.utils';

describe('connectToHolochain', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fake.isConnected = false;
    fake.client = null;
    fake.connectClient.mockReset();
    fake.waitForConnection.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const slowSuccess = (ms: number) => () =>
    new Promise<void>((resolve) =>
      setTimeout(() => {
        fake.isConnected = true;
        fake.client = {};
        resolve();
      }, ms)
    );

  it('reports success when the connection takes 14 s and then succeeds', async () => {
    fake.connectClient.mockImplementation(slowSuccess(14_000));
    fake.waitForConnection.mockImplementation(slowSuccess(14_000));

    const result = connectToHolochain();
    await vi.advanceTimersByTimeAsync(15_000);

    expect(await result).toBe(true);
  });

  it('reports failure when the connection fails', async () => {
    const refused = () => Promise.reject(new Error('connection refused'));
    fake.connectClient.mockImplementation(refused);
    fake.waitForConnection.mockImplementation(refused);

    const result = connectToHolochain();
    await vi.advanceTimersByTimeAsync(100);

    expect(await result).toBe(false);
  });

  it('gives up once the deadline has passed, so a hung conductor still ends in the error', async () => {
    const never = () => new Promise<void>(() => undefined);
    fake.connectClient.mockImplementation(never);
    fake.waitForConnection.mockImplementation(never);

    const result = connectToHolochain();
    await vi.advanceTimersByTimeAsync(CONNECTION_DEADLINE_MS + 1_000);

    expect(await result).toBe(false);
  });
});
