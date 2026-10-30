/**
 * Points the desktop wrapper's `kangaroo.config.ts` at one release of this hApp.
 *
 * The `desktop` job of `.github/workflows/release.yml` runs this inside a clone
 * of the wrapper's `release` branch. It sets the wrapper's `version` to the
 * release version and its `webhapp` block to this release's download URL and
 * digest, which the wrapper's `fetch:webhapp` step downloads and verifies.
 *
 * It has to be safe to run twice. The wrapper may already carry the version
 * (it is bumped in the wrapper's own pull request, as kangaroo #10 does), and a
 * re-run of the job finds the config already pointed at the release. Both are
 * normal, so "nothing changed" is reported, never treated as an error. The only
 * error is a config with no `version` field at all.
 */
import { readFileSync, writeFileSync } from 'node:fs';

export type WrapperTarget = { version: string; url: string; sha256: string };

// Anchored to the start of a line so `holochainVersion:` never matches.
const VERSION_FIELD = /^(\s*)version:\s*'[^']*',?$/m;
const WEBHAPP_BLOCK = /^\s*webhapp:\s*\{[^}]*\},?\n/m;

export const pointWrapperAt = (
  source: string,
  target: WrapperTarget
): { source: string; changed: boolean } => {
  const versionLine = source.match(VERSION_FIELD);
  if (!versionLine) throw new Error("no `version: '...'` field in the wrapper's kangaroo.config.ts");
  const indent = versionLine[1];

  const webhapp =
    `${indent}webhapp: {\n` +
    `${indent}  url: '${target.url}',\n` +
    `${indent}  sha256: '${target.sha256}',\n` +
    `${indent}},\n`;

  let next = source.replace(VERSION_FIELD, `${indent}version: '${target.version}',`);
  next = WEBHAPP_BLOCK.test(next)
    ? next.replace(WEBHAPP_BLOCK, webhapp)
    : next.replace(VERSION_FIELD, (line) => `${line}\n${webhapp.trimEnd()}`);

  return { source: next, changed: next !== source };
};

const flag = (argv: string[], name: string): string => {
  const index = argv.indexOf(`--${name}`);
  if (index === -1 || !argv[index + 1]) throw new Error(`missing --${name}`);
  return argv[index + 1];
};

if (import.meta.main) {
  const argv = Bun.argv.slice(2);
  const path = flag(argv, 'config');
  const result = pointWrapperAt(readFileSync(path, 'utf8'), {
    version: flag(argv, 'version'),
    url: flag(argv, 'url'),
    sha256: flag(argv, 'sha256'),
  });
  writeFileSync(path, result.source);
  console.log(result.changed ? `updated ${path}` : `${path} already points at this release`);
}
