import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { genericAdapter, roleLabel, roAdapter } from '../inspector-adapter.mts';
import { entryTypeName, zomeTypes } from '../inspector-types.mts';

const ROOT = join(import.meta.dir, '..', '..');

describe('the inspector core knows nothing of R&O', () => {
  it('names a type by its index when no adapter knows the zome', () => {
    const types = zomeTypes(['nondominium_integrity'], genericAdapter.zomeNames);
    expect(entryTypeName(types, 0, 2)).toBe('nondominium_integrity #2');
  });

  it('labels a role by its own name when the adapter has nothing for it', () => {
    expect(roleLabel(genericAdapter, 'resource')).toBe('resource');
    expect(genericAdapter.defaultRole).toBeUndefined();
  });

  it('keeps every R&O name out of the core files', () => {
    for (const file of ['inspector-server.mts', 'inspector-view.mts', 'inspector-graph.mts', 'inspector-types.mts', 'inspector.html']) {
      const src = readFileSync(join(ROOT, 'scripts', file), 'utf8');
      expect({ file, hits: src.match(/requests_and_offers|hrea_integrity|\bhREA\b|R&amp;O|R&O/g) ?? [] }).toEqual({ file, hits: [] });
    }
  });
});

describe('the R&O adapter', () => {
  it('names R&O types from this repository and hREA types from the pinned release', () => {
    const ro = zomeTypes(['users_organizations_integrity'], roAdapter.zomeNames);
    expect(ro[0].entries).toEqual(['User', 'Organization']);
    const hrea = zomeTypes(['hrea_integrity'], roAdapter.zomeNames);
    expect(hrea[0].entries).toContain('Commitment');
    expect(hrea[0].links).toContain('CommitmentToFulfillingEconomicEvents');
  });

  it('gives the page its title, its role labels and the role to open on', () => {
    expect(roAdapter.title).toContain('R&O');
    expect(roleLabel(roAdapter, 'hrea')).toBe('hREA');
    expect(roleLabel(roAdapter, 'requests_and_offers')).toBe('Requests & Offers');
    expect(roAdapter.defaultRole).toBe('requests_and_offers');
  });
});
