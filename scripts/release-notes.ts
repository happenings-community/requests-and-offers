#!/usr/bin/env bun
/**
 * release-notes.ts — fill the release-notes template from the CHANGELOG.
 *
 * WHY THIS EXISTS
 *
 * The release note was written by hand at every release, from a CHANGELOG entry
 * that already said the same thing. Two copies of one text, and the note is the
 * copy readers see, so it is the one that drifted.
 *
 * WHAT IT REFUSES TO DO
 *
 * It does not summarise, re-slice or reword the CHANGELOG section. The section
 * is carried across whole. A generator that rewrites prose is a second author,
 * and then there are two versions of the truth again. Everything else on the
 * page (installation links, technical specifications) is derived from the tag
 * and the release manifest.
 */

import { readFileSync, writeFileSync } from 'node:fs';

export type ChangelogSection = {
  /** The `## [x.y.z] - date` heading's version. */
  version: string;
  /** The `### ...` headline inside the section, if it has one. */
  title: string;
  /** Everything under the version heading, headline included. */
  body: string;
};

/**
 * Pull one version's section out of a Keep a Changelog file.
 *
 * Anchored on `## [` because that is the only heading level the format reserves
 * for versions; `###` and `####` are free for the section's own structure, and
 * this project uses both.
 */
export const sectionFor = (changelog: string, version: string): ChangelogSection => {
  const lines = changelog.split('\n');
  const headingIndex = lines.findIndex((line) => line.startsWith(`## [${version}]`));
  if (headingIndex === -1) {
    throw new Error(
      `CHANGELOG.md has no '## [${version}]' section. Write the entry before tagging.`
    );
  }
  const rest = lines.slice(headingIndex + 1);
  const nextIndex = rest.findIndex((line) => line.startsWith('## ['));
  const body = (nextIndex === -1 ? rest : rest.slice(0, nextIndex)).join('\n').trim();
  if (body.length === 0) {
    throw new Error(`CHANGELOG.md section for ${version} is empty.`);
  }
  const headline = body.split('\n').find((line) => line.startsWith('### '));
  return { version, title: headline ? headline.slice(4).trim() : `v${version}`, body };
};

/** The version published immediately before this one, for the compare link. */
export const previousVersion = (changelog: string, version: string): string | undefined => {
  const versions = [...changelog.matchAll(/^## \[([^\]]+)\]/gm)].map((m) => m[1]);
  const index = versions.indexOf(version);
  if (index === -1 || index + 1 >= versions.length) return undefined;
  return versions[index + 1];
};

export type NotesInputs = {
  template: string;
  changelog: string;
  version: string;
  /** Parsed release-manifest.json; only the fields the note quotes. */
  manifest: { holochainVersion: string; network: { requestsAndOffersSeed: string } };
};

/**
 * The template file also documents itself, so only the marked region is the
 * template. Without this, the note would ship with the placeholder reference
 * table printed above it.
 */
export const templateBody = (file: string): string => {
  const begin = file.indexOf('<!-- template:begin -->');
  const end = file.indexOf('<!-- template:end -->');
  if (begin === -1 || end === -1 || end < begin) {
    throw new Error('release-notes template is missing its template:begin / template:end markers');
  }
  return file.slice(begin + '<!-- template:begin -->'.length, end).trim();
};

export const renderNotes = ({ template, changelog, version, manifest }: NotesInputs): string => {
  const section = sectionFor(changelog, version);
  const previous = previousVersion(changelog, version);

  const replacements: Record<string, string> = {
    RELEASE_TITLE: section.title,
    // The section carries its own headline, which the template renders as the
    // title, so it is dropped here rather than printed twice.
    CHANGELOG_BODY: section.body
      .split('\n')
      .filter((line, index, all) => !(index === all.indexOf(`### ${section.title}`)))
      .join('\n')
      .trim(),
    VERSION: version,
    PREV_VERSION: previous ?? version,
    NETWORK: manifest.network.requestsAndOffersSeed,
    HOLOCHAIN_VERSION: manifest.holochainVersion,
  };

  let rendered = templateBody(template);
  for (const [key, value] of Object.entries(replacements)) {
    rendered = rendered.split(`{${key}}`).join(value);
  }

  // A placeholder that survives means the template grew a field nobody fills,
  // and a release note with `{SOMETHING}` in it is worse than no note.
  const leftover = rendered.match(/\{[A-Z_]+\}/g);
  if (leftover) {
    throw new Error(`unfilled placeholders in the release note: ${[...new Set(leftover)].join(', ')}`);
  }
  if (!previous) {
    rendered = rendered.replace(/^.*\/compare\/.*$/m, '**Full Changelog**: see CHANGELOG.md');
  }
  return rendered.trim();
};

const flag = (argv: string[], name: string, fallback?: string): string => {
  const index = argv.indexOf(`--${name}`);
  if (index === -1 || !argv[index + 1]) {
    if (fallback !== undefined) return fallback;
    throw new Error(`missing --${name}`);
  }
  return argv[index + 1];
};

if (import.meta.main) {
  const argv = Bun.argv.slice(2);
  const root = flag(argv, 'root', process.cwd());
  const version = flag(argv, 'version');
  const notes = renderNotes({
    template: readFileSync(
      flag(argv, 'template', `${root}/documentation/templates/release-notes-template.md`),
      'utf8'
    ),
    changelog: readFileSync(flag(argv, 'changelog', `${root}/CHANGELOG.md`), 'utf8'),
    version,
    manifest: JSON.parse(readFileSync(flag(argv, 'manifest'), 'utf8')),
  });
  const out = flag(argv, 'out', '');
  if (out) {
    writeFileSync(out, `${notes}\n`);
    console.log(`wrote ${out}`);
  } else {
    console.log(notes);
  }
}
