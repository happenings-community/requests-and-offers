import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isCI = !!process.env.CI;
const UI_PORT = process.env.E2E_UI_PORT ?? '8880';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: 1,

  reporter: [
    ['html', { outputFolder: 'test-results/html-report', open: isCI ? 'never' : 'on-failure' }],
    ['list', { printSteps: true }],
    ['junit', { outputFile: 'test-results/junit.xml', includeProjectInTestName: true }],
    ['json', { outputFile: 'test-results/test-results.json' }],
    ...(isCI ? [['github'] as const] : []),
    ...(process.env.SLACK_WEBHOOK_URL ? [['./tests/reporters/slack-reporter.ts'] as const] : [])
  ],

  globalSetup: join(__dirname, 'tests/setup/global-setup.ts'),
  globalTeardown: join(__dirname, 'tests/setup/global-teardown.ts'),

  // Generous timeouts — conductor startup adds ~10-20s on cold start
  timeout: isCI ? 120_000 : 60_000,
  expect: { timeout: isCI ? 15_000 : 10_000 },

  use: {
    // Tests always navigate via holochainUrl() from e2e-helpers, which builds
    // the full URL with ?hcPort=&hcToken= params. baseURL is a fallback only.
    baseURL: `http://localhost:${UI_PORT}`,

    trace: isCI ? 'retain-on-failure' : 'on-first-retry',
    screenshot: 'only-on-failure',
    video: isCI ? 'retain-on-failure' : 'on-first-retry',
    actionTimeout: isCI ? 20_000 : 15_000,
    navigationTimeout: isCI ? 45_000 : 30_000,
    ...(isCI && { reducedMotion: 'reduce', colorScheme: 'light' })
  },

  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        launchOptions: {
          args: [
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-web-security',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection',
            ...(isCI
              ? [
                  '--headless=new',
                  '--disable-gpu',
                  '--no-first-run',
                  '--disable-default-apps',
                  '--disable-background-timer-throttling',
                  '--disable-renderer-backgrounding',
                  '--disable-backgrounding-occluded-windows'
                ]
              : [])
          ]
        }
      }
    },

    ...(isCI
      ? [
          { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 720 } } },
          { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 720 } } }
        ]
      : [])
  ],

  // Starts only the Vite UI dev server. The Holochain conductor is managed
  // separately by global-setup / global-teardown via conductor-manager.ts.
  webServer: {
    command: `UI_PORT=${UI_PORT} bun run --filter ui start`,
    url: `http://localhost:${UI_PORT}`,
    // reuseExistingServer lets developers pre-start the UI with 'bun start'
    reuseExistingServer: !isCI,
    timeout: isCI ? 120_000 : 60_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },

  outputDir: 'test-results/artifacts',
});
