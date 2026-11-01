import { describe, it, expect } from 'vitest';

import {
  adminMailto,
  cleanReason,
  contactableAdmins,
  contactBody,
  contactNotice,
  contactSubject,
  footerContext,
  type ContactContext
} from '$lib/utils/admin-contacts';
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

describe('contactSubject', () => {
  it('keeps the membership subject for a blocked member', () => {
    expect(contactSubject({ kind: 'membership' })).toBe('My Requests & Offers membership');
  });

  it('gives the button on every screen its own, general subject', () => {
    expect(contactSubject({ kind: 'general' })).toBe(
      'A question for the Requests & Offers administrators'
    );
  });

  it('names what an about contact concerns', () => {
    expect(contactSubject({ kind: 'about', about: { type: 'request', title: 'A lift' } })).toBe(
      'About a request: A lift'
    );
    expect(contactSubject({ kind: 'about', about: { type: 'offer', title: 'Gardening' } })).toBe(
      'About an offer: Gardening'
    );
    expect(contactSubject({ kind: 'about', about: { type: 'profile', title: 'Bob' } })).toBe(
      'About a member profile: Bob'
    );
  });
});

describe('contactBody', () => {
  it('says what it is about and where it was sent from', () => {
    const context: ContactContext = {
      kind: 'about',
      about: { type: 'offer', title: 'Gardening' },
      from: '/offers/uhCkk'
    };
    expect(contactBody(context)).toBe('About an offer: Gardening\nSent from: /offers/uhCkk\n\n');
  });

  it('is empty when there is nothing to say', () => {
    expect(contactBody({ kind: 'general' })).toBe('');
  });
});

describe('adminMailto', () => {
  it('fills in the subject, encoded, and leaves out an empty body', () => {
    expect(adminMailto('a@example.org', { kind: 'membership' })).toBe(
      'mailto:a@example.org?subject=My%20Requests%20%26%20Offers%20membership'
    );
  });

  it('adds the body when there is one', () => {
    const link = adminMailto('a@example.org', { kind: 'general', from: '/requests' });
    expect(link).toContain('&body=' + encodeURIComponent('Sent from: /requests\n\n'));
  });
});

describe('contactNotice', () => {
  it('promises no more than an email and no record', () => {
    expect(contactNotice({ kind: 'general' })).toBe(
      'An email address opens your own email program. The app keeps no record of it.'
    );
  });

  it('says the person concerned is not told', () => {
    expect(contactNotice({ kind: 'about', about: { type: 'profile', title: 'Bob' } })).toContain(
      'the member you are writing about is not told'
    );
    expect(contactNotice({ kind: 'about', about: { type: 'request', title: 'A lift' } })).toContain(
      'the person who posted it is not told'
    );
  });
});

describe('footerContext', () => {
  const lift = { type: 'request' as const, title: 'A lift' };

  it('is about membership for a blocked member, on any page', () => {
    for (const status of [
      'pending',
      'rejected',
      'suspended_temporarily',
      'suspended_indefinitely'
    ]) {
      expect(footerContext(status, lift, '/requests/x')).toEqual({
        kind: 'membership',
        from: '/requests/x'
      });
    }
  });

  it('names what the page shows for an accepted member', () => {
    expect(footerContext('accepted', lift, '/requests/x')).toEqual({
      kind: 'about',
      about: lift,
      from: '/requests/x'
    });
  });

  it('is general where the page shows nothing in particular', () => {
    expect(footerContext('accepted', null, '/')).toEqual({ kind: 'general', from: '/' });
    expect(footerContext(undefined, null, '/')).toEqual({ kind: 'general', from: '/' });
  });
});
