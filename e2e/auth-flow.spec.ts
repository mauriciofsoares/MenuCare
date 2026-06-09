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

test('encerra sessao no logout e retorna para a tela de login', async ({ page }) => {
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

  await page.route('**/auth/logout', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok' }),
    })
  })

  await page.goto('/')

  await page.locator('form.auth-form input[type="email"]').fill('admin@menucare.local')
  await page.locator('form.auth-form input[type="password"]').fill('Admin@123')
  await page.locator('form.auth-form .auth-button').click()

  await expect(page.locator('.hero-panel')).toBeVisible()
  await page.locator('.topbar-actions .logout-button').click()

  await expect(page.locator('form.auth-form input[type="email"]')).toBeVisible()
  await expect(page.locator('.session-chip')).toHaveCount(0)
})

test('mantem sessao apos reload usando auth/me e localStorage', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'menucare.auth',
      JSON.stringify({
        token: 'persisted-token',
        user: {
          id: 'user-1',
          name: 'Admin MenuCare',
          email: 'admin@menucare.local',
          companyName: 'Empresa Persistida',
          accessProfile: 'Administrador',
        },
      }),
    )
  })

  await page.route('**/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'user-1',
          name: 'Admin MenuCare',
          email: 'admin@menucare.local',
          companyName: 'Empresa Persistida',
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
        summary: {
          contractsCount: 5,
          rulesApprovedCount: 4,
          rulesPendingCount: 1,
          nonConformitiesOpenCount: 0,
          actionPlansInProgressCount: 0,
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

  await expect(page.locator('.session-chip')).toContainText('Empresa Persistida')

  await page.reload()

  await expect(page.locator('.session-chip')).toContainText('Empresa Persistida')
  await expect(page.locator('form.auth-form input[type="email"]')).toHaveCount(0)
})

test('limpa sessao expirada quando auth/me retorna 401', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'menucare.auth',
      JSON.stringify({
        token: 'expired-token',
        user: {
          id: 'user-expired',
          name: 'Sessao Expirada',
          email: 'expired@menucare.local',
          companyName: 'Empresa Expirada',
          accessProfile: 'Administrador',
        },
      }),
    )
  })

  await page.route('**/auth/me', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'error', message: 'Sessao invalida ou expirada' }),
    })
  })

  await page.goto('/')

  await expect(page.locator('form.auth-form input[type="email"]')).toBeVisible()
  await expect(page.locator('.session-chip')).toHaveCount(0)

  const persistedSession = await page.evaluate(() => window.localStorage.getItem('menucare.auth'))
  expect(persistedSession).toBeNull()
})

test('ativa primeiro acesso com sucesso e retorna para login', async ({ page }) => {
  await page.route('**/auth/first-access/activate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        message: 'Primeiro acesso ativado com sucesso.',
        email: 'novo.usuario@menucare.local',
      }),
    })
  })

  await page.goto('/')

  const authTabs = page.locator('.auth-tabs .auth-tab')
  await authTabs.nth(1).click()

  await page.locator('form.auth-form input[type="text"]').fill('INVITE-123')
  await page.locator('form.auth-form input[type="password"]').fill('NovaSenha@123')
  await page.locator('form.auth-form .auth-button').click()

  await expect(page.locator('form.auth-form input[type="email"]')).toBeVisible()
  await expect(page.locator('form.auth-form .auth-success')).toHaveText(
    'Primeiro acesso ativado com sucesso.',
  )
  await expect(page.locator('form.auth-form input[type="email"]')).toHaveValue(
    'novo.usuario@menucare.local',
  )
})

test('exibe erro quando primeiro acesso retorna convite invalido', async ({ page }) => {
  await page.route('**/auth/first-access/activate', async (route) => {
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'error',
        message: 'Convite invalido ou expirado.',
      }),
    })
  })

  await page.goto('/')

  const authTabs = page.locator('.auth-tabs .auth-tab')
  await authTabs.nth(1).click()

  await page.locator('form.auth-form input[type="text"]').fill('INVITE-INVALIDO')
  await page.locator('form.auth-form input[type="password"]').fill('Senha@123')
  await page.locator('form.auth-form .auth-button').click()

  await expect(page.locator('form.auth-form .auth-error')).toHaveText('Convite invalido ou expirado.')
  await expect(page.locator('form.auth-form input[type="text"]')).toBeVisible()
  await expect(page.locator('form.auth-form input[type="email"]')).toHaveCount(0)
})

test('encerra sessao local mesmo quando logout retorna 500', async ({ page }) => {
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

  await page.route('**/auth/logout', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'error', message: 'Falha ao encerrar sessao.' }),
    })
  })

  await page.goto('/')

  await page.locator('form.auth-form input[type="email"]').fill('admin@menucare.local')
  await page.locator('form.auth-form input[type="password"]').fill('Admin@123')
  await page.locator('form.auth-form .auth-button').click()

  await expect(page.locator('.hero-panel')).toBeVisible()
  await page.locator('.topbar-actions .logout-button').click()

  await expect(page.locator('form.auth-form input[type="email"]')).toBeVisible()
  await expect(page.locator('.session-chip')).toHaveCount(0)

  const persistedSession = await page.evaluate(() => window.localStorage.getItem('menucare.auth'))
  expect(persistedSession).toBeNull()
})

test('persiste idioma escolhido no login para escopo global e da empresa', async ({ page }) => {
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

  await page.route('**/preferences/locale', async (route) => {
    const request = route.request()

    if (request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ locale: 'en-US' }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok' }),
    })
  })

  await page.route('**/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
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

  const loginLocaleSelect = page.locator('.auth-card .locale-control select').first()
  await loginLocaleSelect.selectOption('en-US')

  await page.locator('form.auth-form input[type="email"]').fill('admin@menucare.local')
  await page.locator('form.auth-form input[type="password"]').fill('Admin@123')
  await page.locator('form.auth-form .auth-button').click()

  await expect(page.locator('.topbar-actions .locale-control select')).toHaveValue('en-US')

  const savedLocalesAfterLogin = await page.evaluate(() => ({
    global: window.localStorage.getItem('menucare.locale'),
    company: window.localStorage.getItem('menucare.locale.company.empresa-teste'),
  }))

  expect(savedLocalesAfterLogin.global).toBe('en-US')
  expect(savedLocalesAfterLogin.company).toBe('en-US')

  await page.reload()

  await expect(page.locator('.topbar-actions .locale-control select')).toHaveValue('en-US')
})

test('cria contrato e exibe item na lista de contratos', async ({ page }) => {
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
        summary: {
          contractsCount: 1,
          rulesApprovedCount: 0,
          rulesPendingCount: 0,
          nonConformitiesOpenCount: 0,
          actionPlansInProgressCount: 0,
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

  await page.route('**/contracts', async (route) => {
    const request = route.request()

    if (request.method() !== 'POST') {
      await route.continue()
      return
    }

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        contract: {
          id: 'contract-e2e-1',
          title: 'Contrato E2E Principal',
          sourceType: 'regulation',
          status: 'active',
        },
      }),
    })
  })

  await page.goto('/')

  await page.locator('form.auth-form input[type="email"]').fill('admin@menucare.local')
  await page.locator('form.auth-form input[type="password"]').fill('Admin@123')
  await page.locator('form.auth-form .auth-button').click()

  const contractPanel = page
    .locator('article.panel')
    .filter({ has: page.getByRole('heading', { name: 'Novo contrato' }) })
  await contractPanel.locator('input[type="text"]').fill('Contrato E2E Principal')
  await contractPanel.locator('select').nth(0).selectOption('regulation')
  await contractPanel.locator('select').nth(1).selectOption('active')
  await contractPanel.locator('button.auth-button').click()

  const contractsListPanel = page
    .locator('article.panel')
    .filter({ has: page.getByRole('heading', { name: 'Contratos' }) })
  await expect(contractsListPanel).toContainText('Contrato E2E Principal')
  await expect(contractsListPanel).toContainText(/Ativo|Active/)
})

