/**
 * Unit tests for formatUserName — strips sentinel dot used to mark
 * mononymous users while preserving embedded dots (initials, titles).
 */

import { describe, it, expect } from 'vitest';
import { formatUserName } from '$lib/schemas/users.schemas';

describe('formatUserName', () => {
  it('strips trailing " ." sentinel (primary mononym case)', () => {
    expect(formatUserName('Sting .')).toBe('Sting');
  });

  it('strips leading ". " sentinel (defensive)', () => {
    expect(formatUserName('. Cher')).toBe('Cher');
  });

  it('passes through a normal two-part name unchanged', () => {
    expect(formatUserName('Maria Rodriguez')).toBe('Maria Rodriguez');
  });

  it('preserves compound family names', () => {
    expect(formatUserName('Maria del Carmen Rodriguez')).toBe('Maria del Carmen Rodriguez');
  });

  it('preserves embedded dot in titles like "Dr. Smith"', () => {
    expect(formatUserName('Dr. Smith')).toBe('Dr. Smith');
  });

  it('preserves dots in initials like "J. R. R. Tolkien"', () => {
    expect(formatUserName('J. R. R. Tolkien')).toBe('J. R. R. Tolkien');
  });

  it('strips only the trailing sentinel when initials are also present', () => {
    expect(formatUserName('M.A. Singh .')).toBe('M.A. Singh');
  });

  it('handles the degenerate ". ." input defensively', () => {
    // Strips leading ". " then trailing whitespace/dot — ends up empty or "."
    const result = formatUserName('. .');
    expect(['', '.']).toContain(result);
  });

  it('returns empty string for null', () => {
    expect(formatUserName(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatUserName(undefined)).toBe('');
  });

  it('returns empty string for empty input', () => {
    expect(formatUserName('')).toBe('');
  });

  it('trims surrounding whitespace from a normal name', () => {
    expect(formatUserName('  Maria Rodriguez  ')).toBe('Maria Rodriguez');
  });
});
