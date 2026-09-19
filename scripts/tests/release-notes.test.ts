import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { previousVersion, renderNotes, sectionFor, templateBody } from '../release-notes.ts';

const root = join(import.meta.dir, '..', '..');
const realTemplate = readFileSync(
  join(root, 'documentation', 'templates', 'release-notes-template.md'),
  'utf8'
);
const realChangelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');

const changelog = `# Changelog

## [0.7.0] - 2026-11-01

### 🚀 The Second One

Body of the second one.

#### Features

- something

## [0.6.0] - 2026-09-14

### 🚀 The First One

Body of the first one.
`;

const manifest = {
  holochainVersion: '0.6.1',
  network: { requestsAndOffersSeed: 'requests_and_offers_alpha' },
};

describe('sectionFor', () => {
  it('takes the section whole, stopping at the next version heading', () => {
    const section = sectionFor(changelog, '0.7.0');
    expect(section.title).toBe('🚀 The Second One');
    expect(section.body).toContain('Body of the second one.');
    expect(section.body).toContain('#### Features');
    expect(section.body).not.toContain('The First One');
  });

  it('reads the last section, which has no following heading', () => {
    expect(sectionFor(changelog, '0.6.0').body).toContain('Body of the first one.');
  });

  it('finds the real 0.6.0-alpha.1 entry in this repository', () => {
    expect(sectionFor(realChangelog, '0.6.0-alpha.1').title).toContain('Alpha Baseline Release');
  });

  it('stops the release when the version has no CHANGELOG entry', () => {
    expect(() => sectionFor(changelog, '0.9.9')).toThrow(/no '## \[0\.9\.9\]' section/);
  });
});

describe('previousVersion', () => {
  it('is the next version heading down the file', () => {
    expect(previousVersion(changelog, '0.7.0')).toBe('0.6.0');
  });

  it('is undefined for the oldest entry', () => {
    expect(previousVersion(changelog, '0.6.0')).toBeUndefined();
  });
});

describe('templateBody', () => {
  it('drops the template file own documentation', () => {
    const body = templateBody(realTemplate);
    expect(body).toContain('{RELEASE_TITLE}');
    expect(body).not.toContain('| Placeholder | Filled from |');
  });

  it('refuses a template with no markers rather than shipping its prose', () => {
    expect(() => templateBody('## {RELEASE_TITLE}')).toThrow(/template:begin/);
  });
});

describe('renderNotes', () => {
  it('fills every placeholder in the real template', () => {
    const notes = renderNotes({ template: realTemplate, changelog, version: '0.7.0', manifest });
    expect(notes).not.toMatch(/\{[A-Z_]+\}/);
    expect(notes).toContain('## 🚀 The Second One');
    expect(notes).toContain('Body of the second one.');
    expect(notes).toContain('**Network seed**: `requests_and_offers_alpha`');
    expect(notes).toContain('**Holochain**: 0.6.1');
    expect(notes).toContain('compare/v0.6.0...v0.7.0');
  });

  it('does not print the headline twice', () => {
    const notes = renderNotes({ template: realTemplate, changelog, version: '0.7.0', manifest });
    expect(notes.split('The Second One')).toHaveLength(2);
  });

  it('drops the compare link when there is no previous release', () => {
    const notes = renderNotes({ template: realTemplate, changelog, version: '0.6.0', manifest });
    expect(notes).not.toContain('/compare/');
    expect(notes).toContain('see CHANGELOG.md');
  });

  it('aborts on a placeholder nothing fills', () => {
    const template = '<!-- template:begin -->\n{RELEASE_TITLE} and {NOT_A_THING}\n<!-- template:end -->';
    expect(() => renderNotes({ template, changelog, version: '0.7.0', manifest })).toThrow(
      /unfilled placeholders.*\{NOT_A_THING\}/
    );
  });
});