test('cria regra contratual vinculada e exibe item na lista de regras', async ({ page }) => {
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
        summary: {
          contractsCount: 1,
          rulesApprovedCount: 1,
          rulesPendingCount: 0,
          nonConformitiesOpenCount: 0,
          actionPlansInProgressCount: 0,
        },
      }),
    })
  })

  await page.route('**/contracts?limit=30', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        contracts: [
          {
            id: 'contract-base-1',
            title: 'Contrato Base E2E',
            sourceType: 'contract',
            status: 'active',
          },
        ],
      }),
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

  await page.route('**/rules', async (route) => {
    const request = route.request()

    if (request.method() !== 'POST') {
      await route.continue()
      return
    }

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        rule: {
          id: 'rule-e2e-1',
          contractId: 'contract-base-1',
          title: 'Regra E2E de Temperatura',
          description: 'Garantir monitoramento termico continuo.',
          category: 'Seguranca alimentar',
          status: 'approved',
        },
      }),
    })
  })

  await page.goto('/')

  await page.locator('form.auth-form input[type="email"]').fill('admin@menucare.local')
  await page.locator('form.auth-form input[type="password"]').fill('Admin@123')
  await page.locator('form.auth-form .auth-button').click()

  const rulePanel = page
    .locator('article.panel')
    .filter({ has: page.getByRole('heading', { name: 'Nova regra contratual' }) })
  await rulePanel.locator('select').first().selectOption('contract-base-1')
  await rulePanel.locator('input[type="text"]').first().fill('Regra E2E de Temperatura')
  await rulePanel.locator('textarea').fill('Garantir monitoramento termico continuo.')
  await rulePanel.locator('input[type="text"]').nth(1).fill('Seguranca alimentar')
  await rulePanel.locator('select').nth(1).selectOption('approved')
  await rulePanel.locator('button.auth-button').click()

  const rulesListPanel = page
    .locator('article.panel')
    .filter({ has: page.getByRole('heading', { name: 'Regras contratuais' }) })
  await expect(rulesListPanel).toContainText('Regra E2E de Temperatura')
  await expect(rulesListPanel).toContainText(/Aprovada|Approved/)
})

test('valida regra e exibe evento na auditoria de regras', async ({ page }) => {
  let currentRuleStatus = 'under_review'
  let validationRecorded = false

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
        summary: {
          contractsCount: 1,
          rulesApprovedCount: currentRuleStatus === 'approved' ? 1 : 0,
          rulesPendingCount: currentRuleStatus === 'approved' ? 0 : 1,
          nonConformitiesOpenCount: 0,
          actionPlansInProgressCount: 0,
        },
      }),
    })
  })

  await page.route('**/contracts?limit=30', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        contracts: [
          {
            id: 'contract-base-1',
            title: 'Contrato Base E2E',
            sourceType: 'contract',
            status: 'active',
          },
        ],
      }),
    })
  })

  await page.route('**/rules?limit=30', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        rules: [
          {
            id: 'rule-base-1',
            contractId: 'contract-base-1',
            title: 'Regra Base para Validacao',
            description: 'Descricao base para auditoria.',
            category: 'Seguranca alimentar',
            status: currentRuleStatus,
          },
        ],
      }),
    })
  })

  await page.route('**/non-conformities?limit=30', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ nonConformities: [] }),
    })
  })

  await page.route('**/rules/rule-base-1/history', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        events: validationRecorded
          ? [
              {
                id: 'rule-history-1',
                previousStatus: 'under_review',
                nextStatus: 'approved',
                note: 'Validado pelo fluxo E2E',
                actorName: 'Admin MenuCare',
                createdAt: '2026-06-09T10:00:00.000Z',
              },
            ]
          : [],
      }),
    })
  })

  await page.route('**/rules/rule-base-1/status', async (route) => {
    currentRuleStatus = 'approved'
    validationRecorded = true

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        message: 'Regra validada com sucesso.',
      }),
    })
  })

  await page.goto('/')

  await page.locator('form.auth-form input[type="email"]').fill('admin@menucare.local')
  await page.locator('form.auth-form input[type="password"]').fill('Admin@123')
  await page.locator('form.auth-form .auth-button').click()

  const auditPanel = page
    .locator('article.panel')
    .filter({ has: page.getByRole('heading', { name: 'Auditoria de regras' }) })
  await auditPanel.locator('select').first().selectOption('rule-base-1')
  await auditPanel.locator('select').nth(1).selectOption('approved')
  await auditPanel.locator('textarea').fill('Validado pelo fluxo E2E')
  await auditPanel.locator('button.auth-button').click()

  await expect(auditPanel).toContainText('Validado pelo fluxo E2E')
  await expect(auditPanel).toContainText(/Aprovada|Approved/)

  const rulesListPanel = page
    .locator('article.panel')
    .filter({ has: page.getByRole('heading', { name: 'Regras contratuais' }) })
  await expect(rulesListPanel).toContainText('Regra Base para Validacao')
  await expect(rulesListPanel).toContainText(/Aprovada|Approved/)
})

test('cria nao conformidade, adiciona plano de acao e atualiza status', async ({ page }) => {
  let currentNonConformityStatus = 'open'
  let currentActionPlanStatus = 'pending'
  let nonConformityHistoryRecorded = false
  let actionPlanHistoryRecorded = false

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
        summary: {
          contractsCount: 1,
          rulesApprovedCount: 1,
          rulesPendingCount: 0,
          nonConformitiesOpenCount: currentNonConformityStatus === 'open' ? 1 : 0,
          actionPlansInProgressCount: currentActionPlanStatus === 'in_progress' ? 1 : 0,
        },
      }),
    })
  })

  await page.route('**/contracts?limit=30', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        contracts: [
          {
            id: 'contract-base-1',
            title: 'Contrato Base E2E',
            sourceType: 'contract',
            status: 'active',
          },
        ],
      }),
    })
  })

  await page.route('**/rules?limit=30', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        rules: [
          {
            id: 'rule-base-1',
            contractId: 'contract-base-1',
            title: 'Regra Base para Fluxo NC',
            description: 'Regra de contexto para teste de conformidade.',
            category: 'Conformidade',
            status: 'approved',
          },
        ],
      }),
    })
  })

  await page.route('**/non-conformities?limit=30', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        nonConformities: [
          {
            id: 'nc-e2e-1',
            title: 'NC E2E Temperatura fora da faixa',
            description: 'Temperatura registrada acima do limite operacional.',
            origin: 'Inspecao interna',
            impact: 'Risco de seguranca alimentar',
            owner: 'Equipe Qualidade',
            dueDate: '2026-06-30',
            status: currentNonConformityStatus,
            createdAt: '2026-06-09T10:00:00.000Z',
          },
        ],
      }),
    })
  })

  await page.route('**/non-conformities', async (route) => {
    const request = route.request()

    if (request.method() !== 'POST') {
      await route.continue()
      return
    }

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        nonConformity: {
          id: 'nc-e2e-1',
          title: 'NC E2E Temperatura fora da faixa',
          description: 'Temperatura registrada acima do limite operacional.',
          origin: 'Inspecao interna',
          impact: 'Risco de seguranca alimentar',
          owner: 'Equipe Qualidade',
          dueDate: '2026-06-30',
          status: 'open',
          createdAt: '2026-06-09T10:00:00.000Z',
        },
      }),
    })
  })

  await page.route('**/non-conformities/nc-e2e-1/status', async (route) => {
    currentNonConformityStatus = 'in_progress'
    nonConformityHistoryRecorded = true

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok' }),
    })
  })

  await page.route('**/non-conformities/nc-e2e-1/history*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        events: nonConformityHistoryRecorded
          ? [
              {
                id: 'nc-history-1',
                previousStatus: 'open',
                nextStatus: 'in_progress',
                actorName: 'Admin MenuCare',
                createdAt: '2026-06-09T10:20:00.000Z',
              },
            ]
          : [],
        total: nonConformityHistoryRecorded ? 1 : 0,
        hasNext: false,
      }),
    })
  })

  await page.route('**/non-conformities/nc-e2e-1/actions', async (route) => {
    const request = route.request()

    if (request.method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          action: {
            id: 'action-e2e-1',
            nonConformityId: 'nc-e2e-1',
            description: 'Executar recalibracao dos sensores termicos',
            owner: 'Equipe Operacional',
            dueDate: '2026-06-28',
            status: 'pending',
            createdAt: '2026-06-09T10:30:00.000Z',
          },
        }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        actions: [
          {
            id: 'action-e2e-1',
            nonConformityId: 'nc-e2e-1',
            description: 'Executar recalibracao dos sensores termicos',
            owner: 'Equipe Operacional',
            dueDate: '2026-06-28',
            status: currentActionPlanStatus,
            createdAt: '2026-06-09T10:30:00.000Z',
          },
        ],
      }),
    })
  })

  await page.route('**/non-conformities/nc-e2e-1/actions/action-e2e-1/status', async (route) => {
    currentActionPlanStatus = 'in_progress'
    actionPlanHistoryRecorded = true

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok' }),
    })
  })

  await page.route('**/non-conformities/nc-e2e-1/actions/action-e2e-1/history*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        events: actionPlanHistoryRecorded
          ? [
              {
                id: 'action-history-1',
                previousStatus: 'pending',
                nextStatus: 'in_progress',
                actorName: 'Admin MenuCare',
                createdAt: '2026-06-09T10:35:00.000Z',
              },
            ]
          : [],
        total: actionPlanHistoryRecorded ? 1 : 0,
        hasNext: false,
      }),
    })
  })

  await page.goto('/')

  await page.locator('form.auth-form input[type="email"]').fill('admin@menucare.local')
  await page.locator('form.auth-form input[type="password"]').fill('Admin@123')
  await page.locator('form.auth-form .auth-button').click()

  const nonConformityPanel = page
    .locator('article.panel')
    .filter({ has: page.getByRole('heading', { name: /Nao conformidades|Non-conformities/i }) })
  await nonConformityPanel.locator('input[type="text"]').first().fill('NC E2E Temperatura fora da faixa')
  await nonConformityPanel.locator('textarea').first().fill('Temperatura registrada acima do limite operacional.')
  await nonConformityPanel.locator('input[type="text"]').nth(1).fill('Inspecao interna')
  await nonConformityPanel.locator('input[type="text"]').nth(2).fill('Risco de seguranca alimentar')
  await nonConformityPanel.locator('input[type="text"]').nth(3).fill('Equipe Qualidade')
  await nonConformityPanel.locator('input[type="date"]').first().fill('2026-06-30')
  await nonConformityPanel.locator('button.auth-button').click()

  await expect(nonConformityPanel).toContainText('NC E2E Temperatura fora da faixa')
  await expect(nonConformityPanel).toContainText(/Aberta|Open/)
  await nonConformityPanel.locator('.records-list li').first().locator('button.logout-button').first().click()
  await expect(nonConformityPanel).toContainText(/Em andamento|In progress/)
  await expect(nonConformityPanel).toContainText('Admin MenuCare')

  const actionPlanPanel = page
    .locator('article.panel')
    .filter({ has: page.getByRole('heading', { name: /Plano de acao|Action plan/i }) })
  await actionPlanPanel.locator('select').first().selectOption('nc-e2e-1')
  await actionPlanPanel.locator('textarea').first().fill('Executar recalibracao dos sensores termicos')
  await actionPlanPanel.locator('input[type="text"]').first().fill('Equipe Operacional')
  await actionPlanPanel.locator('input[type="date"]').first().fill('2026-06-28')
  await actionPlanPanel.locator('button.auth-button').click()

  await expect(actionPlanPanel).toContainText('Executar recalibracao dos sensores termicos')
  await expect(actionPlanPanel).toContainText(/Pendente|Pending/)
  await actionPlanPanel.locator('.records-list li').first().locator('button.logout-button').first().click()
  await expect(actionPlanPanel).toContainText(/Em andamento|In progress/)
  await expect(actionPlanPanel).toContainText('Admin MenuCare')
})

