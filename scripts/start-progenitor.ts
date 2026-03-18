/**
 * Dev launcher: starts the app with agent 1 pre-configured as the network progenitor.
 *
 * Usage (inside nix develop):
 *   AGENTS=2 bun run scripts/start-progenitor.ts
 *
 * Each agent's UI URL is printed on startup. Open them in separate browser windows.
 * The URL includes ?hcPort=N&hcToken=<base64> so the UI connects to the right conductor.
 *
 * Requires the holochain binary in PATH (run inside `nix develop`).
 */

import { execSync, spawn } from "child_process";
import path from "path";
import { Scenario } from "@holochain/tryorama";
import { encodeHashToBase64 } from "@holochain/client";

const AGENTS = parseInt(process.env.AGENTS ?? "2");
const UI_PORT = parseInt(process.env.UI_PORT ?? "8880");
const NETWORK_SEED = "dev_progenitor";
const HAPP_PATH = path.resolve(import.meta.dir, "../workdir/requests_and_offers.happ");

// ── Build ─────────────────────────────────────────────────────────────────────

console.log("\n[start:progenitor] Building happ...");
execSync("bun run build:happ", { stdio: "inherit", cwd: path.resolve(import.meta.dir, "..") });

// ── Conductor setup ──────────────────────────────────────────────────────────

console.log(`\n[start:progenitor] Starting ${AGENTS} conductor(s)...\n`);

const scenario = new Scenario();

// Graceful shutdown
let cleaningUp = false;
const shutdown = async () => {
  if (cleaningUp) return;
  cleaningUp = true;
  console.log("\n[start:progenitor] Shutting down conductors...");
  await scenario.cleanUp();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// ── Agent 1: progenitor ──────────────────────────────────────────────────────

const progenitorConductor = await scenario.addConductor();
const progenitorPubKey = await progenitorConductor.adminWs().generateAgentPubKey();
const progenitorB64 = encodeHashToBase64(progenitorPubKey);

console.log(`[start:progenitor] Progenitor pubkey: ${progenitorB64}\n`);

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

const progenitorAppInfo = await progenitorConductor.installApp({
  appBundleSource: { type: "path", value: HAPP_PATH },
  options: { agentPubKey: progenitorPubKey, networkSeed: NETWORK_SEED, rolesSettings },
});

await progenitorConductor.adminWs().enableApp({
  installed_app_id: progenitorAppInfo.installed_app_id,
});

const progenitorPort = await progenitorConductor.attachAppInterface();
const progenitorTokenResp = await progenitorConductor.adminWs().issueAppAuthenticationToken({
  installed_app_id: progenitorAppInfo.installed_app_id,
  single_use: false,
  expiry_seconds: 999999,
});

const agentInfos: Array<{ port: number; tokenB64: string }> = [
  {
    port: progenitorPort,
    tokenB64: Buffer.from(progenitorTokenResp.token).toString("base64"),
  },
];

// ── Agents 2..N ──────────────────────────────────────────────────────────────

for (let i = 1; i < AGENTS; i++) {
  const conductor = await scenario.addConductor();
  const appInfo = await conductor.installApp({
    appBundleSource: { type: "path", value: HAPP_PATH },
    options: { networkSeed: NETWORK_SEED, rolesSettings },
  });

  await conductor.adminWs().enableApp({ installed_app_id: appInfo.installed_app_id });

  const port = await conductor.attachAppInterface();
  const tokenResp = await conductor.adminWs().issueAppAuthenticationToken({
    installed_app_id: appInfo.installed_app_id,
    single_use: false,
    expiry_seconds: 999999,
  });

  agentInfos.push({ port, tokenB64: Buffer.from(tokenResp.token).toString("base64") });
}

// ── Connect agents to each other ─────────────────────────────────────────────

await scenario.shareAllAgents();
console.log("[start:progenitor] Conductors connected to each other.\n");

// ── UI dev server ─────────────────────────────────────────────────────────────

console.log(`[start:progenitor] Starting UI on http://localhost:${UI_PORT} ...`);

const uiProc = spawn("bun", ["run", "--filter", "ui", "start"], {
  stdio: "inherit",
  env: { ...process.env, UI_PORT: String(UI_PORT) },
  cwd: path.resolve(import.meta.dir, ".."),
});

uiProc.on("exit", (code) => {
  if (!cleaningUp) {
    console.log(`[start:progenitor] UI process exited (${code}), shutting down...`);
    shutdown();
  }
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
