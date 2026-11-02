/**
 * `bun start:web`: the app in plain browser tabs, one per member, with Vite's
 * hot reload. See documentation/guides/web-dev-mode.md.
 *
 * One local bootstrap server, one sandbox conductor, the hApp installed once
 * per member (AGENTS, default 2) on one shared network seed, one Vite dev
 * server. Prints one URL per member; Ctrl-C tears everything down.
 *
 * Runs under Node, not Bun: @holochain/client's AdminWebsocket handshake fails
 * under Bun ("Expected 101") and succeeds under Node. Needs `hc`, `holochain`
 * and `kitsune2-bootstrap-srv` on PATH, so run it inside `nix develop`.
 */
import { AdminWebsocket } from '@holochain/client';
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  appIdFor,
  encodeToken,
  memberUrl,
  parseWebDevConfig,
  sandboxCreateArgs,
  sandboxRunArgs,
  workdirFor
} from './web-dev.mts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HAPP = join(ROOT, 'workdir', 'requests_and_offers.happ');
// Protects a throwaway local keystore; `--piped` reads it from stdin for both
// `create` and `run`, which would otherwise prompt with no TTY.
const LAIR_PASSPHRASE = 'web-dev-passphrase';
// The conductor checks the Origin header and Node's ws client sends none.
const ORIGIN = 'http://localhost';
const TOKEN_LIFETIME_S = 24 * 60 * 60;

const log = (msg: string) => console.log(`[web] ${msg}`);

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      srv.close(() => (typeof addr === 'object' && addr ? resolve(addr.port) : reject(new Error('no port'))));
    });
  });
}

function onPath(bin: string): boolean {
  try {
    execFileSync('which', [bin], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const children: ChildProcess[] = [];
let workdir: string | null = null;
let stopping = false;

/** Each child runs in its own process group, so the whole tree is killed. */
function start(cmd: string, args: string[], opts: Parameters<typeof spawn>[2] = {}): ChildProcess {
  const child = spawn(cmd, args, { detached: true, ...opts });
  children.push(child);
  return child;
}

async function shutdown(code: number): Promise<never> {
  if (!stopping) {
    stopping = true;
    log('tearing down...');
    for (const signal of ['SIGTERM', 'SIGKILL'] as const) {
      for (const child of children) {
        try {
          if (child.pid) process.kill(-child.pid, signal);
        } catch {
          /* already gone */
        }
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (workdir) rmSync(workdir, { recursive: true, force: true });
  }
  process.exit(code);
}

process.on('SIGINT', () => void shutdown(0));
process.on('SIGTERM', () => void shutdown(0));

async function main() {
  const config = parseWebDevConfig(process.env);
  for (const bin of ['hc', 'holochain', 'kitsune2-bootstrap-srv']) {
    if (!onPath(bin)) throw new Error(`${bin} is not on PATH: run this inside \`nix develop\``);
  }
  if (!existsSync(HAPP)) throw new Error(`${HAPP} is missing: run \`bun run build:happ\` first`);

  const adminPort = config.adminPort ?? (await freePort());
  const bootstrapPort = config.bootstrapPort ?? (await freePort());
  const bootstrapUrl = `http://127.0.0.1:${bootstrapPort}`;
  workdir = workdirFor(adminPort);
  rmSync(workdir, { recursive: true, force: true });
  mkdirSync(workdir, { recursive: true });

  log(`local bootstrap server on ${bootstrapUrl}`);
  start('kitsune2-bootstrap-srv', ['--listen', `127.0.0.1:${bootstrapPort}`], { stdio: 'ignore' });

  // `hc sandbox create` writes its `.hc` index into its working directory and
  // `run --all` reads it from there, so both run inside the workdir: the
  // project root's `.hc` (used by `bun start` and the e2e suite) is untouched.
  log(`creating the sandbox in ${workdir}`);
  execFileSync('hc', sandboxCreateArgs(workdir, bootstrapUrl), {
    cwd: workdir,
    input: `${LAIR_PASSPHRASE}\n`,
    stdio: ['pipe', 'ignore', 'inherit']
  });

  log(`starting the conductor on admin port ${adminPort}`);
  const conductor = start('hc', sandboxRunArgs(adminPort), {
    cwd: workdir,
    // stdout is never read: an undrained pipe would block the conductor.
    stdio: ['pipe', 'ignore', process.env.WEB_VERBOSE ? 'inherit' : 'ignore']
  });
  conductor.stdin?.end(`${LAIR_PASSPHRASE}\n`);

  let admin: AdminWebsocket | null = null;
  for (let i = 0; i < 90 && !admin; i++) {
    try {
      admin = await AdminWebsocket.connect({
        url: new URL(`ws://localhost:${adminPort}`),
        wsClientOptions: { origin: ORIGIN }
      });
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  if (!admin) throw new Error(`the conductor did not answer on admin port ${adminPort} within 90s`);

  // One seed for every member, so they share one network; a fresh one per run,
  // so no other conductor's data or peers are in it.
  const networkSeed = `web-dev-${Date.now()}`;
  const { port: appPort } = await admin.attachAppInterface({ allowed_origins: '*' });
  const urls: string[] = [];
  for (let i = 0; i < config.agents; i++) {
    const installed_app_id = appIdFor(i);
    await admin.installApp({
      source: { type: 'path', value: HAPP },
      installed_app_id,
      network_seed: networkSeed
    });
    await admin.enableApp({ installed_app_id });
    const { token } = await admin.issueAppAuthenticationToken({
      installed_app_id,
      expiry_seconds: TOKEN_LIFETIME_S,
      single_use: false
    });
    urls.push(memberUrl({ uiPort: config.uiPort, appPort, token: encodeToken(token), adminPort }));
    log(`installed ${installed_app_id}`);
  }
  await admin.client.close();

  log(`starting Vite on :${config.uiPort}`);
  start('bun', ['run', '--filter', 'ui', 'start'], {
    cwd: ROOT,
    env: { ...process.env, UI_PORT: String(config.uiPort) },
    stdio: ['ignore', 'inherit', 'inherit']
  });
  const deadline = Date.now() + 90_000;
  let up = false;
  while (!up && Date.now() < deadline) {
    up = await fetch(`http://localhost:${config.uiPort}/`).then(
      (r) => r.ok,
      () => false
    );
    if (!up) await new Promise((r) => setTimeout(r, 500));
  }
  if (!up) throw new Error(`Vite did not answer on :${config.uiPort} within 90s`);

  console.log('');
  log(`ready: ${config.agents} member(s), network seed ${networkSeed}`);
  urls.forEach((url, i) => log(`  member ${String.fromCharCode(65 + i)}  ${url}`));
  log('open each URL in its own browser profile or window; Ctrl-C stops everything.');
}

main().catch(async (error) => {
  console.error(`[web] ${error instanceof Error ? error.message : String(error)}`);
  await shutdown(1);
});