test('exporta historicos de nao conformidade e acao com filtros aplicados', async ({ page }) => {
  let nonConformityExportFilterOk = false
  let actionPlanExportFilterOk = false

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
        summary: {
          contractsCount: 1,
          rulesApprovedCount: 1,
          rulesPendingCount: 0,
          nonConformitiesOpenCount: 1,
          actionPlansInProgressCount: 1,
        },
      }),
    })
  })

  await page.route('**/contracts?limit=30', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        contracts: [
          {
            id: 'contract-base-1',
            title: 'Contrato Base E2E',
            sourceType: 'contract',
            status: 'active',
          },
        ],
      }),
    })
  })

  await page.route('**/rules?limit=30', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        rules: [
          {
            id: 'rule-base-1',
            contractId: 'contract-base-1',
            title: 'Regra Base',
            description: 'Regra base para manter contexto.',
            category: 'Conformidade',
            status: 'approved',
          },
        ],
      }),
    })
  })

  await page.route('**/non-conformities?limit=30', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        nonConformities: [
          {
            id: 'nc-e2e-1',
            title: 'NC E2E Exportacao',
            description: 'Registro para validar export de historico.',
            origin: 'Inspecao interna',
            impact: 'Risco operacional',
            owner: 'Equipe Qualidade',
            dueDate: '2026-06-30',
            status: 'in_progress',
            createdAt: '2026-06-09T10:00:00.000Z',
          },
        ],
      }),
    })
  })

  await page.route('**/non-conformities/nc-e2e-1/actions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        actions: [
          {
            id: 'action-e2e-1',
            nonConformityId: 'nc-e2e-1',
            description: 'Acao E2E Exportacao',
            owner: 'Equipe Operacional',
            dueDate: '2026-06-28',
            status: 'in_progress',
            createdAt: '2026-06-09T10:30:00.000Z',
          },
        ],
      }),
    })
  })

  await page.route('**/non-conformities/nc-e2e-1/history?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        events: [
          {
            id: 'nc-history-1',
            previousStatus: 'open',
            nextStatus: 'in_progress',
            actorName: 'Carlos Filtro',
            createdAt: '2026-06-09T10:20:00.000Z',
          },
        ],
        total: 1,
        hasNext: false,
      }),
    })
  })

  await page.route('**/non-conformities/nc-e2e-1/actions/action-e2e-1/history?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        events: [
          {
            id: 'action-history-1',
            previousStatus: 'pending',
            nextStatus: 'in_progress',
            actorName: 'Carlos Filtro',
            createdAt: '2026-06-09T10:35:00.000Z',
          },
        ],
        total: 1,
        hasNext: false,
      }),
    })
  })

  await page.route('**/non-conformities/nc-e2e-1/history/export?*', async (route) => {
    const params = new URL(route.request().url()).searchParams
    nonConformityExportFilterOk =
      params.get('actor') === 'Carlos Filtro' &&
      params.get('from') === '2026-06-01' &&
      params.get('to') === '2026-06-30'

    await route.fulfill({
      status: 200,
      contentType: 'text/csv',
      body: 'id,previousStatus,nextStatus\nnc-history-1,open,in_progress\n',
    })
  })

  await page.route('**/non-conformities/nc-e2e-1/actions/action-e2e-1/history/export?*', async (route) => {
    const params = new URL(route.request().url()).searchParams
    actionPlanExportFilterOk =
      params.get('actor') === 'Carlos Filtro' &&
      params.get('from') === '2026-06-01' &&
      params.get('to') === '2026-06-30'

    await route.fulfill({
      status: 200,
      contentType: 'text/csv',
      body: 'id,previousStatus,nextStatus\naction-history-1,pending,in_progress\n',
    })
  })

  await page.goto('/')

  await page.locator('form.auth-form input[type="email"]').fill('admin@menucare.local')
  await page.locator('form.auth-form input[type="password"]').fill('Admin@123')
  await page.locator('form.auth-form .auth-button').click()

  const nonConformityPanel = page
    .locator('article.panel')
    .filter({ has: page.getByRole('heading', { name: /Nao conformidades|Non-conformities/i }) })
  await nonConformityPanel.locator('.history-filter-grid input[type="text"]').fill('Carlos Filtro')
  await nonConformityPanel.locator('.history-filter-grid input[type="date"]').nth(0).fill('2026-06-01')
  await nonConformityPanel.locator('.history-filter-grid input[type="date"]').nth(1).fill('2026-06-30')
  await nonConformityPanel.locator('.history-filter-grid .history-filter-actions button').first().click()

  const ncDownloadPromise = page.waitForEvent('download')
  await nonConformityPanel.locator('.history-pagination .history-filter-actions button').first().click()
  const ncDownload = await ncDownloadPromise
  expect(ncDownload.suggestedFilename()).toBe('non-conformity-history-nc-e2e-1.csv')
  expect(nonConformityExportFilterOk).toBe(true)

  const actionPlanPanel = page
    .locator('article.panel')
    .filter({ has: page.getByRole('heading', { name: /Plano de acao|Action plan/i }) })
  await actionPlanPanel.locator('form.crud-form select').first().selectOption('nc-e2e-1')
  await actionPlanPanel.locator('.invite-history-head select').selectOption('action-e2e-1')
  await actionPlanPanel.locator('.history-filter-grid input[type="text"]').fill('Carlos Filtro')
  await actionPlanPanel.locator('.history-filter-grid input[type="date"]').nth(0).fill('2026-06-01')
  await actionPlanPanel.locator('.history-filter-grid input[type="date"]').nth(1).fill('2026-06-30')
  await actionPlanPanel.locator('.history-filter-grid .history-filter-actions button').first().click()

  const actionDownloadPromise = page.waitForEvent('download')
  await actionPlanPanel.locator('.history-pagination .history-filter-actions button').first().click()
  const actionDownload = await actionDownloadPromise
  expect(actionDownload.suggestedFilename()).toBe('action-plan-history-action-e2e-1.csv')
  expect(actionPlanExportFilterOk).toBe(true)
})

