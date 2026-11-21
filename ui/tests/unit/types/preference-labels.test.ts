import { describe, it, expect } from 'vitest';
import { ContactPreferenceHelpers, TimePreferenceHelpers } from '$lib/types/holochain';

/**
 * **Listing pages show a preference by its label, never its enum** (dogfooding of
 * 21 November, F4: request and offer detail pages read "Time Preference: NoPreference").
 * The labels are the ones the forms offer.
 */
describe('preference display values', () => {
  it('labels every time preference the way the form does', () => {
    expect(TimePreferenceHelpers.getDisplayValue('NoPreference')).toBe('No Preference');
    expect(TimePreferenceHelpers.getDisplayValue('Morning')).toBe('Morning');
    expect(TimePreferenceHelpers.getDisplayValue('Afternoon')).toBe('Afternoon');
    expect(TimePreferenceHelpers.getDisplayValue('Evening')).toBe('Evening');
    expect(TimePreferenceHelpers.getDisplayValue({ Other: 'Weekends' })).toBe('Weekends');
    expect(TimePreferenceHelpers.getDisplayValue({ Other: '' })).toBe('Other');
  });

  it('labels every contact preference', () => {
    expect(ContactPreferenceHelpers.getDisplayValue('Email')).toBe('Email');
    expect(ContactPreferenceHelpers.getDisplayValue('Phone')).toBe('Phone');
    expect(ContactPreferenceHelpers.getDisplayValue({ Other: 'Signal' })).toBe('Signal');
  });
});
