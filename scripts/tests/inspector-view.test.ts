import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { roleGraph, type CellDump } from '../inspector-graph.mts';
import { zomeTypes } from '../inspector-types.mts';
import { roAdapter } from '../inspector-adapter.mts';
import {
  autoFit,
  clusteredLayout,
  clusterId,
  collapseTypes,
  fitView,
  focusSet,
  groupId,
  LAYOUT,
  neighbourOrder,
  typeOrder,
  visibleGraph,
  VIEW,
  wheelZoom,
  type FitTrigger,
  type Graph
} from '../inspector-view.mts';

// The same real two-member capture the graph model is tested on.
const fixture = JSON.parse(
  readFileSync(join(import.meta.dir, 'fixtures', 'inspector-exchange.json'), 'utf8'),
  (_k, v) => (v && typeof v === 'object' && typeof v.$bytes === 'string' ? new Uint8Array(Buffer.from(v.$bytes, 'base64')) : v)
) as { apps: Array<{ installed_app_id: string; agent_pub_key: Uint8Array }>; cells: Record<string, CellDump> };
const cellsOf = (role: string) =>
  fixture.apps.map((a) => ({ agentKey: a.agent_pub_key, dump: fixture.cells[`${a.installed_app_id}/${role}`] }));
const hrea = roleGraph('hrea', cellsOf('hrea'), zomeTypes(['hrea_integrity'], roAdapter.zomeNames));
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

