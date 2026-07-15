import { AdminWebsocket, AppWebsocket } from '@holochain/client';
import { spawn, execSync, type ChildProcess } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const PROJECT_ROOT = join(__dirname, '../../..');
// Lair-keystore's unix socket path (<TEST_WORKDIR>/<sandbox-id>/ks/socket)
// must stay under the ~108-byte SUN_LEN limit. PROJECT_ROOT can be
// arbitrarily deep (e.g. inside a git worktree under .worktrees/<branch>/),
// so the sandbox lives under a short, STABLE temp path instead.
//
// Do NOT use os.tmpdir() here: inside `nix develop`, $TMPDIR points at the
// per-shell ephemeral dir (/tmp/nix-shell.XXXX). The conductor is launched
// through a *nested* `nix develop --command`, which has its own distinct
// $TMPDIR, so a path derived from the outer shell's tmpdir is not stable
// across the create/run boundary and intermittently yields
// "unable to open database file". A fixed short path avoids that entirely.
export const TEST_WORKDIR = process.env.RAO_E2E_WORKDIR ?? '/tmp/rao-e2e';
export const PID_FILE = join(TEST_WORKDIR, '.conductor.pid');
export const ENV_FILE = join(TEST_WORKDIR, '.test-env.json');

// Fixed admin port so we don't need to parse conductor output
export const FIXED_ADMIN_PORT = 55000;

// `hc sandbox --piped` reads the lair-keystore passphrase from stdin instead
// of prompting interactively (which hangs with no TTY attached). The same
// passphrase must be used for both `create` (which generates the keystore)
// and `run` (which unlocks it) since it protects a throwaway, single-run
// local keystore — there is nothing sensitive to protect it from here.
const LAIR_PASSPHRASE = 'e2e-test-passphrase';

// Holochain's websocket admin/app interfaces validate the `Origin` header
// against `allowed_origins`. Node's `ws` client sends no Origin header by
// default (unlike a browser), which the conductor rejects outright with a
// WS handshake failure ("Unexpected server response: 400") rather than
// treating it as "no origin". An explicit origin is required even though
// `allowed_origins` is configured as `Any`/`'*'` here.
const NODE_WS_ORIGIN = 'http://localhost';

// Free the fixed admin port if a conductor from a previous run is still bound
// to it. `hc sandbox run` is launched through `nix develop --command`, so the
// real `holochain` process is a *detached grandchild* of the spawned PID —
// killing the wrapper PID alone leaks it, and a leaked conductor keeps admin
// port FIXED_ADMIN_PORT bound so every later run connects to the dead sandbox
// instead of its own ("unable to open database file"). The main teardown path
// (stopConductor) reaps the whole process group; this is the defensive
// startup guard for a prior run that crashed without tearing down.
//
// Kill by port only — NOT `pkill -f <workdir>`, whose pattern would also match
// this very shell command's argv and SIGKILL itself before it could finish.
function killLeftoverConductor(): void {
  execSync(
    `PIDS=$(lsof -ti tcp:${FIXED_ADMIN_PORT} 2>/dev/null); [ -n "$PIDS" ] && kill -9 $PIDS 2>/dev/null; true`,
    { stdio: 'ignore' }
  );
}

export async function startConductor(): Promise<void> {
  // Clean up any previous run. `.hc` (written by `hc sandbox create` into
  // PROJECT_ROOT) tracks sandboxes by index — a stale entry from a prior
  // run would make `hc sandbox run --all` below try to start a sandbox
  // whose directory we just deleted.
  killLeftoverConductor();
  execSync(`rm -rf "${TEST_WORKDIR}" "${join(PROJECT_ROOT, '.hc')}"`, { stdio: 'ignore' });
  execSync(`mkdir -p "${TEST_WORKDIR}"`);

  console.log('[e2e] Generating Holochain sandbox...');
  // `hc sandbox generate` requires (or auto-discovers) a .happ to install.
  // We install the app ourselves via AdminWebsocket in setupHapp(), so we
  // want a bare conductor — that's `hc sandbox create`, not `generate`.
  // `--piped` reads the lair-keystore passphrase from stdin instead of
  // prompting interactively, which would hang with no TTY attached.
  execSync(`nix develop --command hc sandbox --piped create --root "${TEST_WORKDIR}"`, {
    cwd: PROJECT_ROOT,
    stdio: 'pipe',
    input: `${LAIR_PASSPHRASE}\n`
  });

  console.log('[e2e] Starting conductor on admin port', FIXED_ADMIN_PORT);
  // `hc sandbox run` takes sandbox indices from `$(pwd)/.hc` — it has no
  // `--root` flag. `--all` runs the single sandbox `create` just wrote
  // there. cwd must match the `create` call above so it reads the same
  // `.hc` file.
  //
  // `-f=<port>` is `hc sandbox`'s own mechanism for a fixed admin port —
  // note this MUST be applied at `run` time. Editing `port:` in the saved
  // conductor-config.yaml has no effect: `hc sandbox run` always rewrites
  // the admin interface's port to 0 (OS-assigned) before starting, so a
  // pre-patched value in the file is silently discarded.
  const proc: ChildProcess = spawn(
    'nix',
    ['develop', '--command', 'hc', 'sandbox', `-f=${FIXED_ADMIN_PORT}`, '--piped', 'run', '--all'],
    // stdout is 'ignore', not 'pipe' — nothing here ever reads it, and an
    // undrained pipe fills up and blocks the child process from writing
    // further output, which can hang the whole conductor indefinitely.
    //
    // detached: true puts the wrapper and its descendants (hc / holochain /
    // lair-keystore) in their own process group, so stopConductor can kill
    // the whole tree with `process.kill(-pid)` instead of leaking the
    // conductor. Without this, only the `nix develop` wrapper dies and the
    // real conductor lingers on the admin port.
    { cwd: PROJECT_ROOT, stdio: ['pipe', 'ignore', 'pipe'], detached: true }
  );

  proc.stderr?.on('data', (d) => {
    if (process.env.E2E_VERBOSE) process.stderr.write(d);
  });

  proc.stdin?.write(`${LAIR_PASSPHRASE}\n`);
  proc.stdin?.end();

  if (!proc.pid) throw new Error('Conductor process failed to start');
  writeFileSync(PID_FILE, String(proc.pid));
}

