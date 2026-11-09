import type { ContactAbout } from '$lib/utils/admin-contacts';

/**
 * What the page on screen shows, for the footer's "Contact admin": a request,
 * an offer or a member's profile, or nothing. Set by those pages while they
 * are open, and cleared when they close, so the email names what the member
 * was looking at.
 */
let about = $state<ContactAbout | null>(null);

export const contactAbout = {
  get current(): ContactAbout | null {
    return about;
  },
  set(value: ContactAbout | null): void {
    about = value;
  }
};
