import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { encodeHashToBase64 } from '@holochain/client';
import { eventLog } from '$lib/stores/event-log';
import { storeEventBus } from '$lib/stores/storeEvents';

/**
 * The dev-only event log: every event through the store event bus is recorded in order with a
 * sequence number, a timestamp and its origin, and exported as JSON with hashes as base64.
 * A production build records nothing and exposes no handle.
 */

const hash = (fill: number) => new Uint8Array(39).fill(fill);

beforeEach(() => {
  eventLog.clear();
  storeEventBus.clearAll();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('the event log records what the bus emits', () => {
  it('appends in order, with consecutive sequence numbers and local origin', () => {
    storeEventBus.emit('user:deleted', { userHash: hash(1) });
    storeEventBus.emit('request:deleted', { requestHash: hash(2) });
    storeEventBus.emit('offer:deleted', { offerHash: hash(3) });

    const entries = eventLog.entries();
    expect(entries.map((e) => e.event)).toEqual(['user:deleted', 'request:deleted', 'offer:deleted']);
    expect(entries.map((e) => e.seq)).toEqual([0, 1, 2]);
    expect(entries.every((e) => e.origin === 'local')).toBe(true);
    expect(entries[0].payload).toEqual({ userHash: hash(1) });
    expect(entries[2].at).toBeGreaterThanOrEqual(entries[0].at);
  });

  it('records an event before its handlers run, and a throwing handler does not lose it', () => {
    const seen: number[] = [];
    storeEventBus.on('user:deleted', () => seen.push(eventLog.entries().length));
    storeEventBus.on('user:deleted', () => {
      throw new Error('handler failure');
    });
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    storeEventBus.emit('user:deleted', { userHash: hash(1) });

    expect(seen).toEqual([1]);
    expect(eventLog.entries()).toHaveLength(1);
    error.mockRestore();
  });

  it('still delivers to handlers exactly as before', () => {
    const received: unknown[] = [];
    storeEventBus.on('user:deleted', (payload) => received.push(payload));
    const payload = { userHash: hash(7) };
    storeEventBus.emit('user:deleted', payload);
    expect(received).toEqual([payload]);
  });

  it('keeps the last 500 events and drops the oldest', () => {
    for (let i = 0; i < 505; i++) storeEventBus.emit('user:deleted', { userHash: hash(i % 255) });
    const entries = eventLog.entries();
    expect(entries).toHaveLength(500);
    expect(entries[0].seq).toBe(5);
    expect(entries[499].seq).toBe(504);
  });

  it('clear empties the log and restarts the sequence', () => {
    storeEventBus.emit('user:deleted', { userHash: hash(1) });
    eventLog.clear();
    expect(eventLog.entries()).toHaveLength(0);
    storeEventBus.emit('user:deleted', { userHash: hash(1) });
    expect(eventLog.entries()[0].seq).toBe(0);
  });
});

describe('the export', () => {
  it('is JSON in order, and renders hashes as base64 strings', () => {
    storeEventBus.emit('user:deleted', { userHash: hash(9) });
    storeEventBus.emit('request:deleted', { requestHash: hash(4) });

    const exported = JSON.parse(eventLog.export()) as Array<{
      seq: number;
      event: string;
      origin: string;
      payload: Record<string, unknown>;
    }>;

    expect(exported.map((e) => e.event)).toEqual(['user:deleted', 'request:deleted']);
    expect(exported.map((e) => e.seq)).toEqual([0, 1]);
    expect(exported[0].payload.userHash).toBe(encodeHashToBase64(hash(9)));
    expect(exported[1].payload.requestHash).toBe(encodeHashToBase64(hash(4)));
    expect(typeof exported[0].payload.userHash).toBe('string');
  });

  it('exports an empty log as an empty array', () => {
    expect(JSON.parse(eventLog.export())).toEqual([]);
  });
});

describe('a production build records nothing and exposes nothing', () => {
  it('records no entry when DEV is off', () => {
    vi.stubEnv('DEV', false);
    storeEventBus.emit('user:deleted', { userHash: hash(1) });
    expect(eventLog.entries()).toHaveLength(0);
  });

  it('exposes the log on window in a dev build', () => {
    expect((window as unknown as { __roEventLog?: unknown }).__roEventLog).toBe(eventLog);
  });

  it('mentions __roEventLog only inside the DEV guard, so the build can drop it', () => {
    const source = readFileSync('src/lib/stores/event-log.ts', 'utf8').replace(
      /\/\*[\s\S]*?\*\//g,
      ''
    );
    const lines = source.split('\n');
    const handle = lines.findIndex((line) => line.includes('__roEventLog'));
    expect(handle).toBeGreaterThan(-1);
    // The one assignment sits directly under `if (import.meta.env.DEV && ...)`.
    expect(lines[handle - 1]).toMatch(/if \(import\.meta\.env\.DEV && typeof window/);
    expect(lines.filter((line) => line.includes('__roEventLog'))).toHaveLength(1);
  });
});

describe('status events go through the log, not the console', () => {
  const user = { name: 'Ada' } as never;

  it('logs a status event with the source that emitted it', () => {
    storeEventBus.emit('user:status:updated', { user }, 'updateUserStatus');
    storeEventBus.emit('organization:status:updated', { organization: { name: 'Org' } as never });

    const [first, second] = eventLog.entries();
    expect(first.event).toBe('user:status:updated');
    expect(first.source).toBe('updateUserStatus');
    expect(second.event).toBe('organization:status:updated');
    expect(second.source).toBeUndefined();
  });

  it('carries the source into the export', () => {
    storeEventBus.emit('user:status:updated', { user }, 'updateUserStatus');
    const [entry] = JSON.parse(eventLog.export()) as Array<{ source?: string }>;
    expect(entry.source).toBe('updateUserStatus');
  });

  it('prints nothing to the console, which the old emitStatusUpdate did', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    storeEventBus.emit('user:status:updated', { user }, 'updateUserStatus');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('no longer has emitStatusUpdate', () => {
    expect('emitStatusUpdate' in storeEventBus).toBe(false);
  });
});
