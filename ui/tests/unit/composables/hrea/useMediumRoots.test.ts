import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Effect as E } from 'effect';

const mocks = vi.hoisted(() => ({ resolveToOriginal: vi.fn() }));
vi.mock('$lib/stores/mediums_of_exchange.store.svelte', () => ({
  default: { resolveToOriginal: mocks.resolveToOriginal }
}));

import { useMediumRoots } from '$lib/composables/domain/hrea/useMediumRoots.svelte';

describe('useMediumRoots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 9,9,2 is the approval revision of 9,9,1; 6,6,6 cannot be read.
    mocks.resolveToOriginal.mockImplementation((h: Uint8Array) =>
      h[2] === 6 ? E.fail(new Error('not found')) : E.succeed(new Uint8Array([h[0], h[1], 1]))
    );
  });

  it('maps each hash to its root, as the DHT answers it', async () => {
    const roots = useMediumRoots();
    await roots.track(['9,9,2', '9,9,1']);
    expect(roots.rootOf.get('9,9,2')).toBe('9,9,1');
    expect(roots.rootOf.get('9,9,1')).toBe('9,9,1');
    expect(mocks.resolveToOriginal.mock.calls[0][0]).toEqual(new Uint8Array([9, 9, 2]));
  });

  it('asks once per hash, however often it is tracked', async () => {
    const roots = useMediumRoots();
    await roots.track(['9,9,2']);
    await roots.track(['9,9,2', '9,9,2']);
    expect(mocks.resolveToOriginal).toHaveBeenCalledTimes(1);
  });

  it('asks again after a failed call, and skips a hash that is not bytes', async () => {
    const roots = useMediumRoots();
    await roots.track(['6,6,6', 'uhCkk-base64']);
    expect(roots.rootOf.has('6,6,6'), 'a failure is not remembered as a root').toBe(false);
    expect(roots.rootOf.has('uhCkk-base64')).toBe(false);
    expect(mocks.resolveToOriginal).toHaveBeenCalledTimes(1);
    await roots.track(['6,6,6']);
    expect(mocks.resolveToOriginal).toHaveBeenCalledTimes(2);
  });
});
