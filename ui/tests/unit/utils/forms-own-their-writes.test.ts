import { describe, expect, it } from 'vitest';
import { globSync, readFileSync } from 'node:fs';

/**
 * ServiceTypeForm writes the service type itself, through
 * useServiceTypeFormManagement, and only then calls the page's onSubmitSuccess.
 * A page that writes again in that callback makes a second update from the same
 * previous action, which forks the service type's history: two updates where
 * there should be one. This reads the source, like store-effects-run.test.ts,
 * and fails when a page that renders ServiceTypeForm also calls the store's
 * create, suggest or update for service types.
 */

const pages = globSync('src/**/*.svelte').filter((file) =>
  /import\s+ServiceTypeForm\s+from/.test(readFileSync(file, 'utf8'))
);

const write = /serviceTypesStore\.(createServiceType|suggestServiceType|updateServiceType)\s*\(/;

describe('a page leaves the service type write to ServiceTypeForm', () => {
  it('finds the pages that render the form', () => {
    expect(pages.some((file) => file.includes('admin/service-types/[id]/edit'))).toBe(true);
  });

  it('never writes the service type again in a page that renders the form', () => {
    const offenders = pages.filter((file) => write.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
