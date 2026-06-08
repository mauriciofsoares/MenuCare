import { useEffect, useState } from 'react'
import './App.css'
import {
  getSupportedUiLocales,
  getUiMessage,
  resolveUiLocale,
  type UiLocale,
} from './messages'

type FlowStep = {
  title: string
  status: 'Concluida' | 'Em andamento' | 'Proxima' | 'Estrutural'
  description: string
  outcome: string
}

const flowSteps: FlowStep[] = [
  {
    title: 'Cadastro de contrato',
    status: 'Concluida',
    description: 'Upload de contratos, editais, termos e documentos regulatórios.',
    outcome: 'Entrada do material bruto para processamento.',
  },
  {
    title: 'Extração de regras',
    status: 'Concluida',
    description: 'Identificação de requisitos operacionais, nutricionais e contratuais.',
    outcome: 'Regras identificadas sem promoção automática.',
  },
  {
    title: 'Validação humana',
    status: 'Em andamento',
    description: 'Aprovar, editar ou rejeitar cada regra com rastreabilidade.',
    outcome: 'Somente regras aprovadas seguem adiante.',
  },
  {
    title: 'Base contratual',
    status: 'Proxima',
    description: 'Consolidar as regras aprovadas como fonte oficial do cliente.',
    outcome: 'Verdade operacional única por empresa.',
  },
  {
    title: 'Geração de cardápios',
    status: 'Proxima',
    description: 'Usar base contratual, fichas técnicas e restrições alimentares.',
    outcome: 'Cardápios aderentes aos requisitos validados.',
  },
  {
    title: 'Conformidade e auditoria',
    status: 'Estrutural',
    description: 'Medir aderência, registrar ações críticas e manter histórico.',
    outcome: 'Governança, rastreabilidade e conformidade contínuas.',
  },
]

const modules = [
  {
    label: 'Dashboard',
    value: 'Indicadores, contratos recentes e alertas',
  },
  {
    label: 'Contratos',
    value: 'Upload, versionamento e processamento',
  },
  {
    label: 'Regras contratuais',
    value: 'Fila de validação e trilha de mudanças',
  },
  {
    label: 'Conformidade',
    value: 'Regras atendidas, parciais e não atendidas',
  },
]

const nextActions = [
  'Estruturar login e sessão da API.',
  'Criar modelo de dados inicial com empresa, usuários, contratos e regras.',
  'Migrar o portal visual para páginas React por módulo.',
]

type SessionUser = {
  id: string
  name: string
  email: string
  companyName: string
  accessProfile: string
}

