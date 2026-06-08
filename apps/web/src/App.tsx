import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
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

type CreatedInvite = {
  token: string
  email: string
  companyName: string
  active: boolean
}

type ManagedInvite = {
  token: string
  email: string
  active: boolean
  createdAt: string
  usedAt: string | null
}

type DashboardContract = {
  id: string
  title: string
  status: string
  createdAt: string
}

type DashboardSummary = {
  contractsCount: number
  rulesApprovedCount: number
  rulesPendingCount: number
  recentContracts: DashboardContract[]
}

type ContractItem = {
  id: string
  title: string
  sourceType: string
  status: string
  createdAt: string
}

type RuleItem = {
  id: string
  contractId: string
  title: string
  description: string
  category: string
  status: string
  createdAt: string
}

type RuleValidationEvent = {
  id: string
  previousStatus: string
  nextStatus: string
  note: string | null
  actorName: string
  createdAt: string
}

const flowSteps: FlowStep[] = [
  {
    title: 'Cadastro de contrato',
    status: 'Concluida',
    description: 'Upload de contratos, editais, termos e documentos regulatorios.',
    outcome: 'Entrada do material bruto para processamento.',
  },
  {
    title: 'Extracao de regras',
    status: 'Concluida',
    description: 'Identificacao de requisitos operacionais, nutricionais e contratuais.',
    outcome: 'Regras identificadas sem promocao automatica.',
  },
  {
    title: 'Validacao humana',
    status: 'Em andamento',
    description: 'Aprovar, editar ou rejeitar cada regra com rastreabilidade.',
    outcome: 'Somente regras aprovadas seguem adiante.',
  },
  {
    title: 'Base contratual',
    status: 'Proxima',
    description: 'Consolidar as regras aprovadas como fonte oficial do cliente.',
    outcome: 'Verdade operacional unica por empresa.',
  },
  {
    title: 'Geracao de cardapios',
    status: 'Proxima',
    description: 'Usar base contratual, fichas tecnicas e restricoes alimentares.',
    outcome: 'Cardapios aderentes aos requisitos validados.',
  },
  {
    title: 'Conformidade e auditoria',
    status: 'Estrutural',
    description: 'Medir aderencia, registrar acoes criticas e manter historico.',
    outcome: 'Governanca, rastreabilidade e conformidade continuas.',
  },
]

const modules = [
  { label: 'Dashboard', value: 'Indicadores, contratos recentes e alertas' },
  { label: 'Contratos', value: 'Upload, versionamento e processamento' },
  { label: 'Regras contratuais', value: 'Fila de validacao e trilha de mudancas' },
  { label: 'Conformidade', value: 'Regras atendidas, parciais e nao atendidas' },
]