test('exporta trilha de compliance com filtros avancados e escopos page/all', async ({ page }) => {
  const complianceExportCalls: Array<{
    exportType: string | null
    sortOrder: string | null
    exportScope: string | null
    page: string | null
    limit: string | null
    exportId: string | null
    nonConformityId: string | null
    actionPlanId: string | null
    actor: string | null
    from: string | null
    to: string | null
  }> = []

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
        summary: {
          contractsCount: 1,
          rulesApprovedCount: 1,
          rulesPendingCount: 0,
          nonConformitiesOpenCount: 1,
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

  await page.route('**/compliance/exports/audit?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        events: [
          {
            id: 'audit-event-1',
            exportId: 'exp-123',
            exportType: 'action_plan_history',
            nonConformityId: 'nc-e2e-1',
            actionPlanId: 'action-e2e-1',
            filterExportId: 'exp-123',
            filterNonConformityId: 'nc-e2e-1',
            filterActionPlanId: 'action-e2e-1',
            filterSortOrder: 'asc',
            filterExportScope: 'page',
            filterActor: 'Carlos Filtro',
            filterFrom: '2026-06-01',
            filterTo: '2026-06-30',
            actorName: 'Carlos Filtro',
            createdAt: '2026-06-09T11:00:00.000Z',
          },
        ],
        total: 1,
        hasNext: false,
      }),
    })
  })

  await page.route('**/compliance/exports/audit/export?*', async (route) => {
    const params = new URL(route.request().url()).searchParams

    complianceExportCalls.push({
      exportType: params.get('exportType'),
      sortOrder: params.get('sortOrder'),
      exportScope: params.get('exportScope'),
      page: params.get('page'),
      limit: params.get('limit'),
      exportId: params.get('exportId'),
      nonConformityId: params.get('nonConformityId'),
      actionPlanId: params.get('actionPlanId'),
      actor: params.get('actor'),
      from: params.get('from'),
      to: params.get('to'),
    })

    await route.fulfill({
      status: 200,
      contentType: 'text/csv',
      body: 'exportId,exportType\nexp-123,action_plan_history\n',
    })
  })

  await page.goto('/')

  await page.locator('form.auth-form input[type="email"]').fill('admin@menucare.local')
  await page.locator('form.auth-form input[type="password"]').fill('Admin@123')
  await page.locator('form.auth-form .auth-button').click()

  const compliancePanel = page
    .locator('article.panel')
    .filter({ has: page.getByRole('heading', { name: /Rastreabilidade de exportacoes|Export traceability/i }) })

  const complianceHeader = compliancePanel
    .locator('.invite-history-head')
    .filter({ has: page.locator('h3', { hasText: /Rastreabilidade de exportacoes|Export traceability/i }) })

  await complianceHeader.locator('select').selectOption('action_plan_history')
  await compliancePanel.locator('.history-filter-grid input[type="text"]').nth(0).fill('exp-123')
  await compliancePanel.locator('.history-filter-grid select').first().selectOption('asc')
  await compliancePanel.locator('.history-filter-grid input[type="text"]').nth(1).fill('nc-e2e-1')
  await compliancePanel.locator('.history-filter-grid input[type="text"]').nth(2).fill('action-e2e-1')
  await compliancePanel.locator('.history-filter-grid input[type="text"]').nth(3).fill('Carlos Filtro')
  await compliancePanel.locator('.history-filter-grid input[type="date"]').nth(0).fill('2026-06-01')
  await compliancePanel.locator('.history-filter-grid input[type="date"]').nth(1).fill('2026-06-30')
  await compliancePanel.locator('.history-filter-grid .history-filter-actions button').first().click()

  await compliancePanel.locator('.history-pagination label select').nth(0).selectOption('50')
  await compliancePanel.locator('.history-pagination label select').nth(1).selectOption('page')

  const pageScopeDownloadPromise = page.waitForEvent('download')
  await compliancePanel.locator('.history-pagination .history-filter-actions button').first().click()
  const pageScopeDownload = await pageScopeDownloadPromise
  expect(pageScopeDownload.suggestedFilename()).toMatch(/^compliance-export-audit-page-.*\.csv$/)

  await compliancePanel.locator('.history-pagination label select').nth(1).selectOption('all')

  const allScopeDownloadPromise = page.waitForEvent('download')
  await compliancePanel.locator('.history-pagination .history-filter-actions button').first().click()
  const allScopeDownload = await allScopeDownloadPromise
  expect(allScopeDownload.suggestedFilename()).toMatch(/^compliance-export-audit-all-.*\.csv$/)

  expect(complianceExportCalls).toHaveLength(2)
  expect(complianceExportCalls[0]).toEqual({
    exportType: 'action_plan_history',
    sortOrder: 'asc',
    exportScope: 'page',
    page: '1',
    limit: '50',
    exportId: 'exp-123',
    nonConformityId: 'nc-e2e-1',
    actionPlanId: 'action-e2e-1',
    actor: 'Carlos Filtro',
    from: '2026-06-01',
    to: '2026-06-30',
  })
  expect(complianceExportCalls[1]).toEqual({
    exportType: 'action_plan_history',
    sortOrder: 'asc',
    exportScope: 'all',
    page: '1',
    limit: '50',
    exportId: 'exp-123',
    nonConformityId: 'nc-e2e-1',
    actionPlanId: 'action-e2e-1',
    actor: 'Carlos Filtro',
    from: '2026-06-01',
    to: '2026-06-30',
  })
})

test('importa cardapio PDF e atualiza lista de importacoes', async ({ page }) => {
  let menuImportRegistered = false

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
        summary: {
          contractsCount: 1,
          rulesApprovedCount: 1,
          rulesPendingCount: 0,
          nonConformitiesOpenCount: 0,
          actionPlansInProgressCount: 0,
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

  await page.route('**/menus/imports?limit=10', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        imports: menuImportRegistered
          ? [
              {
                id: 'menu-import-e2e-1',
                fileName: 'CARDAPIO-E2E.pdf',
                unitName: 'Hospital MenuCare',
                serviceName: 'Almoco executivo',
                referenceDate: '2026-06-20',
                mealType: 'Almoco',
                financialGoal: 14.5,
                mealCost: 13.2,
                exceededValue: 0,
                exceededPercent: 0,
                validationStatus: 'within_goal',
                recipes: ['Arroz integral', 'Feijao carioca', 'Frango grelhado'],
                createdAt: '2026-06-09T12:00:00.000Z',
              },
            ]
          : [],
      }),
    })
  })

  await page.route('**/menus/imports', async (route) => {
    const request = route.request()

    if (request.method() !== 'POST') {
      await route.continue()
      return
    }

    menuImportRegistered = true

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        import: {
          id: 'menu-import-e2e-1',
          fileName: 'CARDAPIO-E2E.pdf',
          unitName: 'Hospital MenuCare',
          serviceName: 'Almoco executivo',
          referenceDate: '2026-06-20',
          mealType: 'Almoco',
          financialGoal: 14.5,
          mealCost: 13.2,
          exceededValue: 0,
          exceededPercent: 0,
          validationStatus: 'within_goal',
          recipes: ['Arroz integral', 'Feijao carioca', 'Frango grelhado'],
          createdAt: '2026-06-09T12:00:00.000Z',
        },
      }),
    })
  })

  await page.route('**/menus/imports/menu-import-e2e-1/audit', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', results: [] }),
    })
  })

  await page.route('**/menus/imports/menu-import-e2e-1/suggestions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', suggestions: [] }),
    })
  })

  await page.route('**/menus/imports/menu-import-e2e-1/adjusted-versions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', versions: [] }),
    })
  })

  await page.route('**/governance/recommendations/menu-import-e2e-1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', recommendations: [] }),
    })
  })

  await page.route('**/governance/recommendations/menu-import-e2e-1/next-menu', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', proposal: null }),
    })
  })

  await page.route('**/governance/recommendations/menu-import-e2e-1/next-menu/decisions**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', decisions: [] }),
    })
  })

  await page.goto('/')

  await page.locator('form.auth-form input[type="email"]').fill('admin@menucare.local')
  await page.locator('form.auth-form input[type="password"]').fill('Admin@123')
  await page.locator('form.auth-form .auth-button').click()

  const menuImportPanel = page
    .locator('article.panel')
    .filter({ has: page.getByRole('heading', { name: 'Cardapio PDF da Genial' }) })
  const menuImportForm = menuImportPanel.locator('form.crud-form').first()

  await menuImportForm.locator('input[type="text"]').nth(0).fill('CARDAPIO-E2E.pdf')
  await menuImportForm.locator('input[type="text"]').nth(1).fill('Hospital MenuCare')
  await menuImportForm.locator('input[type="text"]').nth(2).fill('Almoco executivo')
  await menuImportForm.locator('input[type="date"]').fill('2026-06-20')
  await menuImportForm.locator('input[type="text"]').nth(3).fill('Almoco')
  await menuImportForm.locator('input[type="number"]').nth(0).fill('14.50')
  await menuImportForm.locator('input[type="number"]').nth(1).fill('13.20')
  await menuImportForm
    .locator('textarea')
    .first()
    .fill('Arroz integral\nFeijao carioca\nFrango grelhado')
  await menuImportForm.locator('button.auth-button').click()

  await expect(menuImportPanel).toContainText('CARDAPIO-E2E.pdf')
  await expect(menuImportPanel).toContainText('Hospital MenuCare')
  await expect(menuImportPanel).toContainText('Dentro da meta')
})

