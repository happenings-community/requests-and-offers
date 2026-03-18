/**
 * Dev launcher: starts the app with agent 1 pre-configured as the network progenitor.
 *
 * Does NOT use @holochain/tryorama (incompatible with Holochain 0.6 quic transport).
 * Uses the hc sandbox CLI + holochain binary directly — same approach tryorama uses
 * internally, but with quic instead of webrtc.
 *
 * Usage (inside nix develop):
 *   bun start:progenitor
 *   AGENTS=3 bun start:progenitor
 *
 * Each agent URL is printed on startup. Open in separate browser windows.
 * The URL includes ?hcPort=N&hcToken=<base64> so the UI connects to the right conductor.
 *
 * Requires holochain and hc binaries in PATH (run inside `nix develop`).
 */

import { execSync, spawn, type ChildProcess } from "child_process";
import { readFileSync } from "fs";
import path from "path";
import { AdminWebsocket, encodeHashToBase64 } from "@holochain/client";

const AGENTS = parseInt(process.env.AGENTS ?? "2");
const UI_PORT = parseInt(process.env.UI_PORT ?? "8880");
const NETWORK_SEED = "dev_progenitor";
const HAPP_PATH = path.resolve(import.meta.dir, "../workdir/requests_and_offers.happ");
const CONDUCTOR_CONFIG = "conductor-config.yaml";
const LAIR_PASSWORD = "lair-password\n";
const ALLOWED_ORIGIN = "hc-dev-progenitor";

// ── Build ─────────────────────────────────────────────────────────────────────

console.log("\n[start:progenitor] Building happ...");
execSync("bun run build:happ", { stdio: "inherit", cwd: path.resolve(import.meta.dir, "..") });

// ── Conductor helpers ─────────────────────────────────────────────────────────

/**
 * Creates a conductor sandbox dir using `hc sandbox create --in-process-lair network quic`.
 * Returns the temp directory path where the conductor config was written.
 */
async function createConductorDir(): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("hc", ["sandbox", "--piped", "create", "--in-process-lair", "network", "quic"]);
    proc.stdin.write(LAIR_PASSWORD);
    proc.stdin.end();

    let conductorDir = "";
    proc.stdout.on("data", (data: Buffer) => {
      const text = data.toString();
      const matches = [...text.matchAll(/DataRootPath\("(.*?)"\)/g)];
      if (matches.length) conductorDir = matches[0][1];
    });
    proc.stderr.on("data", (data: Buffer) => {
      const text = data.toString();
      if (text.includes("error")) console.error("[hc create]", text.trim());
    });
    proc.on("close", (code) => {
      if (code !== 0 || !conductorDir) {
        reject(new Error(`hc sandbox create failed (code ${code})`));
      } else {
        resolve(conductorDir);
      }
    });
  });
}

/**
 * Starts a holochain conductor from a sandbox dir.
 * Returns (process, adminPort) once the conductor is ready.
 */
