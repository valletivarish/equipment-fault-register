import { defineConfig, devices } from '@playwright/test'

// Same suite for local, CI and (the @smoke subset) the deployed URL.
export default defineConfig({
  testDir: './tests',
  outputDir: '../.artifacts/e2e/results',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../.artifacts/e2e/report' }],
    ['json', { outputFile: '../.artifacts/e2e/e2e.json' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:8080',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 820 } } }],
})
