import { expect, test, type Page, type TestInfo } from '@playwright/test'

function trackSameOriginFailures(page: Page, testInfo: TestInfo) {
  const failures: string[] = []
  const configuredBaseUrl = testInfo.project.use.baseURL

  if (typeof configuredBaseUrl !== 'string') {
    return failures
  }

  const origin = new URL(configuredBaseUrl).origin

  page.on('requestfailed', (request) => {
    try {
      const url = new URL(request.url())
      if (url.origin !== origin) return
      failures.push(`REQUEST FAILED ${request.failure()?.errorText || 'unknown'} ${url.pathname}`)
    } catch {
      // Ignore malformed URLs from the browser layer.
    }
  })

  page.on('response', (response) => {
    try {
      const url = new URL(response.url())
      if (url.origin !== origin) return
      if (response.status() < 400) return
      failures.push(`HTTP ${response.status()} ${url.pathname}`)
    } catch {
      // Ignore malformed URLs from the browser layer.
    }
  })

  return failures
}

test.describe('Configurator smoke', () => {
  test('loads the homepage and core controls', async ({ page }, testInfo) => {
    const failures = trackSameOriginFailures(page, testInfo)

    await page.goto('/', { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('heading', { name: /Configure a Real-Time Test System/i })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Select target machine' })).toBeVisible()
    await expect(page.locator('#closed-loop-rate')).toBeVisible()
    await expect(page.getByRole('button', { name: /Generate System Proposal/i }).first()).toBeVisible()

    expect(failures).toEqual([])
  })

  test('opens the target system selector and switches machine', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    const selector = page.getByRole('button', { name: 'Select target machine' })

    await selector.click()
    await expect(page.getByRole('listbox', { name: 'Target machine options' })).toBeVisible()

    await page.getByRole('option', { name: /^Pulse\b/i }).click()

    await expect(page.getByRole('listbox', { name: 'Target machine options' })).toBeHidden()
    await expect(selector).toContainText('Pulse')
  })
})