test('executa auditoria contratual de cardapio importado e exibe resultados', async ({ page }) => {
  let menuImportListFetchCount = 0
  let menuImportAuditPostCount = 0
  let auditWasExecuted = false

  const auditResults = [
    {
      id: 'menu-audit-e2e-1',
      ruleId: 'rule-e2e-1',
      ruleTitle: 'Fruta citrica 3x por semana',
      resultStatus: 'compliant',
      evidence: 'classificacao estruturada validou presenca de fruta citrica no periodo.',
      executedAt: '2026-06-09T12:20:00.000Z',
    },
    {
      id: 'menu-audit-e2e-2',
      ruleId: 'rule-e2e-2',
      ruleTitle: 'Nao repetir peixe em menos de 7 dias',
      resultStatus: 'non_compliant',
      evidence: 'classificacao estruturada encontrou recorrencia de peixe em intervalo inferior a 7 dias.',
      executedAt: '2026-06-09T12:20:00.000Z',
    },
  ]

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
        summary: {
          contractsCount: 1,
          rulesApprovedCount: 2,
          rulesPendingCount: 0,
          nonConformitiesOpenCount: 0,
          actionPlansInProgressCount: 0,
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

  await page.route('**/menus/imports?limit=10', async (route) => {
    menuImportListFetchCount += 1

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        imports: [
          {
            id: 'menu-import-audit-e2e-1',
            fileName: 'CARDAPIO-AUDITORIA-E2E.pdf',
            unitName: 'Hospital MenuCare',
            serviceName: 'Almoco executivo',
            referenceDate: '2026-06-22',
            mealType: 'Almoco',
            financialGoal: 15.3,
            mealCost: 14.8,
            exceededValue: 0,
            exceededPercent: 0,
            validationStatus: 'within_goal',
            recipes: ['Laranja em gomos', 'Arroz integral', 'Peixe assado'],
            createdAt: '2026-06-09T12:00:00.000Z',
          },
        ],
      }),
    })
  })

  await page.route('**/menus/imports/menu-import-audit-e2e-1/audit', async (route) => {
    const request = route.request()

    if (request.method() === 'POST') {
      menuImportAuditPostCount += 1
      auditWasExecuted = true

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', results: auditResults }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        results: auditWasExecuted ? auditResults : [],
      }),
    })
  })

  await page.route('**/menus/imports/menu-import-audit-e2e-1/suggestions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', suggestions: [] }),
    })
  })

  await page.route('**/menus/imports/menu-import-audit-e2e-1/adjusted-versions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', versions: [] }),
    })
  })

  await page.route('**/governance/recommendations/menu-import-audit-e2e-1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', recommendations: [] }),
    })
  })

  await page.route('**/governance/recommendations/menu-import-audit-e2e-1/next-menu', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', proposal: null }),
    })
  })

  await page.route('**/governance/recommendations/menu-import-audit-e2e-1/next-menu/decisions**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', decisions: [] }),
    })
  })

  await page.goto('/')

  await page.locator('form.auth-form input[type="email"]').fill('admin@menucare.local')
  await page.locator('form.auth-form input[type="password"]').fill('Admin@123')
  await page.locator('form.auth-form .auth-button').click()

  const menuImportPanel = page
    .locator('article.panel')
    .filter({ has: page.getByRole('heading', { name: 'Cardapio PDF da Genial' }) })
  const menuAuditHeader = menuImportPanel
    .locator('.invite-history-head')
    .filter({ has: page.getByRole('heading', { name: 'Auditoria contratual do cardapio' }) })

  await menuAuditHeader.locator('select').selectOption('menu-import-audit-e2e-1')
  await menuImportPanel
    .locator('button.logout-button', { hasText: 'Executar auditoria contratual' })
    .click()

  await expect(menuImportPanel).toContainText('Fruta citrica 3x por semana')
  await expect(menuImportPanel).toContainText('Nao repetir peixe em menos de 7 dias')
  await expect(menuImportPanel).toContainText('Conforme')
  await expect(menuImportPanel).toContainText('Nao conforme')
  await expect(menuImportPanel).toContainText('classificacao estruturada')
  expect(menuImportAuditPostCount).toBe(1)
  expect(menuImportListFetchCount).toBeGreaterThanOrEqual(2)
})

test('gera sugestoes de ajuste para cardapio importado e exibe impactos', async ({ page }) => {
  let suggestionsGenerated = false
  let suggestionsPostCount = 0

  const menuSuggestions = [
    {
      id: 'menu-suggestion-e2e-1',
      suggestionText:
        'Substituir Peixe assado por Frango grelhado para atender a regra: Nao repetir peixe em menos de 7 dias.',
      estimatedFinancialImpact: -1.75,
      estimatedNutritionalImpact:
        'Impacto positivo no grupo proteina com substituicao para melhor distribuicao semanal.',
      priorityLevel: 'high',
    },
    {
      id: 'menu-suggestion-e2e-2',
      suggestionText:
        'Reforcar insercao de fruta citrica no almoco de quinta-feira para cobertura contratual.',
      estimatedFinancialImpact: 0.9,
      estimatedNutritionalImpact: 'Melhora equilibrio de vitaminas sem alterar o grupo principal.',
      priorityLevel: 'medium',
    },
  ]

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
        summary: {
          contractsCount: 1,
          rulesApprovedCount: 2,
          rulesPendingCount: 0,
          nonConformitiesOpenCount: 0,
          actionPlansInProgressCount: 0,
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

  await page.route('**/menus/imports?limit=10', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        imports: [
          {
            id: 'menu-import-suggestions-e2e-1',
            fileName: 'CARDAPIO-SUGESTOES-E2E.pdf',
            unitName: 'Hospital MenuCare',
            serviceName: 'Almoco executivo',
            referenceDate: '2026-06-23',
            mealType: 'Almoco',
            financialGoal: 15.5,
            mealCost: 15,
            exceededValue: 0,
            exceededPercent: 0,
            validationStatus: 'within_goal',
            recipes: ['Peixe assado', 'Arroz integral', 'Laranja em gomos'],
            createdAt: '2026-06-09T13:00:00.000Z',
          },
        ],
      }),
    })
  })

  await page.route('**/menus/imports/menu-import-suggestions-e2e-1/audit', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', results: [] }),
    })
  })

  await page.route('**/menus/imports/menu-import-suggestions-e2e-1/suggestions', async (route) => {
    const request = route.request()

    if (request.method() === 'POST') {
      suggestionsGenerated = true
      suggestionsPostCount += 1

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', suggestions: menuSuggestions }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        suggestions: suggestionsGenerated ? menuSuggestions : [],
      }),
    })
  })

  await page.route('**/menus/imports/menu-import-suggestions-e2e-1/adjusted-versions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', versions: [] }),
    })
  })

  await page.route('**/governance/recommendations/menu-import-suggestions-e2e-1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', recommendations: [] }),
    })
  })

  await page.route('**/governance/recommendations/menu-import-suggestions-e2e-1/next-menu', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', proposal: null }),
    })
  })

  await page.route('**/governance/recommendations/menu-import-suggestions-e2e-1/next-menu/decisions**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', decisions: [] }),
    })
  })

  await page.goto('/')

  await page.locator('form.auth-form input[type="email"]').fill('admin@menucare.local')
  await page.locator('form.auth-form input[type="password"]').fill('Admin@123')
  await page.locator('form.auth-form .auth-button').click()

  const menuImportPanel = page
    .locator('article.panel')
    .filter({ has: page.getByRole('heading', { name: 'Cardapio PDF da Genial' }) })

  const menuAuditHeader = menuImportPanel
    .locator('.invite-history-head')
    .filter({ has: page.getByRole('heading', { name: 'Auditoria contratual do cardapio' }) })
  await menuAuditHeader.locator('select').selectOption('menu-import-suggestions-e2e-1')

  await menuImportPanel
    .locator('button.logout-button', { hasText: 'Gerar sugestoes de ajuste' })
    .click()

  await expect(menuImportPanel).toContainText('Troca sugerida com base estruturada')
  await expect(menuImportPanel).toContainText('Alta prioridade')
  await expect(menuImportPanel).toContainText('Media prioridade')
  await expect(menuImportPanel).toContainText('Substituir: Peixe assado')
  await expect(menuImportPanel).toContainText('Receita sugerida: Frango grelhado')
  await expect(menuImportPanel).toContainText('Regra alvo: Nao repetir peixe em menos de 7 dias')
  await expect(menuImportPanel).toContainText('Grupo: proteina')
  await expect(menuImportPanel).toContainText('Impacto financeiro estimado: R$ -1.75')
  await expect(menuImportPanel).toContainText('Impacto financeiro estimado: R$ 0.90')
  await expect(menuImportPanel).toContainText('Reforcar insercao de fruta citrica')

  expect(suggestionsPostCount).toBe(1)
})

