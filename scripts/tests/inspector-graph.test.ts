import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  b64,
  hashFields,
  labelOf,
  networkGraph,
  readable,
  roleGraph,
  validationIndex,
  type CellDump
} from '../inspector-graph.mts';
import { enumVariants, zomeTypes, HREA_ENTRY_TYPES } from '../inspector-types.mts';

// Two members on a real 0.7 conductor after tonight's run: one completed
// exchange and four exchanges that member B cancelled. See the fixture's note.
const fixture = JSON.parse(
  readFileSync(join(import.meta.dir, 'fixtures', 'inspector-exchange.json'), 'utf8'),
  (_k, v) => (v && typeof v === 'object' && typeof v.$bytes === 'string' ? new Uint8Array(Buffer.from(v.$bytes, 'base64')) : v)
) as {
  apps: Array<{ installed_app_id: string; agent_pub_key: Uint8Array }>;
  cells: Record<string, CellDump>;
};

const ROOT = join(import.meta.dir, '..', '..');
const roZomes = [
  'administration_integrity', 'offers_integrity', 'requests_integrity', 'service_types_integrity',
  'users_organizations_integrity', 'mediums_of_exchange_integrity', 'exchanges_integrity'
];
const readZome = (zome: string) => {
  try {
    return readFileSync(join(ROOT, 'dnas/requests_and_offers/zomes/integrity', zome.replace(/_integrity$/, ''), 'src/lib.rs'), 'utf8');
  } catch {
    return null;
  }
};
const cellsOf = (role: string) =>
  fixture.apps.map((a) => ({ agentKey: a.agent_pub_key, dump: fixture.cells[`${a.installed_app_id}/${role}`] }));

const hrea = roleGraph('hrea', cellsOf('hrea'), zomeTypes(['hrea_integrity'], readZome));
const ro = roleGraph('requests_and_offers', cellsOf('requests_and_offers'), zomeTypes(roZomes, readZome));
const byType = (g: typeof hrea, t: string) => g.nodes.filter((n) => n.entryType === t);
const edgesFrom = (g: typeof hrea, id: string, label: string) => g.edges.filter((e) => e.source === id && e.label === label);

describe('entry and link type names', () => {
  it('reads a zome enum in declaration order, skipping attributes', () => {
    const src = 'pub enum EntryTypes {\n  #[entry_type(visibility = "private")]\n  Offer(Offer),\n  Draft,\n}\n';
    expect(enumVariants(src, 'EntryTypes')).toEqual(['Offer', 'Draft']);
  });

  it("names R&O's types from this repository's integrity zomes", () => {
    const types = zomeTypes(roZomes, readZome);
    expect(types[4].entries).toEqual(['User', 'Organization']);
    expect(types[6].entries.slice(0, 2)).toEqual(['Interest', 'Agreement']);
    expect(types.every((t) => t.links.length > 0)).toBe(true);
  });
});

