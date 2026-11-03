/**
 * The inspector's HTTP server, shared by `bun start` (one conductor per member,
 * through hc-spin) and `bun start:web` (one conductor for every member). It
 * reads each conductor through its admin websocket and serves the graph page.
 * Read-only: it never grants, installs or changes anything.
 *
 * Runs under Node, not Bun: @holochain/client's AdminWebsocket handshake fails
 * under Bun ("Expected 101").
 */
import { AdminWebsocket } from '@holochain/client';
import { readFileSync } from 'node:fs';
import { createServer as createHttpServer, type Server, type ServerResponse } from 'node:http';
import * as nodeModule from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectorView, type InspectorCapture } from './inspector.mts';
import { networkGraph, roleGraph, type CellDump } from './inspector-graph.mts';
import { zomeTypes, type ZomeTypes } from './inspector-types.mts';
import { configOf, genericAdapter, type InspectorAdapter } from './inspector-adapter.mts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CYTOSCAPE = join(ROOT, 'node_modules', 'cytoscape', 'dist', 'cytoscape.min.js');
// The conductor checks the Origin header and Node's ws client sends none.
const ORIGIN = 'http://localhost';

/** A conductor the inspector reads: an open admin websocket, or a port to connect to on demand. */
export type ConductorSource = AdminWebsocket | number;

type Network = InspectorCapture['network'];

/**
 * The app ids the page shows. One conductor keeps each app's own id; with one
 * conductor per member (hc-spin installs the same app id in each), the ids get
 * the conductor's number so the members stay apart.
 */
export function memberAppId(appId: string, conductor: number, conductors: number): string {
  return conductors > 1 ? `${appId}#${conductor + 1}` : appId;
}

/** Several conductors' network stats as one: their connections and relay URLs together. */
export function mergeNetworks(networks: Network[]): Network {
  const stats = networks.map((n) => n.transport_stats);
  return {
    transport_stats: {
      backend: [...new Set(stats.map((s) => s.backend))].join(', '),
      peer_urls: [...new Set(stats.flatMap((s) => s.peer_urls))],
      connections: stats.flatMap((s) => s.connections)
    }
  };
}

/** Everything the inspector shows, read through each admin API. */
async function capture(admins: AdminWebsocket[]): Promise<InspectorCapture> {
  const apps: InspectorCapture['apps'] = [];
  const cells: InspectorCapture['cells'] = {};
  const networks: Network[] = [];
  for (const [i, admin] of admins.entries()) {
    for (const app of await admin.listApps({})) {
      const appId = memberAppId(app.installed_app_id, i, admins.length);
      apps.push({ ...(app as unknown as InspectorCapture['apps'][number]), installed_app_id: appId });
      for (const [role, infos] of Object.entries(app.cell_info)) {
        for (const info of infos) {
          if (info.type !== 'provisioned' && info.type !== 'cloned') continue;
          cells[`${appId}/${role}`] = (await admin.dumpFullState({
            cell_id: info.value.cell_id
          })) as unknown as InspectorCapture['cells'][string];
        }
      }
    }
    networks.push((await admin.dumpNetworkStats()) as unknown as Network);
  }
  return { apps, cells, network: mergeNetworks(networks), takenAt: Date.now() };
}

/** Per role, its integrity zomes' type names, read once: the DNAs do not change while the stack runs. */
const typesByRole = new Map<string, ZomeTypes>();
async function typesFor(admin: AdminWebsocket, role: string, cellId: unknown, adapter: InspectorAdapter): Promise<ZomeTypes> {
  const known = typesByRole.get(role);
  if (known) return known;
  // The zome names and their order come from the conductor; only their type names come from the adapter.
  const def = (await admin.getDnaDefinition(cellId as never)) as unknown as { integrity_zomes: Array<[string, unknown]> };
  const types = zomeTypes(def.integrity_zomes.map(([name]) => name), adapter.zomeNames);
  typesByRole.set(role, types);
  return types;
}

/** The graph page's data: the network of cells, then one record graph per DNA. */
async function graphState(admins: AdminWebsocket[], adapter: InspectorAdapter) {
  const c = await capture(admins);
  const cells = c.apps.flatMap((app) =>
    Object.entries(app.cell_info).flatMap(([role, infos]) =>
      infos
        .filter((i) => i.value.cell_id && c.cells[`${app.installed_app_id}/${role}`])
        .map((i) => ({
          appId: app.installed_app_id,
          role,
          cellId: i.value.cell_id!,
          agentKey: app.agent_pub_key,
          dump: c.cells[`${app.installed_app_id}/${role}`] as unknown as CellDump
        }))
    )
  );
  const roles: Record<string, ReturnType<typeof roleGraph>> = {};
  for (const role of [...new Set(cells.map((x) => x.role))]) {
    const ofRole = cells.filter((x) => x.role === role);
    roles[role] = roleGraph(role, ofRole, await typesFor(admins[0], role, ofRole[0].cellId, adapter));
  }
  return { summary: inspectorView(c), network: networkGraph(cells), roles };
}

/**
 * The inspector page on 127.0.0.1 only: `/` is the page, `/api/graph` its
 * data, `/vendor/cytoscape.min.js` the pinned graph library, so it runs offline.
 * A conductor given by port is connected on the first request that needs it,
 * and again after it drops, so the server can start before the conductors do.
 */
export function serveInspector(sources: ConductorSource[], port: number, adapter: InspectorAdapter = genericAdapter): Server {
  const open = new Map<number, AdminWebsocket>();
  const admins = () =>
    Promise.all(
      sources.map(async (s, i) => {
        if (typeof s !== 'number') return s;
        const known = open.get(i);
        if (known) return known;
        const ws = await AdminWebsocket.connect({ url: new URL(`ws://localhost:${s}`), wsClientOptions: { origin: ORIGIN } });
        ws.client.socket.addEventListener('close', () => open.delete(i));
        open.set(i, ws);
        return ws;
      })
    );
  // The page's pure view logic, written in TypeScript and unit-tested as it is,
  // served with its types stripped by Node itself (node:module, Node 22.13+).
  const viewModule = () =>
    (nodeModule as unknown as { stripTypeScriptTypes: (src: string) => string }).stripTypeScriptTypes(
      readFileSync(join(ROOT, 'scripts', 'inspector-view.mts'), 'utf8')
    );
  // Read on every request, so an edit to the page shows on reload without restarting the conductor.
  const page = () => readFileSync(join(ROOT, 'scripts', 'inspector.html'));
  const send = (res: ServerResponse, type: string, body: string | Buffer) =>
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' }).end(body);
  const server = createHttpServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') return send(res, 'text/html; charset=utf-8', page());
    if (req.url === '/vendor/cytoscape.min.js') return send(res, 'text/javascript', readFileSync(CYTOSCAPE));
    if (req.url === '/inspector-view.js') return send(res, 'text/javascript', viewModule());
    if (req.url === '/api/config') return send(res, 'application/json', JSON.stringify(configOf(adapter)));
    if (req.url === '/api/graph') {
      admins()
        .then((admins) => graphState(admins, adapter))
        .then((g) => send(res, 'application/json', JSON.stringify(g)))
        .catch((e) => res.writeHead(502).end(e instanceof Error ? e.message : String(e)));
      return;
    }
    res.writeHead(404).end();
  });
  server.listen(port, '127.0.0.1');
  return server;
}