describe('the clustered layout', () => {
  // What the page lays out by default: unlinked records off, large types grouped.
  const onScreen = collapseTypes(visibleGraph(hrea, { hiddenTypes: new Set(), hideUnlinked: true }), { threshold: 6, expanded: new Set() });
  const everything = hrea as unknown as Graph;
  const cases: Array<[string, Graph]> = [['the default view', onScreen], ['every record, nothing grouped', everything]];

  for (const [name, graph] of cases) {
    describe(name, () => {
      const { positions, clusters } = clusteredLayout(graph);

      it('places every node, and only those', () => {
        expect(new Set(positions.keys())).toEqual(new Set(graph.nodes.map((n) => n.id)));
      });

      it('never puts two nodes, or their labels, closer than one cell', () => {
        const ps = [...positions.values()];
        for (let i = 0; i < ps.length; i++) {
          for (let j = i + 1; j < ps.length; j++) {
            const apart = Math.abs(ps[i].x - ps[j].x) >= LAYOUT.cellWidth || Math.abs(ps[i].y - ps[j].y) >= LAYOUT.cellHeight;
            expect(apart).toBe(true);
          }
        }
      });

      it('keeps each entry type in one block of its own, and the blocks apart', () => {
        const typeOf = new Map(graph.nodes.map((n) => [n.id, n.entryType]));
        expect(clusters.map((c) => c.entryType).sort()).toEqual([...new Set(graph.nodes.map((n) => n.entryType))].sort());
        for (const c of clusters) {
          for (const id of c.ids) {
            expect(typeOf.get(id)).toBe(c.entryType);
            const p = positions.get(id)!;
            expect(p.x).toBeGreaterThan(c.x);
            expect(p.x).toBeLessThan(c.x + c.width);
            expect(p.y).toBeGreaterThan(c.y);
            expect(p.y).toBeLessThan(c.y + c.height);
          }
        }
        for (let i = 0; i < clusters.length; i++) {
          for (let j = i + 1; j < clusters.length; j++) {
            const [a, b] = [clusters[i], clusters[j]];
            const apart = a.x + a.width + LAYOUT.gap <= b.x || b.x + b.width + LAYOUT.gap <= a.x || a.y + a.height + LAYOUT.gap <= b.y || b.y + b.height + LAYOUT.gap <= a.y;
            expect(apart).toBe(true);
          }
        }
      });

      it('frames a block of two or more records, and leaves a lone node unframed', () => {
        for (const c of clusters) expect(c.parent).toBe(c.ids.length > 1 ? clusterId(c.entryType) : null);
      });

      it('gives the same graph the same positions, whatever order its nodes and edges come in', () => {
        const shuffled: Graph = { nodes: [...graph.nodes].reverse(), edges: [...graph.edges].reverse() };
        expect(clusteredLayout(shuffled).positions).toEqual(positions);
        expect(clusteredLayout(graph).positions).toEqual(positions);
      });
    });
  }

  it('lays the types that point at each other side by side', () => {
    const order = typeOrder(onScreen);
    expect(new Set(order)).toEqual(new Set(onScreen.nodes.map((n) => n.entryType)));
    // Every type after the first is linked to one laid before it, when any such link exists.
    const typeOf = new Map(onScreen.nodes.map((n) => [n.id, n.entryType]));
    const pairs = new Set(onScreen.edges.map((e) => [typeOf.get(e.source), typeOf.get(e.target)].sort().join('|')));
    const linked = (a: string, b: string) => pairs.has([a, b].sort().join('|'));
    const touches = (t: string, laid: string[]) => laid.some((u) => linked(u, t));
    let checked = 0;
    for (let i = 1; i < order.length; i++) {
      const laid = order.slice(0, i);
      // Whenever a type still to lay is linked to those laid, the next one laid is such a type.
      if (order.slice(i).some((t) => touches(t, laid))) {
        expect(touches(order[i], laid)).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('adds a new record at the end of its block, moving no other block', () => {
    const t = 'Commitment';
    const base = visibleGraph(hrea, { hiddenTypes: new Set(), hideUnlinked: false });
    const last = base.nodes.filter((n) => n.entryType === t).at(-1)!;
    const before = clusteredLayout(base);
    const grown: Graph = { nodes: [...base.nodes, { ...last, id: `${last.id}-new`, createdAt: '9999-12-31T00:00:00Z' }], edges: base.edges };
    const after = clusteredLayout(grown);
    const block = after.clusters.find((c) => c.entryType === t)!;
    expect(block.ids.at(-1)).toBe(`${last.id}-new`);
    const sameSize = before.clusters.find((c) => c.entryType === t)!.height === block.height;
    if (sameSize) for (const [id, p] of before.positions) expect(after.positions.get(id)).toEqual(p);
  });
});

describe('packing the blocks', () => {
  // The live hREA DNA of the #474 browser check: two agents and five units, nothing linked.
  const node = (id: string, entryType: string): Graph['nodes'][number] => ({ id, kind: entryType === 'Agent' ? 'agent' : 'entry', entryType, label: id, createdAt: id });
  const agentsAndUnits: Graph = {
    nodes: [node('a1', 'Agent'), node('a2', 'Agent'), ...['u1', 'u2', 'u3', 'u4', 'u5'].map((id) => node(id, 'Unit'))],
    edges: []
  };
  const bounds = (clusters: ReturnType<typeof clusteredLayout>['clusters']) => ({
    width: Math.max(...clusters.map((c) => c.x + c.width)),
    height: Math.max(...clusters.map((c) => c.y + c.height))
  });

  it('puts two blocks side by side, not one above the other', () => {
    const [a, b] = clusteredLayout(agentsAndUnits).clusters;
    expect(a.y).toBe(b.y);
    expect(b.x).toBe(a.x + a.width + LAYOUT.gap);
  });

  it('picks the row width whose overall shape is closest to the pane, among every width the blocks allow', () => {
    for (const graph of [agentsAndUnits, hrea as unknown as Graph]) {
      const { clusters } = clusteredLayout(graph);
      const misfit = (w: number, h: number) => Math.abs(Math.log(w / h / LAYOUT.aspect));
      const got = bounds(clusters);
      // Stacking every block is always one of the candidates, so the result is never worse than it.
      const stacked = { width: Math.max(...clusters.map((c) => c.width)), height: clusters.reduce((a, c) => a + c.height, 0) + LAYOUT.gap * (clusters.length - 1) };
      expect(misfit(got.width, got.height)).toBeLessThanOrEqual(misfit(stacked.width, stacked.height) + 1e-9);
    }
  });

  it('keeps one block where it is: a lone type sits at the origin', () => {
    const { clusters } = clusteredLayout({ nodes: [node('u1', 'Unit'), node('u2', 'Unit')], edges: [] });
    expect(clusters).toHaveLength(1);
    expect([clusters[0].x, clusters[0].y]).toEqual([0, 0]);
  });
});

describe('fitting the view', () => {
  it('centres the box and fits it inside the padding', () => {
    const box = { x1: -500, y1: 200, w: 2000, h: 600 };
    const v = fitView(box, 1000, 800);
    expect(v.zoom).toBeCloseTo((1000 - 2 * VIEW.padding) / 2000);
    expect(v.pan.x + v.zoom * (box.x1 + box.w / 2)).toBeCloseTo(500);
    expect(v.pan.y + v.zoom * (box.y1 + box.h / 2)).toBeCloseTo(400);
    expect(v.zoom * box.h).toBeLessThanOrEqual(800 - 2 * VIEW.padding);
  });

  it('never zooms a small graph past the ceiling, nor a single point', () => {
    expect(fitView({ x1: 0, y1: 0, w: 60, h: 40 }, 1200, 900).zoom).toBe(VIEW.fitCeiling);
    expect(fitView({ x1: 10, y1: 10, w: 0, h: 0 }, 1200, 900).zoom).toBe(VIEW.fitCeiling);
  });

  it('stops at the minimum zoom for a huge graph', () => {
    expect(fitView({ x1: 0, y1: 0, w: 1e6, h: 1e6 }, 1000, 800).zoom).toBe(VIEW.minZoom);
  });
});

describe('wheel and trackpad zoom', () => {
  it('zooms in for a wheel up and out for a wheel down, by the same factor', () => {
    const inn = wheelZoom(1, { deltaY: -100 });
    const out = wheelZoom(1, { deltaY: 100 });
    expect(inn).toBeGreaterThan(1);
    expect(out).toBeLessThan(1);
    expect(inn * out).toBeCloseTo(1);
  });

  it('is proportional: ten small trackpad events make one notch', () => {
    let z = 1;
    for (let i = 0; i < 10; i++) z = wheelZoom(z, { deltaY: 10 });
    expect(z).toBeCloseTo(wheelZoom(1, { deltaY: 100 }));
  });

  it('reads line-mode wheels as pixels, gives a pinch more gain, and caps one event', () => {
    expect(wheelZoom(1, { deltaY: 3, deltaMode: 1 })).toBeCloseTo(wheelZoom(1, { deltaY: 48 }));
    expect(wheelZoom(1, { deltaY: 5, ctrlKey: true })).toBeLessThan(wheelZoom(1, { deltaY: 5 }));
    expect(wheelZoom(1, { deltaY: 10000 })).toBe(0.5);
    expect(wheelZoom(1, { deltaY: -10000 })).toBe(2);
  });

  it('stays within the zoom bounds', () => {
    expect(wheelZoom(VIEW.minZoom, { deltaY: 500 })).toBe(VIEW.minZoom);
    expect(wheelZoom(VIEW.maxZoom, { deltaY: -500 })).toBe(VIEW.maxZoom);
  });
});

describe('auto-fit', () => {
  // Everything that changes what is on the graph, or the room it has.
  const refits: FitTrigger[] = ['layout', 'dna', 'filter', 'author', 'search', 'structure', 'expand', 'resize'];

  it('refits on a layout, a DNA switch, a filter, the author, a search, a refresh that changes the records, a group opened or closed, and a resize, while on', () => {
    for (const t of refits) expect(autoFit(true, t)).toEqual({ on: true, fit: true });
  });

  it('never moves the view while off', () => {
    for (const t of refits) expect(autoFit(false, t)).toEqual({ on: false, fit: false });
  });

  it('turns off the moment the reader pans or zooms', () => {
    expect(autoFit(true, 'manual')).toEqual({ on: false, fit: false });
    expect(autoFit(false, 'manual')).toEqual({ on: false, fit: false });
  });

  it('comes back on with F or the toggle, and the toggle turns it off again', () => {
    expect(autoFit(false, 'fit')).toEqual({ on: true, fit: true });
    expect(autoFit(true, 'fit')).toEqual({ on: true, fit: true });
    expect(autoFit(false, 'toggle')).toEqual({ on: true, fit: true });
    expect(autoFit(true, 'toggle')).toEqual({ on: false, fit: false });
  });

  it('follows a session: refit, the reader zooms, refreshes leave him alone, F brings it back', () => {
    let on = true;
    const run = (t: FitTrigger) => { const r = autoFit(on, t); on = r.on; return r.fit; };
    expect(run('layout')).toBe(true);
    expect(run('manual')).toBe(false);
    expect(run('structure')).toBe(false);
    expect(run('resize')).toBe(false);
    expect(run('fit')).toBe(true);
    expect(run('expand')).toBe(true);
  });

  it('refits when the reader switches DNA and then shows the unlinked records (the #474 browser check)', () => {
    let on = true;
    const run = (t: FitTrigger) => { const r = autoFit(on, t); on = r.on; return r.fit; };
    expect(run('dna')).toBe(true);
    expect(run('filter')).toBe(true);
    expect(run('search')).toBe(true);
    expect(on).toBe(true);
  });
});