describe('the hREA graph, from a real capture', () => {
  it('has a node per created record, one per agent, and no node for an update', () => {
    const creates = cellsOf('hrea').flatMap((c) =>
      c.dump.source_chain_dump.records.filter((r) => r.action.data.type === 'Create' && r.entry?.entry_type === 'App')
    );
    const agents = new Set(cellsOf('hrea').map((c) => b64(c.agentKey)));
    expect(hrea.nodes.filter((n) => n.kind === 'entry').length).toBe(creates.length);
    expect(hrea.nodes.filter((n) => n.kind === 'agent').map((n) => n.id).sort()).toEqual([...agents].sort());
  });

  it('names every node by its hREA entry type', () => {
    for (const n of hrea.nodes.filter((x) => x.kind === 'entry')) expect(HREA_ENTRY_TYPES).toContain(n.entryType);
    for (const t of ['Agreement', 'Commitment', 'EconomicEvent', 'Proposal', 'Intent']) expect(byType(hrea, t).length).toBeGreaterThan(0);
  });

  it('chains updates onto their original: the commitments B closed read finished, with their revisions', () => {
    const closed = byType(hrea, 'Commitment').filter((n) => (n.entry as { finished?: boolean }).finished === true);
    expect(closed.length).toBeGreaterThanOrEqual(4);
    for (const n of closed) expect(n.revisions.length).toBeGreaterThanOrEqual(2);
  });

  it('draws a commitment as a clause of its agreement, and the event as fulfilling its commitment', () => {
    for (const c of byType(hrea, 'Commitment')) {
      const [edge] = edgesFrom(hrea, c.id, 'clause_of');
      expect(hrea.nodes.find((n) => n.id === edge.target)?.entryType).toBe('Agreement');
    }
    const [event] = byType(hrea, 'EconomicEvent');
    const fulfills = edgesFrom(hrea, event.id, 'fulfills');
    expect(fulfills.length).toBe(1);
    expect(hrea.nodes.find((n) => n.id === fulfills[0].target)?.entryType).toBe('Commitment');
  });

  it("shows tonight's gap at a glance: no proposal publishes an intent", () => {
    for (const p of byType(hrea, 'Proposal')) expect(edgesFrom(hrea, p.id, 'publishes').length).toBe(0);
  });

  it('draws links between records, named by link type, and skips anchors', () => {
    const links = hrea.edges.filter((e) => e.via === 'link');
    expect(links.length).toBeGreaterThan(0);
    expect(links.some((e) => e.label === 'ReaAgreementToReaCommitments')).toBe(true);
    expect(links.some((e) => e.label === 'CommitmentToFulfillingEconomicEvents')).toBe(true);
    // Collections hang off anchors, and an *Updates link joins a record to its
    // own revision, which the revision chain already shows: neither is drawn.
    expect(links.some((e) => e.label.startsWith('All') || e.label.endsWith('Updates'))).toBe(false);
    expect(hrea.edges.some((e) => e.source === e.target)).toBe(false);
  });
});

describe('the R&O graph, from a real capture', () => {
  it('labels users and offers by a readable field, and leaves capability grants out', () => {
    expect(byType(ro, 'User').length).toBe(2);
    for (const u of byType(ro, 'User')) expect(u.label).not.toBe('');
    expect(byType(ro, 'Offer').map((n) => n.label)).toContain('Rust pairing session');
    expect(ro.nodes.some((n) => n.entryType === 'CapGrant')).toBe(false);
  });

  it('gives each member its own chain, newest first, linked to the graph', () => {
    for (const c of cellsOf('requests_and_offers')) {
      const own = c.dump.source_chain_dump.records.filter((r) => b64(r.action.header.author) === b64(c.agentKey));
      const chain = ro.chains[b64(c.agentKey)];
      expect(chain.length).toBe(own.length);
      expect(chain[0].seq).toBe(Math.max(...own.map((r) => r.action.header.action_seq)));
      expect(chain.some((a) => a.nodeId !== null)).toBe(true);
    }
  });
});

describe('validation state', () => {
  it('marks an action integrated when a cell holds its op as integrated', () => {
    const index = validationIndex(cellsOf('hrea').map((c) => c.dump));
    expect([...index.values()].every((v) => v === 'integrated')).toBe(true);
    expect(index.size).toBeGreaterThan(0);
  });
});

describe('the network graph', () => {
  it("joins two members' cells of one role when each knows the other as a peer", () => {
    const cells = fixture.apps.flatMap((a) =>
      ['requests_and_offers', 'hrea'].map((role) => ({ appId: a.installed_app_id, role, agentKey: a.agent_pub_key, dump: fixture.cells[`${a.installed_app_id}/${role}`] }))
    );
    const net = networkGraph(cells);
    expect(net.nodes.length).toBe(4);
    for (const e of net.edges) expect(e.source.split('/')[1]).toBe(e.target.split('/')[1]);
    expect(net.edges.length).toBeGreaterThan(0);
  });
});

describe('readable entries', () => {
  it('turns hashes into base64 and finds the hash-valued fields', () => {
    const hash = new Uint8Array([0x84, 0x29, 0x24, ...new Array(36).fill(1)]);
    const entry = { id: hash, clause_of: hash, title: 'Bike repair', nested: { realization_of: [hash] } };
    expect((readable(entry) as { clause_of: string }).clause_of.startsWith('uhCkk')).toBe(true);
    expect(hashFields(entry).map((f) => f.field)).toEqual(['clause_of', 'nested.realization_of']);
    expect(labelOf(entry)).toBe('Bike repair');
  });
});
