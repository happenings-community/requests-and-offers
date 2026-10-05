/**
 * Unit tests for messaging-threads — the rules that decide what the Messages list and a
 * conversation show.
 *
 * These are the brief's part 1 predictions, written before the code, proven here as
 * tables. They are pure functions for the same reason the zome's validation rules are:
 * each is a decision that fails silently if it is wrong. A thread keyed the wrong way
 * splits one person into a row per device, and nothing throws.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { MESSAGING_STRINGS as S, fill } from '$lib/strings/messaging.strings';
import type { ActionHash, AgentPubKey } from '@holochain/client';
import type { AgreementInDHT, ExchangeStatus, ExchangeTerm } from '$lib/types/holochain';
import type { UIExchange, UIInterest } from '$lib/types/ui';
import type { Message } from '$lib/schemas/messaging.schemas';
import {
  applyBlocks,
  buildThreads,
  clampReceipt,
  buildTimeline,
  bytesLeft,
  classifySendFailure,
  contentBytes,
  guestReason,
  isDevicesNotFound,
  isPersonal,
  isTooLong,
  messagesNeeded,
  percentOver,
  percentUsed,
  receiptsEnabledFor,
  unarchivedByNewMessages,
  matchesFilter,
  proposableFrom,
  showsAsAgreement,
  threadKeyOf,
  unopenedConversations,
  type ThreadFilter,
  type UIThread
} from '$lib/utils/messaging-threads';

const hash = (n: number): ActionHash => new Uint8Array([132, 41, 36, n]) as unknown as ActionHash;
const agent = (n: number): AgentPubKey =>
  new Uint8Array([132, 32, 36, n]) as unknown as AgentPubKey;

const ME = hash(1);
const ANITA = hash(2);
const MARCO = hash(3);

/** Anita runs two devices. This is the whole point of keying by `User`. */
const ANITA_PHONE = agent(20);
const ANITA_LAPTOP = agent(21);
const MARCO_AGENT = agent(30);
const MY_AGENT = agent(10);

const AGENT_TO_USER: Record<string, ActionHash> = {
  [String(ANITA_PHONE)]: ANITA,
  [String(ANITA_LAPTOP)]: ANITA,
  [String(MARCO_AGENT)]: MARCO,
  [String(MY_AGENT)]: ME
};
const agentToUser = (a: AgentPubKey) => AGENT_TO_USER[String(a)];

/**
 * Microseconds, as the zome gives them.
 *
 * `Timestamp` is a branded number in the schemas, so the cast is here, once, rather than
 * at every fixture. Branding is what stops a millisecond value being passed where the
 * wire format is microseconds, which is exactly the confusion the timeline test caught.
 */
const micros = (seconds: number) =>
  (seconds * 1_000_000) as unknown as Message['at'];

const message = (over: Partial<Message> & { at: number }): Message =>
  ({
    hash: hash(99),
    from: ANITA_PHONE,
    to: MY_AGENT,
    content: 'hello',
    // Empty unless a case sets one: that is the fallback path, and most cases want it.
    sendId: '',
    ...over
  }) as Message;

const term = (over: Partial<ExchangeTerm> = {}): ExchangeTerm => ({
  direction: 'Provide',
  resource_conforms_to: 'Web design',
  resource_kind: 'Service',
  quantity: { value: 3, unit: 'hours' },
  ...over
});

const exchange = (over: {
  counterparty: ActionHash;
  provider?: ActionHash;
  receiver?: ActionHash;
  listing_type?: 'Request' | 'Offer';
  created_at?: number;
  status?: ExchangeStatus;
}): UIExchange => ({
  agreement_hash: hash(50),
  created_at: over.created_at ?? 100,
  status: over.status ?? 'Agreed',
  agreement: {
    listing: hash(40),
    listing_type: over.listing_type ?? 'Offer',
    interest: hash(41),
    counterparty: over.counterparty,
    provider: over.provider ?? ME,
    receiver: over.receiver ?? over.counterparty,
    primary: term(),
    reciprocal: term({ direction: 'Receive' }),
    medium: 'Gift',
    terms: '',
    delivery_timeframe: ''
  } as AgreementInDHT
});

const interest = (over: {
  listing_type?: 'Request' | 'Offer';
  created_at?: number;
  user?: ActionHash;
}): UIInterest =>
  ({
    listing: hash(60),
    listing_type: over.listing_type ?? 'Offer',
    user: over.user ?? ME,
    interest_hash: hash(61),
    created_at: over.created_at ?? 50
  }) as UIInterest;

const build = (over: Partial<Parameters<typeof buildThreads>[0]> = {}) =>
  buildThreads({
    me: ME,
    inbox: [],
    sent: [],
    exchanges: [],
    interests: [],
    agentToUser,
    readUpTo: {},
    archivedKeys: new Set(),
    ...over
  });

