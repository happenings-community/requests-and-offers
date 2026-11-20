import { encodeHashToBase64 } from '@holochain/client';
import type { StoreEvents } from './storeEvents';

/**
 * A dev-only record of every event that passes through the store event bus.
 *
 * Ordering bugs across agents are the interesting ones, and `console.log` archaeology cannot
 * be exported. The log keeps the last {@link CAPACITY} events with a sequence number, a local
 * timestamp and where the change came from, and exports them as JSON with hashes rendered as
 * base64, so a failing session can be attached to a bug report.
 *
 * It records only in a dev build. `import.meta.env.DEV` is replaced by a literal at build time,
 * so a production build drops both the recording and the `window` handle below.
 */

/** Where a change came from: this agent's own action, or the network. Only `local` exists yet. */
export type EventOrigin = 'local' | 'signal';

export type LogEntry = {
  readonly seq: number;
  readonly at: number;
  readonly event: keyof StoreEvents;
  readonly payload: unknown;
  readonly origin: EventOrigin;
};

const CAPACITY = 500;

/** Hashes are `Uint8Array`s, which `JSON.stringify` turns into a useless object. */
function replacer(_key: string, value: unknown): unknown {
  if (value instanceof Uint8Array) return encodeHashToBase64(value);
  if (typeof value === 'bigint') return value.toString();
  return value;
}

class EventLog {
  private buffer: LogEntry[] = [];
  private seq = 0;

  record(event: keyof StoreEvents, payload: unknown, origin: EventOrigin = 'local'): void {
    if (!import.meta.env.DEV) return;
    this.buffer.push({ seq: this.seq++, at: Date.now(), event, payload, origin });
    if (this.buffer.length > CAPACITY) this.buffer.shift();
  }

  entries(): readonly LogEntry[] {
    return this.buffer;
  }

  clear(): void {
    this.buffer = [];
    this.seq = 0;
  }

  /** The whole buffer as JSON, hashes as base64. */
  export(): string {
    return JSON.stringify(this.buffer, replacer, 2);
  }
}

export const eventLog = new EventLog();

/** Exposed for the browser console, where the log is used: `__roEventLog.export()`. */
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __roEventLog?: EventLog }).__roEventLog = eventLog;
}