test('gera versao ajustada de cardapio importado com horizonte e impacto financeiro', async ({ page }) => {
  let adjustedVersionGenerated = false
  let adjustedVersionPostCount = 0
  let adjustedVersionMonthsAheadPayload: number | null = null

  const adjustedVersions = [
    {
      id: 'menu-adjusted-version-e2e-1',
      importId: 'menu-import-adjusted-e2e-1',
      versionLabel: 'Versao ajustada Junho/2026 +2M',
      adjustedMealCost: 13.4,
      totalFinancialImpact: -1.6,
      nutritionalImpactSummary: 'Maior equilibrio proteico e reforco de frutas citricas no ciclo.',
      appliedSuggestions: ['Troca de peixe por frango', 'Inclusao de fruta citrica'],
      planningMonthsAhead: 2,
      targetMonth: '2026-08',
      commemorativeContext: {
        prioritizeNobleDishes: true,
      },
      createdAt: '2026-06-09T14:00:00.000Z',
    },
  ]

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
        summary: {
          contractsCount: 1,
          rulesApprovedCount: 2,
          rulesPendingCount: 0,
          nonConformitiesOpenCount: 0,
          actionPlansInProgressCount: 0,
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

  await page.route('**/menus/imports?limit=10', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        imports: [
          {
            id: 'menu-import-adjusted-e2e-1',
            fileName: 'CARDAPIO-AJUSTADO-E2E.pdf',
            unitName: 'Hospital MenuCare',
            serviceName: 'Almoco executivo',
            referenceDate: '2026-06-24',
            mealType: 'Almoco',
            financialGoal: 15,
            mealCost: 14.9,
            exceededValue: 0,
            exceededPercent: 0,
            validationStatus: 'within_goal',
            recipes: ['Peixe assado', 'Arroz integral', 'Laranja em gomos'],
            createdAt: '2026-06-09T13:30:00.000Z',
          },
        ],
      }),
    })
  })

  await page.route('**/menus/imports/menu-import-adjusted-e2e-1/audit', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', results: [] }),
    })
  })

  await page.route('**/menus/imports/menu-import-adjusted-e2e-1/suggestions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', suggestions: [] }),
    })
  })

  await page.route('**/menus/imports/menu-import-adjusted-e2e-1/adjusted-versions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        versions: adjustedVersionGenerated ? adjustedVersions : [],
      }),
    })
  })

  await page.route('**/menus/imports/menu-import-adjusted-e2e-1/adjusted-version', async (route) => {
    const request = route.request()
    const body = request.postDataJSON() as { monthsAhead?: number }
    adjustedVersionMonthsAheadPayload = body.monthsAhead ?? null
    adjustedVersionGenerated = true
    adjustedVersionPostCount += 1

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        adjustedVersion: adjustedVersions[0],
      }),
    })
  })

  await page.route('**/governance/recommendations/menu-import-adjusted-e2e-1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', recommendations: [] }),
    })
  })

  await page.route('**/governance/recommendations/menu-import-adjusted-e2e-1/next-menu', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', proposal: null }),
    })
  })

  await page.route('**/governance/recommendations/menu-import-adjusted-e2e-1/next-menu/decisions**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', decisions: [] }),
    })
  })

  await page.goto('/')

  await page.locator('form.auth-form input[type="email"]').fill('admin@menucare.local')
  await page.locator('form.auth-form input[type="password"]').fill('Admin@123')
  await page.locator('form.auth-form .auth-button').click()

  const menuImportPanel = page
    .locator('article.panel')
    .filter({ has: page.getByRole('heading', { name: 'Cardapio PDF da Genial' }) })
  const menuAuditHeader = menuImportPanel
    .locator('.invite-history-head')
    .filter({ has: page.getByRole('heading', { name: 'Auditoria contratual do cardapio' }) })
  await menuAuditHeader.locator('select').selectOption('menu-import-adjusted-e2e-1')

  const adjustedVersionPanelHeader = menuImportPanel
    .locator('.invite-history-head')
    .filter({ has: page.getByRole('heading', { name: 'Versoes ajustadas' }) })

  const adjustedVersionForm = adjustedVersionPanelHeader.locator('xpath=following-sibling::form[1]')
  await adjustedVersionForm.locator('select').selectOption('2')

  await menuImportPanel
    .locator('button.logout-button', { hasText: 'Gerar nova versao ajustada' })
    .click()

  await expect(menuImportPanel).toContainText('Versao ajustada Junho/2026 +2M')
  await expect(menuImportPanel).toContainText('2 sugestoes aplicadas')
  await expect(menuImportPanel).toContainText('Mes alvo: 2026-08 | Horizonte: 2 mes(es)')
  await expect(menuImportPanel).toContainText('Custo ajustado: R$ 13.40 | Impacto financeiro total: R$ -1.60')
  await expect(menuImportPanel).toContainText('Maior equilibrio proteico e reforco de frutas citricas no ciclo.')
  await expect(menuImportPanel).toContainText('Datas comemorativas: priorizando pratos nobres')

  expect(adjustedVersionPostCount).toBe(1)
  expect(adjustedVersionMonthsAheadPayload).toBe(2)
})