describe('buildThreads', () => {
  /**
   * Prediction 1, and the break-it-on-purpose that goes with it.
   *
   * **To make this go red:** in `buildThreads`, key the thread by the message's agent
   * instead of by the `User` it resolves to — that is, replace `input.agentToUser(...)`
   * with a cast of the agent key. Anita then becomes two rows, one per device, and the
   * first assertion below fails with 3 instead of 2.
   */
  it('gives one row per person, not one per device', () => {
    const threads = build({
      inbox: [
        message({ at: micros(10), from: ANITA_PHONE }),
        message({ at: micros(20), from: ANITA_LAPTOP, hash: hash(98), content: 'from my laptop' }),
        message({ at: micros(30), from: MARCO_AGENT, hash: hash(97), content: 'hi' })
      ]
    });

    expect(threads).toHaveLength(2);
    const anita = threads.find((t) => t.key === threadKeyOf(ANITA));
    expect(anita?.messages).toHaveLength(2);
    expect(threads.map((t) => t.key)).toContain(threadKeyOf(MARCO));
  });

  it('sorts the newest conversation first', () => {
    const threads = build({
      inbox: [
        message({ at: micros(10), from: ANITA_PHONE }),
        message({ at: micros(99), from: MARCO_AGENT, hash: hash(97) })
      ]
    });
    expect(threads[0].key).toBe(threadKeyOf(MARCO));
  });

  /** A conversation can exist before a word is written. */
  it('opens a thread for an interest with no messages', () => {
    const threads = build({
      interests: [{ interest: interest({}), counterparty: ANITA }]
    });
    expect(threads).toHaveLength(1);
    expect(threads[0].messages).toHaveLength(0);
    expect(threads[0].interests).toHaveLength(1);
  });

  it('counts only their unread messages, against this thread marker', () => {
    // Milliseconds now, and local: read state left the chain in brief E.
    const markers = { [threadKeyOf(ANITA)]: 15_000 };
    const threads = build({
      inbox: [
        message({ at: micros(10), from: ANITA_PHONE }),
        message({ at: micros(20), from: ANITA_PHONE, hash: hash(98) }),
        message({ at: micros(30), from: ANITA_LAPTOP, hash: hash(96) })
      ],
      sent: [message({ at: micros(40), from: MY_AGENT, to: ANITA_PHONE, hash: hash(95) })],
      readUpTo: markers
    });
    // Two of theirs after the marker; my own never counts.
    expect(threads[0].unread).toBe(2);
  });

  /**
   * One logical message to a two-device member is two entries on my chain. Showing both
   * would double every line of my own side of the conversation.
   */
  /**
   * **Prediction 8**, and the heart of decision 2. One send becomes an entry per
   * recipient agent, and a retry after a lost answer can add another; the send id is
   * what matches them.
   *
   * **The earliest wins, deliberately.** Keeping the latest would let a sender reuse an
   * id to replace something they had already said, so the first thing said under an id
   * is what stands.
   *
   * **To make this go red:** keep the latest instead of the earliest, or drop the send
   * id from the key. The content assertion flips, or the count does.
   */
  it('collapses copies by send id, keeping the earliest', () => {
    const threads = build({
      inbox: [
        message({
          at: micros(40),
          from: ANITA_PHONE,
          hash: hash(95),
          content: 'what I actually said',
          sendId: 'anita-1'
        } as Partial<Message> & { at: number }),
        // A retry a minute later, under the same id, saying something else.
        message({
          at: micros(100),
          from: ANITA_PHONE,
          hash: hash(94),
          content: 'a replacement nobody should see',
          sendId: 'anita-1'
        } as Partial<Message> & { at: number })
      ]
    });

    expect(threads[0].messages, 'one logical message').toHaveLength(1);
    expect(threads[0].messages[0].content).toBe('what I actually said');
  });

  it('keeps two different people apart even when they pick the same send id', () => {
    const threads = build({
      inbox: [
        message({ at: micros(10), from: ANITA_PHONE, sendId: 'same' } as Partial<Message> & {
          at: number;
        }),
        message({
          at: micros(20),
          from: MARCO_AGENT,
          hash: hash(97),
          sendId: 'same'
        } as Partial<Message> & { at: number })
      ]
    });
    expect(threads, 'two people, two conversations').toHaveLength(2);
    expect(threads.every((t) => t.messages.length === 1)).toBe(true);
  });

  it('collapses the per-agent copies of one sent message', () => {
    const threads = build({
      sent: [
        message({ at: micros(40), from: MY_AGENT, to: ANITA_PHONE, hash: hash(95), content: 'ok' }),
        message({
          // Two milliseconds later: the second copy of the same send, as the zome writes
          // them one after another.
          at: (micros(40) + 2000) as unknown as Message['at'],
          from: MY_AGENT,
          to: ANITA_LAPTOP,
          hash: hash(94),
          content: 'ok'
        })
      ]
    });
    expect(threads[0].messages).toHaveLength(1);
    expect(threads[0].messages[0].mine).toBe(true);
  });

  /**
   * Prediction 6, the half this layer owns. `get_inbox` already drops role messages, but
   * `get_sent` does not and should not, so Messages has to drop them itself.
   */
  it('keeps role messages out of Messages, from either source', () => {
    const roleMessage = message({
      at: micros(10),
      from: ANITA_PHONE,
      role: { type: 'admin' }
    } as Partial<Message> & { at: number });

    expect(isPersonal(roleMessage)).toBe(false);
    expect(build({ inbox: [roleMessage] })).toHaveLength(0);
    expect(
      build({
        sent: [{ ...roleMessage, from: MY_AGENT, to: ANITA_PHONE } as Message]
      })
    ).toHaveLength(0);
  });

  /**
   * Archiving means "I am done with this for now", not "never show me this person". A
   * message arriving into a folder nobody opens is the failure this prevents.
   *
   * **To make this go red:** remove the `thread.archived && thread.unread > 0` block in
   * `buildThreads`. The conversation stays archived and the new message is invisible.
   */
  it('brings an archived conversation back when a new message arrives, still unopened', () => {
    const archivedKeys = new Set([threadKeyOf(ANITA)]);
    const threads = build({
      inbox: [message({ at: micros(30), from: ANITA_PHONE })],
      readUpTo: { [threadKeyOf(ANITA)]: 10_000 },
      archivedKeys
    });

    expect(threads[0].archived).toBe(false);
    expect(threads[0].unread).toBe(1);
    expect(matchesFilter(threads[0], 'all')).toBe(true);
    expect(matchesFilter(threads[0], 'unopened')).toBe(true);
    // And the caller is told, so it can stop archiving it on the next load.
    expect(unarchivedByNewMessages(threads, archivedKeys)).toEqual([threadKeyOf(ANITA)]);
  });

  it('leaves an archived conversation archived when nothing is unread', () => {
    const archivedKeys = new Set([threadKeyOf(ANITA)]);
    const threads = build({
      inbox: [message({ at: micros(5), from: ANITA_PHONE })],
      readUpTo: { [threadKeyOf(ANITA)]: 10_000 },
      archivedKeys
    });
    expect(threads[0].archived).toBe(true);
    expect(unarchivedByNewMessages(threads, archivedKeys)).toEqual([]);
  });

  it('drops a message whose agent resolves to nobody rather than inventing a thread', () => {
    const threads = build({ inbox: [message({ at: micros(10), from: agent(77) })] });
    expect(threads).toHaveLength(0);
  });
});

