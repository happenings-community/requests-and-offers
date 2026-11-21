import { describe, expect, it } from 'bun:test';
import {
  evaluate,
  fetchPaths,
  renderAnnotations,
  renderSummary
} from '../check-zome-labels.ts';

const integrity = 'dnas/requests_and_offers/zomes/integrity/offers/src/lib.rs';
const integrityToml = 'dnas/requests_and_offers/zomes/integrity/offers/Cargo.toml';
const coordinator = 'dnas/requests_and_offers/zomes/coordinator/offers/src/offer.rs';

describe('evaluate', () => {
  it('asks for both labels on an integrity change', () => {
    const v = evaluate([integrity], []);
    expect(v.missing).toEqual(['breaking-change', 'zome:integrity']);
    expect(v.suggested).toEqual([]);
  });

  it('asks only for what is missing', () => {
    expect(evaluate([integrity], ['breaking-change']).missing).toEqual(['zome:integrity']);
    expect(evaluate([integrity], ['zome:integrity']).missing).toEqual(['breaking-change']);
  });

  it('is quiet when both labels are there', () => {
    expect(evaluate([integrity], ['breaking-change', 'zome:integrity']).missing).toEqual([]);
  });

  it('counts a manifest inside an integrity zome', () => {
    expect(evaluate([integrityToml], []).integrityPaths).toEqual([integrityToml]);
  });

  it('suggests zome:coordinator on a coordinator change and never requires breaking-change', () => {
    const v = evaluate([coordinator], []);
    expect(v.missing).toEqual([]);
    expect(v.suggested).toEqual(['zome:coordinator']);
    expect(evaluate([coordinator], ['zome:coordinator']).suggested).toEqual([]);
  });

  it('handles a mixed pull request', () => {
    const v = evaluate([integrity, coordinator], ['zome:coordinator']);
    expect(v.missing).toEqual(['breaking-change', 'zome:integrity']);
    expect(v.suggested).toEqual([]);
  });

  it('works for any DNA directory name', () => {
    expect(evaluate(['dnas/other_dna/zomes/integrity/x/src/lib.rs'], []).missing.length).toBe(2);
  });

  it('ignores everything that is not a zome', () => {
    const v = evaluate(
      [
        'ui/src/lib/services/zomes/offers.service.ts',
        'dnas/requests_and_offers/dna.yaml',
        'dnas/requests_and_offers/zomes/integrity',
        'dnas/requests_and_offers/zomes/integrity_notes/readme.md',
        'documentation/zomes/integrity/overview.md',
        'tests/sweettest/src/integrity/mod.rs'
      ],
      []
    );
    expect(v.integrityPaths).toEqual([]);
    expect(v.coordinatorPaths).toEqual([]);
    expect(v.missing).toEqual([]);
  });

  it('does not treat a label name as a path match or the reverse', () => {
    expect(evaluate([], ['zome:integrity', 'breaking-change'])).toEqual({
      integrityPaths: [],
      coordinatorPaths: [],
      missing: [],
      suggested: []
    });
  });

  it('deduplicates paths', () => {
    expect(evaluate([integrity, integrity], []).integrityPaths).toEqual([integrity]);
  });
});

describe('rendering', () => {
  it('emits a warning annotation naming the missing labels, never an error', () => {
    const lines = renderAnnotations(evaluate([integrity], ['breaking-change']));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toStartWith('::warning ');
    expect(lines[0]).toContain("'zome:integrity'");
    expect(lines[0]).not.toContain("'breaking-change'");
  });

  it('emits a notice, not a warning, for the coordinator suggestion', () => {
    const lines = renderAnnotations(evaluate([coordinator], []));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toStartWith('::notice ');
  });

  it('emits nothing when the labels are right', () => {
    expect(renderAnnotations(evaluate([integrity], ['breaking-change', 'zome:integrity']))).toEqual([]);
  });

  it('writes a summary even when there is nothing to say', () => {
    expect(renderSummary(evaluate(['README.md'], []))).toContain('touches no zome');
  });

  it('lists paths and truncates long lists', () => {
    const many = Array.from({ length: 20 }, (_, i) => `dnas/d/zomes/integrity/z/src/f${i}.rs`);
    const s = renderSummary(evaluate(many, []));
    expect(s).toContain('f0.rs');
    expect(s).toContain('and 5 more');
    expect(s).toContain('`breaking-change`, `zome:integrity`');
  });
});

describe('fetchPaths', () => {
  const page = (n: number, prefix: string) =>
    Array.from({ length: n }, (_, i) => ({ filename: `${prefix}${i}` }));

  it('pages until a short page and reports both sides of a rename', async () => {
    const calls: string[] = [];
    const fake = (async (url: string) => {
      calls.push(url);
      const p = Number(new URL(url).searchParams.get('page'));
      const body =
        p === 1
          ? page(100, 'a')
          : [{ filename: 'new/path.rs', previous_filename: integrity }];
      return new Response(JSON.stringify(body), { status: 200 });
    }) as unknown as typeof fetch;
    const paths = await fetchPaths('o/r', 7, 'tok', fake);
    expect(calls).toHaveLength(2);
    expect(paths).toHaveLength(102);
    expect(evaluate(paths, []).missing).toEqual(['breaking-change', 'zome:integrity']);
  });

  it('fails loudly when the API refuses', async () => {
    const fake = (async () => new Response('no', { status: 403 })) as unknown as typeof fetch;
    await expect(fetchPaths('o/r', 7, 'tok', fake)).rejects.toThrow('403');
  });
});