export async function setupHapp(): Promise<{ appPort: number; tokenBase64: string }> {
  const happPath = join(PROJECT_ROOT, 'workdir', 'requests_and_offers.happ');
  if (!existsSync(happPath)) {
    throw new Error(
      `[e2e] hApp not found at ${happPath}. Run 'bun build:happ' from the project root first.`
    );
  }

  console.log('[e2e] Connecting AdminWebsocket...');
  let admin: AdminWebsocket | null = null;
  // The conductor is launched via a nested `nix develop --command hc
  // sandbox ... run` (see startConductor) — shell activation alone can eat
  // several seconds on top of lair-keystore + holochain startup, so a 30s
  // budget is too tight and flakes under normal system load. 90s observed
  // to be comfortably enough; still bounded, not indefinite.
  const CONNECT_RETRIES = 90;
  for (let i = 0; i < CONNECT_RETRIES; i++) {
    try {
      admin = await AdminWebsocket.connect({
        url: new URL(`ws://localhost:${FIXED_ADMIN_PORT}`),
        wsClientOptions: { origin: NODE_WS_ORIGIN }
      });
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  if (!admin) {
    throw new Error(`[e2e] Conductor failed to become ready after ${CONNECT_RETRIES}s`);
  }

  try {
    console.log('[e2e] Installing hApp...');
    await admin.installApp({
      source: { type: 'path', value: happPath },
      installed_app_id: 'requests_and_offers'
    });

    await admin.enableApp({ installed_app_id: 'requests_and_offers' });

    // port is omitted so the OS picks a free port
    const { port: appPort } = await admin.attachAppInterface({
      allowed_origins: '*'
    });

    const { token } = await admin.issueAppAuthenticationToken({
      installed_app_id: 'requests_and_offers',
      expiry_seconds: 3600,
      single_use: false
    });

    // token is number[] — encode so it matches what HolochainClientService expects
    const tokenBase64 = btoa(String.fromCharCode(...token));

    console.log(`[e2e] App ready → port ${appPort}`);

    writeFileSync(ENV_FILE, JSON.stringify({ appPort, tokenBase64 }));
    return { appPort, tokenBase64 };
  } finally {
    try {
      await admin.client.close();
    } catch {
      /* ignore */
    }
  }
}

export async function stopConductor(): Promise<void> {
  if (existsSync(PID_FILE)) {
    const pid = parseInt(readFileSync(PID_FILE, 'utf-8'), 10);
    // Negative PID targets the whole process group (see detached: true in
    // startConductor) so the conductor + lair-keystore descendants die too,
    // not just the `nix develop` wrapper.
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      /* group already gone */
    }
    await new Promise((r) => setTimeout(r, 1000));
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      /* clean shutdown already happened */
    }
  }
  // Belt-and-suspenders: free the admin port and reap anything still holding
  // the workdir, in case the group kill missed a re-parented process.
  killLeftoverConductor();
  await new Promise((r) => setTimeout(r, 500));
  execSync(`rm -rf "${TEST_WORKDIR}"`, { stdio: 'ignore' });
}

export function readTestEnv(): { appPort: number; tokenBase64: string } {
  if (!existsSync(ENV_FILE)) {
    throw new Error('[e2e] Test env not found. Did globalSetup run?');
  }
  return JSON.parse(readFileSync(ENV_FILE, 'utf-8'));
}

export async function createZomeClient(
  appPort: number,
  tokenBase64: string
): Promise<AppWebsocket> {
  // Zome call signing credentials live in an in-memory keystore inside
  // @holochain/client (see zome-call-signing.js), scoped to the current
  // process. Playwright's globalSetup — where the app was installed — runs
  // in a separate process from test workers, so credentials authorized
  // there aren't visible here. Re-authorize them in this process before
  // returning the client, or every callZome() throws NoSigningCredentialsForCell.
  const admin = await AdminWebsocket.connect({
    url: new URL(`ws://localhost:${FIXED_ADMIN_PORT}`),
    wsClientOptions: { origin: NODE_WS_ORIGIN }
  });
  try {
    const cellIds = await admin.listCellIds();
    for (const cellId of cellIds) {
      await admin.authorizeSigningCredentials(cellId);
    }
  } finally {
    await admin.client.close();
  }

  const token = Array.from(atob(tokenBase64), (c) => c.charCodeAt(0));
  return AppWebsocket.connect({
    url: new URL(`ws://localhost:${appPort}`),
    token,
    wsClientOptions: { origin: NODE_WS_ORIGIN }
  });
}