const nextActions = [
  'Adicionar trilha de auditoria de validacoes.',
  'Criar modulo dedicado de Contratos com filtros.',
  'Criar modulo dedicado de Regras por status.',
]

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
  const [authMode, setAuthMode] = useState<'login' | 'invite'>('login')
  const [locale, setLocale] = useState<UiLocale>(getInitialLocale)
  const [authState, setAuthState] = useState<AuthState | null>(null)
  const [isServerLocaleHydrated, setIsServerLocaleHydrated] = useState(false)
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null)
  const [contracts, setContracts] = useState<ContractItem[]>([])
  const [rules, setRules] = useState<RuleItem[]>([])
  const [loadingSession, setLoadingSession] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const [domainError, setDomainError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false)
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false)
  const [isLoadingInviteHistory, setIsLoadingInviteHistory] = useState(false)
  const [isMutatingInvite, setIsMutatingInvite] = useState(false)
  const [isSubmittingRuleValidation, setIsSubmittingRuleValidation] = useState(false)
  const [isLoadingRuleHistory, setIsLoadingRuleHistory] = useState(false)
  const [isSubmittingContract, setIsSubmittingContract] = useState(false)
  const [isSubmittingRule, setIsSubmittingRule] = useState(false)
  const [loginForm, setLoginForm] = useState({
    email: 'admin@menucare.local',
    password: 'Admin@123',
  })
  const [inviteForm, setInviteForm] = useState({
    token: '',
    password: '',
  })
  const [adminInviteForm, setAdminInviteForm] = useState({
    email: '',
  })
  const [inviteNotice, setInviteNotice] = useState<string | null>(null)
  const [generatedInvite, setGeneratedInvite] = useState<CreatedInvite | null>(null)
  const [inviteGenerationError, setInviteGenerationError] = useState<string | null>(null)
  const [inviteHistory, setInviteHistory] = useState<ManagedInvite[]>([])
  const [inviteHistoryFilter, setInviteHistoryFilter] = useState<'all' | 'active' | 'used'>('all')
  const [ruleValidationForm, setRuleValidationForm] = useState({
    ruleId: '',
    status: 'approved',
    note: '',
  })
  const [ruleValidationEvents, setRuleValidationEvents] = useState<RuleValidationEvent[]>([])
  const [contractForm, setContractForm] = useState({
    title: '',
    sourceType: 'contract',
    status: 'processing',
  })
  const [ruleForm, setRuleForm] = useState({
    contractId: '',
    title: '',
    description: '',
    category: '',
    status: 'identified',
  })

  const uiMessage = getUiMessage(locale)
  const supportedLocales = getSupportedUiLocales()

  const fetchDashboardSummary = async (token: string) => {
    const response = await fetch(`${API_URL}/dashboard/summary`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      return
    }

    const payload = (await response.json()) as { summary?: DashboardSummary }

    if (payload.summary) {
      setDashboardSummary(payload.summary)
    }
  }

  const fetchInviteHistory = async (token: string, filter: 'all' | 'active' | 'used') => {
    setIsLoadingInviteHistory(true)
    setInviteGenerationError(null)

    try {
      const response = await fetch(`${API_URL}/auth/invites?status=${filter}&limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      const payload = (await response.json()) as
        | { status: 'ok'; invites: ManagedInvite[] }
        | { status: 'error'; message: string }

      if (!response.ok || payload.status !== 'ok') {
        throw new Error(
          'message' in payload ? payload.message : uiMessage.auth.genericSignInError,
        )
      }

      setInviteHistory(payload.invites ?? [])
    } catch (error) {
      setInviteGenerationError(
        error instanceof Error ? error.message : uiMessage.auth.genericSignInError,
      )
      setInviteHistory([])
    } finally {
      setIsLoadingInviteHistory(false)
    }
  }

  const fetchRules = async (token: string) => {
    const response = await fetch(`${API_URL}/rules?limit=30`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      return
    }

    const payload = (await response.json()) as { rules?: RuleItem[] }
    setRules(payload.rules ?? [])
  }

  const fetchRuleHistory = async (token: string, ruleId: string) => {
    if (!ruleId) {
      setRuleValidationEvents([])
      return
    }

    setIsLoadingRuleHistory(true)

    try {
      const response = await fetch(`${API_URL}/rules/${ruleId}/history`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      const payload = (await response.json()) as
        | { status: 'ok'; events: RuleValidationEvent[] }
        | { status: 'error'; message: string }

      if (!response.ok || payload.status !== 'ok') {
        throw new Error('message' in payload ? payload.message : 'Falha ao carregar auditoria.')
      }

      setRuleValidationEvents(payload.events ?? [])
    } catch (error) {
      setDomainError(error instanceof Error ? error.message : 'Falha ao carregar auditoria.')
      setRuleValidationEvents([])
    } finally {
      setIsLoadingRuleHistory(false)
    }
  }

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
          headers: { Authorization: `Bearer ${parsed.token}` },
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
          headers: { Authorization: `Bearer ${authState.token}` },
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

  useEffect(() => {
    if (!authState) {
      setInviteHistory([])
      return
    }

    void fetchInviteHistory(authState.token, inviteHistoryFilter)
  }, [authState?.token, inviteHistoryFilter])

  useEffect(() => {
    if (!authState) {
      setDashboardSummary(null)
      setContracts([])
      setRules([])
      return
    }

    const loadDomainData = async () => {
      try {
        const [summaryResponse, contractsResponse, rulesResponse] = await Promise.all([
          fetch(`${API_URL}/dashboard/summary`, {
            headers: { Authorization: `Bearer ${authState.token}` },
          }),
          fetch(`${API_URL}/contracts?limit=30`, {
            headers: { Authorization: `Bearer ${authState.token}` },
          }),
          fetch(`${API_URL}/rules?limit=30`, {
            headers: { Authorization: `Bearer ${authState.token}` },
          }),
        ])

        if (summaryResponse.ok) {
          const payload = (await summaryResponse.json()) as { summary?: DashboardSummary }

          if (payload.summary) {
            setDashboardSummary(payload.summary)
          }
        }

        if (contractsResponse.ok) {
          const payload = (await contractsResponse.json()) as { contracts?: ContractItem[] }
          setContracts(payload.contracts ?? [])
        }

        if (rulesResponse.ok) {
          const payload = (await rulesResponse.json()) as { rules?: RuleItem[] }
          setRules(payload.rules ?? [])
        }
      } catch {
        setDashboardSummary(null)
      }
    }

    void loadDomainData()
  }, [authState?.token])

  useEffect(() => {
    if (!ruleForm.contractId && contracts.length > 0) {
      setRuleForm((current) => ({ ...current, contractId: contracts[0].id }))
    }
  }, [contracts])

  useEffect(() => {
    if (!authState) {
      setRuleValidationEvents([])
      return
    }

    if (!ruleValidationForm.ruleId && rules.length > 0) {
      setRuleValidationForm((current) => ({ ...current, ruleId: rules[0].id }))
      return
    }

    if (ruleValidationForm.ruleId) {
      void fetchRuleHistory(authState.token, ruleValidationForm.ruleId)
    }
  }, [authState?.token, ruleValidationForm.ruleId, rules])

  const handleLocaleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setLocale(resolveUiLocale(event.target.value))
  }

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setAuthError(null)

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      setAuthError(error instanceof Error ? error.message : uiMessage.auth.genericSignInError)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInviteSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthError(null)
    setInviteNotice(null)
    setIsSubmittingInvite(true)

    try {
      const response = await fetch(`${API_URL}/auth/first-access/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: inviteForm.token.trim(),
          password: inviteForm.password,
        }),
      })

      const payload = (await response.json()) as
        | { status: 'ok'; message?: string; email?: string }
        | { status: 'error'; message: string }

      if (!response.ok || payload.status !== 'ok') {
        throw new Error(
          'message' in payload ? payload.message : uiMessage.auth.genericSignInError,
        )
      }

      setInviteNotice(payload.message ?? uiMessage.auth.inviteSuccess)
      setAuthMode('login')
      setLoginForm((current) => ({
        ...current,
        email: payload.email ?? current.email,
        password: inviteForm.password,
      }))
      setInviteForm({ token: '', password: '' })
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : uiMessage.auth.genericSignInError)
    } finally {
      setIsSubmittingInvite(false)
    }
  }

  const handleCreateContract = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!authState) {
      return
    }

    setDomainError(null)
    setIsSubmittingContract(true)

    try {
      const response = await fetch(`${API_URL}/contracts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authState.token}`,
        },
        body: JSON.stringify(contractForm),
      })

      const payload = (await response.json()) as
        | { status: 'ok'; contract: ContractItem }
        | { status: 'error'; message: string }

      if (!response.ok || payload.status !== 'ok') {
        throw new Error('message' in payload ? payload.message : 'Falha ao cadastrar contrato.')
      }

      setContracts((current) => [payload.contract, ...current])
      setContractForm({ title: '', sourceType: 'contract', status: 'processing' })
      await fetchDashboardSummary(authState.token)
    } catch (error) {
      setDomainError(error instanceof Error ? error.message : 'Falha ao cadastrar contrato.')
    } finally {
      setIsSubmittingContract(false)
    }
  }

  const handleGenerateInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!authState) {
      return
    }

    setInviteGenerationError(null)
    setGeneratedInvite(null)
    setIsGeneratingInvite(true)

    try {
      const response = await fetch(`${API_URL}/auth/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authState.token}`,
        },
        body: JSON.stringify({ email: adminInviteForm.email.trim() }),
      })

      const payload = (await response.json()) as
        | { status: 'ok'; invite: CreatedInvite }
        | { status: 'error'; message: string }

      if (!response.ok || payload.status !== 'ok') {
        throw new Error(
          'message' in payload ? payload.message : uiMessage.auth.genericSignInError,
        )
      }

      setGeneratedInvite(payload.invite)
      setAdminInviteForm({ email: '' })
      await fetchInviteHistory(authState.token, inviteHistoryFilter)
    } catch (error) {
      setInviteGenerationError(
        error instanceof Error ? error.message : uiMessage.auth.genericSignInError,
      )
    } finally {
      setIsGeneratingInvite(false)
    }
  }

  const handleRevokeInvite = async (token: string) => {
    if (!authState) {
      return
    }

    setInviteGenerationError(null)
    setIsMutatingInvite(true)

    try {
      const response = await fetch(`${API_URL}/auth/invites/${token}/revoke`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authState.token}` },
      })

      const payload = (await response.json()) as
        | { status: 'ok'; message?: string }
        | { status: 'error'; message: string }

      if (!response.ok || payload.status !== 'ok') {
        throw new Error(
          'message' in payload ? payload.message : uiMessage.auth.genericSignInError,
        )
      }

      await fetchInviteHistory(authState.token, inviteHistoryFilter)
    } catch (error) {
      setInviteGenerationError(
        error instanceof Error ? error.message : uiMessage.auth.genericSignInError,
      )
    } finally {
      setIsMutatingInvite(false)
    }
  }

  const handleRegenerateInvite = async (token: string) => {
    if (!authState) {
      return
    }

    setInviteGenerationError(null)
    setIsMutatingInvite(true)

    try {
      const response = await fetch(`${API_URL}/auth/invites/${token}/regenerate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authState.token}` },
      })

      const payload = (await response.json()) as
        | { status: 'ok'; invite: CreatedInvite }
        | { status: 'error'; message: string }

      if (!response.ok || payload.status !== 'ok') {
        throw new Error(
          'message' in payload ? payload.message : uiMessage.auth.genericSignInError,
        )
      }

      setGeneratedInvite(payload.invite)
      await fetchInviteHistory(authState.token, inviteHistoryFilter)
    } catch (error) {
      setInviteGenerationError(
        error instanceof Error ? error.message : uiMessage.auth.genericSignInError,
      )
    } finally {
      setIsMutatingInvite(false)
    }
  }

  const handleCreateRule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!authState) {
      return
    }

    setDomainError(null)
    setIsSubmittingRule(true)

    try {
      const response = await fetch(`${API_URL}/rules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authState.token}`,
        },
        body: JSON.stringify(ruleForm),
      })

      const payload = (await response.json()) as
        | { status: 'ok'; rule: RuleItem }
        | { status: 'error'; message: string }

      if (!response.ok || payload.status !== 'ok') {
        throw new Error('message' in payload ? payload.message : 'Falha ao cadastrar regra.')
      }

      setRules((current) => [payload.rule, ...current])
      setRuleForm((current) => ({
        ...current,
        title: '',
        description: '',
        category: '',
        status: 'identified',
      }))
      await fetchDashboardSummary(authState.token)
    } catch (error) {
      setDomainError(error instanceof Error ? error.message : 'Falha ao cadastrar regra.')
    } finally {
      setIsSubmittingRule(false)
    }
  }

  const handleRuleValidationSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!authState || !ruleValidationForm.ruleId) {
      return
    }

    setDomainError(null)
    setIsSubmittingRuleValidation(true)

    try {
      const response = await fetch(`${API_URL}/rules/${ruleValidationForm.ruleId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authState.token}`,
        },
        body: JSON.stringify({
          status: ruleValidationForm.status,
          note: ruleValidationForm.note.trim() || undefined,
        }),
      })

      const payload = (await response.json()) as
        | { status: 'ok'; message?: string }
        | { status: 'error'; message: string }

      if (!response.ok || payload.status !== 'ok') {
        throw new Error('message' in payload ? payload.message : 'Falha ao validar regra.')
      }

      setRuleValidationForm((current) => ({ ...current, note: '' }))
      await Promise.all([
        fetchRules(authState.token),
        fetchDashboardSummary(authState.token),
        fetchRuleHistory(authState.token, ruleValidationForm.ruleId),
      ])
    } catch (error) {
      setDomainError(error instanceof Error ? error.message : 'Falha ao validar regra.')
    } finally {
      setIsSubmittingRuleValidation(false)
    }
  }

  const handleLogout = async () => {
    if (authState) {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authState.token}` },
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
            <select value={locale} onChange={handleLocaleChange} aria-label={uiMessage.common.languageLabel}>
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
              <select value={locale} onChange={handleLocaleChange} aria-label={uiMessage.common.languageLabel}>
                {supportedLocales.map((item) => (
                  <option key={item} value={item}>
                    {uiMessage.common.localeNames[item]}
                  </option>
                ))}
              </select>
            </label>
            <div className="auth-tabs" role="tablist" aria-label="Fluxo de acesso">
              <button
                type="button"
                className={`auth-tab ${authMode === 'login' ? 'active' : ''}`}
                onClick={() => {
                  setAuthMode('login')
                  setAuthError(null)
                }}
              >
                {uiMessage.auth.loginTabLabel}
              </button>
              <button
                type="button"
                className={`auth-tab ${authMode === 'invite' ? 'active' : ''}`}
                onClick={() => {
                  setAuthMode('invite')
                  setAuthError(null)
                }}
              >
                {uiMessage.auth.firstAccessTabLabel}
              </button>
            </div>
            <h1>{uiMessage.auth.loginTitle}</h1>
            <p>
              Entre com a conta inicial para acessar os fluxos de contratos, regras,
              cardapios e conformidade.
            </p>

            <div className="login-hint">
              <span>Conta demo</span>
              <strong>admin@menucare.local</strong>
              <strong>Admin@123</strong>
            </div>
          </div>

          {authMode === 'login' ? (
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
                  onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                  autoComplete="current-password"
                />
              </label>

              {authError ? <p className="auth-error">{authError}</p> : null}
              {inviteNotice ? <p className="auth-success">{inviteNotice}</p> : null}

              <button type="submit" className="auth-button" disabled={isSubmitting}>
                {isSubmitting ? uiMessage.auth.loginLoadingButton : uiMessage.auth.loginButton}
              </button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleInviteSubmit}>
              <h2 className="invite-title">{uiMessage.auth.inviteTitle}</h2>

              <label>
                <span>{uiMessage.auth.inviteTokenLabel}</span>
                <input
                  type="text"
                  value={inviteForm.token}
                  onChange={(event) =>
                    setInviteForm((current) => ({ ...current, token: event.target.value }))
                  }
                  required
                />
              </label>

              <label>
                <span>{uiMessage.auth.invitePasswordLabel}</span>
                <input
                  type="password"
                  value={inviteForm.password}
                  onChange={(event) =>
                    setInviteForm((current) => ({ ...current, password: event.target.value }))
                  }
                  minLength={6}
                  required
                />
              </label>

              {authError ? <p className="auth-error">{authError}</p> : null}

              <button type="submit" className="auth-button" disabled={isSubmittingInvite}>
                {isSubmittingInvite
                  ? uiMessage.auth.inviteLoadingButton
                  : uiMessage.auth.inviteButton}
              </button>
            </form>
          )}
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
              <select value={locale} onChange={handleLocaleChange} aria-label={uiMessage.common.languageLabel}>
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
            O projeto agora tem autenticacao, preferencias por empresa e operacoes reais de
            contratos e regras com persistencia em banco.
          </p>
        </div>

        <div className="hero-metrics" aria-label="Resumo do projeto">
          <article>
            <strong>{dashboardSummary?.contractsCount ?? '-'}</strong>
            <span>contratos cadastrados</span>
          </article>
          <article>
            <strong>{dashboardSummary?.rulesApprovedCount ?? '-'}</strong>
            <span>regras aprovadas</span>
          </article>
          <article>
            <strong>{dashboardSummary?.rulesPendingCount ?? '-'}</strong>
            <span>regras em validacao</span>
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
            <p>Esse e o caminho que guia o produto e as proximas entregas do codigo.</p>
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
              <h2>Modulos que sustentam o fluxo</h2>
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
            <h3>Contratos recentes</h3>
            {dashboardSummary?.recentContracts?.length ? (
              <ul>
                {dashboardSummary.recentContracts.map((contract) => (
                  <li key={contract.id}>
                    <strong>{contract.title}</strong>
                    <span>{contract.status}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Nenhum contrato cadastrado ainda.</p>
            )}
          </div>

          <div className="next-actions">
            <h3>Proximas acoes</h3>
            <ul>
              {nextActions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </div>
        </aside>
      </section>

      <section className="operations-grid">
        <article className="panel invite-admin-panel">
          <div className="section-head compact">
            <div>
              <span className="section-kicker">Acesso</span>
              <h2>{uiMessage.auth.adminInviteTitle}</h2>
            </div>
          </div>

          <p className="invite-admin-description">{uiMessage.auth.adminInviteDescription}</p>

          <form className="crud-form" onSubmit={handleGenerateInvite}>
            <label>
              <span>{uiMessage.auth.adminInviteEmailLabel}</span>
              <input
                type="email"
                value={adminInviteForm.email}
                onChange={(event) =>
                  setAdminInviteForm((current) => ({ ...current, email: event.target.value }))
                }
                required
              />
            </label>

            <button type="submit" className="auth-button" disabled={isGeneratingInvite}>
              {isGeneratingInvite
                ? uiMessage.auth.adminInviteLoadingButton
                : uiMessage.auth.adminInviteButton}
            </button>
          </form>

          {inviteGenerationError ? <p className="auth-error">{inviteGenerationError}</p> : null}

          {generatedInvite ? (
            <div className="generated-invite-card">
              <span>{uiMessage.auth.adminInviteTokenLabel}</span>
              <strong>{generatedInvite.token}</strong>
              <p>{generatedInvite.email}</p>
            </div>
          ) : null}

          <div className="invite-history-head">
            <h3>{uiMessage.auth.inviteHistoryTitle}</h3>
            <label>
              <span>{uiMessage.auth.inviteFilterLabel}</span>
              <select
                value={inviteHistoryFilter}
                onChange={(event) =>
                  setInviteHistoryFilter(event.target.value as 'all' | 'active' | 'used')
                }
              >
                <option value="all">{uiMessage.auth.inviteFilterAll}</option>
                <option value="active">{uiMessage.auth.inviteFilterActive}</option>
                <option value="used">{uiMessage.auth.inviteFilterUsed}</option>
              </select>
            </label>
          </div>

          {isLoadingInviteHistory ? (
            <p className="empty-note">{uiMessage.auth.inviteLoadingHistory}</p>
          ) : inviteHistory.length ? (
            <ul className="invite-history-list">
              {inviteHistory.map((item) => (
                <li key={item.token}>
                  <div className="invite-history-row">
                    <strong>{item.token}</strong>
                    <span className={`invite-status ${item.active ? 'active' : 'inactive'}`}>
                      {item.active
                        ? uiMessage.auth.inviteStatusActive
                        : uiMessage.auth.inviteStatusInactive}
                    </span>
                  </div>
                  <p>{item.email}</p>
                  <small>
                    {uiMessage.auth.inviteCreatedAtLabel}:{' '}
                    {new Date(item.createdAt).toLocaleString(locale)}
                  </small>
                  {item.usedAt ? (
                    <small>
                      {uiMessage.auth.inviteUsedAtLabel}:{' '}
                      {new Date(item.usedAt).toLocaleString(locale)}
                    </small>
                  ) : null}
                  <div className="invite-history-actions">
                    <button
                      type="button"
                      className="logout-button"
                      onClick={() => handleRegenerateInvite(item.token)}
                      disabled={isMutatingInvite}
                    >
                      {uiMessage.auth.inviteRegenerateButton}
                    </button>
                    {item.active ? (
                      <button
                        type="button"
                        className="logout-button"
                        onClick={() => handleRevokeInvite(item.token)}
                        disabled={isMutatingInvite}
                      >
                        {uiMessage.auth.inviteRevokeButton}
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-note">{uiMessage.auth.inviteEmptyHistory}</p>
          )}
        </article>

        <article className="panel">
          <div className="section-head compact">
            <div>
              <span className="section-kicker">Operacao</span>
              <h2>Novo contrato</h2>
            </div>
          </div>

          <form className="crud-form" onSubmit={handleCreateContract}>
            <label>
              <span>Titulo</span>
              <input
                type="text"
                value={contractForm.title}
                onChange={(event) =>
                  setContractForm((current) => ({ ...current, title: event.target.value }))
                }
                required
                minLength={3}
              />
            </label>

            <label>
              <span>Tipo de documento</span>
              <select
                value={contractForm.sourceType}
                onChange={(event) =>
                  setContractForm((current) => ({ ...current, sourceType: event.target.value }))
                }
              >
                <option value="contract">Contrato</option>
                <option value="bid_notice">Edital</option>
                <option value="reference_term">Termo de referencia</option>
                <option value="regulation">Regulamento</option>
              </select>
            </label>

            <label>
              <span>Status</span>
              <select
                value={contractForm.status}
                onChange={(event) =>
                  setContractForm((current) => ({ ...current, status: event.target.value }))
                }
              >
                <option value="processing">Em processamento</option>
                <option value="draft">Rascunho</option>
                <option value="active">Ativo</option>
                <option value="archived">Arquivado</option>
              </select>
            </label>

            <button type="submit" className="auth-button" disabled={isSubmittingContract}>
              {isSubmittingContract ? 'Salvando...' : 'Salvar contrato'}
            </button>
          </form>
        </article>

        <article className="panel">
          <div className="section-head compact">
            <div>
              <span className="section-kicker">Operacao</span>
              <h2>Nova regra contratual</h2>
            </div>
          </div>

          <form className="crud-form" onSubmit={handleCreateRule}>
            <label>
              <span>Contrato</span>
              <select
                value={ruleForm.contractId}
                onChange={(event) =>
                  setRuleForm((current) => ({ ...current, contractId: event.target.value }))
                }
                required
              >
                <option value="" disabled>
                  Selecione um contrato
                </option>
                {contracts.map((contract) => (
                  <option key={contract.id} value={contract.id}>
                    {contract.title}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Titulo da regra</span>
              <input
                type="text"
                value={ruleForm.title}
                onChange={(event) =>
                  setRuleForm((current) => ({ ...current, title: event.target.value }))
                }
                required
                minLength={3}
              />
            </label>

            <label>
              <span>Descricao</span>
              <textarea
                value={ruleForm.description}
                onChange={(event) =>
                  setRuleForm((current) => ({ ...current, description: event.target.value }))
                }
                required
                minLength={3}
              />
            </label>

            <label>
              <span>Categoria</span>
              <input
                type="text"
                value={ruleForm.category}
                onChange={(event) =>
                  setRuleForm((current) => ({ ...current, category: event.target.value }))
                }
                required
                minLength={2}
              />
            </label>

            <label>
              <span>Status inicial</span>
              <select
                value={ruleForm.status}
                onChange={(event) =>
                  setRuleForm((current) => ({ ...current, status: event.target.value }))
                }
              >
                <option value="identified">Identificada</option>
                <option value="under_review">Em validacao</option>
                <option value="approved">Aprovada</option>
                <option value="rejected">Rejeitada</option>
                <option value="archived">Arquivada</option>
              </select>
            </label>

            <button
              type="submit"
              className="auth-button"
              disabled={isSubmittingRule || contracts.length === 0}
            >
              {isSubmittingRule ? 'Salvando...' : 'Salvar regra'}
            </button>
          </form>

          {contracts.length === 0 ? (
            <p className="empty-note">Cadastre um contrato antes de adicionar regras.</p>
          ) : null}
          {domainError ? <p className="auth-error">{domainError}</p> : null}
        </article>
      </section>

      <section className="operations-grid">
        <article className="panel">
          <div className="section-head compact">
            <div>
              <span className="section-kicker">Validacao</span>
              <h2>Auditoria de regras</h2>
            </div>
          </div>

          <form className="crud-form" onSubmit={handleRuleValidationSubmit}>
            <label>
              <span>Regra</span>
              <select
                value={ruleValidationForm.ruleId}
                onChange={(event) =>
                  setRuleValidationForm((current) => ({ ...current, ruleId: event.target.value }))
                }
                required
              >
                <option value="" disabled>
                  Selecione uma regra
                </option>
                {rules.map((rule) => (
                  <option key={rule.id} value={rule.id}>
                    {rule.title}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Novo status</span>
              <select
                value={ruleValidationForm.status}
                onChange={(event) =>
                  setRuleValidationForm((current) => ({ ...current, status: event.target.value }))
                }
              >
                <option value="under_review">Em validacao</option>
                <option value="approved">Aprovar</option>
                <option value="rejected">Rejeitar</option>
                <option value="archived">Arquivar</option>
              </select>
            </label>

            <label>
              <span>Observacao (opcional)</span>
              <textarea
                value={ruleValidationForm.note}
                onChange={(event) =>
                  setRuleValidationForm((current) => ({ ...current, note: event.target.value }))
                }
                minLength={3}
              />
            </label>

            <button
              type="submit"
              className="auth-button"
              disabled={isSubmittingRuleValidation || rules.length === 0}
            >
              {isSubmittingRuleValidation ? 'Registrando...' : 'Registrar validacao'}
            </button>
          </form>

          {isLoadingRuleHistory ? (
            <p className="empty-note">Carregando trilha de auditoria...</p>
          ) : ruleValidationEvents.length ? (
            <ul className="validation-history-list">
              {ruleValidationEvents.map((event) => (
                <li key={event.id}>
                  <div className="validation-history-row">
                    <strong>{event.previousStatus}</strong>
                    <span>{event.nextStatus}</span>
                  </div>
                  <p>{event.note ?? 'Sem observacao registrada.'}</p>
                  <small>
                    {event.actorName} · {new Date(event.createdAt).toLocaleString(locale)}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-note">Sem eventos de auditoria para a regra selecionada.</p>
          )}
        </article>

        <article className="panel">
          <div className="section-head compact">
            <div>
              <span className="section-kicker">Dados reais</span>
              <h2>Contratos</h2>
            </div>
          </div>
          <ul className="records-list">
            {contracts.length ? (
              contracts.map((contract) => (
                <li key={contract.id}>
                  <strong>{contract.title}</strong>
                  <span>{contract.status}</span>
                </li>
              ))
            ) : (
              <li>
                <strong>Nenhum contrato encontrado</strong>
                <span>Use o formulario para cadastrar o primeiro contrato.</span>
              </li>
            )}
          </ul>
        </article>

        <article className="panel">
          <div className="section-head compact">
            <div>
              <span className="section-kicker">Dados reais</span>
              <h2>Regras contratuais</h2>
            </div>
          </div>
          <ul className="records-list">
            {rules.length ? (
              rules.map((rule) => (
                <li key={rule.id}>
                  <strong>{rule.title}</strong>
                  <span>{rule.status}</span>
                </li>
              ))
            ) : (
              <li>
                <strong>Nenhuma regra encontrada</strong>
                <span>Cadastre regras para iniciar a validacao contratual.</span>
              </li>
            )}
          </ul>
        </article>
      </section>
    </main>
  )
}

export default App
