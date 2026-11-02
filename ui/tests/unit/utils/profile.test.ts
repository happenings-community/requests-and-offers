import { describe, expect, it } from 'vitest';
import type { UIExchange, UIStatus, UIUser } from '$lib/types/ui';
import { detailsLine, exchangesWith, exchangesWithLabel, statusChip } from '$lib/utils/profile';

const hash = (n: number) => new Uint8Array([132, 41, 36, n]);
const status = (s: Partial<UIStatus>) =>
  ({ original_action_hash: hash(90), previous_action_hash: hash(90), ...s }) as UIStatus;

describe('statusChip', () => {
  it('colours each status by what it means', () => {
    expect(statusChip(status({ status_type: 'accepted' }))).toEqual({
      label: 'Accepted',
      variant: 'variant-soft-success'
    });
    expect(statusChip(status({ status_type: 'pending' }))?.variant).toBe('variant-soft-warning');
    expect(statusChip(status({ status_type: 'rejected' }))?.variant).toBe('variant-soft-error');
    expect(statusChip(status({ status_type: 'suspended indefinitely' }))).toEqual({
      label: 'Suspended',
      variant: 'variant-soft-error'
    });
  });

  it('gives the end of a temporary suspension', () => {
    const chip = statusChip(
      status({ status_type: 'suspended temporarily', suspended_until: '2026-11-01T12:00:00Z' }),
      Date.parse('2026-10-18T00:00:00Z')
    );
    expect(chip?.label).toBe('Suspended');
    expect(chip?.variant).toBe('variant-soft-error');
    expect(chip?.until).toMatch(/2026/);
  });

  it('reads a temporary suspension that has ended as in review', () => {
    expect(
      statusChip(
        status({ status_type: 'suspended temporarily', suspended_until: '2026-10-01T00:00:00Z' }),
        Date.parse('2026-10-18T00:00:00Z')
      )
    ).toEqual({ label: 'In review', variant: 'variant-soft-warning' });
  });

  it('shows nothing without a status', () => {
    expect(statusChip(undefined)).toBeNull();
  });
});

describe('detailsLine', () => {
  const user = (u: Partial<UIUser>) => ({ user_type: 'creator', ...u }) as UIUser;

  it('gives type, location and time zone in order', () => {
    expect(detailsLine(user({ location: 'Colchester', time_zone: 'Europe/London' }))).toEqual([
      'Creator',
      'Colchester',
      'Europe/London'
    ]);
  });

  it('leaves out what is not set', () => {
    expect(detailsLine(user({ user_type: 'advocate' }))).toEqual(['Advocate']);
  });
});

describe('exchangesWith', () => {
  const me = hash(1);
  const sam = hash(2);
  const ana = hash(3);
  const exchange = (provider: Uint8Array, receiver: Uint8Array) =>
    ({ agreement: { provider, receiver } }) as unknown as UIExchange;
  const mine = [exchange(me, sam), exchange(ana, me), exchange(sam, me)];

  it('keeps my exchanges with that member, either side', () => {
    expect(exchangesWith(mine, me, sam)).toHaveLength(2);
    expect(exchangesWith(mine, me, ana)).toHaveLength(1);
  });

  it('finds none on my own profile, or before I am known', () => {
    expect(exchangesWith(mine, me, me)).toEqual([]);
    expect(exchangesWith(mine, undefined, sam)).toEqual([]);
  });

  it('says one exchange or several', () => {
    expect(exchangesWithLabel(1)).toBe('1 exchange with you');
    expect(exchangesWithLabel(3)).toBe('3 exchanges with you');
  });
});
