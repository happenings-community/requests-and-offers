import { describe, it, expect } from 'vitest';
import { paths } from '$lib/paths';
import { EXCHANGE_STRINGS } from '$lib/strings/exchanges.strings';
import { proposeUnavailable, type ProposeProblem } from '$lib/utils/propose-unavailable';

const LISTING = new Uint8Array(Array(39).fill(1));
const S = EXCHANGE_STRINGS.unavailable;

/**
 * **A propose page that cannot open must still lead somewhere** (Soushi, alpha 2
 * dogfooding, 21 November). It showed a red bar reading "This page needs a listing to
 * propose against." and nothing else: an alarm with no way on. Each reason it cannot open
 * now names what happened in a member's words and offers a way forward.
 */
describe('proposeUnavailable', () => {
  it('sends a member with no listing to their exchanges first, then to the listings', () => {
    const state = proposeUnavailable({ kind: 'no-listing' }, { listing: null, type: null });
    expect(state.title).toBe(S.noListing.title);
    expect(state.body).toBe(S.noListing.body);
    expect(state.actions.map((a) => a.href)).toEqual([
      paths.exchanges(),
      paths.requests(),
      paths.offers()
    ]);
    expect(state.actions.filter((a) => a.primary).map((a) => a.href)).toEqual([paths.exchanges()]);
    expect(state.retry).toBe(false);
  });

  it('cannot name the listing when the link lacks its type, so it offers the same ways on', () => {
    const state = proposeUnavailable({ kind: 'no-type' }, { listing: LISTING, type: null });
    expect(state.title).toBe(S.noType.title);
    expect(state.actions.map((a) => a.href)).toEqual([
      paths.exchanges(),
      paths.requests(),
      paths.offers()
    ]);
  });

  it('points a listing that was not found at the list of its own kind', () => {
    const state = proposeUnavailable({ kind: 'not-found' }, { listing: LISTING, type: 'Request' });
    expect(state.title).toBe(S.notFound.title);
    expect(state.actions[0]).toMatchObject({ href: paths.requests(), primary: true });
    expect(state.actions.map((a) => a.href)).toContain(paths.exchanges());
    // The listing itself would only say "not found" again.
    expect(state.actions.map((a) => a.href)).not.toContain(paths.requestDetail(LISTING));
  });

  it('leads back to the listing, and offers a retry, when reading it failed', () => {
    const problem: ProposeProblem = { kind: 'failed', detail: 'Connection closed' };
    const state = proposeUnavailable(problem, { listing: LISTING, type: 'Offer' });
    expect(state.title).toBe(S.failed.title);
    expect(state.actions[0]).toMatchObject({ href: paths.offerDetail(LISTING), primary: true });
    expect(state.retry).toBe(true);
    expect(state.detail).toBe('Connection closed');
  });

  it('never makes more than one action primary', () => {
    const problems: ProposeProblem[] = [
      { kind: 'no-listing' },
      { kind: 'no-type' },
      { kind: 'not-found' },
      { kind: 'failed', detail: 'x' }
    ];
    for (const p of problems) {
      const state = proposeUnavailable(p, { listing: LISTING, type: 'Offer' });
      expect(state.actions.filter((a) => a.primary)).toHaveLength(1);
    }
  });
});
