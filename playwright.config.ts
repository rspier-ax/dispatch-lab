import { defineConfig, devices } from '@playwright/test';

const frontendPort = 4200;
const backendPort = 8080;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${frontendPort}`,
    trace: 'on-first-retry',
    viewport: { width: 1280, height: 800 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'go run ./cmd/server',
      cwd: './backend',
      port: backendPort,
      reuseExistingServer: !process.env.CI,
      env: {
        CORS_ORIGIN: `http://localhost:${frontendPort}`,
        SIM_TICK_MS: '200',
        DEMO_CONTROLS: 'true',
      },
    },
    {
      command: 'npm start',
      cwd: './frontend',
      port: frontendPort,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