describe('matchesFilter', () => {
  const threadWith = (over: Partial<UIThread>): UIThread => ({
    counterparty: ANITA,
    key: threadKeyOf(ANITA),
    messages: [],
    interests: [],
    exchanges: [],
    lastAt: 0,
    unread: 0,
    archived: false,
    ...over
  });

  it('reads Offers and Requests from the cards, not the messages', () => {
    const offer = threadWith({ interests: [interest({ listing_type: 'Offer' })] });
    const request = threadWith({ interests: [interest({ listing_type: 'Request' })] });

    expect(matchesFilter(offer, 'offers')).toBe(true);
    expect(matchesFilter(offer, 'requests')).toBe(false);
    expect(matchesFilter(request, 'requests')).toBe(true);
    expect(matchesFilter(request, 'offers')).toBe(false);
  });

  it('counts an exchange of that type too', () => {
    const thread = threadWith({ exchanges: [exchange({ counterparty: ANITA, listing_type: 'Request' })] });
    expect(matchesFilter(thread, 'requests')).toBe(true);
    expect(matchesFilter(thread, 'exchanges')).toBe(true);
  });

  it('shows Unopened only when something is unread', () => {
    expect(matchesFilter(threadWith({ unread: 1 }), 'unopened')).toBe(true);
    expect(matchesFilter(threadWith({ unread: 0 }), 'unopened')).toBe(false);
  });

  /** Archived is a view: a conversation is never in two places at once. */
  it('hides archived from every filter but Archived', () => {
    const archived = threadWith({
      archived: true,
      unread: 1,
      interests: [interest({ listing_type: 'Offer' })]
    });
    const filters: ThreadFilter[] = ['all', 'unopened', 'offers', 'requests', 'exchanges'];
    for (const filter of filters) {
      expect(matchesFilter(archived, filter), `archived should be hidden from ${filter}`).toBe(
        false
      );
    }
    expect(matchesFilter(archived, 'archived')).toBe(true);
  });
});

describe('buildTimeline', () => {
  /** Prediction 2: a proposal sits where it happened, between the messages around it. */
  it('interleaves cards and messages by time', () => {
    const thread: UIThread = {
      counterparty: ANITA,
      key: threadKeyOf(ANITA),
      messages: [
        { ...message({ at: micros(20) }), mine: false },
        { ...message({ at: micros(60), hash: hash(98) }), mine: true }
      ],
      // `created_at` on a card is already milliseconds, from the store's `timed` helper;
      // a message's `at` is microseconds from the zome. `buildTimeline` converts the
      // message and leaves the card alone, so the fixtures here are in milliseconds.
      interests: [interest({ created_at: 10_000 })],
      exchanges: [exchange({ counterparty: ANITA, created_at: 40_000 })],
      lastAt: 60_000,
      unread: 0,
      archived: false
    };

    expect(buildTimeline(thread).map((i) => [i.kind, i.at])).toEqual([
      ['interest', 10_000],
      ['message', 20_000],
      ['exchange', 40_000],
      ['message', 60_000]
    ]);
  });

  it('puts the opening interest before a message sent in the same instant', () => {
    const thread: UIThread = {
      counterparty: ANITA,
      key: threadKeyOf(ANITA),
      messages: [{ ...message({ at: micros(10) }), mine: false }],
      interests: [interest({ created_at: 10_000 })],
      exchanges: [],
      lastAt: 10_000, // the message's micros(10) is also 10_000 ms: a deliberate tie

      unread: 0,
      archived: false
    };
    expect(buildTimeline(thread).map((i) => i.kind)).toEqual(['interest', 'message']);
  });
});