test('cadastra data comemorativa e exibe item com sugestao de prato nobre', async ({ page }) => {
  let commemorativeDateRegistered = false
  let commemorativeDatePostCount = 0
  let commemorativeDatePayload: {
    referenceDate: string
    title: string
    nobleDishHint?: string
  } | null = null

  const commemorativeDateItem = {
    id: 'commemorative-date-e2e-1',
    referenceDate: '2026-06-24',
    year: 2026,
    title: 'Festa Junina',
    nobleDishHint: 'Canjica premium',
    createdBy: 'Admin MenuCare',
    createdAt: '2026-06-09T14:30:00.000Z',
  }

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
        summary: {
          contractsCount: 1,
          rulesApprovedCount: 2,
          rulesPendingCount: 0,
          nonConformitiesOpenCount: 0,
          actionPlansInProgressCount: 0,
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

  await page.route('**/menus/imports?limit=10', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', imports: [] }),
    })
  })

  await page.route('**/menus/commemorative-dates?year=*&limit=400', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        commemorativeDates: commemorativeDateRegistered ? [commemorativeDateItem] : [],
      }),
    })
  })

  await page.route('**/menus/commemorative-dates', async (route) => {
    const request = route.request()

    if (request.method() !== 'POST') {
      await route.continue()
      return
    }

    commemorativeDatePostCount += 1
    commemorativeDateRegistered = true
    commemorativeDatePayload = request.postDataJSON() as {
      referenceDate: string
      title: string
      nobleDishHint?: string
    }

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', commemorativeDate: commemorativeDateItem }),
    })
  })

  await page.goto('/')

  await page.locator('form.auth-form input[type="email"]').fill('admin@menucare.local')
  await page.locator('form.auth-form input[type="password"]').fill('Admin@123')
  await page.locator('form.auth-form .auth-button').click()

  const menuImportPanel = page
    .locator('article.panel')
    .filter({ has: page.getByRole('heading', { name: 'Cardapio PDF da Genial' }) })

  const commemorativeHeader = menuImportPanel
    .locator('.invite-history-head')
    .filter({ has: page.getByRole('heading', { name: 'Aba de datas comemorativas' }) })
  const commemorativeForm = commemorativeHeader.locator('xpath=following-sibling::form[1]')

  await commemorativeForm.locator('input[type="number"]').fill('2026')
  await commemorativeForm.locator('input[type="date"]').fill('2026-06-24')
  await commemorativeForm.locator('input[type="text"]').nth(0).fill('Festa Junina')
  await commemorativeForm.locator('input[type="text"]').nth(1).fill('Canjica premium')
  await commemorativeForm.locator('button.auth-button').click()

  await expect(menuImportPanel).toContainText('Festa Junina')
  await expect(menuImportPanel).toContainText('Canjica premium')
  await expect(menuImportPanel).toContainText('2026')

  expect(commemorativeDatePostCount).toBe(1)
  expect(commemorativeDatePayload).toEqual({
    referenceDate: '2026-06-24',
    title: 'Festa Junina',
    nobleDishHint: 'Canjica premium',
  })
})

test('importa avaliacao PDF e exibe score com quantidade de avaliacoes', async ({ page }) => {
  let evaluationRegistered = false
  let evaluationPostCount = 0
  let evaluationPayload: {
    fileName: string
    unitName: string
    serviceName: string
    referenceDate: string
    score: number
    evaluationsCount: number
    comments?: string
  } | null = null

  const evaluationItem = {
    id: 'evaluation-import-e2e-1',
    fileName: 'AVALIACOES-JUNHO-E2E.pdf',
    unitName: 'Hospital MenuCare',
    serviceName: 'Almoco executivo',
    referenceDate: '2026-06-25',
    score: 8.7,
    evaluationsCount: 124,
    comments: 'Melhora percebida no sabor e variedade das preparacoes.',
    createdAt: '2026-06-09T15:00:00.000Z',
  }

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
        summary: {
          contractsCount: 1,
          rulesApprovedCount: 2,
          rulesPendingCount: 0,
          nonConformitiesOpenCount: 0,
          actionPlansInProgressCount: 0,
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

  await page.route('**/menus/imports?limit=10', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', imports: [] }),
    })
  })

  await page.route('**/evaluations/imports?limit=10', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        evaluations: evaluationRegistered ? [evaluationItem] : [],
      }),
    })
  })

  await page.route('**/evaluations/imports', async (route) => {
    const request = route.request()

    if (request.method() !== 'POST') {
      await route.continue()
      return
    }

    evaluationPostCount += 1
    evaluationRegistered = true
    evaluationPayload = request.postDataJSON() as {
      fileName: string
      unitName: string
      serviceName: string
      referenceDate: string
      score: number
      evaluationsCount: number
      comments?: string
    }

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', evaluation: evaluationItem }),
    })
  })

  await page.goto('/')

  await page.locator('form.auth-form input[type="email"]').fill('admin@menucare.local')
  await page.locator('form.auth-form input[type="password"]').fill('Admin@123')
  await page.locator('form.auth-form .auth-button').click()

  const menuImportPanel = page
    .locator('article.panel')
    .filter({ has: page.getByRole('heading', { name: 'Cardapio PDF da Genial' }) })

  const evaluationHeader = menuImportPanel
    .locator('.invite-history-head')
    .filter({ has: page.getByRole('heading', { name: 'Importacao de avaliacoes (PDF)' }) })
  const evaluationForm = evaluationHeader.locator('xpath=following-sibling::form[1]')

  await evaluationForm.locator('input[type="text"]').nth(0).fill('AVALIACOES-JUNHO-E2E.pdf')
  await evaluationForm.locator('input[type="text"]').nth(1).fill('Hospital MenuCare')
  await evaluationForm.locator('input[type="text"]').nth(2).fill('Almoco executivo')
  await evaluationForm.locator('input[type="date"]').fill('2026-06-25')
  await evaluationForm.locator('input[type="number"]').nth(0).fill('8.7')
  await evaluationForm.locator('input[type="number"]').nth(1).fill('124')
  await evaluationForm
    .locator('textarea')
    .fill('Melhora percebida no sabor e variedade das preparacoes.')
  await evaluationForm.locator('button.auth-button').click()

  await expect(menuImportPanel).toContainText('AVALIACOES-JUNHO-E2E.pdf')
  await expect(menuImportPanel).toContainText('Nota 8.7')
  await expect(menuImportPanel).toContainText('124 avaliacoes')
  await expect(menuImportPanel).toContainText('Melhora percebida no sabor e variedade das preparacoes.')

  expect(evaluationPostCount).toBe(1)
  expect(evaluationPayload).toEqual({
    fileName: 'AVALIACOES-JUNHO-E2E.pdf',
    unitName: 'Hospital MenuCare',
    serviceName: 'Almoco executivo',
    referenceDate: '2026-06-25',
    score: 8.7,
    evaluationsCount: 124,
    comments: 'Melhora percebida no sabor e variedade das preparacoes.',
  })
})

test('recalcula inteligencia de combinacoes e exibe tendencia com cruzamentos', async ({ page }) => {
  let intelligenceRebuilt = false
  let rebuildPostCount = 0

  const rebuiltCombinations = [
    {
      id: 'combo-e2e-1',
      combinationKey: 'hospital-menucare-almoco',
      recipes: ['Frango grelhado', 'Arroz integral', 'Laranja em gomos'],
      unitName: 'Hospital MenuCare',
      serviceName: 'Almoco executivo',
      averageRating: 8.42,
      evaluationsCount: 124,
      mappedRecords: 36,
      lastReferenceDate: '2026-06-25',
      trend: 'positive',
      createdAt: '2026-06-09T16:00:00.000Z',
    },
  ]

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
        summary: {
          contractsCount: 1,
          rulesApprovedCount: 2,
          rulesPendingCount: 0,
          nonConformitiesOpenCount: 0,
          actionPlansInProgressCount: 0,
        },
      }),
    })
  })

  await page.route('**/contracts?limit=30', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ contracts: [] }) })
  })

  await page.route('**/rules?limit=30', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rules: [] }) })
  })

  await page.route('**/non-conformities?limit=30', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ nonConformities: [] }) })
  })

  await page.route('**/menus/imports?limit=10', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', imports: [] }) })
  })

  await page.route('**/menus/commemorative-dates?year=*&limit=400', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', commemorativeDates: [] }) })
  })

  await page.route('**/evaluations/imports?limit=10', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', evaluations: [] }) })
  })

  await page.route('**/evaluations/intelligence?limit=10', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        combinations: intelligenceRebuilt ? rebuiltCombinations : [],
      }),
    })
  })

  await page.route('**/evaluations/intelligence/rebuild', async (route) => {
    rebuildPostCount += 1
    intelligenceRebuilt = true
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', summary: { generatedCombinations: 1 } }),
    })
  })

  await page.goto('/')

  await page.locator('form.auth-form input[type="email"]').fill('admin@menucare.local')
  await page.locator('form.auth-form input[type="password"]').fill('Admin@123')
  await page.locator('form.auth-form .auth-button').click()

  const menuImportPanel = page
    .locator('article.panel')
    .filter({ has: page.getByRole('heading', { name: 'Cardapio PDF da Genial' }) })

  await menuImportPanel.locator('button.logout-button', { hasText: 'Recalcular inteligencia' }).click()

  await expect(menuImportPanel).toContainText('Hospital MenuCare · Almoco executivo')
  await expect(menuImportPanel).toContainText('Tendencia positiva')
  await expect(menuImportPanel).toContainText('Nota media 8.42 · 124 avaliacoes · 36 cruzamentos')
  await expect(menuImportPanel).toContainText('Receitas: Frango grelhado | Arroz integral | Laranja em gomos')
  expect(rebuildPostCount).toBe(1)
})

