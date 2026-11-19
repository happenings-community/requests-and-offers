/**
 * Where Back goes (Sam, 17 October): to the screen the member came from in the
 * app, or, when they arrived directly (a fresh start or a link from outside),
 * to a fallback the page names. Every back button follows this rule, through
 * `BackButton`.
 *
 * One exception (#349 review): coming back from this page's own edit form,
 * after Save or Cancel, is not somewhere to go back to, so Back goes to the
 * fallback, as it always did before this rule. Where a member lands after a
 * save is R122 in #346.
 */
export function backTarget(
  cameFrom: URL | null | undefined,
  fallback: string,
  here?: URL
): 'history' | string {
  if (!cameFrom) return fallback;
  if (here && cameFrom.pathname === `${here.pathname.replace(/\/+$/, '')}/edit`) return fallback;
  return 'history';
}
