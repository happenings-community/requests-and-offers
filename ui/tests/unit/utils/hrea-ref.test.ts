import { describe, it, expect } from 'vitest';
import { encodeHashToBase64 } from '@holochain/client';
import { noteRefersTo, refHashFromNote, refNote } from '$lib/utils/hrea-ref';

// An action hash: the 3-byte prefix, 32 bytes of core, 4 of location.
const actionHash = new Uint8Array([132, 41, 36, ...Array.from({ length: 36 }, (_, i) => i + 1)]);
const legacyNote = `ref:serviceType:${actionHash.toString()}`;

describe('hREA ref notes', () => {
  it('writes the hash in its base64 form, not as a list of byte values', () => {
    const note = refNote('serviceType', actionHash);
    expect(note).toBe(`ref:serviceType:${encodeHashToBase64(actionHash)}`);
    expect(note).not.toMatch(/\d+,\d+/);
  });

  it('writes unknown when there is no hash', () => {
    expect(refNote('user', undefined)).toBe('ref:user:unknown');
  });

  it("reads a note in either form as the store's map key", () => {
    const key = actionHash.toString();
    expect(refHashFromNote(refNote('serviceType', actionHash), 'serviceType')).toBe(key);
    expect(refHashFromNote(legacyNote, 'serviceType')).toBe(key);
  });

  it('reads nothing from a note of another type', () => {
    expect(refHashFromNote(legacyNote, 'mediumOfExchange')).toBeNull();
    expect(refHashFromNote(undefined, 'user')).toBeNull();
  });

  it('matches a hash against a note written in either form, so existing data still matches', () => {
    expect(noteRefersTo(refNote('serviceType', actionHash), 'serviceType', actionHash)).toBe(true);
    expect(noteRefersTo(legacyNote, 'serviceType', actionHash)).toBe(true);
    expect(noteRefersTo(legacyNote, 'serviceType', actionHash.toString())).toBe(true);
    expect(noteRefersTo(legacyNote, 'serviceType', encodeHashToBase64(actionHash))).toBe(true);
  });

  it('does not match another hash or another type', () => {
    const other = new Uint8Array(actionHash);
    other[10] = 200;
    expect(noteRefersTo(legacyNote, 'serviceType', other)).toBe(false);
    expect(noteRefersTo(legacyNote, 'user', actionHash)).toBe(false);
    expect(noteRefersTo(legacyNote, 'serviceType', undefined)).toBe(false);
  });
});
