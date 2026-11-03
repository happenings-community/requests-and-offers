import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { roleGraph, type CellDump } from '../inspector-graph.mts';
import { zomeTypes } from '../inspector-types.mts';
import { collapseTypes, focusSet, groupId, neighbourOrder, visibleGraph } from '../inspector-view.mts';

// The same real two-member capture the graph model is tested on.
const fixture = JSON.parse(
  readFileSync(join(import.meta.dir, 'fixtures', 'inspector-exchange.json'), 'utf8'),
  (_k, v) => (v && typeof v === 'object' && typeof v.$bytes === 'string' ? new Uint8Array(Buffer.from(v.$bytes, 'base64')) : v)
) as { apps: Array<{ installed_app_id: string; agent_pub_key: Uint8Array }>; cells: Record<string, CellDump> };
const cellsOf = (role: string) =>
  fixture.apps.map((a) => ({ agentKey: a.agent_pub_key, dump: fixture.cells[`${a.installed_app_id}/${role}`] }));
const hrea = roleGraph('hrea', cellsOf('hrea'), zomeTypes(['hrea_integrity'], () => null));
const count = (t: string) => hrea.nodes.filter((n) => n.entryType === t).length;

describe('collapsing a large type into one counted node', () => {
  const view = collapseTypes(hrea, { threshold: 6, expanded: new Set() });

  it('replaces every type above the threshold with one group node carrying its count', () => {
    expect(count('ResourceSpecification')).toBeGreaterThan(6);
    const group = view.nodes.find((n) => n.id === groupId('ResourceSpecification'))!;
    expect(group.kind).toBe('group');
    expect(group.count).toBe(count('ResourceSpecification'));
    expect(view.nodes.some((n) => n.entryType === 'ResourceSpecification' && n.kind !== 'group')).toBe(false);
  });

  it('leaves the types at or under the threshold, and every agent, as they were', () => {
    for (const t of ['Agreement', 'Commitment', 'EconomicEvent', 'Proposal', 'Intent']) {
      expect(view.nodes.filter((n) => n.entryType === t && n.kind === 'entry').length).toBe(count(t));
    }
    expect(view.nodes.filter((n) => n.kind === 'agent').length).toBe(hrea.nodes.filter((n) => n.kind === 'agent').length);
  });

  it('redirects edges into the group, one edge per source and label, never one onto itself', () => {
    const into = view.edges.filter((e) => e.target === groupId('ResourceSpecification'));
    expect(into.length).toBeGreaterThan(0);
    const keys = view.edges.map((e) => `${e.source}|${e.target}|${e.label}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(view.edges.some((e) => e.source === e.target)).toBe(false);
    for (const e of view.edges) {
      expect(view.nodes.some((n) => n.id === e.source)).toBe(true);
      expect(view.nodes.some((n) => n.id === e.target)).toBe(true);
    }
  });

  it('opens a type again once it is expanded', () => {
    const open = collapseTypes(hrea, { threshold: 6, expanded: new Set(['ResourceSpecification']) });
    expect(open.nodes.some((n) => n.id === groupId('ResourceSpecification'))).toBe(false);
    expect(open.nodes.filter((n) => n.entryType === 'ResourceSpecification').length).toBe(count('ResourceSpecification'));
  });
});

describe('focus and keyboard navigation', () => {
  const [commitment] = hrea.nodes.filter((n) => n.entryType === 'Commitment');

  it('focuses a node with exactly its neighbours, either direction, at depth one', () => {
    const set = focusSet(hrea.edges, commitment.id, 1);
    const expected = new Set([commitment.id]);
    for (const e of hrea.edges) {
      if (e.source === commitment.id) expected.add(e.target);
      if (e.target === commitment.id) expected.add(e.source);
    }
    expect(set).toEqual(expected);
    expect(set.size).toBeGreaterThan(1);
  });

  it('grows the focus by one hop per level of depth', () => {
    expect(focusSet(hrea.edges, commitment.id, 2).size).toBeGreaterThanOrEqual(focusSet(hrea.edges, commitment.id, 1).size);
  });

  it('orders the neighbours the arrow keys step through, stably, without the node itself', () => {
    const order = neighbourOrder(hrea.edges, commitment.id, (id) => hrea.nodes.find((n) => n.id === id)?.label ?? id);
    expect(order).not.toContain(commitment.id);
    expect(new Set(order)).toEqual(new Set([...focusSet(hrea.edges, commitment.id, 1)].filter((id) => id !== commitment.id)));
    expect(neighbourOrder(hrea.edges, commitment.id, (id) => id)).toEqual(neighbourOrder(hrea.edges, commitment.id, (id) => id));
  });
});

describe('what the filters leave on screen', () => {
  it('drops hidden types and the edges that touch them', () => {
    const v = visibleGraph(hrea, { hiddenTypes: new Set(['Unit']), hideUnlinked: false });
    expect(v.nodes.some((n) => n.entryType === 'Unit')).toBe(false);
    for (const e of v.edges) expect(v.nodes.some((n) => n.id === e.source) && v.nodes.some((n) => n.id === e.target)).toBe(true);
  });

  it('drops the records nothing links to or from when asked', () => {
    const v = visibleGraph(hrea, { hiddenTypes: new Set(), hideUnlinked: true });
    const linked = new Set(hrea.edges.flatMap((e) => [e.source, e.target]));
    expect(v.nodes.every((n) => linked.has(n.id))).toBe(true);
    expect(v.nodes.length).toBeLessThan(hrea.nodes.length);
  });
});
