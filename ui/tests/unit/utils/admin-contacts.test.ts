import { describe, it, expect } from 'vitest';

import { contactableAdmins, cleanReason } from '$lib/utils/admin-contacts';
import type { UIUser } from '$lib/types/ui';

const admin = (over: Partial<UIUser>): UIUser =>
  ({
    original_action_hash: new Uint8Array([1]),
    previous_action_hash: new Uint8Array([1]),
    name: 'An Admin',
    nickname: 'admin',
    email: '',
    ...over
  }) as UIUser;

describe('contactableAdmins', () => {
  it('keeps administrators with an email or a phone number', () => {
    const withEmail = admin({ email: 'a@example.org' });
    const withPhone = admin({ phone: '+44 1206 000000' });
    expect(contactableAdmins([withEmail, withPhone])).toEqual([withEmail, withPhone]);
  });

  it('leaves out administrators with no contact details, such as an unloaded profile', () => {
    expect(contactableAdmins([admin({}), admin({ email: '   ', phone: '' })])).toEqual([]);
  });
});

describe('cleanReason', () => {
  it('returns the trimmed message', () => {
    expect(cleanReason('  Please add a short bio  ')).toBe('Please add a short bio');
  });

  it('is undefined when the message is blank or missing, so none is stored', () => {
    expect(cleanReason('   ')).toBeUndefined();
    expect(cleanReason('')).toBeUndefined();
    expect(cleanReason(undefined)).toBeUndefined();
  });
});
