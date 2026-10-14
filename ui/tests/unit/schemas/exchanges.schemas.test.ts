import { describe, it, expect } from 'vitest';
import { Either } from 'effect';
import {
  decodeCreateAgreementInput,
  decodeCreateInterestInput,
  decodeExchangeTerm,
  decodeReviewInput
} from '$lib/schemas/exchanges.schemas';

const hash = (n: number) => new Uint8Array([n, n, n, n]);

const service = {
  direction: 'Provide',
  resource_conforms_to: 'Web development',
  resource_kind: 'Service',
  quantity: { value: 4, unit: 'hours' }
};

const currency = {
  direction: 'Receive',
  resource_conforms_to: 'CAD',
  resource_kind: 'Currency',
  quantity: { value: 200, unit: 'CAD' }
};

const agreement = {
  listing: hash(1),
  listing_type: 'Offer',
  interest: hash(2),
  primary: service,
  reciprocal: currency,
  medium: 'CAD',
  terms: 'Two sessions, remote.',
  delivery_timeframe: 'Within 2 weeks'
};

/** The message a failed decode would put in front of the member. */
const failure = <A>(result: Either.Either<A, { message: string }>): string => {
  if (Either.isRight(result)) throw new Error('expected the decode to fail');
  return result.left.message;
};

describe('exchange term schema', () => {
  it('accepts a service term that names its specification', () => {
    expect(Either.isRight(decodeExchangeTerm(service))).toBe(true);
  });

  it('refuses a service term that names no specification', () => {
    const result = decodeExchangeTerm({ ...service, resource_conforms_to: '' });
    expect(failure(result)).toContain('names no resource specification');
  });

  it('refuses a gift that carries a quantity', () => {
    const result = decodeExchangeTerm({
      direction: 'Receive',
      resource_conforms_to: '',
      resource_kind: 'Gift',
      quantity: { value: 1, unit: 'hours' }
    });
    expect(failure(result)).toContain('carries no quantity');
  });

  it('refuses a gift that names a resource', () => {
    const result = decodeExchangeTerm({
      direction: 'Receive',
      resource_conforms_to: 'Web development',
      resource_kind: 'Gift',
      quantity: null
    });
    expect(failure(result)).toContain('names no resource');
  });

  it('accepts a term to be discussed, which names and counts nothing', () => {
    const result = decodeExchangeTerm({
      direction: 'Receive',
      resource_conforms_to: '',
      resource_kind: 'Tbd',
      quantity: null
    });
    expect(Either.isRight(result)).toBe(true);
  });

  it('refuses a quantity of zero', () => {
    const result = decodeExchangeTerm({ ...service, quantity: { value: 0, unit: 'hours' } });
    expect(failure(result)).toContain('greater than zero');
  });

  it('refuses a quantity with no unit', () => {
    const result = decodeExchangeTerm({ ...service, quantity: { value: 2, unit: '' } });
    expect(failure(result)).toContain('needs a unit');
  });
});

describe('create agreement input schema', () => {
  it('accepts a service settled in currency', () => {
    expect(Either.isRight(decodeCreateAgreementInput(agreement))).toBe(true);
  });

  it('refuses a primary term that is not the service provided', () => {
    const result = decodeCreateAgreementInput({
      ...agreement,
      primary: { ...service, direction: 'Receive' }
    });
    expect(failure(result)).toContain('primary term is the service provided');
  });

  it('refuses a primary term that is not a service', () => {
    const result = decodeCreateAgreementInput({ ...agreement, primary: currency });
    expect(failure(result)).toContain('primary term is the service provided');
  });

  it('refuses a reciprocal term flowing the wrong way', () => {
    const result = decodeCreateAgreementInput({
      ...agreement,
      reciprocal: { ...currency, direction: 'Provide' }
    });
    expect(failure(result)).toContain('what the provider receives');
  });

  it('refuses an agreement that names no medium', () => {
    const result = decodeCreateAgreementInput({ ...agreement, medium: '   ' });
    expect(failure(result)).toContain('how this exchange is settled');
  });
});

describe('review input schema', () => {
  it('accepts a rating inside the range the zome allows', () => {
    const result = decodeReviewInput({
      rating: 5,
      on_time: true,
      as_agreed: true,
      comment: 'Clear and on time.'
    });
    expect(Either.isRight(result)).toBe(true);
  });

  it('refuses a rating above five, which the zome would refuse', () => {
    const result = decodeReviewInput({
      rating: 6,
      on_time: true,
      as_agreed: true,
      comment: ''
    });
    expect(failure(result)).toContain('one to five stars');
  });

  it('refuses an unrated review', () => {
    const result = decodeReviewInput({ rating: 0, on_time: true, as_agreed: true, comment: '' });
    expect(failure(result)).toContain('one to five stars');
  });

  it('refuses half a star', () => {
    const result = decodeReviewInput({ rating: 4.5, on_time: true, as_agreed: true, comment: '' });
    expect(failure(result)).toContain('whole number');
  });
});

describe('create interest input schema', () => {
  it('accepts a listing hash and its type', () => {
    expect(
      Either.isRight(decodeCreateInterestInput({ listing: hash(1), listing_type: 'Request' }))
    ).toBe(true);
  });

  it('refuses a listing type the zome does not know', () => {
    expect(
      Either.isLeft(decodeCreateInterestInput({ listing: hash(1), listing_type: 'Barter' }))
    ).toBe(true);
  });
});
