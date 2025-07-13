import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Environment-specific configuration
const isCI = !!process.env.CI;
const isTauriDev = !!process.env.TAURI_DEV;
const testEnv = process.env.TEST_ENV || 'development';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Disable parallel execution for Holochain tests
  forbidOnly: isCI,
  retries: isCI ? 2 : 0, // More retries in CI for stability
  workers: 1, // Single worker to avoid Holochain conductor conflicts

  // Enhanced reporting for CI/CD
  reporter: [
    [
      'html',
      {
        outputFolder: 'test-results/html-report',
        open: isCI ? 'never' : 'on-failure'
      }
    ],
    ['list', { printSteps: true }], // Detailed console output
    [
      'junit',
      {
        outputFile: 'test-results/junit.xml',
        includeProjectInTestName: true
      }
    ],
    ['json', { outputFile: 'test-results/test-results.json' }], // For CI analysis
    ...(isCI ? [['github'] as const] : []), // GitHub Actions integration
    ...(process.env.SLACK_WEBHOOK_URL ? [['./tests/reporters/slack-reporter.ts'] as const] : [])
  ],

  globalSetup: join(__dirname, 'tests/setup/global-setup.ts'),
  globalTeardown: join(__dirname, 'tests/setup/global-teardown.ts'),

  // Environment-specific timeouts
  timeout: isCI ? 120000 : 60000, // Longer timeout in CI
  expect: {
    timeout: isCI ? 15000 : 10000
  },
  use: {
    // Environment-specific base URL
    baseURL: isTauriDev ? 'http://localhost:5173' : 'tauri://localhost',

    // Enhanced tracing and debugging
    trace: isCI ? 'retain-on-failure' : 'on-first-retry',
    screenshot: isCI ? 'only-on-failure' : 'only-on-failure',
    video: isCI ? 'retain-on-failure' : 'on-first-retry',

    // Environment-specific timeouts for Holochain operations
    actionTimeout: isCI ? 20000 : 15000,
    navigationTimeout: isCI ? 45000 : 30000,

    // Additional CI-specific settings
    ...(isCI && {
      // Disable animations for more stable tests
      reducedMotion: 'reduce',
      // Force color scheme for consistency
      colorScheme: 'light'
    })
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
            '--disable-dev-shm-usage', // Prevent CI memory issues
            '--disable-web-security',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection',
            ...(isCI
              ? [
                  '--headless=new',
                  '--disable-gpu',
                  '--no-first-run',
                  '--disable-default-apps',
                  '--disable-popup-blocking',
                  '--disable-background-timer-throttling',
                  '--disable-renderer-backgrounding',
                  '--disable-backgrounding-occluded-windows'
                ]
              : [])
          ]
        }
      }
    },

    // Additional browser testing for CI
    ...(isCI
      ? [
          {
            name: 'firefox',
            use: {
              ...devices['Desktop Firefox'],
              viewport: { width: 1280, height: 720 }
            }
          },
          {
            name: 'webkit',
            use: {
              ...devices['Desktop Safari'],
              viewport: { width: 1280, height: 720 }
            }
          }
        ]
      : []),

    // Mobile testing (optional, for comprehensive coverage)
    ...(process.env.INCLUDE_MOBILE_TESTS
      ? [
          {
            name: 'mobile-chrome',
            use: {
              ...devices['Pixel 5']
            }
          },
          {
            name: 'mobile-safari',
            use: {
              ...devices['iPhone 12']
            }
          }
        ]
      : [])
  ],
  // Enhanced web server configuration
  webServer: isTauriDev
    ? {
        command: 'bun run start',
        url: 'http://localhost:5173',
        reuseExistingServer: !isCI,
        timeout: isCI ? 180000 : 120000, // 3 minutes in CI
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
          NODE_ENV: testEnv,
          ...(isCI && {
            CI: 'true',
            FORCE_COLOR: '0' // Disable colors in CI logs
          })
        }
      }
    : undefined,

  // Output directories
  outputDir: 'test-results/artifacts',

  // Metadata for CI integration
  metadata: {
    testEnvironment: testEnv,
    holochainVersion: process.env.HOLOCHAIN_VERSION || 'latest',
    nodeVersion: process.version,
    timestamp: new Date().toISOString()
  }
});
