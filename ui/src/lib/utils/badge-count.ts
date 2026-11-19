/**
 * A badge's number, capped so it stays one small pill: "9+" past nine. Every badge on
 * the bar, the menu button, the drawer and the dropdowns shows its count through this,
 * so they read alike; the words a screen reader hears carry the full number.
 *
 * On its own, importing nothing, so a shared component can cap a number without
 * loading the stores that `navigation/nav-counts.svelte.ts` reads.
 */
export const shownCount = (n: number) => (n > 9 ? '9+' : String(n));
