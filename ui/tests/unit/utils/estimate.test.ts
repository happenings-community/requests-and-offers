import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { estimateLabel } from '$lib/utils/estimate';

/**
 * **A listing's estimate reads as it was written** (#380, #525).
 *
 * It was an f32: 1.1 was stored as 1.100000023841858 and printed that way. It is an
 * exact decimal string now, and every display prints it through `estimateLabel`.
 *
 * **To make this go red:** spell it `String(Math.fround(Number(hours)))` in
 * `estimateLabel`, or print `time_estimate_hours` through a number on any surface below.
 */
describe('estimateLabel', () => {
  it('prints the decimal as written', () => {
    expect(estimateLabel('1.1')).toBe('1.1 hours');
    expect(estimateLabel('33.3')).toBe('33.3 hours');
    expect(estimateLabel('2.50')).toBe('2.50 hours');
  });

  it('says hour for one, however it is written, and hours for none', () => {
    expect(estimateLabel('1')).toBe('1 hour');
    expect(estimateLabel('1.0')).toBe('1.0 hour');
    expect(estimateLabel('0')).toBe('0 hours');
  });
});

/** Source-reading, as the project mounts neither the request page nor its modal. */
describe('every surface prints the estimate through estimateLabel', () => {
  const FILES = [
    'src/routes/(public)/requests/[id]/+page.svelte',
    'src/lib/components/requests/RequestDetailsModal.svelte',
    'src/lib/services/mappers/request-proposal.mapper.ts'
  ];

  it.each(FILES)('%s', (file) => {
    const source = readFileSync(file, 'utf8');
    expect(source).toContain('estimateLabel(request.time_estimate_hours)');
    // Printed raw, or through a number, it is the float again.
    expect(source).not.toMatch(/\{request\??\.time_estimate_hours\}/);
    expect(source).not.toMatch(/(Number|parseFloat)\(\s*request\??\.time_estimate_hours/);
  });
});
