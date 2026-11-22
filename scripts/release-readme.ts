/**
 * release-readme.ts — refuse a release whose README was not re-read for it.
 *
 * The README describes the project as a release leaves it: what ships, the
 * known gaps, what comes next. It drifted once already (messaging listed as in
 * progress after it shipped, #592), because nothing on the release path asked
 * anyone to read it.
 *
 * The README carries an invisible marker, `<!-- release-ready: X.Y.Z -->`,
 * which whoever re-reads it raises to the version being released. A tag whose
 * version differs from the marker is refused before the heavy suites run.
 * The marker proves the README was read for this release, not that it is right.
 */
import { readFileSync } from 'node:fs';

const MARKER = /<!--\s*release-ready:\s*(\S+?)\s*-->/g;

export type ReadmeVerdict = { ok: true } | { ok: false; reason: string };

/** The version the README says it was re-read for, or undefined. */
export const markedVersion = (readme: string): string | undefined => {
  const found = [...readme.matchAll(MARKER)].map((m) => m[1]);
  if (found.length > 1) {
    throw new Error(`README.md has ${found.length} release-ready markers; keep exactly one.`);
  }
  return found[0];
};

export const checkReadme = (readme: string, version: string): ReadmeVerdict => {
  const wanted = version.replace(/^v/, '');
  let marked: string | undefined;
  try {
    marked = markedVersion(readme);
  } catch (error) {
    return { ok: false, reason: (error as Error).message };
  }
  if (marked === undefined) {
    return {
      ok: false,
      reason: `README.md has no '<!-- release-ready: ${wanted} -->' marker. Re-read the README for ${wanted}, then add it.`
    };
  }
  if (marked.replace(/^v/, '') !== wanted) {
    return {
      ok: false,
      reason: `README.md was last re-read for ${marked}, not ${wanted}. Bring it up to date (tagline, Where the Project Stands, commands), then raise the marker to ${wanted}.`
    };
  }
  return { ok: true };
};

if (import.meta.main) {
  const argv = Bun.argv.slice(2);
  const at = argv.indexOf('--version');
  const version = at === -1 ? undefined : argv[at + 1];
  if (!version) {
    console.error('usage: bun scripts/release-readme.ts --version X.Y.Z [--readme README.md]');
    process.exit(2);
  }
  const readmeAt = argv.indexOf('--readme');
  const path = readmeAt === -1 ? 'README.md' : argv[readmeAt + 1];
  const verdict = checkReadme(readFileSync(path, 'utf8'), version);
  if (!verdict.ok) {
    console.error(verdict.reason);
    process.exit(1);
  }
  console.log(`README.md is marked ready for ${version.replace(/^v/, '')}.`);
}
