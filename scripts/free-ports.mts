/** Prints N free TCP ports on 127.0.0.1, comma-separated: `node scripts/free-ports.mts 2`. */
import { createServer, type Server } from 'node:net';

const n = Math.max(1, Number(process.argv[2]) || 1);
// Held open together until all are picked, so the same port is never printed twice.
const servers: Server[] = [];
const ports: number[] = [];
for (let i = 0; i < n; i++) {
  const srv = createServer();
  await new Promise<void>((resolve, reject) => {
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => resolve());
  });
  servers.push(srv);
  ports.push((srv.address() as { port: number }).port);
}
await Promise.all(servers.map((s) => new Promise((r) => s.close(r))));
console.log(ports.join(','));
