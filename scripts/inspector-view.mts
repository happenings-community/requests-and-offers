/**
 * What the inspector's entry graph puts on screen, from the graph model
 * (inspector-graph.mts): types collapsed into counted nodes, filters, the
 * focus around a node and the order the arrow keys walk its neighbours.
 * Pure and dependency-free: the server strips its types and serves it to the
 * page as /inspector-view.js, and the unit tests import it as it is.
 */

export type ViewNode = {
  id: string;
  kind: 'entry' | 'agent' | 'group';
  entryType: string;
  label: string;
  author?: string;
  deleted?: boolean;
  revisions?: unknown[];
  /** For a group: how many records it stands for. */
  count?: number;
  [field: string]: unknown;
};

export type ViewEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
  via: 'link' | 'field';
  deleted: boolean;
  /** For an edge into or out of a group: how many edges it stands for. */
  count?: number;
};

export type Graph = { nodes: ViewNode[]; edges: ViewEdge[] };

export const groupId = (entryType: string) => `group:${entryType}`;

/**
 * Every type with more than `threshold` records becomes one node carrying its
 * count, unless it is in `expanded`. Edges to and from its records go to the
 * group instead, merged per source, target and label.
 */
export function collapseTypes(graph: Graph, opts: { threshold: number; expanded: Set<string> }): Graph {
  const perType = new Map<string, number>();
  for (const n of graph.nodes) if (n.kind === 'entry') perType.set(n.entryType, (perType.get(n.entryType) ?? 0) + 1);
  const collapsed = new Set([...perType].filter(([t, c]) => c > opts.threshold && !opts.expanded.has(t)).map(([t]) => t));
  const home = new Map<string, string>();
  const nodes: ViewNode[] = [];
  for (const n of graph.nodes) {
    if (n.kind === 'entry' && collapsed.has(n.entryType)) home.set(n.id, groupId(n.entryType));
    else nodes.push(n);
  }
  for (const t of collapsed) {
    nodes.push({ id: groupId(t), kind: 'group', entryType: t, label: `${t} ×${perType.get(t)}`, count: perType.get(t) });
  }
  const edges = new Map<string, ViewEdge>();
  for (const e of graph.edges) {
    const source = home.get(e.source) ?? e.source;
    const target = home.get(e.target) ?? e.target;
    if (source === target) continue;
    const merged = source !== e.source || target !== e.target;
    const id = merged ? `${source}|${target}|${e.label}` : e.id;
    const known = edges.get(id);
    if (known) {
      known.count = (known.count ?? 1) + 1;
      known.deleted = known.deleted && e.deleted;
    } else edges.set(id, { ...e, id, source, target, ...(merged ? { count: 1 } : {}) });
  }
  return { nodes, edges: [...edges.values()] };
}

/** The graph left once hidden types, and optionally every record with no edge, are taken out. */
export function visibleGraph(graph: Graph, opts: { hiddenTypes: Set<string>; hideUnlinked: boolean }): Graph {
  let nodes = graph.nodes.filter((n) => !opts.hiddenTypes.has(n.entryType));
  let ids = new Set(nodes.map((n) => n.id));
  const edges = graph.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
  if (opts.hideUnlinked) {
    const linked = new Set(edges.flatMap((e) => [e.source, e.target]));
    nodes = nodes.filter((n) => linked.has(n.id));
    ids = new Set(nodes.map((n) => n.id));
  }
  return { nodes, edges: edges.filter((e) => ids.has(e.source) && ids.has(e.target)) };
}

/** The node and every node within `depth` edges of it, edges read both ways. */
export function focusSet(edges: Array<Pick<ViewEdge, 'source' | 'target'>>, id: string, depth = 1): Set<string> {
  const seen = new Set([id]);
  let frontier = [id];
  for (let d = 0; d < depth && frontier.length; d++) {
    const next: string[] = [];
    for (const e of edges) {
      for (const [from, to] of [[e.source, e.target], [e.target, e.source]]) {
        if (frontier.includes(from) && !seen.has(to)) {
          seen.add(to);
          next.push(to);
        }
      }
    }
    frontier = next;
  }
  return seen;
}

/** The neighbours the arrow keys step through: by label, then id, so the order never shifts between refreshes. */
export function neighbourOrder(
  edges: Array<Pick<ViewEdge, 'source' | 'target'>>,
  id: string,
  labelOf: (id: string) => string
): string[] {
  return [...focusSet(edges, id, 1)]
    .filter((n) => n !== id)
    .sort((a, b) => labelOf(a).localeCompare(labelOf(b)) || a.localeCompare(b));
}
