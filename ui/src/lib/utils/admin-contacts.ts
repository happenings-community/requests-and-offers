import type { UIUser } from '$lib/types/ui';
import { isBlockedState } from '$lib/utils/profile-status';

/**
 * Why a member is contacting the administrators. One context for every way in, so
 * the same call can become an email here, a role message when messaging is
 * present, and a flag where the stewarding module is.
 *
 * - `general`: the button on every screen, about anything.
 * - `membership`: a pending, rejected or suspended member, from their status
 *   screen (#331).
 * - `about`: the button beside a listing or a profile, about that thing.
 */
export type ContactKind = 'general' | 'membership' | 'about';

/** What an `about` contact concerns, as the member sees it. */
export type ContactAbout = {
  type: 'request' | 'offer' | 'profile';
  /** The listing's title or the member's name. */
  title: string;
};

export type ContactContext = {
  kind: ContactKind;
  about?: ContactAbout;
  /** The screen it was sent from, as a path, so an administrator can find it. */
  from?: string;
};

const ABOUT_NOUN: Record<ContactAbout['type'], string> = {
  request: 'a request',
  offer: 'an offer',
  profile: 'a member profile'
};

/** The email subject for a context. */
export function contactSubject(context: ContactContext): string {
  switch (context.kind) {
    case 'membership':
      return 'My Requests & Offers membership';
    case 'about':
      return context.about
        ? `About ${ABOUT_NOUN[context.about.type]}: ${context.about.title}`
        : 'A question for the Requests & Offers administrators';
    case 'general':
      return 'A question for the Requests & Offers administrators';
  }
}

/**
 * The opening of the email body: what it is about and where it was sent from,
 * so the administrator need not ask. Empty when there is nothing to say.
 */
export function contactBody(context: ContactContext): string {
  const lines: string[] = [];
  if (context.about) {
    lines.push(`About ${ABOUT_NOUN[context.about.type]}: ${context.about.title}`);
  }
  if (context.from) {
    lines.push(`Sent from: ${context.from}`);
  }
  return lines.length > 0 ? `${lines.join('\n')}\n\n` : '';
}

/**
 * What happens when the member uses the modal, said plainly so it promises no
 * more than it does: an email from their own program, no record in the app,
 * and, when it is about someone, that person is not told.
 */
export function contactNotice(context: ContactContext): string {
  const base = 'An email address opens your own email program. The app keeps no record of it';
  if (context.about?.type === 'profile') {
    return `${base}, and the member you are writing about is not told.`;
  }
  if (context.about) {
    return `${base}, and the person who posted it is not told.`;
  }
  return `${base}.`;
}

/**
 * The context the footer's "Contact admin" sends. A pending, rejected or
 * suspended member is writing about their membership, whatever page they are
 * on; otherwise a page that shows a listing or a profile names it; otherwise
 * it is general.
 */
export function footerContext(
  statusType: string | null | undefined,
  about: ContactAbout | null,
  from: string
): ContactContext {
  if (statusType && isBlockedState(statusType)) return { kind: 'membership', from };
  if (about) return { kind: 'about', about, from };
  return { kind: 'general', from };
}

/** A mailto link to an administrator, with the subject and body filled in. */
export function adminMailto(email: string, context: ContactContext): string {
  const body = contactBody(context);
  const query = `subject=${encodeURIComponent(contactSubject(context))}`;
  return `mailto:${email}?${query}${body ? `&body=${encodeURIComponent(body)}` : ''}`;
}

/**
 * The administrators a member can actually reach: those whose profile gives an
 * email address or a phone number (#331). An administrator whose profile
 * couldn't be loaded carries neither, so is left out rather than shown with a
 * made-up address.
 */
export function contactableAdmins(admins: readonly UIUser[]): UIUser[] {
  return admins.filter((admin) => !!(admin.email?.trim() || admin.phone?.trim()));
}

/**
 * The message an administrator typed for an applicant, trimmed, or undefined
 * when left blank, so an empty rejection stores no reason.
 */
export function cleanReason(text: string | null | undefined): string | undefined {
  const reason = (text ?? '').trim();
  return reason.length > 0 ? reason : undefined;
}
