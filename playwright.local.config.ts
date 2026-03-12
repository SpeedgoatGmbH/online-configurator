import { defineConfig } from '@playwright/test'
import { sharedConfig } from './playwright.shared'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'

export default defineConfig({
  ...sharedConfig,
  workers: 1,
  use: {
    ...sharedConfig.use,
    baseURL,
  },
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
