/**
 * Unit tests for messaging-local — the rules for a member's local state.
 *
 * These exist because the failure they guard against is silent and expensive: an older
 * build meeting a newer stored shape, and destroying unsent messages while doing it.
 */

import { describe, it, expect } from 'vitest';
import {
  EMPTY_LOCAL,
  LOCAL_SCHEMA_VERSION,
  localKey,
  readLocal,
  writeLocal,
  type LocalStore,
  type OutboxItem
} from '$lib/utils/messaging-local';

/** A `localStorage` stand-in, so the rules can be tested without a browser. */
function fakeStore(initial: Record<string, string> = {}) {
  const data = { ...initial };
  const store: LocalStore & { data: Record<string, string> } = {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    }
  };
  return store;
}

const KEY = localKey('uhCAkTEST');

const item = (over: Partial<OutboxItem> = {}): OutboxItem => ({
  id: 'a1',
  to: 'uhCkkANITA',
  content: 'not sent yet',
  queuedAt: 1,
  state: 'waiting',
  ...over
});

describe('readLocal', () => {
  it('reads what this version wrote', () => {
    const store = fakeStore();
    writeLocal(store, KEY, { archived: ['x'], outbox: [item()] });
    const read = readLocal(store, KEY);
    expect(read.schemaVersion).toBe(LOCAL_SCHEMA_VERSION);
    expect(read.archived).toEqual(['x']);
    expect(read.outbox).toHaveLength(1);
  });

  it('is empty when there is nothing, and when there is nonsense', () => {
    expect(readLocal(fakeStore(), KEY)).toEqual(EMPTY_LOCAL);
    expect(readLocal(fakeStore({ [KEY]: 'not json' }), KEY)).toEqual(EMPTY_LOCAL);
    expect(readLocal(undefined, KEY)).toEqual(EMPTY_LOCAL);
  });

  it('reads a version it does not know as empty, rather than guessing its shape', () => {
    const store = fakeStore({
      [KEY]: JSON.stringify({ schemaVersion: 99, archived: ['x'], outbox: [item()] })
    });
    expect(readLocal(store, KEY)).toEqual(EMPTY_LOCAL);
  });
});

describe('writeLocal', () => {
  /**
   * **The one that matters** (Sam, 4 October).
   *
   * Reading an unknown version as empty is right; *writing over* it is not. A newer
   * build's outbox holds messages the member typed and has not sent, and overwriting it
   * loses them silently with no way back. Older code meeting newer data must degrade,
   * never delete.
   *
   * **To make this go red:** drop the version guard in `writeLocal` so it merges over
   * whatever is there. The stored outbox below is replaced by an empty one and the
   * unsent message is gone.
   */
  it('leaves a version it does not know completely untouched', () => {
    const theirs = JSON.stringify({
      schemaVersion: 99,
      archived: ['theirs'],
      outbox: [item({ id: 'unsent', content: 'typed, never sent' })]
    });
    const store = fakeStore({ [KEY]: theirs });

    const wrote = writeLocal(store, KEY, { archived: ['mine'] });

    expect(wrote, 'the write should report that it did not happen').toBe(false);
    expect(store.data[KEY], 'the stored value should be byte-identical').toBe(theirs);
  });

  it('merges a patch without disturbing the other fields', () => {
    const store = fakeStore();
    writeLocal(store, KEY, { archived: ['a'], outbox: [item()] });
    writeLocal(store, KEY, { archived: ['a', 'b'] });

    const read = readLocal(store, KEY);
    expect(read.archived).toEqual(['a', 'b']);
    expect(read.outbox, 'the outbox should survive an archive write').toHaveLength(1);
  });

  it('writes over a value with no version at all, which no build of ours wrote', () => {
    const store = fakeStore({ [KEY]: JSON.stringify({ archived: ['legacy'] }) });
    expect(writeLocal(store, KEY, { archived: ['mine'] })).toBe(true);
    expect(readLocal(store, KEY).archived).toEqual(['mine']);
  });

  it('reports failure rather than throwing when the store refuses', () => {
    const refusing: LocalStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded');
      }
    };
    expect(() => writeLocal(refusing, KEY, { archived: ['x'] })).not.toThrow();
    expect(writeLocal(refusing, KEY, { archived: ['x'] })).toBe(false);
  });
});
