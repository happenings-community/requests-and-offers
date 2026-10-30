import { describe, it, expect } from 'vitest';
import { Schema } from 'effect';
import {
  InboxEntrySchema,
  MessageReadSchema,
  MessagingSignalSchema
} from '$lib/schemas/messaging.schemas';

/**
 * **The module evaluates, and reads what the zome sends.**
 *
 * Every import of these schemas was type-only until the store began decoding signals
 * with one, and the module threw "Unsupported schema or overlapping types" the first time
 * it was evaluated: `Schema.extend` does not take a `Schema.Class`. A module that only
 * ever had its types imported can be broken for a long time without anyone noticing.
 */

const hash = (n: number) => new Uint8Array(Array(39).fill(n));

describe('the messaging schemas', () => {
  it('read an inbox entry as the zome returns it', () => {
    const entry = Schema.decodeUnknownSync(InboxEntrySchema)({
      type: 'Read',
      hash: hash(1),
      from: hash(2),
      to: hash(3),
      at: 1_760_000_000_000_000,
      content: 'see you at ten',
      sendId: 'send-1',
      readUpTo: 1_759_999_000_000_000
    });
    expect(entry.type).toBe('Read');
    if (entry.type === 'Read') expect(entry.readUpTo).toBe(1_759_999_000_000_000);
  });

  it('read a message outcome', () => {
    expect(Schema.decodeUnknownSync(MessageReadSchema)({ type: 'Withheld' }).type).toBe('Withheld');
  });

  /** The wire name is `readUpTo`, which the zome now sends (F5). */
  it('read a receipt signal under the name the zome sends', () => {
    const signal = Schema.decodeUnknownSync(MessagingSignalSchema)({
      type: 'Receipt',
      readUpTo: 1_760_000_000_000_000,
      from: hash(2)
    });
    expect(signal.type).toBe('Receipt');
  });

  it('refuse a receipt whose mark is under another name', () => {
    expect(() =>
      Schema.decodeUnknownSync(MessagingSignalSchema)({
        type: 'Receipt',
        read_up_to: 1_760_000_000_000_000,
        from: hash(2)
      })
    ).toThrow();
  });
});