describe('isDevicesNotFound', () => {
  /**
   * Read the zome's own literal out of its source, rather than retyping it here.
   *
   * **A retyped copy is worse than no test.** It makes this suite and the Rust suite both
   * pass while the real match fails, which is exactly what happened: a `\` continuation
   * in the Rust string collapsed into four spaces mid-sentence, and a hand-typed
   * expectation in this file would never have noticed. So the contract is tested against
   * the thing itself.
   *
   * If this throws, the constant has moved or been reshaped, and that is the right
   * outcome: the two sides have to move together.
   */
  const ZOME_SOURCE = 'dnas/requests_and_offers/zomes/coordinator/messaging/src/message.rs';

  const zomeLiteral = (): string => {
    // Vitest runs with the working directory at `ui/`, but do not depend on it: try the
    // repo root from there, then from here, and say which were tried if neither exists.
    const candidates = [resolve(process.cwd(), '..', ZOME_SOURCE), resolve(process.cwd(), ZOME_SOURCE)];
    const found = candidates.find((path) => existsSync(path));
    if (!found) {
      throw new Error(`Could not find ${ZOME_SOURCE}. Tried:\n  ${candidates.join('\n  ')}`);
    }
    const source = readFileSync(found, 'utf8');
    const match = source.match(/pub const DEVICES_NOT_FOUND: &str = "([^"]*)";/);
    if (!match) {
      throw new Error(
        'DEVICES_NOT_FOUND not found as a single-line literal in message.rs. It is kept on ' +
          'one line precisely so this can read it; see the comment above the constant.'
      );
    }
    return match[1].replace(/\\'/g, "'");
  };

  it("recognises the zome's own string, read from message.rs", () => {
    expect(isDevicesNotFound(zomeLiteral())).toBe(true);
  });

  /** The bug that prompted all this: whitespace the eye skips and the matcher does not. */
  it('holds a clean sentence, with no doubled whitespace', () => {
    const literal = zomeLiteral();
    expect(literal).not.toMatch(/\s{2,}/);
    expect(literal.trim()).toBe(literal);
  });

  it('does not mistake a real refusal for a waiting condition', () => {
    const refusals = [
      'Your member profile is not accepted yet, so you cannot send messages',
      'That role has no holders, so there is nowhere to deliver to',
      'Message content is 20000 bytes, over the 16384 byte limit',
      'Only a holder of that role can send a case event'
    ];
    for (const refusal of refusals) {
      expect(isDevicesNotFound(refusal), refusal).toBe(false);
    }
  });

  it('treats a missing reason as a refusal rather than silently queueing', () => {
    expect(isDevicesNotFound(undefined)).toBe(false);
    expect(isDevicesNotFound(null)).toBe(false);
    expect(isDevicesNotFound('')).toBe(false);
  });
});

