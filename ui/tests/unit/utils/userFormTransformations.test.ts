/**
 * Unit tests for form <-> DHT transformations.
 *
 * formInputToDHT: concatenates given_name + family_name into the single DHT name field.
 * dhtToFormInput: first-space split for edit-mode pre-fill, preserving compound family names.
 */

import { describe, it, expect } from 'vitest';
import {
  formInputToDHT,
  dhtToFormInput,
  type UserFormInput
} from '$lib/schemas/users.schemas';
import type { UserInDHT } from '$lib/schemas/users.schemas';

// Minimal valid form input for tests - only name fields vary
const baseForm: Omit<UserFormInput, 'given_name' | 'family_name'> = {
  nickname: 'tester',
  user_type: 'advocate',
  email: 'test@example.com'
};

const baseDHT: Omit<UserInDHT, 'name'> = {
  nickname: 'tester',
  user_type: 'advocate',
  email: 'test@example.com'
};

describe('formInputToDHT', () => {
  it('concatenates given_name and family_name with a single space', () => {
    const result = formInputToDHT({
      ...baseForm,
      given_name: 'Maria',
      family_name: 'Rodriguez'
    });
    expect(result.name).toBe('Maria Rodriguez');
  });

  it('produces the sentinel form for mononymous users (family_name = ".")', () => {
    const result = formInputToDHT({
      ...baseForm,
      given_name: 'Sting',
      family_name: '.'
    });
    expect(result.name).toBe('Sting .');
  });

  it('preserves a compound family name', () => {
    const result = formInputToDHT({
      ...baseForm,
      given_name: 'Maria',
      family_name: 'del Carmen Rodriguez'
    });
    expect(result.name).toBe('Maria del Carmen Rodriguez');
  });

  it('trims whitespace on both name parts', () => {
    const result = formInputToDHT({
      ...baseForm,
      given_name: '  Maria  ',
      family_name: '  Rodriguez  '
    });
    expect(result.name).toBe('Maria Rodriguez');
  });

  it('preserves all other fields unchanged', () => {
    const input: UserFormInput = {
      ...baseForm,
      given_name: 'Maria',
      family_name: 'Rodriguez',
      bio: 'Hello',
      phone: '+44 1234 567890',
      time_zone: 'Europe/London',
      location: 'Colchester'
    };
    const result = formInputToDHT(input);
    expect(result.nickname).toBe('tester');
    expect(result.user_type).toBe('advocate');
    expect(result.email).toBe('test@example.com');
    expect(result.bio).toBe('Hello');
    expect(result.phone).toBe('+44 1234 567890');
    expect(result.time_zone).toBe('Europe/London');
    expect(result.location).toBe('Colchester');
  });
});

describe('dhtToFormInput', () => {
  it('splits a normal two-part name on the first space', () => {
    const result = dhtToFormInput({ ...baseDHT, name: 'Maria Rodriguez' });
    expect(result.given_name).toBe('Maria');
    expect(result.family_name).toBe('Rodriguez');
  });

  it('preserves a compound family name (first-space split)', () => {
    const result = dhtToFormInput({ ...baseDHT, name: 'Maria del Carmen Rodriguez' });
    expect(result.given_name).toBe('Maria');
    expect(result.family_name).toBe('del Carmen Rodriguez');
  });

  it('leaves family_name empty for a single-token name (mononym, NOT pre-filled with dot)', () => {
    const result = dhtToFormInput({ ...baseDHT, name: 'Sting' });
    expect(result.given_name).toBe('Sting');
    expect(result.family_name).toBe('');
  });

  it('handles a stored sentinel-form name by restoring the dot to family_name', () => {
    // A user who saved as a mononym has stored name "Sting ." - first-space
    // split treats "." as the family_name, which is what we want for editing.
    const result = dhtToFormInput({ ...baseDHT, name: 'Sting .' });
    expect(result.given_name).toBe('Sting');
    expect(result.family_name).toBe('.');
  });

  it('trims surrounding whitespace before splitting', () => {
    const result = dhtToFormInput({ ...baseDHT, name: '  Maria Rodriguez  ' });
    expect(result.given_name).toBe('Maria');
    expect(result.family_name).toBe('Rodriguez');
  });

  it('preserves all other fields unchanged', () => {
    const result = dhtToFormInput({
      ...baseDHT,
      name: 'Maria Rodriguez',
      bio: 'Hello',
      phone: '+44 1234 567890',
      time_zone: 'Europe/London',
      location: 'Colchester'
    });
    expect(result.nickname).toBe('tester');
    expect(result.user_type).toBe('advocate');
    expect(result.email).toBe('test@example.com');
    expect(result.bio).toBe('Hello');
    expect(result.phone).toBe('+44 1234 567890');
    expect(result.time_zone).toBe('Europe/London');
    expect(result.location).toBe('Colchester');
  });
});

describe('round-trip: form -> DHT -> form', () => {
  it('round-trips a normal two-part name', () => {
    const original: UserFormInput = {
      ...baseForm,
      given_name: 'Maria',
      family_name: 'Rodriguez'
    };
    const roundTripped = dhtToFormInput(formInputToDHT(original));
    expect(roundTripped.given_name).toBe('Maria');
    expect(roundTripped.family_name).toBe('Rodriguez');
  });

  it('round-trips a compound family name', () => {
    const original: UserFormInput = {
      ...baseForm,
      given_name: 'Maria',
      family_name: 'del Carmen Rodriguez'
    };
    const roundTripped = dhtToFormInput(formInputToDHT(original));
    expect(roundTripped.given_name).toBe('Maria');
    expect(roundTripped.family_name).toBe('del Carmen Rodriguez');
  });

  it('round-trips a mononymous user (family_name "." is preserved)', () => {
    const original: UserFormInput = {
      ...baseForm,
      given_name: 'Sting',
      family_name: '.'
    };
    const roundTripped = dhtToFormInput(formInputToDHT(original));
    expect(roundTripped.given_name).toBe('Sting');
    expect(roundTripped.family_name).toBe('.');
  });
});
