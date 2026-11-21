import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { hasEstimate, readEstimate } from '$lib/utils/estimate';

/**
 * **Zero hours means no estimate, everywhere** (dogfooding of 21 November, F19).
 *
 * "0" was accepted and the request page read "Estimated time 0 hours", while the proposal
 * page and the hREA mirror both read a zero estimate as none. The form now refuses 0 and
 * says to leave the field blank, and a zero already on the network is shown as no
 * estimate. The form also says what is wrong when the field is left, not only on submit.
 */
describe('readEstimate', () => {
  it('reads blank as no estimate', () => {
    expect(readEstimate('')).toEqual({ value: null, error: null });
    expect(readEstimate('   ')).toEqual({ value: null, error: null });
  });

  it('keeps a good estimate as written, a decimal comma read as a dot', () => {
    expect(readEstimate('2')).toEqual({ value: '2', error: null });
    expect(readEstimate('1,5')).toEqual({ value: '1.5', error: null });
  });

  it('refuses zero, however it is written, and says to leave the field blank', () => {
    for (const zero of ['0', '0.0', '0,00']) {
      const read = readEstimate(zero);
      expect(read.value).toBeNull();
      expect(read.error).toBe(
        'The estimated time must be more than 0 hours; leave it blank if you have no estimate.'
      );
    }
  });

  it('refuses a sign or letters with the decimal message', () => {
    expect(readEstimate('-1').error).toMatch(/^The estimated time must be a plain number/);
    expect(readEstimate('abc').error).toMatch(/^The estimated time must be a plain number/);
  });
});

describe('hasEstimate', () => {
  it('is false for none and for a zero already on the network', () => {
    expect(hasEstimate(null)).toBe(false);
    expect(hasEstimate(undefined)).toBe(false);
    expect(hasEstimate('0')).toBe(false);
    expect(hasEstimate('0.00')).toBe(false);
  });

  it('is true for an estimate', () => {
    expect(hasEstimate('0.5')).toBe(true);
    expect(hasEstimate('2')).toBe(true);
  });
});

/** Source-reading, as the project mounts neither the request page, its modal nor the form. */
describe('the surfaces use them', () => {
  it.each([
    'src/routes/(public)/requests/[id]/+page.svelte',
    'src/lib/components/requests/RequestDetailsModal.svelte'
  ])('%s shows the estimate only when there is one', (file) => {
    expect(readFileSync(file, 'utf8')).toMatch(/hasEstimate\(request\??\.time_estimate_hours\)/);
  });

  it('the request form validates the field when it is left', () => {
    const source = readFileSync('src/lib/components/requests/RequestForm.svelte', 'utf8');
    expect(source).toMatch(/onblur=\{[^}]*readEstimate/);
  });

  it('the request form opens a zero already published as a blank field', () => {
    const source = readFileSync('src/lib/components/requests/RequestForm.svelte', 'utf8');
    expect(source).toMatch(/hasEstimate\(request\?\.time_estimate_hours\)\s*\?/);
  });
});
