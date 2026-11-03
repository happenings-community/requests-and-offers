/**
 * `bun start`'s inspector: the same graph page as `bun start:web`, over the
 * conductors hc-spin starts, one per member. `ADMIN_PORTS` lists their admin
 * ports (the `network` script picks them and passes them to hc-spin with
 * `--force-admin-ports`); `INSPECTOR_PORT` is the page's port, free if unset.
 * Prints the URL and opens it unless WEB_OPEN=0. Starts before the conductors
 * do: each one is connected on the page's first request after it is up.
 *
 * Runs under Node, not Bun (see scripts/inspector-server.mts).
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { urlsToOpen } from './inspector.mts';
import { serveInspector } from './inspector-server.mts';
import { openCommand, parsePortList } from './web-dev.mts';

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      srv.close(() => (typeof addr === 'object' && addr ? resolve(addr.port) : reject(new Error('no port'))));
    });
  });

const adminPorts = parsePortList(process.env.ADMIN_PORTS);
if (adminPorts.length === 0) {
  console.error('[inspector] ADMIN_PORTS is empty: run it through `bun start`, which sets it.');
  process.exit(1);
}
const port = Number(process.env.INSPECTOR_PORT) || (await freePort());
serveInspector(adminPorts, port);
const url = `http://localhost:${port}/`;
console.log(`[inspector] ${url}  (conductors on admin ports ${adminPorts.join(', ')})`);
const opener = openCommand(process.platform);
for (const u of opener ? urlsToOpen([], url, process.env) : []) {
  const [cmd, ...args] = opener!;
  const child = spawn(cmd, [...args, u], { detached: true, stdio: 'ignore' });
  child.on('error', () => console.log(`[inspector] could not open ${u}; open it by hand`));
  child.unref();
}