test('gera proposta do proximo cardapio e registra decisao aprovada no historico', async ({ page }) => {
  let proposalPostCount = 0
  let decisionPostCount = 0
  let decisionPayload: { decision?: string; justification?: string } | null = null
  let decisionHistory = [] as Array<{
    id: string
    importId: string
    status: 'approved' | 'rejected'
    justification: string
    governanceBlocksApproval: boolean
    historicalNonBlocking: boolean
    actorId: string
    actorName: string
    createdAt: string
    nextMenuProposal: {
      importId: string
      unitName: string
      serviceName: string
      proposalType: 'historical_recommended' | 'current_baseline'
      recipes: string[]
      estimatedCost: number
      financialGoal: number
      historicalLayer: {
        nonBlocking: boolean
        sourceCombinationId: string | null
        sourceAverageRating: number | null
        sourceEvaluationsCount: number
        note: string
      }
      governance: {
        blocksApproval: boolean
        mandatoryFindings: Array<{
          criterion: string
          status: 'ok' | 'violation'
        }>
      }
    }
  }>

  const recommendationPreview = {
    policy: {
      priorityOrder: [
        'financial_goal',
        'nutritional_restrictions',
        'operational_rules',
        'historical_ratings',
      ],
      levels: [
        { key: 'mandatory', blocksApproval: true },
        { key: 'recommended', blocksApproval: false },
      ],
      blockingCriteria: ['financial_goal', 'nutritional_restrictions'],
    },
    importContext: {
      importId: 'menu-import-next-e2e-1',
      unitName: 'Hospital MenuCare',
      serviceName: 'Almoco executivo',
      financialGoal: 15,
      mealCost: 14.2,
      currentRecipes: ['Frango grelhado', 'Arroz integral', 'Laranja em gomos'],
    },
    decision: {
      blocksApproval: false,
      mandatoryFindings: [
        { criterion: 'Meta financeira', status: 'ok', detail: 'Custo atual dentro da meta contratada.' },
      ],
    },
    historicalLayer: {
      nonBlocking: true,
      note: 'Historico favorece combinacoes com fruta citrica e proteina branca.',
      recommendedCombinations: [
        {
          id: 'comb-1',
          recipes: ['Frango grelhado', 'Arroz integral', 'Laranja em gomos'],
          averageRating: 8.6,
          evaluationsCount: 124,
          trend: 'positive',
        },
      ],
    },
  }

  const nextMenuProposal = {
    importId: 'menu-import-next-e2e-1',
    unitName: 'Hospital MenuCare',
    serviceName: 'Almoco executivo',
    proposalType: 'historical_recommended' as const,
    recipes: ['Frango grelhado', 'Arroz integral', 'Laranja em gomos'],
    estimatedCost: 14.1,
    financialGoal: 15,
    historicalLayer: {
      nonBlocking: true,
      sourceCombinationId: 'comb-1',
      sourceAverageRating: 8.6,
      sourceEvaluationsCount: 124,
      note: 'Proposta prioriza combinacao historicamente bem avaliada.',
    },
    governance: {
      blocksApproval: false,
      mandatoryFindings: [{ criterion: 'Meta financeira', status: 'ok' as const }],
    },
  }

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
        summary: {
          contractsCount: 1,
          rulesApprovedCount: 2,
          rulesPendingCount: 0,
          nonConformitiesOpenCount: 0,
          actionPlansInProgressCount: 0,
        },
      }),
    })
  })

  await page.route('**/contracts?limit=30', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ contracts: [] }) })
  })

  await page.route('**/rules?limit=30', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rules: [] }) })
  })

  await page.route('**/non-conformities?limit=30', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ nonConformities: [] }) })
  })

  await page.route('**/menus/imports?limit=10', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        imports: [
          {
            id: 'menu-import-next-e2e-1',
            fileName: 'CARDAPIO-NEXT-E2E.pdf',
            unitName: 'Hospital MenuCare',
            serviceName: 'Almoco executivo',
            referenceDate: '2026-06-26',
            mealType: 'Almoco',
            financialGoal: 15,
            mealCost: 14.2,
            exceededValue: 0,
            exceededPercent: 0,
            validationStatus: 'within_goal',
            recipes: ['Frango grelhado', 'Arroz integral', 'Laranja em gomos'],
            createdAt: '2026-06-09T16:30:00.000Z',
          },
        ],
      }),
    })
  })

  await page.route('**/menus/imports/menu-import-next-e2e-1/audit', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', results: [] }) })
  })

  await page.route('**/menus/imports/menu-import-next-e2e-1/suggestions', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', suggestions: [] }) })
  })

  await page.route('**/menus/imports/menu-import-next-e2e-1/adjusted-versions', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', versions: [] }) })
  })

  await page.route('**/menus/commemorative-dates?year=*&limit=400', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', commemorativeDates: [] }) })
  })

  await page.route('**/evaluations/imports?limit=10', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', evaluations: [] }) })
  })

  await page.route('**/evaluations/intelligence?limit=10', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', combinations: [] }) })
  })

  await page.route('**/governance/recommendations/menu-import-next-e2e-1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', recommendation: recommendationPreview }),
    })
  })

  await page.route('**/governance/recommendations/menu-import-next-e2e-1/next-menu/decisions?limit=10', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', decisions: decisionHistory }),
    })
  })

  await page.route('**/governance/recommendations/menu-import-next-e2e-1/next-menu/decision', async (route) => {
    const request = route.request()
    decisionPayload = request.postDataJSON() as { decision?: string; justification?: string }
    decisionPostCount += 1

    const createdDecision = {
      id: 'next-decision-e2e-1',
      importId: 'menu-import-next-e2e-1',
      status: (decisionPayload.decision ?? 'approved') as 'approved' | 'rejected',
      justification: decisionPayload.justification ?? '',
      governanceBlocksApproval: false,
      historicalNonBlocking: true,
      actorId: 'user-1',
      actorName: 'Admin MenuCare',
      createdAt: '2026-06-09T16:50:00.000Z',
      nextMenuProposal,
    }

    decisionHistory = [createdDecision, ...decisionHistory]

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', decision: createdDecision }),
    })
  })

  await page.route('**/governance/recommendations/menu-import-next-e2e-1/next-menu', async (route) => {
    proposalPostCount += 1
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', nextMenuProposal }),
    })
  })

  await page.goto('/')

  await page.locator('form.auth-form input[type="email"]').fill('admin@menucare.local')
  await page.locator('form.auth-form input[type="password"]').fill('Admin@123')
  await page.locator('form.auth-form .auth-button').click()

  const menuImportPanel = page
    .locator('article.panel')
    .filter({ has: page.getByRole('heading', { name: 'Cardapio PDF da Genial' }) })
  const menuAuditHeader = menuImportPanel
    .locator('.invite-history-head')
    .filter({ has: page.getByRole('heading', { name: 'Auditoria contratual do cardapio' }) })
  await menuAuditHeader.locator('select').selectOption('menu-import-next-e2e-1')

  await expect(menuImportPanel).toContainText('Aprovacao permitida na camada obrigatoria')
  await expect(menuImportPanel).toContainText('Meta R$ 15.00 | Custo R$ 14.20')
  await expect(menuImportPanel).toContainText('Top combinacoes: Frango grelhado + Arroz integral + Laranja em gomos (nota 8.60)')

  await menuImportPanel
    .locator('button.logout-button', { hasText: 'Gerar proposta do proximo cardapio' })
    .click()

  await expect(menuImportPanel).toContainText('Proposta baseada em historico de combinacoes')
  await expect(menuImportPanel).toContainText('Receitas propostas: Frango grelhado | Arroz integral | Laranja em gomos')
  await expect(menuImportPanel).toContainText('Custo estimado R$ 14.10 | Meta R$ 15.00')

  const decisionForm = menuImportPanel.locator('form.crud-form').filter({ has: page.getByText('Justificativa da decisao') }).first()
  await decisionForm.locator('textarea').fill('Aprovado por manter meta financeira e historico positivo.')
  await decisionForm.locator('button.logout-button', { hasText: 'Aprovar proposta' }).click()

  await expect(menuImportPanel).toContainText('Historico de decisoes do proximo cardapio')
  await expect(menuImportPanel).toContainText('Aprovado')
  await expect(menuImportPanel).toContainText('Aprovado por manter meta financeira e historico positivo.')

  expect(proposalPostCount).toBe(1)
  expect(decisionPostCount).toBe(1)
  expect(decisionPayload).toEqual({
    decision: 'approved',
    justification: 'Aprovado por manter meta financeira e historico positivo.',
  })
})
