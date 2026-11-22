import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { isInitWaitTimeout, retryOnceAfterInitWait } from '$lib/utils/init-wait';

// The message as the conductor returned it, dogfooding, 22 November 2026.
const initWait = new Error(
  'internal_error: Another zome function has triggered the `init()` callback, which has been blocking this zome call for longer than 30 seconds. Giving up.'
);

describe('isInitWaitTimeout', () => {
  it("recognises the conductor's init wait, as an Error or as text", () => {
    expect(isInitWaitTimeout(initWait)).toBe(true);
    expect(isInitWaitTimeout(`Failed to get network seed: ${initWait}`)).toBe(true);
  });

  it('does not take other failures for it', () => {
    expect(isInitWaitTimeout(new Error('Client not connected'))).toBe(false);
    expect(isInitWaitTimeout(new Error('init failed: Unreachable'))).toBe(false);
    expect(isInitWaitTimeout(undefined)).toBe(false);
  });
});

describe('retryOnceAfterInitWait', () => {
  it('returns the first answer without retrying', async () => {
    const call = vi.fn().mockResolvedValue('seed');
    const onRetry = vi.fn();
    await expect(retryOnceAfterInitWait(call, onRetry)).resolves.toBe('seed');
    expect(call).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  /** **To make this go red:** throw the init wait instead of calling again. */
  it('calls once more after an init wait, and says so first', async () => {
    const call = vi.fn().mockRejectedValueOnce(initWait).mockResolvedValueOnce('seed');
    const onRetry = vi.fn();
    await expect(retryOnceAfterInitWait(call, onRetry)).resolves.toBe('seed');
    expect(call).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('tries only once more', async () => {
    // A third call would succeed, so a retry that kept going resolves and fails here.
    const call = vi
      .fn()
      .mockRejectedValueOnce(initWait)
      .mockRejectedValueOnce(initWait)
      .mockResolvedValue('seed');
    await expect(retryOnceAfterInitWait(call)).rejects.toBe(initWait);
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('does not retry any other failure', async () => {
    const other = new Error('Client not connected');
    const call = vi.fn().mockRejectedValue(other);
    await expect(retryOnceAfterInitWait(call)).rejects.toBe(other);
    expect(call).toHaveBeenCalledTimes(1);
  });
});

/** Read from the source, as `startup-progress.test.ts` does: the suite does not mount the root layout. */
describe('the network step', () => {
  /** **To make this go red:** call `hc.getNetworkSeed()` directly again, or drop `stillStarting`. */
  it('retries its reads once after an init wait, saying it is still starting', () => {
    const layout = readFileSync('src/routes/+layout.svelte', 'utf8');
    const step = layout.slice(
      layout.indexOf('const verifyNetworkStep'),
      layout.indexOf('const loadUserDataStep')
    );
    expect(step).toMatch(
      /retryOnceAfterInitWait\(\s*\(\) => hc\.getNetworkSeed\(\),\s*stillStarting\s*\)/
    );
    expect(step).toMatch(
      /retryOnceAfterInitWait\(\s*\(\) => hc\.getNetworkInfo\(\),\s*stillStarting\s*\)/
    );
    expect(step).toMatch(
      /updateStep\('network', 'running', 'Still starting up, checking again\.\.\.'\)/
    );
  });
});
