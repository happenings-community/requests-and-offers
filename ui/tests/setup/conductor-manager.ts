import { AdminWebsocket, AppWebsocket } from '@holochain/client';
import { spawn, execSync, type ChildProcess } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const PROJECT_ROOT = join(__dirname, '../../..');
export const TEST_WORKDIR = join(PROJECT_ROOT, 'test-e2e-workdir');
export const PID_FILE = join(TEST_WORKDIR, '.conductor.pid');
export const ENV_FILE = join(TEST_WORKDIR, '.test-env.json');

// Fixed admin port so we don't need to parse conductor output
const FIXED_ADMIN_PORT = 55000;

function findConductorConfig(): string {
  const entries = readdirSync(TEST_WORKDIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const candidate = join(TEST_WORKDIR, entry.name, 'conductor-config.yaml');
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`No conductor-config.yaml found in ${TEST_WORKDIR}`);
}

function patchAdminPort(configPath: string): void {
  const lines = readFileSync(configPath, 'utf-8').split('\n');
  let inAdminInterfaces = false;
  let patched = false;

  const modified = lines.map((line) => {
    if (/^admin_interfaces:/.test(line)) {
      inAdminInterfaces = true;
    } else if (inAdminInterfaces && /^\S/.test(line) && line.trim()) {
      inAdminInterfaces = false;
    }
    if (inAdminInterfaces && !patched && /^\s+port:\s*\d+/.test(line)) {
      patched = true;
      return line.replace(/port:\s*\d+/, `port: ${FIXED_ADMIN_PORT}`);
    }
    return line;
  });

  writeFileSync(configPath, modified.join('\n'));
}

export async function startConductor(): Promise<void> {
  // Clean up any previous run
  execSync(`rm -rf "${TEST_WORKDIR}"`, { stdio: 'ignore' });
  execSync(`mkdir -p "${TEST_WORKDIR}"`);

  console.log('[e2e] Generating Holochain sandbox...');
  execSync(`nix develop --command hc sandbox generate --root "${TEST_WORKDIR}"`, {
    cwd: PROJECT_ROOT,
    stdio: 'pipe',
  });

  // Patch the generated config to use our fixed admin port
  const configPath = findConductorConfig();
  patchAdminPort(configPath);

  console.log('[e2e] Starting conductor on admin port', FIXED_ADMIN_PORT);
  const proc: ChildProcess = spawn(
    'nix',
    ['develop', '--command', 'hc', 'sandbox', 'run', '--root', TEST_WORKDIR],
    { cwd: PROJECT_ROOT, stdio: ['ignore', 'pipe', 'pipe'], detached: false }
  );

  proc.stderr?.on('data', (d) => {
    if (process.env.E2E_VERBOSE) process.stderr.write(d);
  });

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
  for (let i = 0; i < 30; i++) {
    try {
      admin = await AdminWebsocket.connect({ url: new URL(`ws://localhost:${FIXED_ADMIN_PORT}`) });
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  if (!admin) throw new Error('[e2e] Conductor failed to become ready after 30s');

  try {
    console.log('[e2e] Installing hApp...');
    await admin.installApp({
      source: { type: 'path', value: happPath },
      installed_app_id: 'requests_and_offers',
    });

    await admin.enableApp({ installed_app_id: 'requests_and_offers' });

    // port is omitted so the OS picks a free port
    const { port: appPort } = await admin.attachAppInterface({
      allowed_origins: '*',
    });

    const { token } = await admin.issueAppAuthenticationToken({
      installed_app_id: 'requests_and_offers',
      expiry_seconds: 3600,
      single_use: false,
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
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      /* already gone */
    }
  }
  // Wait briefly for clean shutdown
  await new Promise((r) => setTimeout(r, 1000));
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
  const token = Array.from(atob(tokenBase64), (c) => c.charCodeAt(0));
  return AppWebsocket.connect({
    url: new URL(`ws://localhost:${appPort}`),
    token,
  });
}
