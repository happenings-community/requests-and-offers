/**
 * Who can see what, by profile state (#335).
 *
 * Listings, members and organisations are open to accepted members only.
 * Pending, rejected and suspended members, and anyone without a profile, see
 * the blocked view instead. This sets consistent disclosure inside the app; it
 * is not a security boundary, since a member's conductor still holds DHT data.
 * The real gate is a joining membrane (#165, #166).
 */

/**
 * A profile state as `ProfileGuard` names it: loading, missing, pending,
 * accepted, rejected, suspended_temporarily, suspended_indefinitely, unknown
 * or error.
 */
export type ProfileAccessState = string;

/** True when a member in this state may browse guarded pages. */
export function canBrowseFor(state: ProfileAccessState): boolean {
  if (state === 'accepted') return true;
  // Fallback: a network fault or timeout must not lock out an accepted member.
  return state === 'error' || state === 'unknown';
}

/**
 * A member's own profile pages stay open at every status: they are where a
 * profile is made, read and edited, including an applicant answering a
 * request for more information.
 */
export const OPEN_TO_ALL_PATHS: readonly string[] = ['/user', '/user/create', '/user/edit'];

export function isOpenToAll(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return OPEN_TO_ALL_PATHS.includes(path);
}
