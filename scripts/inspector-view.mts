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

// ---- Layout ---------------------------------------------------------------

export type Point = { x: number; y: number };

/** One entry type's block: its records on a grid, in a frame of its own. */
export type Cluster = {
  entryType: string;
  /** The compound node framing the block, or null for a block of one node, which needs no frame. */
  parent: string | null;
  ids: string[];
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ClusterLayout = { positions: Map<string, Point>; clusters: Cluster[] };

/**
 * Sizes in model pixels. A cell is wider than a node's longest label (the
 * page ellipsises labels at 110px), so no two labels can touch.
 */
export const LAYOUT = {
  cellWidth: 150,
  cellHeight: 58,
  /** Space inside a frame, and the band at its top that carries the type's name. */
  padding: 14,
  header: 18,
  /** Space between two frames. */
  gap: 48,
  /** Width over height the blocks are packed towards: the graph pane's usual shape. */
  aspect: 1.6
};

export const clusterId = (entryType: string) => `cluster:${entryType}`;

/**
 * The order the blocks are laid in: start from the type with the most edges to
 * other types, then always take the type most connected to those already laid,
 * so the types that point at each other sit side by side. Ties go by name.
 */
export function typeOrder(graph: Graph): string[] {
  const typeOf = new Map(graph.nodes.map((n) => [n.id, n.entryType]));
  const types = [...new Set(graph.nodes.map((n) => n.entryType))].sort();
  const weight = new Map<string, number>();
  const total = new Map<string, number>(types.map((t) => [t, 0]));
  for (const e of graph.edges) {
    const a = typeOf.get(e.source);
    const b = typeOf.get(e.target);
    if (!a || !b || a === b) continue;
    for (const k of [`${a}\u0000${b}`, `${b}\u0000${a}`]) weight.set(k, (weight.get(k) ?? 0) + 1);
    total.set(a, (total.get(a) ?? 0) + 1);
    total.set(b, (total.get(b) ?? 0) + 1);
  }
  const order: string[] = [];
  const left = new Set(types);
  const pull = new Map<string, number>(types.map((t) => [t, 0]));
  while (left.size) {
    const next = [...left].sort(
      (a, b) => pull.get(b)! - pull.get(a)! || total.get(b)! - total.get(a)! || a.localeCompare(b)
    )[0];
    order.push(next);
    left.delete(next);
    for (const t of left) pull.set(t, pull.get(t)! + (weight.get(`${next}\u0000${t}`) ?? 0));
  }
  return order;
}

/**
 * Where every node goes, as a pure function of the graph: one block per entry
 * type, its records on a grid in creation order (so a new record joins the end
 * of its block), the blocks packed into rows. Nodes never overlap, types never
 * mix, and the same graph always gets the same positions, so a refresh that
 * changes nothing moves nothing.
 */
export function clusteredLayout(graph: Graph, opts: Partial<typeof LAYOUT> = {}): ClusterLayout {
  const o = { ...LAYOUT, ...opts };
  const byType = new Map<string, ViewNode[]>();
  for (const n of graph.nodes) byType.set(n.entryType, [...(byType.get(n.entryType) ?? []), n]);
  const created = (n: ViewNode) => (typeof n.createdAt === 'string' ? n.createdAt : '');
  const blocks = typeOrder(graph).map((t) => {
    const nodes = byType.get(t)!.sort((a, b) => created(a).localeCompare(created(b)) || a.id.localeCompare(b.id));
    // Roughly square on screen: columns times cell width close to rows times cell height.
    const cols = Math.max(1, Math.min(nodes.length, Math.ceil(Math.sqrt((nodes.length * o.cellHeight) / o.cellWidth))));
    const rows = Math.ceil(nodes.length / cols);
    const framed = nodes.length > 1;
    const inner = framed ? o.padding : 0;
    return {
      entryType: t,
      nodes,
      cols,
      framed,
      inner,
      top: framed ? o.header + o.padding : 0,
      width: cols * o.cellWidth + 2 * inner,
      height: rows * o.cellHeight + (framed ? o.header + 2 * o.padding : 0)
    };
  });
  // Pack the blocks into rows at each width the blocks themselves allow (the first one, two, three...
  // side by side), and keep the packing whose overall shape is closest to the pane's aspect.
  type Packed = { at: Point[]; width: number; height: number };
  const pack = (rowWidth: number): Packed => {
    const at: Point[] = [];
    let x = 0;
    let y = 0;
    let rowHeight = 0;
    let width = 0;
    for (const b of blocks) {
      if (x > 0 && x + b.width > rowWidth) {
        x = 0;
        y += rowHeight + o.gap;
        rowHeight = 0;
      }
      at.push({ x, y });
      width = Math.max(width, x + b.width);
      x += b.width + o.gap;
      rowHeight = Math.max(rowHeight, b.height);
    }
    return { at, width, height: y + rowHeight };
  };
  const misfit = (p: Packed) => (p.height > 0 ? Math.abs(Math.log(p.width / p.height / o.aspect)) : 0);
  let best = pack(0);
  for (let k = 1, w = 0; k <= blocks.length; k++) {
    w += (k > 1 ? o.gap : 0) + blocks[k - 1].width;
    const p = pack(w);
    if (misfit(p) < misfit(best) - 1e-9) best = p;
  }
  const positions = new Map<string, Point>();
  const clusters: Cluster[] = [];
  blocks.forEach((b, j) => {
    const { x, y } = best.at[j];
    b.nodes.forEach((n, i) => {
      positions.set(n.id, {
        x: x + b.inner + (i % b.cols) * o.cellWidth + o.cellWidth / 2,
        y: y + b.top + Math.floor(i / b.cols) * o.cellHeight + o.cellHeight / 2
      });
    });
    clusters.push({
      entryType: b.entryType,
      parent: b.framed ? clusterId(b.entryType) : null,
      ids: b.nodes.map((n) => n.id),
      x,
      y,
      width: b.width,
      height: b.height
    });
  });
  return { positions, clusters };
}

// ---- Viewport -------------------------------------------------------------

export type Box = { x1: number; y1: number; w: number; h: number };
export type Viewport = { zoom: number; pan: Point };

export const VIEW = {
  /** Space kept free around the graph when it is fitted, in screen pixels. */
  padding: 36,
  /** A fit never zooms past this, so a graph of three records does not fill the pane. */
  fitCeiling: 1.25,
  minZoom: 0.1,
  maxZoom: 3
};

/** The zoom and pan that show `box` whole in a `width` × `height` pane, centred. */
export function fitView(box: Box, width: number, height: number, opts: Partial<typeof VIEW> = {}): Viewport {
  const o = { ...VIEW, ...opts };
  const room = (pane: number, size: number) => (size > 0 ? Math.max(1, pane - 2 * o.padding) / size : Infinity);
  const zoom = Math.min(Math.max(Math.min(room(width, box.w), room(height, box.h), o.fitCeiling), o.minZoom), o.maxZoom);
  return {
    zoom,
    pan: { x: width / 2 - zoom * (box.x1 + box.w / 2), y: height / 2 - zoom * (box.y1 + box.h / 2) }
  };
}

/**
 * The zoom level after one wheel event: proportional to how far the wheel or
 * trackpad moved, so a trackpad's many small events glide and a mouse notch
 * steps about a fifth. A pinch arrives as a wheel event with ctrlKey and small
 * deltas, so it gets a stronger gain. One event never more than doubles or halves.
 */
export function wheelZoom(
  zoom: number,
  e: { deltaY: number; deltaMode?: number; ctrlKey?: boolean },
  opts: Partial<typeof VIEW> = {}
): number {
  const o = { ...VIEW, ...opts };
  const px = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
  const factor = Math.min(2, Math.max(0.5, Math.exp(-px * (e.ctrlKey ? 0.01 : 0.002))));
  return Math.min(o.maxZoom, Math.max(o.minZoom, zoom * factor));
}

/**
 * What wakes the auto-fit, and what puts it to sleep.
 * - These refit only while it is on: `layout` (Re-layout), `dna` (another DNA,
 *   or the first load), `filter` (a type chip, Hide unlinked, Group large types),
 *   `author` (the author filter), `search` (the page fits the matches, or
 *   everything once the search is cleared), `structure` (a refresh added or
 *   removed records), `expand` (a group opened or closed) and `resize`.
 * - `manual`: the reader panned, zoomed, focused or centred on a record. It turns
 *   off, so the view never moves under him.
 * - `fit` (F, the Fit button, Esc) fits and turns it back on; `toggle` flips it.
 */
export type FitTrigger =
  | 'layout'
  | 'dna'
  | 'filter'
  | 'author'
  | 'search'
  | 'structure'
  | 'expand'
  | 'resize'
  | 'manual'
  | 'fit'
  | 'toggle';

export function autoFit(on: boolean, trigger: FitTrigger): { on: boolean; fit: boolean } {
  switch (trigger) {
    case 'manual':
      return { on: false, fit: false };
    case 'fit':
      return { on: true, fit: true };
    case 'toggle':
      return on ? { on: false, fit: false } : { on: true, fit: true };
    default:
      return { on, fit: on };
  }
}