describe('classifySendFailure', () => {
  /**
   * The question this answers is "may the message already have been written?", because
   * that is what decides whether the app may retry by itself. Getting it wrong in one
   * direction sends a duplicate nobody asked for.
   *
   * **To make this go red:** make the `noAnswer` branch fall through to `refused`. A
   * timeout is then shown as a refusal, which claims we know it was not sent.
   */
  const holochainError = (name: string, message: string) => {
    const e = new Error(message);
    e.name = name;
    return e;
  };

  it('retries only the failure that proves nothing was written', () => {
    const devices = new Error(
      "Could not reach that member's devices just now. The message has not been sent; try again in a moment."
    );
    expect(classifySendFailure(devices).kind).toBe('devicesNotFound');
  });

  it('treats silence as silence, never as a refusal', () => {
    // The client's own timeout, from promiseTimeout in lib/api/common.js: a plain Error.
    expect(classifySendFailure(new Error('Request timed out in 60000 ms: call_zome')).kind).toBe(
      'noAnswer'
    );
    // And a socket that went while the call was in flight.
    expect(
      classifySendFailure(
        holochainError('ClientClosedWithPendingRequests', 'client closed')
      ).kind
    ).toBe('noAnswer');
    expect(classifySendFailure(holochainError('ConnectionError', 'no connection')).kind).toBe(
      'noAnswer'
    );
  });

  it('keeps the zome\'s own words on a recognised refusal', () => {
    const refusal = holochainError(
      'ribosome_error',
      'Your member profile is not accepted yet, so you cannot send messages'
    );
    const result = classifySendFailure(refusal);
    expect(result.kind).toBe('refused');
    expect(result.kind === 'refused' && result.reason).toContain('not accepted yet');
  });

  /** The other names the conductor uses when it answered and said no. */
  it('treats the other answered wire errors as refusals too', () => {
    for (const name of [
      'zome_call_unauthorized',
      'zome_call_authentication_failed',
      'deserialization'
    ]) {
      expect(classifySendFailure(holochainError(name, 'no')).kind, name).toBe('refused');
    }
  });

  /**
   * The case this is really for: an error from **another copy of the client**.
   *
   * This worktree holds ten copies of `@holochain/client`, ours at 0.20.5 and nine at
   * 0.20.0 under `@theweave/*`, `@holochain-open-dev/*` and `vf-graphql-holochain`.
   * Inside Moss the error may come from one of those, and it may arrive
   * structured-cloned from a worker, which strips the prototype entirely. A classifier
   * that asked `instanceof` would call every one of these a refusal and tell members
   * their messages failed when they may not have.
   *
   * **To make this go red:** put `instanceof Error` back in `errorShape`. All three plain
   * objects below fall through to `refused`.
   */
  it('reads a plain object with the right fields, with no prototype at all', () => {
    const asPlainObject = { name: 'ClientClosedWithPendingRequests', message: 'client closed' };
    expect(classifySendFailure(asPlainObject).kind).toBe('noAnswer');

    const timedOut = { name: 'Error', message: 'Request timed out in 60000 ms: call_zome' };
    expect(classifySendFailure(timedOut).kind).toBe('noAnswer');

    // Even with no prototype chain whatsoever, as a structured clone can arrive.
    const cloned = Object.assign(Object.create(null), {
      name: 'ConnectionError',
      message: 'no connection'
    });
    expect(classifySendFailure(cloned).kind).toBe('noAnswer');

    const devices = {
      name: 'ribosome_error',
      message:
        "Could not reach that member's devices just now. The message has not been sent; try again in a moment."
    };
    expect(classifySendFailure(devices).kind).toBe('devicesNotFound');
  });

  /** Odd inputs must not throw: a classifier that crashes loses the message entirely. */
  it('survives a thrown string, or something with no fields at all', () => {
    expect(() => classifySendFailure('Request timed out in 1 ms: x')).not.toThrow();
    expect(() => classifySendFailure({})).not.toThrow();
    expect(() => classifySendFailure(null)).not.toThrow();
    expect(() => classifySendFailure(Object.create(null))).not.toThrow();
  });

  /**
   * **The default, and the reason for it** (Sam, 4 October).
   *
   * "Refused" claims we know the message did not land. We only know that when the zome
   * answered. Anything else is a silence, and a member told "not sent" about a message
   * that did send will type it again, which is the duplicate the whole design avoids.
   *
   * **To make this go red:** return `refused` from the last line of
   * `classifySendFailure` instead of `noAnswer`. Every case here flips.
   */
  it('calls an unrecognised failure may-not-have-sent, never a refusal', () => {
    const unknown = [
      new Error('something odd'),
      holochainError('internal_error', 'the conductor had a bad day'),
      holochainError('dna_read_error', 'could not read the dna'),
      holochainError('SomeNameNobodyHasSeen', 'who knows'),
      { name: 'websocket_closed', message: 'socket went away' },
      'a bare string nobody typed on purpose',
      undefined,
      null,
      {}
    ];
    for (const error of unknown) {
      expect(classifySendFailure(error).kind, String(error)).toBe('noAnswer');
    }
  });
});

describe('showsAsAgreement', () => {
  /**
   * **A declined proposal stays a card** (Sam, 4 October). The card is what carries the
   * reason the other person gave, and collapsing it to a one-line agreement would throw
   * that away at the moment it matters most.
   *
   * **To make this go red:** drop the `Declined` clause. A declined proposal becomes an
   * agreement line and its reason disappears from the conversation.
   */
  it('keeps a declined proposal as a card, and everything agreed as a line', () => {
    expect(showsAsAgreement('Proposed')).toBe(false);
    expect(showsAsAgreement('Declined')).toBe(false);

    for (const status of ['Agreed', 'OneSideDone', 'Complete', 'Reviewed', 'Cancelled']) {
      expect(showsAsAgreement(status), status).toBe(true);
    }
  });
});

describe('buildTimeline, an exchange keeping its place', () => {
  /**
   * **Accepting a proposal must not move it down the conversation** (Sam, 4 October). The
   * time used is the agreement's, never the response's, so the messages either side of it
   * do not reshuffle around something that was already read in place.
   *
   * **To make this go red:** sort exchanges by `response.created_at` when a response
   * exists. The card jumps past the two messages that followed it.
   */
  it('orders an accepted exchange by when it was proposed, not when it was accepted', () => {
    const accepted: UIExchange = {
      ...exchange({ counterparty: ANITA, created_at: 20_000 }),
      status: 'Agreed',
      // Accepted long after the messages that followed the proposal.
      response: { agreement: hash(50), accepted: true, note: '', created_at: 90_000 }
    } as UIExchange;

    const thread: UIThread = {
      counterparty: ANITA,
      key: threadKeyOf(ANITA),
      messages: [
        { ...message({ at: micros(10) }), mine: false },
        { ...message({ at: micros(30), hash: hash(98) }), mine: true },
        { ...message({ at: micros(40), hash: hash(97) }), mine: false }
      ],
      interests: [],
      exchanges: [accepted],
      lastAt: 90_000,
      unread: 0,
      archived: false
    };

    expect(buildTimeline(thread).map((i) => [i.kind, i.at])).toEqual([
      ['message', 10_000],
      ['exchange', 20_000],
      ['message', 30_000],
      ['message', 40_000]
    ]);
  });
});

