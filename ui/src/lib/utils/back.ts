/**
 * Where Back goes (Sam, 17 October): to the screen the member came from in the
 * app, or, when they arrived directly (a fresh start or a link from outside),
 * to a fallback the page names. Every back button follows this rule, through
 * `BackButton`.
 */
export function backTarget(cameFrom: URL | null | undefined, fallback: string): 'history' | string {
  return cameFrom ? 'history' : fallback;
}
