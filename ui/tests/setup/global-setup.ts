import { startConductor, setupHapp, FIXED_ADMIN_PORT } from './conductor-manager.js';

export default async function globalSetup() {
  await startConductor();
  const { appPort, tokenBase64 } = await setupHapp();

  // Expose to all test workers via process.env
  process.env.HC_APP_PORT = String(appPort);
  process.env.HC_APP_TOKEN = tokenBase64;
  // Admin port lets the browser authorize its own zome-call signing
  // credentials (a plain browser has no host signer). See holochainUrl().
  process.env.HC_ADMIN_PORT = String(FIXED_ADMIN_PORT);
}
