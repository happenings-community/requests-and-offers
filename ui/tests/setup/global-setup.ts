import { startConductor, setupHapp } from './conductor-manager.js';

export default async function globalSetup() {
  await startConductor();
  const { appPort, tokenBase64 } = await setupHapp();

  // Expose to all test workers via process.env
  process.env.HC_APP_PORT = String(appPort);
  process.env.HC_APP_TOKEN = tokenBase64;
}
