/**
 * The inspector's graph model, built from `dumpFullState` captures: what each
 * DNA's records are, how they point at each other, and how far each has got
 * through validation. Pure, so it is unit-tested on captures from a real 0.7
 * conductor (scripts/tests/fixtures/).
 *
 * - One node per record that a Create made: an app entry, or an agent key.
 *   Updates join their original as a chain of revisions; a Delete greys it out.
 * - Edges come from links (CreateLink, named by link type; a DeleteLink greys
 *   the edge) and from hash-valued entry fields, such as an hREA Commitment's
 *   `clause_of` or an EconomicEvent's `fulfills`.
 */
import { decode } from '@msgpack/msgpack';
import { entryTypeName, linkTypeName, type ZomeTypes } from './inspector-types.mts';

type Bytes = Uint8Array;

export type RawAction = {
  header: { author: Bytes; timestamp: number; action_seq: number };
  data: { type: string; [field: string]: unknown };
};
export type RawRecord = {
  action_address: Bytes;
  action: RawAction;
  entry?: { entry_type: string; entry: Bytes } | null;
};
export type CellDump = {
  source_chain_dump: { records: RawRecord[] };
  integration_dump: { validation_limbo: unknown[]; integration_limbo: unknown[]; integrated: unknown[] };
  peer_dump?: { peers: Array<{ kitsune_agent: string }> };
};

export type Validation = 'integrated' | 'validation limbo' | 'integration limbo' | 'not seen';

export type Revision = { hash: string; at: string; author: string; validation: Validation };

export type GraphNode = {
  id: string;
  kind: 'entry' | 'agent';
  entryType: string;
  label: string;
  author: string;
  createdAt: string;
  /** Oldest first; the first is the Create. */
  revisions: Revision[];
  /** The latest revision's entry, decoded, hashes as base64 strings. */
  entry: unknown;
  deleted: boolean;
  /** The Create action, as it was recorded. */
  header: { seq: number; timestamp: string; type: string };
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
  via: 'link' | 'field';
  deleted: boolean;
};

export type ChainAction = {
  seq: number;
  type: string;
  entryType: string | null;
  at: string;
  hash: string;
  /** The graph node this action made or changed, if any. */
  nodeId: string | null;
};

export type RoleGraph = {
  role: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Per agent key, that agent's own source chain in this DNA, newest first. */
  chains: Record<string, ChainAction[]>;
};

const HASH_LENGTH = 39;

export function isHash(value: unknown): value is Bytes {
  return value instanceof Uint8Array && value.length === HASH_LENGTH && value[0] === 0x84 && value[2] === 0x24;
}

export function b64(hash: Bytes): string {
  // The `u`-prefixed URL-safe base64 Holochain prints (encodeHashToBase64).
  return `u${Buffer.from(hash).toString('base64url')}`;
}

/** An agent key's 32-byte core, as kitsune names the agent in peer dumps. */
export function kitsuneAgent(agentKey: Bytes): string {
  return Buffer.from(agentKey.subarray(3, 35)).toString('base64url');
}

const iso = (micros: number) => new Date(Math.floor(micros / 1000)).toISOString();

/** A decoded entry made JSON-safe: hashes to base64, other bytes to `bytes:<base64>`. */
export function readable(value: unknown): unknown {
  if (isHash(value)) return b64(value);
  if (value instanceof Uint8Array) return `bytes:${Buffer.from(value).toString('base64')}`;
  if (Array.isArray(value)) return value.map(readable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, readable(v)]));
  }
  return value;
}

const LABEL_FIELDS = ['title', 'name', 'nickname', 'note', 'description', 'label', 'action'];

export function labelOf(entry: unknown): string {
  if (!entry || typeof entry !== 'object') return '';
  for (const field of LABEL_FIELDS) {
    const v = (entry as Record<string, unknown>)[field];
    if (typeof v === 'string' && v.trim()) return v.trim().length > 40 ? `${v.trim().slice(0, 39)}…` : v.trim();
  }
  return '';
}

/** Every hash inside a decoded entry, with the field path that holds it. `id` is skipped: hREA's points at itself. */
export function hashFields(entry: unknown, path = ''): Array<{ field: string; hash: Bytes }> {
  if (isHash(entry)) return path && path !== 'id' ? [{ field: path, hash: entry }] : [];
  if (Array.isArray(entry)) return entry.flatMap((v) => hashFields(v, path));
  if (entry && typeof entry === 'object' && !(entry instanceof Uint8Array)) {
    return Object.entries(entry).flatMap(([k, v]) => hashFields(v, path ? `${path}.${k}` : k));
  }
  return [];
}

