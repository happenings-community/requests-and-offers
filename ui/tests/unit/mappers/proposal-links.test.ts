import { describe, it, expect } from 'vitest';
import { proposalIntentLinks } from '$lib/services/mappers/proposal-links';

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
