import { describe, it, expect } from 'vitest';
import { encodeHashToBase64 } from '@holochain/client';
import { proposalIntentLinks, proposalsForListing } from '$lib/services/mappers/proposal-links';

const mapped = (isReciprocal: boolean) => ({ isReciprocal });
const created = (id: string) => ({ id });

describe('proposalIntentLinks', () => {
  it('puts the service intents in publishes and the payment intent in reciprocal', () => {
    expect(
      proposalIntentLinks(
        [mapped(false), mapped(false), mapped(true)],
        [created('work-1'), created('work-2'), created('pay')]
      )
    ).toEqual({ publishes: ['work-1', 'work-2'], reciprocal: ['pay'] });
  });

  it('pairs each mapped intent with the created intent at the same position', () => {
    expect(
      proposalIntentLinks([mapped(true), mapped(false)], [created('pay'), created('work')])
    ).toEqual({ publishes: ['work'], reciprocal: ['pay'] });
  });

  it('refuses a count mismatch rather than linking the wrong intents', () => {
    expect(() => proposalIntentLinks([mapped(false), mapped(true)], [created('work')])).toThrow(
      '2 intents mapped, 1 created'
    );
  });
});

describe('proposalsForListing', () => {
  const offerHash = new Uint8Array([132, 41, 36, ...Array.from({ length: 36 }, (_, i) => i + 7)]);
  const otherHash = new Uint8Array([132, 41, 36, ...Array.from({ length: 36 }, (_, i) => i + 50)]);
  const note = (kind: string, hash: string) =>
    `Description: x\n\n--- hREA Mapping ---\nOriginal ${kind} hash: ${hash}\nCreated: 2026-11-21`;

  it('finds every proposal an offer was mirrored as, the copies an edit left included', () => {
    const proposals = [
      { id: 'p1', name: 'Offer: Weekend garden help', note: note('offer', offerHash.toString()) },
      {
        id: 'p2',
        name: 'Offer: Weekend garden help (Saturdays)',
        note: note('offer', offerHash.toString())
      },
      { id: 'p3', name: 'Offer: Garden help, take two', note: note('offer', otherHash.toString()) },
      { id: 'p4', name: 'Request: Need help', note: note('request', offerHash.toString()) }
    ];
    expect(proposalsForListing(proposals, 'offer', offerHash).map((p) => p.id)).toEqual([
      'p1',
      'p2'
    ]);
    expect(proposalsForListing(proposals, 'request', offerHash).map((p) => p.id)).toEqual(['p4']);
  });

  it('reads the hash in its base64 form too, and nothing from a proposal without a note', () => {
    const proposals = [
      { id: 'b', note: note('offer', encodeHashToBase64(offerHash)) },
      { id: 'none', note: undefined }
    ];
    expect(proposalsForListing(proposals, 'offer', offerHash).map((p) => p.id)).toEqual(['b']);
  });
});