async function startConductor(conductorDir: string): Promise<{ proc: ChildProcess; adminPort: number }> {
  return new Promise((resolve, reject) => {
    const configPath = path.join(conductorDir, CONDUCTOR_CONFIG);
    const proc = spawn("holochain", ["--piped", "-c", configPath]);
    proc.stdin!.write(LAIR_PASSWORD);
    proc.stdin!.end();

    proc.stdout!.on("data", (data: Buffer) => {
      const text = data.toString();
      const match = text.match(/###ADMIN_PORT:(\d+)###/);
      if (match) {
        resolve({ proc, adminPort: parseInt(match[1]) });
      }
    });
    proc.stderr!.on("data", (data: Buffer) => {
      // Holochain writes normal logs to stderr — only surface actual errors
      const text = data.toString();
      if (text.toLowerCase().includes("error")) {
        console.error("[holochain]", text.trim());
      }
    });
    proc.on("close", (code) => {
      reject(new Error(`holochain process exited unexpectedly (code ${code})`));
    });

    // Safety timeout
    setTimeout(() => reject(new Error("Conductor startup timed out after 30s")), 30_000);
  });
}

// ── Process tracking for shutdown ────────────────────────────────────────────

const conductorProcesses: ChildProcess[] = [];
const adminWebsockets: AdminWebsocket[] = [];

const shutdown = async () => {
  console.log("\n[start:progenitor] Shutting down conductors...");
  for (const ws of adminWebsockets) {
    try { ws.client.close(); } catch { /* ignore */ }
  }
  for (const proc of conductorProcesses) {
    proc.kill("SIGTERM");
  }
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// ── Start all conductors ──────────────────────────────────────────────────────

console.log(`\n[start:progenitor] Creating ${AGENTS} conductor(s) (quic transport)...\n`);

const adminPorts: number[] = [];
for (let i = 0; i < AGENTS; i++) {
  const conductorDir = await createConductorDir();
  const { proc, adminPort } = await startConductor(conductorDir);
  conductorProcesses.push(proc);
  adminPorts.push(adminPort);
  console.log(`[start:progenitor] Conductor ${i + 1} ready on admin port ${adminPort}`);
}

// ── Connect admin websockets ──────────────────────────────────────────────────

const adminWSes: AdminWebsocket[] = [];
for (const port of adminPorts) {
  const ws = await AdminWebsocket.connect({
    url: new URL(`ws://localhost:${port}`),
    wsClientOptions: { origin: ALLOWED_ORIGIN },
  });
  adminWSes.push(ws);
  adminWebsockets.push(ws);
}

// ── Agent 1: generate progenitor pubkey ──────────────────────────────────────

const progenitorPubKey = await adminWSes[0].generateAgentPubKey();
const progenitorB64 = encodeHashToBase64(progenitorPubKey);
console.log(`\n[start:progenitor] Progenitor pubkey: ${progenitorB64}\n`);

const rolesSettings = {
  requests_and_offers: {
    type: "provisioned" as const,
    value: {
      modifiers: {
        properties: { progenitor_pubkey: progenitorB64 },
      },
    },
  },
};

// ── Install happ in all conductors ───────────────────────────────────────────

const agentInfos: Array<{ port: number; tokenB64: string }> = [];

for (let i = 0; i < AGENTS; i++) {
  const adminWs = adminWSes[i];
  const isProgenitor = i === 0;
  const installOptions: Record<string, unknown> = {
    networkSeed: NETWORK_SEED,
    rolesSettings,
  };
  if (isProgenitor) installOptions.agentPubKey = progenitorPubKey;

  const appInfo = await adminWs.installApp({
    appBundleSource: { type: "path", value: HAPP_PATH },
    options: installOptions as never,
  });

  await adminWs.enableApp({ installed_app_id: appInfo.installed_app_id });

  const { port } = await adminWs.attachAppInterface({
    allowed_origins: ALLOWED_ORIGIN,
    port: 0, // let OS assign
  });

  const tokenResp = await adminWs.issueAppAuthenticationToken({
    installed_app_id: appInfo.installed_app_id,
    single_use: false,
    expiry_seconds: 999999,
  });

  agentInfos.push({
    port,
    tokenB64: Buffer.from(tokenResp.token).toString("base64"),
  });

  const label = isProgenitor ? " (PROGENITOR)" : "";
  console.log(`[start:progenitor] Agent ${i + 1}${label} installed, app port ${port}`);
}

// ── UI dev server ─────────────────────────────────────────────────────────────

console.log(`\n[start:progenitor] Starting UI on http://localhost:${UI_PORT} ...`);

const uiProc = spawn("bun", ["run", "--filter", "ui", "start"], {
  stdio: "inherit",
  env: { ...process.env, UI_PORT: String(UI_PORT) },
  cwd: path.resolve(import.meta.dir, ".."),
});

uiProc.on("exit", (code) => {
  console.log(`[start:progenitor] UI process exited (${code}), shutting down...`);
  shutdown();
});

// Give Vite time to start
await new Promise((resolve) => setTimeout(resolve, 3000));

// ── Print agent URLs ──────────────────────────────────────────────────────────

console.log("\n[start:progenitor] ✅ Ready! Open each URL in a separate browser window:\n");
for (let i = 0; i < AGENTS; i++) {
  const { port, tokenB64 } = agentInfos[i];
  const label = i === 0 ? " (PROGENITOR)" : "";
  const url = `http://localhost:${UI_PORT}?hcPort=${port}&hcToken=${encodeURIComponent(tokenB64)}`;
  console.log(`  Agent ${i + 1}${label}: ${url}`);
}
console.log("\nPress Ctrl+C to stop all conductors.\n");

// ── Keep alive ────────────────────────────────────────────────────────────────

await new Promise<never>(() => {});
