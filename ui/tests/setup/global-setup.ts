import { startHolochain } from './start-holochain';

async function globalSetup() {
  await startHolochain();
}

export default globalSetup;