describe('proposableFrom', () => {
  const threadWithInterests = (interests: UIInterest[]): UIThread => ({
    counterparty: ANITA,
    key: threadKeyOf(ANITA),
    messages: [],
    interests,
    exchanges: [],
    lastAt: 0,
    unread: 0,
    archived: false
  });

  /**
   * **Only listings one of the two has shown interest in** can be proposed from, and
   * whose a listing is follows from who showed the interest, with no extra lookup.
   *
   * **To make this go red:** compare against the counterparty instead of `me`. The two
   * groups swap, and the picker offers each person the other's half.
   */
  it('splits the interests into theirs and yours by who showed each one', () => {
    const iWantTheirOffer = interest({ listing_type: 'Offer', user: ME });
    const theyWantMyRequest = interest({ listing_type: 'Request', user: ANITA });

    const { theirs, yours } = proposableFrom(
      threadWithInterests([iWantTheirOffer, theyWantMyRequest]),
      ME
    );

    expect(theirs).toEqual([iWantTheirOffer]);
    expect(yours).toEqual([theyWantMyRequest]);
  });

  it('offers nothing when neither of you has shown interest', () => {
    const { theirs, yours } = proposableFrom(threadWithInterests([]), ME);
    expect(theirs).toEqual([]);
    expect(yours).toEqual([]);
  });
});

describe('guestReason', () => {
  /**
   * A member should read the zome's sentence, not the conductor's rendering of it.
   *
   * **To make this go red:** return `raw` unconditionally. The wrapped cases below come
   * back with `Guest(...)` still around them, which is what a member would be shown.
   */
  it("unwraps the zome's own sentence when the conductor wrapped it", () => {
    const wrapped =
      'Wasm error while working with Ribosome: Guest("Your member profile is not accepted yet, so you cannot send messages")';
    expect(guestReason(wrapped)).toBe(
      'Your member profile is not accepted yet, so you cannot send messages'
    );
  });

  it('leaves a plain sentence exactly as it is', () => {
    const plain = "Could not reach that member's devices just now.";
    expect(guestReason(plain)).toBe(plain);
  });

  /** Losing the message is the one thing it must never do. */
  it('passes an unrecognised shape through untouched', () => {
    for (const odd of ['', 'Guest(', 'something nobody expected', 'Guest()']) {
      expect(guestReason(odd), odd).toBe(odd);
    }
  });

  it('undoes the escaping around a quoted word', () => {
    expect(guestReason('Guest("the \\"kettle\\" is off")')).toBe('the "kettle" is off');
  });
});