type AuthState = {
  token: string
  user: SessionUser
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
const STORAGE_KEY = 'menucare.auth'
const GLOBAL_LOCALE_STORAGE_KEY = 'menucare.locale'
const APP_LOCALE_HINT =
  import.meta.env.VITE_APP_LOCALE ??
  (typeof navigator !== 'undefined' ? navigator.language : 'pt-BR')

const getCompanyLocaleStorageKey = (companyName: string) => {
  const normalized = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return `menucare.locale.company.${normalized}`
}

const getInitialLocale = (): UiLocale => {
  if (typeof window === 'undefined') {
    return resolveUiLocale(APP_LOCALE_HINT)
  }

  const globalLocale = window.localStorage.getItem(GLOBAL_LOCALE_STORAGE_KEY)
  return resolveUiLocale(globalLocale ?? APP_LOCALE_HINT)
}

function App() {
  const [locale, setLocale] = useState<UiLocale>(getInitialLocale)
  const [authState, setAuthState] = useState<AuthState | null>(null)
  const [isServerLocaleHydrated, setIsServerLocaleHydrated] = useState(false)
  const [loadingSession, setLoadingSession] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loginForm, setLoginForm] = useState({
    email: 'admin@menucare.local',
    password: 'Admin@123',
  })
  const uiMessage = getUiMessage(locale)
  const supportedLocales = getSupportedUiLocales()

  useEffect(() => {
    const storedAuth = window.localStorage.getItem(STORAGE_KEY)

    if (!storedAuth) {
      setLoadingSession(false)
      return
    }

    const validateSession = async () => {
      try {
        const parsed = JSON.parse(storedAuth) as AuthState
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${parsed.token}`,
          },
        })

        if (!response.ok) {
          throw new Error(uiMessage.auth.sessionExpired)
        }

        const payload = (await response.json()) as { user: SessionUser }
        setAuthState({ token: parsed.token, user: payload.user })
      } catch {
        window.localStorage.removeItem(STORAGE_KEY)
      } finally {
        setLoadingSession(false)
      }
    }

    void validateSession()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(GLOBAL_LOCALE_STORAGE_KEY, locale)

    if (authState) {
      const companyLocaleKey = getCompanyLocaleStorageKey(authState.user.companyName)
      window.localStorage.setItem(companyLocaleKey, locale)
    }
  }, [locale, authState])

  useEffect(() => {
    if (!authState || typeof window === 'undefined') {
      setIsServerLocaleHydrated(false)
      return
    }

    const companyLocaleKey = getCompanyLocaleStorageKey(authState.user.companyName)
    const savedCompanyLocale = window.localStorage.getItem(companyLocaleKey)
    let isCancelled = false

    if (savedCompanyLocale) {
      const resolvedCompanyLocale = resolveUiLocale(savedCompanyLocale)

      if (resolvedCompanyLocale !== locale) {
        setLocale(resolvedCompanyLocale)
      }
    } else {
      window.localStorage.setItem(companyLocaleKey, locale)
    }

    const hydrateLocaleFromServer = async () => {
      try {
        const response = await fetch(`${API_URL}/preferences/locale`, {
          headers: {
            Authorization: `Bearer ${authState.token}`,
          },
        })

        if (!response.ok) {
          return
        }

        const payload = (await response.json()) as { locale?: string }

        if (!payload.locale || isCancelled) {
          return
        }

        const resolvedServerLocale = resolveUiLocale(payload.locale)

        if (resolvedServerLocale !== locale) {
          setLocale(resolvedServerLocale)
        }
      } finally {
        if (!isCancelled) {
          setIsServerLocaleHydrated(true)
        }
      }
    }

    void hydrateLocaleFromServer()

    return () => {
      isCancelled = true
    }
  }, [authState?.token, authState?.user.companyName])

  useEffect(() => {
    if (!authState || !isServerLocaleHydrated) {
      return
    }

    const persistLocaleInServer = async () => {
      await fetch(`${API_URL}/preferences/locale`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authState.token}`,
        },
        body: JSON.stringify({ locale }),
      })
    }

    void persistLocaleInServer()
  }, [locale, authState?.token, isServerLocaleHydrated])

  const handleLocaleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setLocale(resolveUiLocale(event.target.value))
  }

  const handleLoginSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setAuthError(null)

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginForm),
      })

      const payload = (await response.json()) as
        | { status: 'ok'; token: string; user: SessionUser }
        | { status: 'error'; message: string }

      if (!response.ok || payload.status !== 'ok') {
        throw new Error(
          'message' in payload ? payload.message : uiMessage.auth.genericSignInError,
        )
      }

      const nextState = { token: payload.token, user: payload.user }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState))
      setAuthState(nextState)
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : uiMessage.auth.genericSignInError,
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLogout = async () => {
    if (authState) {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authState.token}`,
        },
      })
    }

    window.localStorage.removeItem(STORAGE_KEY)
    setAuthState(null)
  }

  if (loadingSession) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="eyebrow">MenuCare SaaS</div>
          <label className="locale-control">
            <span>{uiMessage.common.languageLabel}</span>
            <select
              value={locale}
              onChange={handleLocaleChange}
              aria-label={uiMessage.common.languageLabel}
            >
              {supportedLocales.map((item) => (
                <option key={item} value={item}>
                  {uiMessage.common.localeNames[item]}
                </option>
              ))}
            </select>
          </label>
          <h1>{uiMessage.auth.validatingSessionTitle}</h1>
          <p>{uiMessage.auth.validatingSessionText}</p>
        </section>
      </main>
    )
  }

  if (!authState) {
    return (
      <main className="auth-shell">
        <section className="auth-card auth-card-grid">
          <div className="auth-copy">
            <div className="eyebrow">MenuCare SaaS</div>
            <label className="locale-control">
              <span>{uiMessage.common.languageLabel}</span>
              <select
                value={locale}
                onChange={handleLocaleChange}
                aria-label={uiMessage.common.languageLabel}
              >
                {supportedLocales.map((item) => (
                  <option key={item} value={item}>
                    {uiMessage.common.localeNames[item]}
                  </option>
                ))}
              </select>
            </label>
            <h1>{uiMessage.auth.loginTitle}</h1>
            <p>
              Entre com a conta inicial para acessar os fluxos de contratos, regras,
              cardápios e conformidade.
            </p>

            <div className="login-hint">
              <span>Conta demo</span>
              <strong>admin@menucare.local</strong>
              <strong>Admin@123</strong>
            </div>
          </div>

          <form className="auth-form" onSubmit={handleLoginSubmit}>
            <label>
              <span>Email</span>
              <input
                type="email"
                value={loginForm.email}
                onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))}
                autoComplete="email"
              />
            </label>

            <label>
              <span>Senha</span>
              <input
                type="password"
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm((current) => ({ ...current, password: event.target.value }))
                }
                autoComplete="current-password"
              />
            </label>

            {authError ? <p className="auth-error">{authError}</p> : null}

            <button type="submit" className="auth-button" disabled={isSubmitting}>
              {isSubmitting ? uiMessage.auth.loginLoadingButton : uiMessage.auth.loginButton}
            </button>
          </form>
        </section>
      </main>
    )
  }

  return (
    <main className="shell">
      <header className="hero-panel">
        <div className="topbar">
          <div>
            <div className="eyebrow">MenuCare SaaS</div>
            <div className="session-chip">
              {uiMessage.auth.activeSession} {authState.user.companyName}
            </div>
          </div>

          <div className="topbar-actions">
            <label className="locale-control compact">
              <span>{uiMessage.common.languageLabel}</span>
              <select
                value={locale}
                onChange={handleLocaleChange}
                aria-label={uiMessage.common.languageLabel}
              >
                {supportedLocales.map((item) => (
                  <option key={item} value={item}>
                    {uiMessage.common.localeNames[item]}
                  </option>
                ))}
              </select>
            </label>

            <button type="button" className="logout-button" onClick={handleLogout}>
              {uiMessage.common.logoutButton}
            </button>
          </div>
        </div>

        <div className="hero-copy">
          <h1>Fluxos de atividade retomados.</h1>
          <p>
            O projeto está organizado ao redor do fluxo oficial do produto: contrato,
            extração, validação humana, base contratual, cardápios, conformidade e
            auditoria.
          </p>
        </div>

        <div className="hero-metrics" aria-label="Resumo do projeto">
          <article>
            <strong>6</strong>
            <span>etapas principais do fluxo</span>
          </article>
          <article>
            <strong>1</strong>
            <span>base contratual por empresa</span>
          </article>
          <article>
            <strong>3</strong>
            <span>frentes imediatas de implementação</span>
          </article>
        </div>
      </header>

      <section className="content-grid">
        <article className="panel panel-flow">
          <div className="section-head">
            <div>
              <span className="section-kicker">Fluxo principal</span>
              <h2>Como as atividades se encadeiam</h2>
            </div>
            <p>Esse é o caminho que guia o produto e as próximas entregas do código.</p>
          </div>

          <div className="timeline">
            {flowSteps.map((step, index) => (
              <div className="timeline-item" key={step.title}>
                <div className="timeline-marker">0{index + 1}</div>
                <div className="timeline-content">
                  <div className="timeline-meta">
                    <h3>{step.title}</h3>
                    <span>{step.status}</span>
                  </div>
                  <p>{step.description}</p>
                  <strong>{step.outcome}</strong>
                </div>
              </div>
            ))}
          </div>
        </article>

        <aside className="panel panel-sidebar">
          <div className="section-head compact">
            <div>
              <span className="section-kicker">Frentes do produto</span>
              <h2>Módulos que sustentam o fluxo</h2>
            </div>
          </div>

          <div className="module-list">
            {modules.map((module) => (
              <article className="module-card" key={module.label}>
                <h3>{module.label}</h3>
                <p>{module.value}</p>
              </article>
            ))}
          </div>

          <div className="next-actions">
            <h3>Próximas ações</h3>
            <ul>
              {nextActions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </div>
        </aside>
      </section>
    </main>
  )
}

export default App