function decodeEntry(record: RawRecord): unknown {
  const e = record.entry;
  if (!e || e.entry_type !== 'App' || !(e.entry instanceof Uint8Array)) return null;
  try {
    return decode(e.entry);
  } catch {
    return null;
  }
}

/** The action header inside a DHT op, whatever the op's variant. */
function opHeader(op: unknown): { author: Bytes; action_seq: number } | null {
  const stack: unknown[] = [op];
  while (stack.length) {
    const v = stack.pop();
    if (!v || typeof v !== 'object' || v instanceof Uint8Array) continue;
    const header = (v as { header?: { author?: unknown; action_seq?: unknown } }).header;
    if (header && header.author instanceof Uint8Array && typeof header.action_seq === 'number') {
      return { author: header.author, action_seq: header.action_seq };
    }
    stack.push(...Object.values(v as object));
  }
  return null;
}

/** By `${author}|${seq}`: the furthest an action has got in any of these cells. */
export function validationIndex(cells: CellDump[]): Map<string, Validation> {
  const index = new Map<string, Validation>();
  const rank: Record<Validation, number> = {
    'not seen': 0,
    'validation limbo': 1,
    'integration limbo': 2,
    integrated: 3
  };
  const note = (ops: unknown[], state: Validation) => {
    for (const op of ops) {
      const h = opHeader(op);
      if (!h) continue;
      const key = `${b64(h.author)}|${h.action_seq}`;
      const prev = index.get(key) ?? 'not seen';
      if (rank[state] > rank[prev]) index.set(key, state);
    }
  };
  for (const c of cells) {
    note(c.integration_dump.validation_limbo, 'validation limbo');
    note(c.integration_dump.integration_limbo, 'integration limbo');
    note(c.integration_dump.integrated, 'integrated');
  }
  return index;
}

/**
 * One DNA's graph, from every local member's cell of that role. Each member's
 * chain is read from its own cell; the members share one network, so together
 * they hold every record the inspector can show.
 */