describe('the composer byte budget', () => {
  /**
   * **Bytes, not characters.** The zome checks `content.len()`, and Rust's `String::len`
   * is the UTF-8 byte length. A character counter would let someone writing with accents
   * or emoji fill the budget while the counter still showed room.
   *
   * **To make this go red:** count `text.length` instead. The last two assertions fail.
   */
  it('counts UTF-8 bytes, as the zome does', () => {
    expect(contentBytes('hello')).toBe(5);
    expect(contentBytes('')).toBe(0);
    // Two bytes each, and the character count would say five.
    expect(contentBytes('café')).toBe(5);
    expect(contentBytes('ééééé')).toBe(10);
    // One emoji is four bytes, and the character count would say two.
    expect(contentBytes('🤝')).toBe(4);
  });

  /**
   * **Sam's two worked examples**, from the hand test on 4 October. They are what fixes
   * the rounding: 20,001 bytes is 22.08% over, and the line says 23%, so the percentage
   * is ceilinged rather than rounded.
   *
   * **To make this go red:** use `Math.round` in `percentOver`. The first case says 22.
   */
  it('matches the worked examples: 23% over and two messages, then three', () => {
    const twentyThousandAndOne = 'a'.repeat(20_001);
    expect(contentBytes(twentyThousandAndOne)).toBe(20_001);
    expect(percentOver(twentyThousandAndOne)).toBe(23);
    expect(messagesNeeded(twentyThousandAndOne)).toBe(2);

    const fortyThousand = 'a'.repeat(40_000);
    expect(messagesNeeded(fortyThousand)).toBe(3);
    expect(percentOver(fortyThousand)).toBe(145);
  });

  /**
   * The two percentages round opposite ways, and neither should flatter the member:
   * "used" never claims the limit is reached early, "over" never understates the
   * problem.
   */
  it('floors what is used and ceilings what is over', () => {
    expect(percentUsed('')).toBe(0);
    expect(percentUsed('a'.repeat(16 * 1024 - 1)), 'one byte short is not 100%').toBe(99);
    expect(percentUsed('a'.repeat(16 * 1024))).toBe(100);

    expect(percentOver('a'.repeat(16 * 1024)), 'exactly at the limit is not over').toBe(0);
    expect(percentOver('a'.repeat(16 * 1024 + 1)), 'one byte over rounds up to 1%').toBe(1);
  });

  /**
   * **The boundary, where floor and ceiling meet** (Sam, 5 October). 16,384 is the last
   * byte that sends and the first that reads as 100%; 16,385 is the first that is
   * refused and the first that is 1% over. An off-by-one anywhere in the three helpers
   * would land exactly here and nowhere else.
   *
   * The whole rendered line is asserted, not just the numbers, so the composition is
   * covered too: a correct percentage in a sentence that reads wrongly is still wrong.
   *
   * **To make this go red:** change any `<` to `<=` or `Math.ceil` to `Math.round` in
   * `bytesLeft`, `percentUsed`, `percentOver` or `messagesNeeded`.
   */
  it('holds exactly at the limit, and tips one byte past it', () => {
    const atTheLimit = 'a'.repeat(16 * 1024);
    const oneOver = 'a'.repeat(16 * 1024 + 1);

    expect(contentBytes(atTheLimit)).toBe(16_384);
    expect(contentBytes(oneOver)).toBe(16_385);

    // Exactly at the limit: sendable, and reads as full.
    expect(bytesLeft(atTheLimit), 'nothing left, but not negative').toBe(0);
    expect(bytesLeft(atTheLimit) < 0, 'must still be sendable').toBe(false);
    expect(fill(S.conversation.limitUsed, { percent: percentUsed(atTheLimit) })).toBe(
      '100% of the limit used'
    );

    // One byte past: refused, and the line says by how much and what to do.
    expect(bytesLeft(oneOver) < 0, 'must be refused').toBe(true);
    expect(
      fill(S.conversation.tooLongBy, {
        percent: percentOver(oneOver),
        count: messagesNeeded(oneOver)
      })
    ).toBe('Too long by 1%. Split it into 2 messages.');
  });

  it('never suggests splitting a message that fits', () => {
    expect(messagesNeeded('')).toBe(1);
    expect(messagesNeeded('a'.repeat(16 * 1024))).toBe(1);
    expect(messagesNeeded('a'.repeat(16 * 1024 + 1))).toBe(2);
  });

  it('reports what is left, and goes negative past the limit', () => {
    expect(bytesLeft('')).toBe(16 * 1024);
    expect(bytesLeft('a'.repeat(16 * 1024))).toBe(0);
    expect(bytesLeft('a'.repeat(16 * 1024 + 1))).toBe(-1);
    // And the emoji case: 4096 of them is exactly the limit, not a quarter of it.
    expect(bytesLeft('🤝'.repeat(4096))).toBe(0);
  });
});

describe('isTooLong', () => {
  it("recognises the zome's length refusal, whatever the numbers", () => {
    expect(isTooLong('Message content is 20000 bytes, over the 16384 byte limit')).toBe(true);
    expect(isTooLong('Message content is 1 bytes, over the 2 byte limit')).toBe(true);
  });

  it('does not catch any other refusal', () => {
    for (const other of [
      'Case ID is 90 bytes, over the 64 byte limit',
      'Your member profile is not accepted yet, so you cannot send messages',
      undefined,
      ''
    ]) {
      expect(isTooLong(other), String(other)).toBe(false);
    }
  });
});

describe('unread counts cards as well as messages', () => {
  const marker = (at: number) => ({ [threadKeyOf(ANITA)]: at * 1000 });

  /**
   * **A proposal arriving marks its conversation unopened** (Sam, 4 October). It used to
   * leave Messages looking quiet while adding to a separate exchanges number, so one
   * event was counted twice in one place and not at all in the other.
   *
   * **To make this go red:** drop the `unreadCards` term from `thread.unread`. The
   * conversation goes back to reading as empty.
   */
  it('marks a conversation unopened when a proposal arrives', () => {
    // Anita wrote the agreement, so she is not its counterparty: I am.
    const theirProposal = exchange({ counterparty: ME, provider: ANITA, created_at: 50_000 });
    const threads = build({
      interests: [{ interest: interest({}), counterparty: ANITA }],
      exchanges: [theirProposal],
      readUpTo: marker(10)
    });

    expect(threads[0].unread).toBe(1);
    expect(unopenedConversations(threads)).toBe(1);
  });

  it('does not count a proposal I made myself, with no answer yet', () => {
    const myProposal = exchange({ counterparty: ANITA, created_at: 50_000 });
    const threads = build({ exchanges: [myProposal], readUpTo: marker(10) });
    expect(threads[0].unread).toBe(0);
  });

  it('counts their answer to a proposal I made', () => {
    const answered: UIExchange = {
      ...exchange({ counterparty: ANITA, created_at: 20_000 }),
      response: { agreement: hash(50), accepted: true, note: '', created_at: 60_000 }
    } as UIExchange;
    const threads = build({ exchanges: [answered], readUpTo: marker(10) });
    expect(threads[0].unread).toBe(1);
  });

  /**
   * **Conversations are counted once.** One holding an unread message and an unread
   * proposal is one thing to look at, not two.
   *
   * **To make this go red:** have the badge sum `t.unread` instead of counting threads,
   * which is what it did before. This returns 2.
   */
  it('counts a conversation holding both a message and a proposal as one', () => {
    const theirProposal = exchange({ counterparty: ME, provider: ANITA, created_at: 50_000 });
    const threads = build({
      inbox: [message({ at: micros(40), from: ANITA_PHONE })],
      exchanges: [theirProposal],
      readUpTo: marker(10)
    });

    expect(threads[0].unread, 'two items in the one conversation').toBe(2);
    expect(unopenedConversations(threads), 'but one conversation to open').toBe(1);
  });

  /**
   * Opening clears the count. **"Your turn" is not this number** and is not cleared by
   * looking: it comes from `turnOf` on the exchange and goes when the member acts.
   */
  it('clears the count once the conversation has been opened', () => {
    const theirProposal = exchange({ counterparty: ME, provider: ANITA, created_at: 50_000 });
    const opened = build({
      inbox: [message({ at: micros(40), from: ANITA_PHONE })],
      exchanges: [theirProposal],
      // The marker moves past everything when the conversation is opened.
      readUpTo: marker(99)
    });

    expect(opened[0].unread).toBe(0);
    expect(unopenedConversations(opened)).toBe(0);
    // The exchange itself is untouched by reading: whose turn it is still comes from it.
    expect(opened[0].exchanges).toHaveLength(1);
  });
});

