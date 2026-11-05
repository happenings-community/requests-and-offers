import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  entryTypeLabel,
  inspectorView,
  LATEST_ACTIONS,
  opKind,
  urlsToOpen,
  type InspectorCapture
} from '../inspector.mts';
import { memberAppId, mergeNetworks } from '../inspector-server.mts';

// A capture from a real Holochain 0.7 conductor (two members on `bun start:web`),
// trimmed; Uint8Arrays are stored as {"$bytes": base64}. See its "note" field.
const raw = readFileSync(join(import.meta.dir, 'fixtures', 'inspector-dump.json'), 'utf8');
const fixture = JSON.parse(raw, (_key, value) =>
  value && typeof value === 'object' && typeof value.$bytes === 'string'
    ? new Uint8Array(Buffer.from(value.$bytes, 'base64'))
    : value
) as Omit<InspectorCapture, 'takenAt'> & { note: string };
const capture: InspectorCapture = { ...fixture, takenAt: Date.UTC(2026, 10, 3, 1, 50) };

describe('inspectorView, from a real 0.7 capture', () => {
  const view = inspectorView(capture);

  it('lists every installed member with its agent key and status', () => {
    // Member A first: members are listed by app id, not in listApps order.
    expect(view.members.map((m) => m.appId)).toEqual(
      capture.apps.map((a) => a.installed_app_id).sort((x, y) => x.localeCompare(y))
    );
    for (const m of view.members) {
      expect(m.agentKey.startsWith('uhCAk')).toBe(true);
      expect(m.status).toBe('enabled');
    }
  });

  it('gives each member its two cells, R&O and hREA, by DNA hash', () => {
    for (const m of view.members) {
      expect(m.cells.map((c) => c.role).sort()).toEqual(['hrea', 'requests_and_offers']);
      for (const c of m.cells) expect(c.dnaHash.startsWith('uhC0k')).toBe(true);
    }
    // Both members share one network, so one DNA per role.
    const ro = new Set(view.members.map((m) => m.cells.find((c) => c.role === 'requests_and_offers')!.dnaHash));
    expect(ro.size).toBe(1);
  });

  it('reads each source chain: length, published ops, and the latest actions newest first', () => {
    for (const m of view.members) {
      for (const c of m.cells) {
        const dump = capture.cells[`${m.appId}/${c.role}`];
        const records = dump.source_chain_dump.records;
        expect(c.chainLength).toBe(records.length);
        expect(c.publishedOps).toBe(dump.source_chain_dump.published_ops_count);
        expect(c.latestActions.length).toBe(Math.min(LATEST_ACTIONS, records.length));
        const newest = records[records.length - 1].action;
        expect(c.latestActions[0].seq).toBe(newest.header.action_seq);
        expect(c.latestActions[0].type).toBe(newest.data.type);
        expect(c.latestActions[0].at).toBe(new Date(Math.floor(newest.header.timestamp / 1000)).toISOString());
        const seqs = c.latestActions.map((a) => a.seq);
        expect([...seqs].sort((a, b) => b - a)).toEqual(seqs);
      }
    }
  });

  it('counts the DHT ops: integrated against both limbos, and integrated by kind', () => {
    for (const m of view.members) {
      for (const c of m.cells) {
        const dump = capture.cells[`${m.appId}/${c.role}`].integration_dump;
        expect(c.ops).toEqual({
          integrated: dump.integrated.length,
          validationLimbo: dump.validation_limbo.length,
          integrationLimbo: dump.integration_limbo.length
        });
        const byKind = Object.values(c.integratedByKind).reduce((a, b) => a + b, 0);
        expect(byKind).toBe(dump.integrated.length);
      }
    }
  });

  it('reports the network stats once, for the whole conductor', () => {
    const stats = capture.network.transport_stats;
    expect(view.network.backend).toBe(stats.backend);
    expect(view.network.peerUrls).toEqual(stats.peer_urls);
    expect(view.network.connections).toBe(stats.connections.length);
  });
});

describe('entryTypeLabel and opKind', () => {
  it('names app entry types by zome and entry index, and system types by name', () => {
    expect(entryTypeLabel({ App: { zome_index: 4, entry_index: 0, visibility: 'Public' } })).toBe(
      'App zome 4 entry 0'
    );
    expect(entryTypeLabel('CapGrant')).toBe('CapGrant');
    expect(entryTypeLabel(undefined)).toBeNull();
  });

  it('reads the op variant under ChainOp', () => {
    expect(opKind({ ChainOp: { CreateRecord: [] } })).toBe('CreateRecord');
    expect(opKind({ WarrantOp: {} })).toBe('WarrantOp');
  });
});

describe('urlsToOpen', () => {
  const members = ['http://localhost:8880/?hcPort=1', 'http://127.0.0.1:8880/?hcPort=1'];
  const inspector = 'http://localhost:56102/';

  it('opens one tab per member, then the inspector', () => {
    expect(urlsToOpen(members, inspector, {})).toEqual([...members, inspector]);
  });

  it('opens nothing with WEB_OPEN=0, for headless and CI use', () => {
    expect(urlsToOpen(members, inspector, { WEB_OPEN: '0' })).toEqual([]);
  });
});

describe('reading several conductors, as bun start runs them', () => {
  it('keeps one conductor’s app ids, and numbers them when each member has its own conductor', () => {
    expect(memberAppId('requests_and_offers', 0, 1)).toBe('requests_and_offers');
    expect(memberAppId('requests_and_offers', 0, 2)).toBe('requests_and_offers#1');
    expect(memberAppId('requests_and_offers', 1, 2)).toBe('requests_and_offers#2');
  });

  it('merges the conductors’ network stats: every connection and relay, each backend once', () => {
    const one = capture.network;
    const two = { transport_stats: { ...one.transport_stats, connections: [{ pub_key: 'x', send_message_count: 1, recv_message_count: 2, is_direct: true }] } };
    const merged = mergeNetworks([one, two]);
    expect(merged.transport_stats.backend).toBe(one.transport_stats.backend);
    expect(merged.transport_stats.connections.length).toBe(one.transport_stats.connections.length + 1);
    expect(merged.transport_stats.peer_urls).toEqual([...new Set(one.transport_stats.peer_urls)]);
  });
});
