import { describe, it, expect } from 'vitest';
import { encode } from '@msgpack/msgpack';
import type { Record as HolochainRecord } from '@holochain/client';
import {
  listingReciprocalAction,
  listingNoteLine,
  listingOfProposal,
  mediumFromRecord,
  proposalsForListing
} from '$lib/services/mappers/listing-medium';

const medium = (exchange_type: 'base' | 'currency', code: string, name: string) => ({
  exchange_type,
  code,
  name
});

describe("a listing's reciprocal intent follows its medium", () => {
  it('is a transfer for a currency', () => {
    expect(listingReciprocalAction(medium('currency', 'GBP', 'Pound sterling'))).toBe('transfer');
  });

  it('is work for Service Exchange, a service given in return', () => {
    expect(listingReciprocalAction(medium('base', 'EXCHANGE_SERVICES', 'Service Exchange'))).toBe(
      'work'
    );
    // Either the code or the name identifies it, as the agreement rule reads the name.
    expect(listingReciprocalAction(medium('base', 'OTHER', 'Service Exchange'))).toBe('work');
    expect(listingReciprocalAction(medium('base', 'EXCHANGE_SERVICES', 'Renamed'))).toBe('work');
  });

  it('is none for a base medium that expects nothing back', () => {
    expect(
      listingReciprocalAction(medium('base', 'PAY_IT_FORWARD', 'Free/Pay it Forward'))
    ).toBeNull();
  });

  it('keeps a transfer when the medium could not be read', () => {
    expect(listingReciprocalAction(null)).toBe('transfer');
  });
});

describe('mediumFromRecord', () => {
  it("reads the medium's entry", () => {
    const entry = medium('base', 'EXCHANGE_SERVICES', 'Service Exchange');
    const record = { entry: { Present: { entry: encode(entry) } } } as unknown as HolochainRecord;
    expect(mediumFromRecord(record)).toMatchObject(entry);
  });

  it('is null for no record, an entry not present, or bytes that do not decode', () => {
    expect(mediumFromRecord(null)).toBeNull();
    expect(
      mediumFromRecord({ entry: { NotStored: null } } as unknown as HolochainRecord)
    ).toBeNull();
    const junk = { entry: { Present: { entry: new Uint8Array([0xc1]) } } };
    expect(mediumFromRecord(junk as unknown as HolochainRecord)).toBeNull();
  });
});

describe("finding a listing's proposals by their note", () => {
  const note = (kind: 'request' | 'offer', hash: string) =>
    [
      'Description: x',
      'Offered by: Ada',
      '',
      '--- hREA Mapping ---',
      listingNoteLine(kind, hash),
      'Created: 2026-11-20'
    ].join('\n');

  it('finds every proposal naming the listing, duplicates included', () => {
    const proposals = [
      { id: 'p1', note: note('offer', '1,2,3') },
      { id: 'p2', note: note('offer', '1,2,3') },
      { id: 'p3', note: note('offer', '9,9') }
    ];
    expect(proposalsForListing(proposals, 'offer', '1,2,3').map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('matches the whole hash, never a prefix of a longer one, nor the other kind', () => {
    const proposals = [
      { id: 'long', note: note('offer', '1,2,34') },
      { id: 'request', note: note('request', '1,2,3') },
      { id: 'none', note: undefined }
    ];
    expect(proposalsForListing(proposals, 'offer', '1,2,3')).toEqual([]);
  });

  it('reads which listing a proposal mirrors, and none for an N/A or a foreign note', () => {
    expect(listingOfProposal({ note: note('request', '4,5') })).toEqual({
      kind: 'request',
      hash: '4,5'
    });
    expect(listingOfProposal({ note: 'Original offer hash: N/A' })).toBeNull();
    expect(listingOfProposal({ note: 'something else' })).toBeNull();
    expect(listingOfProposal({})).toBeNull();
  });
});
