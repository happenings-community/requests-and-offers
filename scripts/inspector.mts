/**
 * The `bun start:web` inspector: what each member's cells hold, read through
 * the conductor's admin API. It replaces `hc playground`, whose only build is
 * for Holochain 0.5 and cannot read a 0.7 conductor (see
 * documentation/guides/web-dev-mode.md). Read-only: it never grants, installs
 * or changes anything.
 *
 * This file holds the pure part, a raw capture turned into the view the page
 * renders, so it is unit-tested against a capture from a real 0.7 conductor
 * (scripts/tests/fixtures/inspector-dump.json). scripts/start-web.mts takes the
 * capture and serves the page.
 */
import { encodeHashToBase64 } from '@holochain/client';

type Bytes = Uint8Array;

/** What start-web reads from the admin API, as the client returns it. */
export type InspectorCapture = {
  apps: Array<{
    installed_app_id: string;
    agent_pub_key: Bytes;
    status: { type: string };
    cell_info: Record<string, Array<{ type: string; value: { cell_id?: [Bytes, Bytes] } }>>;
  }>;
  /** Keyed `${installed_app_id}/${role}`. */
  cells: Record<string, FullStateDump>;
  network: {
    transport_stats: {
      backend: string;
      peer_urls: string[];
      connections: Array<{ pub_key: string; send_message_count: number; recv_message_count: number; is_direct: boolean }>;
    };
  };
  /** When the capture was taken, ms since the epoch. */
  takenAt: number;
};

type ActionDump = {
  header: { author: Bytes; timestamp: number; action_seq: number };
  data: { type: string; entry_type?: unknown };
};

export type FullStateDump = {
  source_chain_dump: { records: Array<{ action_address: Bytes; action: ActionDump }>; published_ops_count: number };
  integration_dump: { validation_limbo: unknown[]; integration_limbo: unknown[]; integrated: unknown[] };
  peer_dump: { peers: unknown[] };
};

export type ActionView = {
  seq: number;
  type: string;
  entryType: string | null;
  /** ISO 8601, from the action's microsecond timestamp. */
  at: string;
  hash: string;
};

export type CellView = {
  role: string;
  dnaHash: string;
  chainLength: number;
  publishedOps: number;
  /** Newest first. */
  latestActions: ActionView[];
  ops: { integrated: number; validationLimbo: number; integrationLimbo: number };
  /** Integrated ops by kind, e.g. { CreateRecord: 12, CreateLink: 4 }. */
  integratedByKind: Record<string, number>;
  peersKnown: number;
};

export type MemberView = {
  appId: string;
  agentKey: string;
  status: string;
  cells: CellView[];
};

export type InspectorView = {
  takenAt: string;
  network: { backend: string; peerUrls: string[]; connections: number; directConnections: number };
  members: MemberView[];
};

export const LATEST_ACTIONS = 8;

/** `{ App: { zome_index, entry_index } }` or a system type such as "CapGrant". */
export function entryTypeLabel(entryType: unknown): string | null {
  if (entryType === undefined || entryType === null) return null;
  if (typeof entryType === 'string') return entryType;
  if (typeof entryType === 'object' && 'App' in entryType) {
    const app = (entryType as { App: { zome_index: number; entry_index: number } }).App;
    return `App zome ${app.zome_index} entry ${app.entry_index}`;
  }
  return Object.keys(entryType as object)[0] ?? null;
}

/** The op variant name: `{ ChainOp: { CreateRecord: [...] } }` is "CreateRecord". */
export function opKind(op: unknown): string {
  if (!op || typeof op !== 'object') return 'Unknown';
  const [outer, inner] = Object.entries(op as Record<string, unknown>)[0] ?? [];
  if (outer === 'ChainOp' && inner && typeof inner === 'object') {
    return Object.keys(inner as object)[0] ?? 'ChainOp';
  }
  return outer ?? 'Unknown';
}

export function actionView(record: { action_address: Bytes; action: ActionDump }): ActionView {
  const { header, data } = record.action;
  return {
    seq: header.action_seq,
    type: data.type,
    entryType: entryTypeLabel(data.entry_type),
    at: new Date(Math.floor(header.timestamp / 1000)).toISOString(),
    hash: encodeHashToBase64(record.action_address)
  };
}

export function cellView(role: string, dnaHash: Bytes, dump: FullStateDump): CellView {
  const records = dump.source_chain_dump.records;
  const integratedByKind: Record<string, number> = {};
  for (const op of dump.integration_dump.integrated) {
    const kind = opKind(op);
    integratedByKind[kind] = (integratedByKind[kind] ?? 0) + 1;
  }
  return {
    role,
    dnaHash: encodeHashToBase64(dnaHash),
    chainLength: records.length,
    publishedOps: dump.source_chain_dump.published_ops_count,
    latestActions: records.slice(-LATEST_ACTIONS).reverse().map(actionView),
    ops: {
      integrated: dump.integration_dump.integrated.length,
      validationLimbo: dump.integration_dump.validation_limbo.length,
      integrationLimbo: dump.integration_dump.integration_limbo.length
    },
    integratedByKind,
    peersKnown: dump.peer_dump.peers.length
  };
}

/** The whole page: one entry per installed app, by app id, one per provisioned or cloned cell. */
export function inspectorView(capture: InspectorCapture): InspectorView {
  const stats = capture.network.transport_stats;
  return {
    takenAt: new Date(capture.takenAt).toISOString(),
    network: {
      backend: stats.backend,
      peerUrls: stats.peer_urls,
      connections: stats.connections.length,
      directConnections: stats.connections.filter((c) => c.is_direct).length
    },
    members: [...capture.apps]
      .sort((a, b) => a.installed_app_id.localeCompare(b.installed_app_id))
      .map((app) => ({
      appId: app.installed_app_id,
      agentKey: encodeHashToBase64(app.agent_pub_key),
      status: app.status.type,
      cells: Object.entries(app.cell_info).flatMap(([role, infos]) =>
        infos.flatMap((info) => {
          const cellId = info.value.cell_id;
          const dump = capture.cells[`${app.installed_app_id}/${role}`];
          return cellId && dump ? [cellView(role, cellId[0], dump)] : [];
        })
      )
    }))
  };
}

/** The member tabs and the inspector, unless WEB_OPEN=0 turns opening off. */
export function urlsToOpen(memberUrls: string[], inspectorUrl: string, env: Record<string, string | undefined>): string[] {
  if (env.WEB_OPEN === '0') return [];
  return [...memberUrls, inspectorUrl];
}
