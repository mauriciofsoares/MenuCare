import { expect, test } from '@playwright/test'

test('carrega a aplicacao web', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('body')).toBeVisible()
})
