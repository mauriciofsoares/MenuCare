import { expect, test } from '@playwright/test'

test('exibe formulario de login e permite alternar para primeiro acesso', async ({ page }) => {
  await page.goto('/')

  const loginEmail = page.locator('form.auth-form input[type="email"]')
  const loginPassword = page.locator('form.auth-form input[type="password"]')

  await expect(loginEmail).toBeVisible()
  await expect(loginPassword).toBeVisible()

  const authTabs = page.locator('.auth-tabs .auth-tab')
  await expect(authTabs).toHaveCount(2)
  await authTabs.nth(1).click()

  const inviteToken = page.locator('form.auth-form input[type="text"]')
  const invitePassword = page.locator('form.auth-form input[type="password"]')

  await expect(inviteToken).toBeVisible()
  await expect(invitePassword).toBeVisible()
  await expect(inviteToken).toHaveAttribute('required', '')
  await expect(invitePassword).toHaveAttribute('required', '')
})

test('realiza login com sucesso usando mock da API e mostra sessao ativa', async ({ page }) => {
  await page.route('**/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        token: 'fake-token',
        user: {
          id: 'user-1',
          name: 'Admin MenuCare',
          email: 'admin@menucare.local',
          companyName: 'Empresa Teste',
          accessProfile: 'Administrador',
        },
      }),
    })
  })

  await page.goto('/')

  await page.locator('form.auth-form input[type="email"]').fill('admin@menucare.local')
  await page.locator('form.auth-form input[type="password"]').fill('Admin@123')
  await page.locator('form.auth-form .auth-button').click()

  await expect(page.locator('.session-chip')).toContainText('Empresa Teste')
})

test('exibe erro quando login retorna 401', async ({ page }) => {
  await page.route('**/auth/login', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'error',
        message: 'Credenciais invalidas',
      }),
    })
  })

  await page.goto('/')

  await page.locator('form.auth-form input[type="email"]').fill('admin@menucare.local')
  await page.locator('form.auth-form input[type="password"]').fill('SenhaErrada')
  await page.locator('form.auth-form .auth-button').click()

  await expect(page.locator('form.auth-form .auth-error')).toHaveText('Credenciais invalidas')
  await expect(page.locator('.session-chip')).toHaveCount(0)
})

test('carrega area principal apos login com dashboard mockado', async ({ page }) => {
  await page.route('**/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        token: 'fake-token',
        user: {
          id: 'user-1',
          name: 'Admin MenuCare',
          email: 'admin@menucare.local',
          companyName: 'Empresa Teste',
          accessProfile: 'Administrador',
        },
      }),
    })
  })

  await page.route('**/dashboard/summary', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        summary: {
          contractsCount: 12,
          rulesApprovedCount: 8,
          rulesPendingCount: 3,
          nonConformitiesOpenCount: 2,
          actionPlansInProgressCount: 1,
        },
      }),
    })
  })

  await page.route('**/contracts?limit=30', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ contracts: [] }),
    })
  })

  await page.route('**/rules?limit=30', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rules: [] }),
    })
  })

  await page.route('**/non-conformities?limit=30', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ nonConformities: [] }),
    })
  })

  await page.goto('/')

  await page.locator('form.auth-form input[type="email"]').fill('admin@menucare.local')
  await page.locator('form.auth-form input[type="password"]').fill('Admin@123')
  await page.locator('form.auth-form .auth-button').click()

  await expect(page.locator('.hero-panel')).toBeVisible()
  await expect(page.locator('.hero-metrics')).toContainText('12')
  await expect(page.locator('.hero-metrics')).toContainText('8')
})
