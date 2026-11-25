import { describe, it, expect } from 'vitest';
import { toZomePayload } from '$lib/utils/zome-payload';

/**
 * The plain-data form every zome payload takes before it leaves the page (#621).
 * The property that matters is the one Electron IPC enforces: `structuredClone` succeeds.
 */
describe('toZomePayload', () => {
  it('turns nested $state proxies into plain, cloneable data', () => {
    const form = $state({ timeframe: { kind: 'Days', days: [1, 2] }, tags: ['a', 'b'] });
    expect(() => structuredClone(form)).toThrow();

    const payload = toZomePayload({ request: form, extra: [form.timeframe] });

    expect(() => structuredClone(payload)).not.toThrow();
    expect(payload).toEqual({
      request: { timeframe: { kind: 'Days', days: [1, 2] }, tags: ['a', 'b'] },
      extra: [{ kind: 'Days', days: [1, 2] }]
    });
  });

  it('reaches a proxy held by a class instance, which a state snapshot would not', () => {
    class Input {
      constructor(readonly timeframe: unknown) {}
    }
    const chosen = $state({ kind: 'Ongoing' });

    const payload = toZomePayload(new Input(chosen));

    expect(() => structuredClone(payload)).not.toThrow();
    expect(payload).toEqual({ timeframe: { kind: 'Ongoing' } });
  });

  it('keeps hashes, dates and scalars as they are', () => {
    const hash = new Uint8Array([132, 41, 36]);
    const when = new Date(0);

    const payload = toZomePayload({ hash, when, n: 1, s: 'x', none: null, unset: undefined });

    expect(payload.hash).toBe(hash);
    expect(payload.when).toBe(when);
    expect(payload).toEqual({ hash, when, n: 1, s: 'x', none: null, unset: undefined });
    expect(toZomePayload(null)).toBeNull();
    expect(toZomePayload(hash)).toBe(hash);
  });
});
