import type { UIUser } from '$lib/types/ui';

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
 * The reason an administrator typed into a status prompt, trimmed, or
 * undefined when left blank, so an empty reject reason stores no reason.
 */
export function reasonFrom(data: FormData): string | undefined {
  const reason = String(data.get('reason') ?? '').trim();
  return reason.length > 0 ? reason : undefined;
}
