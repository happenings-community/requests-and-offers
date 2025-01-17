import { stopHolochain } from './start-holochain';

async function globalTeardown() {
  await stopHolochain();
}

export default globalTeardown;
