import { describe, it, expect } from 'vitest';

import { plainZomeError } from '$lib/utils/zome-refusals';

// The exact text a pending member saw in alpha 1 (#330).
const ALPHA1_REFUSAL =
  'Failed to register interest: Wasm runtime error while working with Ribosome: ' +
  'RuntimeError: WasmError { file: "dnas/requests_and_offers/utils/src/errors.rs", ' +
  'line: 181, error: Guest("Entity not accepted: user") }';

describe('plainZomeError', () => {
  it('rewrites the not-accepted refusal into plain words', () => {
    const result = plainZomeError(new Error(ALPHA1_REFUSAL));
    expect(result.known).toBe(true);
    expect(result.message).not.toMatch(/Wasm|Ribosome|Guest/);
    expect(result.message).toMatch(/approved/);
  });

  it('keeps the raw text as details for an admin', () => {
    expect(plainZomeError(new Error(ALPHA1_REFUSAL)).details).toBe(ALPHA1_REFUSAL);
  });

  it('matches the plural form the offers and requests zomes use', () => {
    expect(plainZomeError('Guest("Entity not accepted: users")').known).toBe(true);
  });

  it('does not rewrite organisation refusals, which need different wording', () => {
    expect(plainZomeError('Guest("Entity not accepted: organization")').known).toBe(false);
  });

  it('leaves an unknown error as it was', () => {
    const result = plainZomeError(new Error('Something else broke'));
    expect(result).toEqual({
      message: 'Something else broke',
      details: 'Something else broke',
      known: false
    });
  });
});
