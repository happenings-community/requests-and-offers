import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function startHolochain() {
  const projectRoot = join(__dirname, '../../..');
  const workdirPath = join(projectRoot, 'workdir');
  const happPath = join(workdirPath, 'requests_and_offers.happ');

  try {
    // Ensure workdir exists
    execSync(`mkdir -p ${workdirPath}`, {
      stdio: 'inherit',
      cwd: projectRoot
    });

    // Start conductor in background
    console.log('Starting Holochain conductor...');
    execSync(`nix develop --command hc sandbox generate --root ${workdirPath}`, {
      stdio: 'inherit',
      cwd: projectRoot
    });

    // Install and activate happ
    console.log('Installing happ...');
    execSync(`nix develop --command hc sandbox call install-app '${happPath}'`, {
      stdio: 'inherit',
      cwd: projectRoot
    });

    console.log('Activating happ...');
    execSync('nix develop --command hc sandbox call activate-app requests_and_offers', {
      stdio: 'inherit',
      cwd: projectRoot
    });

    // Wait for conductor to be ready
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log('Holochain conductor is ready');
  } catch (error) {
    console.error('Failed to start Holochain:', error);
    throw error;
  }
}

export async function stopHolochain() {
  try {
    const projectRoot = join(__dirname, '../../..');
    console.log('Stopping Holochain conductor...');
    execSync('nix develop --command hc sandbox clean', {
      stdio: 'inherit',
      cwd: projectRoot
    });
    console.log('Holochain conductor stopped');
  } catch (error) {
    console.error('Failed to stop Holochain:', error);
    throw error;
  }
}
