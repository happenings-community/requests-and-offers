#!/usr/bin/env bun
/**
 * check-zome-labels.ts: warn when a pull request's labels do not match the
 * zomes it touches.
 *
 * WHY THIS EXISTS
 *
 * Only an integrity zome change alters the DNA hash. A coordinator change does
 * not. A pull request that moves the hash without saying so ships a network
 * reset to every member as a surprise, so the label has to be there before the
 * merge, not discovered after it.
 *
 *   integrity paths   -> expect `breaking-change` and `zome:integrity`
 *   coordinator paths -> suggest `zome:coordinator`
 *
 * WHAT IT REFUSES TO DO
 *
 * It never fails on a missing label. The decision was "warns": a warning
 * annotation and a job summary, exit 0. It does fail when it cannot read the
 * file list, because a check that cannot go red when it is blind is not a check.
 *
 * It reads paths from the API and nothing else. It checks out no pull request
 * code and runs none, so it is safe on a fork.
 */

import { appendFileSync } from 'node:fs';

export const INTEGRITY = /^dnas\/[^/]+\/zomes\/integrity\/.+/;
export const COORDINATOR = /^dnas\/[^/]+\/zomes\/coordinator\/.+/;

export const BREAKING = 'breaking-change';
export const ZOME_INTEGRITY = 'zome:integrity';
export const ZOME_COORDINATOR = 'zome:coordinator';

export type Verdict = {
  integrityPaths: string[];
  coordinatorPaths: string[];
  /** Labels that should be on the pull request and are not. */
  missing: string[];
  /** Labels that would help and are not required. */
  suggested: string[];
};

/**
 * Pure: the changed paths and the current labels in, the verdict out.
 * A rename reports both its old and new path to the caller, so a file moved out
 * of an integrity zome still counts as touching it.
 */
export function evaluate(paths: string[], labels: string[]): Verdict {
  const have = new Set(labels);
  const unique = [...new Set(paths)];
  const integrityPaths = unique.filter((p) => INTEGRITY.test(p));
  const coordinatorPaths = unique.filter((p) => COORDINATOR.test(p));

  const missing = integrityPaths.length
    ? [BREAKING, ZOME_INTEGRITY].filter((l) => !have.has(l))
    : [];
  const suggested =
    coordinatorPaths.length && !have.has(ZOME_COORDINATOR) ? [ZOME_COORDINATOR] : [];

  return { integrityPaths, coordinatorPaths, missing, suggested };
}

const LIST_LIMIT = 15;

function list(paths: string[]): string {
  const shown = paths.slice(0, LIST_LIMIT).map((p) => `- \`${p}\``);
  if (paths.length > LIST_LIMIT) shown.push(`- and ${paths.length - LIST_LIMIT} more`);
  return shown.join('\n');
}

/** The job summary, in markdown. Always written, so a green run still says what it saw. */
export function renderSummary(v: Verdict): string {
  const out = ['## Zome label check', ''];
  if (!v.integrityPaths.length && !v.coordinatorPaths.length) {
    out.push('This pull request touches no zome. Nothing to check.');
    return out.join('\n') + '\n';
  }
  if (v.integrityPaths.length) {
    out.push(
      `Integrity zome paths changed (${v.integrityPaths.length}). This alters the DNA hash and needs a network reset or a migration.`,
      '',
      list(v.integrityPaths),
      ''
    );
    out.push(
      v.missing.length
        ? `**Missing labels:** ${v.missing.map((l) => `\`${l}\``).join(', ')}. This is a warning, not a failure.`
        : `Labels \`${BREAKING}\` and \`${ZOME_INTEGRITY}\` are present.`,
      ''
    );
  }
  if (v.coordinatorPaths.length) {
    out.push(
      `Coordinator zome paths changed (${v.coordinatorPaths.length}). The DNA hash does not move.`,
      '',
      list(v.coordinatorPaths),
      ''
    );
    out.push(
      v.suggested.length
        ? `**Suggested label:** \`${ZOME_COORDINATOR}\`.`
        : `Label \`${ZOME_COORDINATOR}\` is present.`,
      ''
    );
  }
  return out.join('\n');
}

/** GitHub Actions workflow commands, one per finding. */
export function renderAnnotations(v: Verdict): string[] {
  const lines: string[] = [];
  if (v.missing.length) {
    lines.push(
      `::warning title=Integrity zome changed::This pull request changes an integrity zome, which alters the DNA hash. Add the ${v.missing.map((l) => `'${l}'`).join(' and ')} label${v.missing.length > 1 ? 's' : ''}.`
    );
  }
  if (v.suggested.length) {
    lines.push(
      `::notice title=Coordinator zome changed::Consider the '${ZOME_COORDINATOR}' label. The DNA hash does not move.`
    );
  }
  return lines;
}

type ApiFile = { filename: string; previous_filename?: string };

/** Every changed path of the pull request, paged, renames counted on both sides. */
export async function fetchPaths(
  repo: string,
  pr: number,
  token: string,
  fetchImpl: typeof fetch = fetch,
  apiUrl = 'https://api.github.com'
): Promise<string[]> {
  const paths: string[] = [];
  // The API serves at most 3000 files, 100 a page.
  for (let page = 1; page <= 30; page++) {
    const res = await fetchImpl(
      `${apiUrl}/repos/${repo}/pulls/${pr}/files?per_page=100&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    );
    if (!res.ok) throw new Error(`GitHub API ${res.status} on pull request ${pr} files page ${page}`);
    const files = (await res.json()) as ApiFile[];
    for (const f of files) {
      paths.push(f.filename);
      if (f.previous_filename) paths.push(f.previous_filename);
    }
    if (files.length < 100) break;
  }
  return paths;
}

async function main(): Promise<void> {
  const { GITHUB_REPOSITORY, GH_TOKEN, PR_NUMBER, PR_LABELS, GITHUB_STEP_SUMMARY, GITHUB_API_URL } =
    process.env;
  if (!GITHUB_REPOSITORY || !GH_TOKEN || !PR_NUMBER) {
    throw new Error('GITHUB_REPOSITORY, GH_TOKEN and PR_NUMBER are required');
  }
  const labels = (JSON.parse(PR_LABELS || '[]') as string[]).map(String);
  const paths = await fetchPaths(
    GITHUB_REPOSITORY,
    Number(PR_NUMBER),
    GH_TOKEN,
    fetch,
    GITHUB_API_URL || undefined
  );
  const verdict = evaluate(paths, labels);

  for (const line of renderAnnotations(verdict)) console.log(line);
  const summary = renderSummary(verdict);
  console.log(summary);
  if (GITHUB_STEP_SUMMARY) appendFileSync(GITHUB_STEP_SUMMARY, summary);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(`::error title=Zome label check could not run::${(err as Error).message}`);
    process.exit(1);
  });
}
