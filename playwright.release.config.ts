import { defineConfig } from '@playwright/test'
import { sharedConfig } from './playwright.shared'

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL || 'https://speedgoatgmbh.github.io/online-configurator'

export default defineConfig({
  ...sharedConfig,
  use: {
    ...sharedConfig.use,
    baseURL,
  },
})