describe('applyBlocks', () => {
  /**
   * **One function, applied once** (brief E, decision 4). Every read the interface makes
   * starts from the same inbox, so the filter goes there rather than being repeated in
   * the personal list, the role inbox and a member's own correspondence.
   *
   * **To make this go red:** have one of those three read the unfiltered list instead.
   * Because they all derive from the filtered one, there is only one place to get wrong,
   * which is the point.
   */
  it('hides every message from a blocked person, whichever device they used', () => {
    const messages = [
      message({ at: micros(10), from: ANITA_PHONE }),
      message({ at: micros(20), from: ANITA_LAPTOP, hash: hash(98) }),
      message({ at: micros(30), from: MARCO_AGENT, hash: hash(97) })
    ];

    const kept = applyBlocks(messages, agentToUser, new Set([threadKeyOf(ANITA)]));

    expect(kept, 'both of Anita\'s devices go, Marco stays').toHaveLength(1);
    expect(kept[0].from).toBe(MARCO_AGENT);
  });

  it('blocks by person, so blocking does not have to be done per device', () => {
    const fromLaptopOnly = [message({ at: micros(20), from: ANITA_LAPTOP })];
    expect(applyBlocks(fromLaptopOnly, agentToUser, new Set([threadKeyOf(ANITA)]))).toHaveLength(
      0
    );
  });

  it('keeps everything when nobody is blocked', () => {
    const messages = [message({ at: micros(10), from: ANITA_PHONE })];
    expect(applyBlocks(messages, agentToUser, new Set())).toBe(messages);
  });

  /**
   * A block cannot be proven against somebody we cannot identify, and dropping messages
   * on a failed lookup would hide more than the member asked to hide.
   */
  it('keeps a message whose author will not resolve', () => {
    const unknown = [message({ at: micros(10), from: agent(77) })];
    expect(applyBlocks(unknown, agentToUser, new Set([threadKeyOf(ANITA)]))).toHaveLength(1);
  });
});

describe('receiptsEnabledFor', () => {
  /**
   * **Prediction 5.** Changing the overall setting reaches every chat that has not been
   * decided, and no chat that has.
   *
   * **To make this go red:** make the per-chat setting a boolean defaulting to the
   * overall value. A chat set to `off` then flips when the overall one changes.
   */
  it('lets the overall setting govern only the chats nobody has decided', () => {
    expect(receiptsEnabledFor(undefined, true), 'inherit, overall on').toBe(true);
    expect(receiptsEnabledFor('inherit', true)).toBe(true);
    expect(receiptsEnabledFor(undefined, false), 'inherit, overall off').toBe(false);
    expect(receiptsEnabledFor('inherit', false)).toBe(false);

    // Set deliberately: the overall setting does not reach these, either way.
    expect(receiptsEnabledFor('on', false), 'on survives overall off').toBe(true);
    expect(receiptsEnabledFor('off', true), 'off survives overall on').toBe(false);
  });
});

describe('clampReceipt', () => {
  /**
   * **Prediction 3.** A receipt's time is a claim; only who sent it is trustworthy.
   *
   * **To make this go red:** return `claimed`. The first case then reports a message as
   * read that was never sent.
   */
  it('trims a claim to the last message actually sent', () => {
    expect(clampReceipt(99_000, 50_000), 'a claim beyond what was sent').toBe(50_000);
    expect(clampReceipt(30_000, 50_000), 'an honest claim is left alone').toBe(30_000);
    expect(clampReceipt(50_000, 50_000), 'exactly the last message').toBe(50_000);
  });

  it('reads nothing when nothing was sent', () => {
    expect(clampReceipt(99_000, undefined)).toBe(0);
    expect(clampReceipt(99_000, 0)).toBe(0);
  });
});
