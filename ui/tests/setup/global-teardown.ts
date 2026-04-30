import { stopConductor } from './conductor-manager.js';

export default async function globalTeardown() {
  await stopConductor();
}