export function roleGraph(role: string, cells: Array<{ agentKey: Bytes; dump: CellDump }>, types: ZomeTypes): RoleGraph {
  const validation = validationIndex(cells.map((c) => c.dump));
  const nodes = new Map<string, GraphNode>();
  const alias = new Map<string, string>(); // action or entry hash -> node id
  const agentByCore = new Map<string, string>(); // 32-byte core -> agent node id
  const edges = new Map<string, GraphEdge>();
  const linkEdges = new Map<string, string>(); // CreateLink action hash -> edge id
  const chains: Record<string, ChainAction[]> = {};
  const all = cells.flatMap((c) =>
    c.dump.source_chain_dump.records.map((r) => ({ record: r, owner: b64(c.agentKey) }))
  );
  const stateOf = (r: RawRecord): Validation =>
    validation.get(`${b64(r.action.header.author)}|${r.action.header.action_seq}`) ?? 'not seen';
  const entryTypeOf = (data: RawAction['data']): string | null => {
    const t = data.entry_type as unknown;
    if (!t) return null;
    if (typeof t === 'string') return t;
    const app = (t as { App?: { zome_index: number; entry_index: number } }).App;
    return app ? entryTypeName(types, app.zome_index, app.entry_index) : Object.keys(t as object)[0] ?? null;
  };
  const resolve = (hash: Bytes): string | undefined =>
    alias.get(b64(hash)) ?? (hash[1] === 0x20 || hash[1] === 0x21 ? agentByCore.get(kitsuneAgent(hash)) : undefined);

  // Pass 1: nodes from Creates, in chain order.
  for (const { record } of all) {
    const { header, data } = record.action;
    if (data.type !== 'Create') continue;
    const hash = b64(record.action_address);
    const author = b64(header.author);
    const rev: Revision = { hash, at: iso(header.timestamp), author, validation: stateOf(record) };
    if (data.entry_type === 'AgentPubKey') {
      const id = author;
      if (!nodes.has(id)) {
        nodes.set(id, {
          id, kind: 'agent', entryType: 'Agent', label: `${author.slice(0, 9)}…`, author, createdAt: rev.at,
          revisions: [rev], entry: null, deleted: false, header: { seq: header.action_seq, timestamp: rev.at, type: 'Create' }
        });
        agentByCore.set(kitsuneAgent(header.author), id);
      }
      alias.set(hash, id);
      continue;
    }
    const entry = decodeEntry(record);
    if (entry === null) continue; // a system entry such as a CapGrant: not part of the app's data
    nodes.set(hash, {
      id: hash, kind: 'entry', entryType: entryTypeOf(data) ?? 'Entry', label: labelOf(entry), author,
      createdAt: rev.at, revisions: [rev], entry: readable(entry), deleted: false,
      header: { seq: header.action_seq, timestamp: rev.at, type: 'Create' }
    });
    alias.set(hash, hash);
    if (isHash(data.entry_hash)) alias.set(b64(data.entry_hash), hash);
  }
  // Pass 2: updates and deletes, oldest first, onto their original.
  const changes = all
    .filter(({ record }) => record.action.data.type === 'Update' || record.action.data.type === 'Delete')
    .sort((a, b) => a.record.action.header.timestamp - b.record.action.header.timestamp);
  for (const { record } of changes) {
    const { header, data } = record.action;
    const target = isHash(data.original_action_address)
      ? resolve(data.original_action_address)
      : isHash(data.deletes_address)
        ? resolve(data.deletes_address)
        : undefined;
    const node = target ? nodes.get(target) : undefined;
    if (!node) continue;
    const hash = b64(record.action_address);
    alias.set(hash, node.id);
    if (data.type === 'Delete') {
      node.deleted = true;
      continue;
    }
    if (isHash(data.entry_hash)) alias.set(b64(data.entry_hash), node.id);
    node.revisions.push({ hash, at: iso(header.timestamp), author: b64(header.author), validation: stateOf(record) });
    const entry = decodeEntry(record);
    if (entry !== null) {
      node.entry = readable(entry);
      node.label = labelOf(entry) || node.label;
    }
  }
  // Pass 3: edges from entry fields, then from links.
  for (const node of nodes.values()) {
    if (node.kind !== 'entry') continue;
    const raw = all.find(({ record }) => b64(record.action_address) === node.revisions[node.revisions.length - 1].hash);
    const entry = raw ? decodeEntry(raw.record) : null;
    for (const { field, hash } of hashFields(entry)) {
      const target = resolve(hash);
      if (!target || target === node.id) continue;
      const id = `${node.id}|${target}|${field}`;
      edges.set(id, { id, source: node.id, target, label: field, via: 'field', deleted: false });
    }
  }
  for (const { record } of all) {
    const { data } = record.action;
    if (data.type === 'CreateLink' && isHash(data.base_address) && isHash(data.target_address)) {
      const source = resolve(data.base_address);
      const target = resolve(data.target_address);
      if (!source || !target || source === target) continue; // anchors and paths are not drawn
      const label = linkTypeName(types, Number(data.zome_index), Number(data.link_type));
      const id = `${source}|${target}|${label}`;
      edges.set(id, { id, source, target, label, via: 'link', deleted: false });
      linkEdges.set(b64(record.action_address), id);
    }
  }
  for (const { record } of all) {
    const { data } = record.action;
    if (data.type !== 'DeleteLink' || !isHash(data.link_add_address)) continue;
    const edge = edges.get(linkEdges.get(b64(data.link_add_address)) ?? '');
    if (edge) edge.deleted = true;
  }
  // Each member's own chain, newest first.
  for (const c of cells) {
    const owner = b64(c.agentKey);
    chains[owner] = [...c.dump.source_chain_dump.records]
      .filter((r) => b64(r.action.header.author) === owner)
      .sort((a, b) => b.action.header.action_seq - a.action.header.action_seq)
      .map((r) => ({
        seq: r.action.header.action_seq,
        type: r.action.data.type,
        entryType: entryTypeOf(r.action.data),
        at: iso(r.action.header.timestamp),
        hash: b64(r.action_address),
        nodeId:
          alias.get(b64(r.action_address)) ??
          linkEdges.get(b64(r.action_address))?.split('|')[0] ??
          null
      }));
  }
  return { role, nodes: [...nodes.values()], edges: [...edges.values()], chains };
}

export type NetworkGraph = {
  nodes: Array<{ id: string; appId: string; role: string; agentKey: string }>;
  edges: Array<{ id: string; source: string; target: string; kind: 'knows' | 'connected' }>;
};

/** Cells as nodes; an edge where a cell knows another member's cell of the same role as a peer. */
export function networkGraph(cells: Array<{ appId: string; role: string; agentKey: Bytes; dump: CellDump }>): NetworkGraph {
  const nodes = cells.map((c) => ({ id: `${c.appId}/${c.role}`, appId: c.appId, role: c.role, agentKey: b64(c.agentKey) }));
  const byAgent = new Map(cells.map((c) => [`${c.role}|${kitsuneAgent(c.agentKey)}`, `${c.appId}/${c.role}`]));
  const edges: NetworkGraph['edges'] = [];
  for (const c of cells) {
    const id = `${c.appId}/${c.role}`;
    for (const peer of c.dump.peer_dump?.peers ?? []) {
      const target = byAgent.get(`${c.role}|${peer.kitsune_agent}`);
      if (target && target !== id) edges.push({ id: `${id}>${target}`, source: id, target, kind: 'knows' });
    }
  }
  return { nodes, edges };
}
