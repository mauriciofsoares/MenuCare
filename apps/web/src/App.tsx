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

type InviteAuditEvent = {
  id: string
  inviteToken: string
  inviteEmail: string
  action: string
  note: string | null
  actorName: string
  createdAt: string
}

type ComplianceExportAuditEvent = {
  id: string
  exportId: string
  exportType: string
  nonConformityId: string | null
  actionPlanId: string | null
  filterExportId: string | null
  filterNonConformityId: string | null
  filterActionPlanId: string | null
  filterSortOrder: string | null
  filterExportScope: string | null
  filterActor: string | null
  filterFrom: string | null
  filterTo: string | null
  actorName: string
  createdAt: string
}

type ComplianceExportAuditResponse = {
  events?: ComplianceExportAuditEvent[]
  page?: number
  limit?: number
  total?: number
  hasNext?: boolean
}

type NonConformityItem = {
  id: string
  title: string
  description: string
  origin: string
  impact: string
  owner: string
  dueDate: string
  status: string
  createdAt: string
}

type ActionPlanItem = {
  id: string
  nonConformityId: string
  description: string
  owner: string
  dueDate: string
  status: string
  createdAt: string
}

type ActionPlanEvent = {
  id: string
  previousStatus: string
  nextStatus: string
  actorName: string
  createdAt: string
}

type NonConformityEvent = {
  id: string
  previousStatus: string
  nextStatus: string
  actorName: string
  createdAt: string
}

type NonConformityHistoryResponse = {
  events?: NonConformityEvent[]
  page?: number
  limit?: number
  total?: number
  hasNext?: boolean
}

type ActionPlanHistoryResponse = {
  events?: ActionPlanEvent[]
  page?: number
  limit?: number
  total?: number
  hasNext?: boolean
}

type NonConformityHistoryFilter = {
  actor: string
  from: string
  to: string
}

type ActionPlanHistoryFilter = {
  actor: string
  from: string
  to: string
}

type ComplianceExportAuditFilter = {
  exportId: string
  nonConformityId: string
  actionPlanId: string
  sortOrder: 'desc' | 'asc'
  actor: string
  from: string
  to: string
}

type ComplianceExportAuditPreferences = {
  typeFilter: 'all' | 'non_conformity_history' | 'action_plan_history' | 'compliance_export_audit'
  filter: ComplianceExportAuditFilter
  appliedFilter: ComplianceExportAuditFilter
  page: number
  limit: 30 | 50 | 100
  exportScope: 'page' | 'all'
}

type RecommendationPolicyItemKey =
  | 'contract_rules'
  | 'financial_goal'
  | 'nutritional_restrictions'
  | 'operational_rules'
  | 'historical_ratings'

type RecommendationPolicyBlockingKey =
  | 'contract_rule_violation'
  | 'mandatory_nutritional_restriction_violation'
  | 'financial_goal_exceeded'
  | 'critical_operational_rule_violation'

type RecommendationPolicyLevel = {
  key: 'mandatory' | 'recommended' | 'informational'
  blocksApproval: boolean
}

type RecommendationPolicyContract = {
  priorityOrder: RecommendationPolicyItemKey[]
  levels: RecommendationPolicyLevel[]
  blockingCriteria: RecommendationPolicyBlockingKey[]
}

type MenuImportItem = {
  id: string
  fileName: string
  unitName: string
  serviceName: string
  referenceDate: string
  mealType: string
  financialGoal: number
  mealCost: number
  exceededValue: number
  exceededPercent: number
  validationStatus: 'within_goal' | 'above_goal'
  recipes: string[]
  createdAt: string
}

type MenuImportAuditItem = {
  id: string
  ruleId: string | null
  ruleTitle: string
  resultStatus: 'compliant' | 'non_compliant'
  evidence: string
  createdAt: string
}

type MenuImportSuggestionItem = {
  id: string
  sourceType: 'rule' | 'financial_goal'
  sourceReference: string | null
  suggestionText: string
  estimatedFinancialImpact: number
  estimatedNutritionalImpact: string
  priorityLevel: 'high' | 'medium'
  createdAt: string
}

type MenuAdjustedVersionItem = {
  id: string
  versionLabel: string
  adjustedMealCost: number
  totalFinancialImpact: number
  nutritionalImpactSummary: string
  appliedSuggestions: Array<{
    id: string
    suggestionText: string
    estimatedFinancialImpact: number
    estimatedNutritionalImpact: string
    priorityLevel: 'high' | 'medium'
  }>
  createdAt: string
}

type MenuEvaluationImportItem = {
  id: string
  fileName: string
  unitName: string
  serviceName: string
  referenceDate: string
  score: number
  evaluationsCount: number
  comments: string | null
  createdAt: string
}

type MenuCombinationIntelligenceItem = {
  id: string
  combinationKey: string
  recipes: string[]
  unitName: string
  serviceName: string
  averageRating: number
  evaluationsCount: number
  mappedRecords: number
  lastReferenceDate: string
  trend: 'positive' | 'stable' | 'negative'
  createdAt: string
}

type MenuRecommendationPreview = {
  policy: RecommendationPolicyContract
  importContext: {
    importId: string
    unitName: string
    serviceName: string
    financialGoal: number
    mealCost: number
    currentRecipes: string[]
  }
  decision: {
    blocksApproval: boolean
    mandatoryFindings: Array<{
      criterion: string
      status: 'ok' | 'violation'
      detail: string
    }>
  }
  historicalLayer: {
    nonBlocking: boolean
    note: string
    recommendedCombinations: Array<{
      id: string
      recipes: string[]
      averageRating: number
      evaluationsCount: number
      trend: 'positive' | 'stable' | 'negative'
    }>
  }
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

const getCompanyComplianceExportAuditStorageKey = (companyName: string) => {
  const normalized = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return `menucare.audit.exports.company.${normalized}`
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
  const [nonConformities, setNonConformities] = useState<NonConformityItem[]>([])
  const [actionPlans, setActionPlans] = useState<ActionPlanItem[]>([])
  const [actionPlanEvents, setActionPlanEvents] = useState<ActionPlanEvent[]>([])
  const [actionPlanHistoryPage, setActionPlanHistoryPage] = useState(1)
  const [actionPlanHistoryHasNext, setActionPlanHistoryHasNext] = useState(false)
  const [actionPlanHistoryTotal, setActionPlanHistoryTotal] = useState(0)
  const [nonConformityEvents, setNonConformityEvents] = useState<NonConformityEvent[]>([])
  const [nonConformityHistoryPage, setNonConformityHistoryPage] = useState(1)
  const [nonConformityHistoryHasNext, setNonConformityHistoryHasNext] = useState(false)
  const [nonConformityHistoryTotal, setNonConformityHistoryTotal] = useState(0)
  const [nonConformityHistoryFilter, setNonConformityHistoryFilter] =
    useState<NonConformityHistoryFilter>({
      actor: '',
      from: '',
      to: '',
    })
  const [appliedNonConformityHistoryFilter, setAppliedNonConformityHistoryFilter] =
    useState<NonConformityHistoryFilter>({
      actor: '',
      from: '',
      to: '',
    })
  const [actionPlanHistoryFilter, setActionPlanHistoryFilter] = useState<ActionPlanHistoryFilter>({
    actor: '',
    from: '',
    to: '',
  })
  const [appliedActionPlanHistoryFilter, setAppliedActionPlanHistoryFilter] =
    useState<ActionPlanHistoryFilter>({
      actor: '',
      from: '',
      to: '',
    })
  const [loadingSession, setLoadingSession] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const [domainError, setDomainError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false)
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false)
  const [isLoadingInviteHistory, setIsLoadingInviteHistory] = useState(false)
  const [isLoadingInviteAudit, setIsLoadingInviteAudit] = useState(false)
  const [isLoadingComplianceExportAudit, setIsLoadingComplianceExportAudit] = useState(false)
  const [isExportingComplianceExportAudit, setIsExportingComplianceExportAudit] = useState(false)
  const [isMutatingInvite, setIsMutatingInvite] = useState(false)
  const [isSubmittingRuleValidation, setIsSubmittingRuleValidation] = useState(false)
  const [isLoadingRuleHistory, setIsLoadingRuleHistory] = useState(false)
  const [isSubmittingContract, setIsSubmittingContract] = useState(false)
  const [isSubmittingRule, setIsSubmittingRule] = useState(false)
  const [isSubmittingNonConformity, setIsSubmittingNonConformity] = useState(false)
  const [isSubmittingActionPlan, setIsSubmittingActionPlan] = useState(false)
  const [isUpdatingNonConformityId, setIsUpdatingNonConformityId] = useState<string | null>(null)
  const [isUpdatingActionPlanId, setIsUpdatingActionPlanId] = useState<string | null>(null)
  const [isLoadingActionPlanHistory, setIsLoadingActionPlanHistory] = useState(false)
  const [isLoadingNonConformityHistory, setIsLoadingNonConformityHistory] = useState(false)
  const [complianceExportAuditPage, setComplianceExportAuditPage] = useState(1)
  const [complianceExportAuditLimit, setComplianceExportAuditLimit] = useState<30 | 50 | 100>(30)
  const [complianceExportAuditHasNext, setComplianceExportAuditHasNext] = useState(false)
  const [complianceExportAuditTotal, setComplianceExportAuditTotal] = useState(0)
  const [recommendationPolicy, setRecommendationPolicy] = useState<RecommendationPolicyContract | null>(null)
  const [isLoadingRecommendationPolicy, setIsLoadingRecommendationPolicy] = useState(false)
  const [menuImports, setMenuImports] = useState<MenuImportItem[]>([])
  const [isLoadingMenuImports, setIsLoadingMenuImports] = useState(false)
  const [isSubmittingMenuImport, setIsSubmittingMenuImport] = useState(false)
  const [selectedMenuImportId, setSelectedMenuImportId] = useState('')
  const [menuImportAuditItems, setMenuImportAuditItems] = useState<MenuImportAuditItem[]>([])
  const [isLoadingMenuImportAudit, setIsLoadingMenuImportAudit] = useState(false)
  const [isRunningMenuImportAudit, setIsRunningMenuImportAudit] = useState(false)
  const [menuImportSuggestions, setMenuImportSuggestions] = useState<MenuImportSuggestionItem[]>([])
  const [isLoadingMenuImportSuggestions, setIsLoadingMenuImportSuggestions] = useState(false)
  const [isGeneratingMenuImportSuggestions, setIsGeneratingMenuImportSuggestions] = useState(false)
  const [menuAdjustedVersions, setMenuAdjustedVersions] = useState<MenuAdjustedVersionItem[]>([])
  const [isLoadingMenuAdjustedVersions, setIsLoadingMenuAdjustedVersions] = useState(false)
  const [isGeneratingAdjustedVersion, setIsGeneratingAdjustedVersion] = useState(false)
  const [menuEvaluationImports, setMenuEvaluationImports] = useState<MenuEvaluationImportItem[]>([])
  const [isLoadingMenuEvaluationImports, setIsLoadingMenuEvaluationImports] = useState(false)
  const [isSubmittingMenuEvaluationImport, setIsSubmittingMenuEvaluationImport] = useState(false)
  const [menuCombinationIntelligence, setMenuCombinationIntelligence] = useState<MenuCombinationIntelligenceItem[]>([])
  const [isLoadingMenuCombinationIntelligence, setIsLoadingMenuCombinationIntelligence] = useState(false)
  const [isRebuildingMenuCombinationIntelligence, setIsRebuildingMenuCombinationIntelligence] = useState(false)
  const [menuRecommendationPreview, setMenuRecommendationPreview] = useState<MenuRecommendationPreview | null>(null)
  const [isLoadingMenuRecommendationPreview, setIsLoadingMenuRecommendationPreview] = useState(false)
  const [complianceExportAuditExportScope, setComplianceExportAuditExportScope] =
    useState<'page' | 'all'>('page')
  const [isExportingNonConformityHistory, setIsExportingNonConformityHistory] = useState(false)
  const [isExportingActionPlanHistory, setIsExportingActionPlanHistory] = useState(false)
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
  const [inviteAuditEvents, setInviteAuditEvents] = useState<InviteAuditEvent[]>([])
  const [complianceExportAuditEvents, setComplianceExportAuditEvents] = useState<ComplianceExportAuditEvent[]>([])
  const [complianceExportAuditTypeFilter, setComplianceExportAuditTypeFilter] =
    useState<'all' | 'non_conformity_history' | 'action_plan_history' | 'compliance_export_audit'>('all')
  const [complianceExportAuditFilter, setComplianceExportAuditFilter] =
    useState<ComplianceExportAuditFilter>({
      exportId: '',
      nonConformityId: '',
      actionPlanId: '',
      sortOrder: 'desc',
      actor: '',
      from: '',
      to: '',
    })
  const [appliedComplianceExportAuditFilter, setAppliedComplianceExportAuditFilter] =
    useState<ComplianceExportAuditFilter>({
      exportId: '',
      nonConformityId: '',
      actionPlanId: '',
      sortOrder: 'desc',
      actor: '',
      from: '',
      to: '',
    })
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
  const [nonConformityForm, setNonConformityForm] = useState({
    title: '',
    description: '',
    origin: '',
    impact: '',
    owner: '',
    dueDate: '',
  })
  const [selectedNonConformityId, setSelectedNonConformityId] = useState('')
  const [selectedActionPlanId, setSelectedActionPlanId] = useState('')
  const [actionPlanForm, setActionPlanForm] = useState({
    description: '',
    owner: '',
    dueDate: '',
    status: 'pending',
  })
  const [menuImportForm, setMenuImportForm] = useState({
    fileName: 'BROKER2.GENIALNET.COM.BR.pdf',
    unitName: '',
    serviceName: '',
    referenceDate: '',
    mealType: 'Almoco',
    financialGoal: '',
    mealCost: '',
    recipesText: '',
  })
  const [evaluationImportForm, setEvaluationImportForm] = useState({
    fileName: 'AVALIACOES-GENIALNET.pdf',
    unitName: '',
    serviceName: '',
    referenceDate: '',
    score: '',
    evaluationsCount: '',
    comments: '',
  })

  const uiMessage = getUiMessage(locale)
  const supportedLocales = getSupportedUiLocales()

  const getInviteAuditActionLabel = (action: string) => {
    if (action === 'generated') {
      return uiMessage.auth.inviteAuditActionGenerated
    }

    if (action === 'revoked') {
      return uiMessage.auth.inviteAuditActionRevoked
    }

    if (action === 'regenerated') {
      return uiMessage.auth.inviteAuditActionRegenerated
    }

    if (action === 'activated') {
      return uiMessage.auth.inviteAuditActionActivated
    }

    return action
  }

  const getRuleStatusLabel = (status: string) => {
    if (status === 'identified') {
      return uiMessage.auth.ruleStatusIdentified
    }

    if (status === 'under_review') {
      return uiMessage.auth.ruleStatusUnderReview
    }

    if (status === 'approved') {
      return uiMessage.auth.ruleStatusApproved
    }

    if (status === 'rejected') {
      return uiMessage.auth.ruleStatusRejected
    }

    if (status === 'archived') {
      return uiMessage.auth.ruleStatusArchived
    }

    return status
  }

  const getContractStatusLabel = (status: string) => {
    if (status === 'draft') {
      return uiMessage.auth.contractStatusDraft
    }

    if (status === 'processing') {
      return uiMessage.auth.contractStatusProcessing
    }

    if (status === 'active') {
      return uiMessage.auth.contractStatusActive
    }

    if (status === 'archived') {
      return uiMessage.auth.contractStatusArchived
    }

    return status
  }

  const getContractStatusBadgeClass = (status: string) => {
    if (status === 'active') {
      return 'status-badge is-positive'
    }

    if (status === 'processing') {
      return 'status-badge is-progress'
    }

    if (status === 'draft') {
      return 'status-badge is-neutral'
    }

    if (status === 'archived') {
      return 'status-badge is-muted'
    }

    return 'status-badge is-neutral'
  }

  const getNonConformityStatusLabel = (status: string) => {
    if (status === 'open') {
      return uiMessage.auth.nonConformityStatusOpen
    }

    if (status === 'in_progress') {
      return uiMessage.auth.nonConformityStatusInProgress
    }

    if (status === 'resolved') {
      return uiMessage.auth.nonConformityStatusResolved
    }

    if (status === 'cancelled') {
      return uiMessage.auth.nonConformityStatusCancelled
    }

    return status
  }

  const getActionPlanStatusLabel = (status: string) => {
    if (status === 'pending') {
      return uiMessage.auth.actionPlanStatusPending
    }

    if (status === 'in_progress') {
      return uiMessage.auth.actionPlanStatusInProgress
    }

    if (status === 'done') {
      return uiMessage.auth.actionPlanStatusDone
    }

    return status
  }

  const getNonConformityStatusBadgeClass = (status: string) => {
    if (status === 'open') {
      return 'status-badge is-negative'
    }

    if (status === 'in_progress') {
      return 'status-badge is-progress'
    }

    if (status === 'resolved') {
      return 'status-badge is-positive'
    }

    if (status === 'cancelled') {
      return 'status-badge is-muted'
    }

    return 'status-badge is-neutral'
  }

  const getActionPlanStatusBadgeClass = (status: string) => {
    if (status === 'pending') {
      return 'status-badge is-neutral'
    }

    if (status === 'in_progress') {
      return 'status-badge is-progress'
    }

    if (status === 'done') {
      return 'status-badge is-positive'
    }

    return 'status-badge is-neutral'
  }

  const getRuleStatusBadgeClass = (status: string) => {
    if (status === 'approved') {
      return 'status-badge is-positive'
    }

    if (status === 'under_review' || status === 'identified') {
      return 'status-badge is-progress'
    }

    if (status === 'rejected') {
      return 'status-badge is-negative'
    }

    if (status === 'archived') {
      return 'status-badge is-muted'
    }

    return 'status-badge is-neutral'
  }

  const getRecommendationPolicyItemLabel = (item: RecommendationPolicyItemKey) => {
    if (item === 'contract_rules') {
      return uiMessage.auth.recommendationPolicyItemContractRules
    }

    if (item === 'financial_goal') {
      return uiMessage.auth.recommendationPolicyItemFinancialGoal
    }

    if (item === 'nutritional_restrictions') {
      return uiMessage.auth.recommendationPolicyItemNutritionalRestrictions
    }

    if (item === 'operational_rules') {
      return uiMessage.auth.recommendationPolicyItemOperationalRules
    }

    return uiMessage.auth.recommendationPolicyItemHistoricalRatings
  }

  const getRecommendationPolicyBlockingLabel = (item: RecommendationPolicyBlockingKey) => {
    if (item === 'contract_rule_violation') {
      return uiMessage.auth.recommendationPolicyItemContractViolation
    }

    if (item === 'mandatory_nutritional_restriction_violation') {
      return uiMessage.auth.recommendationPolicyItemNutritionViolation
    }

    if (item === 'financial_goal_exceeded') {
      return uiMessage.auth.recommendationPolicyItemFinancialExceeded
    }

    return uiMessage.auth.recommendationPolicyItemOperationalViolation
  }

  const getRecommendationLevelLabel = (level: RecommendationPolicyLevel['key']) => {
    if (level === 'mandatory') {
      return uiMessage.auth.recommendationPolicyLevelMandatory
    }

    if (level === 'recommended') {
      return uiMessage.auth.recommendationPolicyLevelRecommended
    }

    return uiMessage.auth.recommendationPolicyLevelInformational
  }

  const getRecommendationLevelBadgeClass = (level: RecommendationPolicyLevel['key']) => {
    if (level === 'mandatory') {
      return 'status-badge is-negative'
    }

    if (level === 'recommended') {
      return 'status-badge is-progress'
    }

    return 'status-badge is-neutral'
  }

  const getMenuImportStatusLabel = (status: MenuImportItem['validationStatus']) => {
    if (status === 'within_goal') {
      return 'Dentro da meta'
    }

    return 'Acima da meta'
  }

  const getMenuImportStatusBadgeClass = (status: MenuImportItem['validationStatus']) => {
    if (status === 'within_goal') {
      return 'status-badge is-positive'
    }

    return 'status-badge is-negative'
  }

  const getMenuImportAuditStatusLabel = (status: MenuImportAuditItem['resultStatus']) => {
    if (status === 'compliant') {
      return 'Conforme'
    }

    return 'Nao conforme'
  }

  const getMenuImportAuditStatusBadgeClass = (status: MenuImportAuditItem['resultStatus']) => {
    if (status === 'compliant') {
      return 'status-badge is-positive'
    }

    return 'status-badge is-negative'
  }

  const getSuggestionPriorityLabel = (priority: MenuImportSuggestionItem['priorityLevel']) => {
    if (priority === 'high') {
      return 'Alta prioridade'
    }

    return 'Media prioridade'
  }

  const getSuggestionPriorityBadgeClass = (priority: MenuImportSuggestionItem['priorityLevel']) => {
    if (priority === 'high') {
      return 'status-badge is-negative'
    }

    return 'status-badge is-progress'
  }

  const getCombinationTrendLabel = (trend: MenuCombinationIntelligenceItem['trend']) => {
    if (trend === 'positive') {
      return 'Tendencia positiva'
    }

    if (trend === 'stable') {
      return 'Tendencia estavel'
    }

    return 'Tendencia negativa'
  }

  const getCombinationTrendBadgeClass = (trend: MenuCombinationIntelligenceItem['trend']) => {
    if (trend === 'positive') {
      return 'status-badge is-positive'
    }

    if (trend === 'stable') {
      return 'status-badge is-progress'
    }

    return 'status-badge is-negative'
  }

  const getMandatoryFindingBadgeClass = (status: 'ok' | 'violation') => {
    if (status === 'violation') {
      return 'status-badge is-negative'
    }

    return 'status-badge is-positive'
  }

  const fetchRecommendationPolicy = async (token: string) => {
    setIsLoadingRecommendationPolicy(true)

    try {
      const response = await fetch(`${API_URL}/governance/recommendation-policy`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      const payload = (await response.json()) as
        | { status: 'ok'; policy: RecommendationPolicyContract }
        | { status: 'error'; message: string }

      if (!response.ok || payload.status !== 'ok') {
        throw new Error()
      }

      setRecommendationPolicy(payload.policy)
    } catch {
      setRecommendationPolicy(null)
    } finally {
      setIsLoadingRecommendationPolicy(false)
    }
  }

  const fetchMenuImports = async (token: string) => {
    setIsLoadingMenuImports(true)

    try {
      const response = await fetch(`${API_URL}/menus/imports?limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      const payload = (await response.json()) as
        | { status: 'ok'; imports: MenuImportItem[] }
        | { status: 'error'; message: string }

      if (!response.ok || payload.status !== 'ok') {
        throw new Error(
          'message' in payload ? payload.message : 'Falha ao carregar importacoes de cardapio.',
        )
      }

      setMenuImports(payload.imports ?? [])
    } catch {
      setMenuImports([])
    } finally {
      setIsLoadingMenuImports(false)
    }
  }

  const fetchMenuImportAudit = async (token: string, importId: string) => {
    if (!importId) {
      setMenuImportAuditItems([])
      return
    }

    setIsLoadingMenuImportAudit(true)

    try {
      const response = await fetch(`${API_URL}/menus/imports/${importId}/audit`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      const payload = (await response.json()) as
        | { status: 'ok'; results: MenuImportAuditItem[] }
        | { status: 'error'; message: string }

      if (!response.ok || payload.status !== 'ok') {
        throw new Error()
      }

      setMenuImportAuditItems(payload.results ?? [])
    } catch {
      setMenuImportAuditItems([])
    } finally {
      setIsLoadingMenuImportAudit(false)
    }
  }

  const fetchMenuImportSuggestions = async (token: string, importId: string) => {
    if (!importId) {
      setMenuImportSuggestions([])
      return
    }

    setIsLoadingMenuImportSuggestions(true)

    try {
      const response = await fetch(`${API_URL}/menus/imports/${importId}/suggestions`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      const payload = (await response.json()) as
        | { status: 'ok'; suggestions: MenuImportSuggestionItem[] }
        | { status: 'error'; message: string }

      if (!response.ok || payload.status !== 'ok') {
        throw new Error()
      }

      setMenuImportSuggestions(payload.suggestions ?? [])
    } catch {
      setMenuImportSuggestions([])
    } finally {
      setIsLoadingMenuImportSuggestions(false)
    }
  }

  const fetchMenuAdjustedVersions = async (token: string, importId: string) => {
    if (!importId) {
      setMenuAdjustedVersions([])
      return
    }

    setIsLoadingMenuAdjustedVersions(true)

    try {
      const response = await fetch(`${API_URL}/menus/imports/${importId}/adjusted-versions`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      const payload = (await response.json()) as
        | { status: 'ok'; versions: MenuAdjustedVersionItem[] }
        | { status: 'error'; message: string }

      if (!response.ok || payload.status !== 'ok') {
        throw new Error()
      }

      setMenuAdjustedVersions(payload.versions ?? [])
    } catch {
      setMenuAdjustedVersions([])
    } finally {
      setIsLoadingMenuAdjustedVersions(false)
    }
  }

  const fetchMenuEvaluationImports = async (token: string) => {
    setIsLoadingMenuEvaluationImports(true)

    try {
      const response = await fetch(`${API_URL}/evaluations/imports?limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      const payload = (await response.json()) as
        | { status: 'ok'; evaluations: MenuEvaluationImportItem[] }
        | { status: 'error'; message: string }

      if (!response.ok || payload.status !== 'ok') {
        throw new Error()
      }

      setMenuEvaluationImports(payload.evaluations ?? [])
    } catch {
      setMenuEvaluationImports([])
    } finally {
      setIsLoadingMenuEvaluationImports(false)
    }
  }

  const fetchMenuCombinationIntelligence = async (token: string) => {
    setIsLoadingMenuCombinationIntelligence(true)

    try {
      const response = await fetch(`${API_URL}/evaluations/intelligence?limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      const payload = (await response.json()) as
        | { status: 'ok'; combinations: MenuCombinationIntelligenceItem[] }
        | { status: 'error'; message: string }

      if (!response.ok || payload.status !== 'ok') {
        throw new Error()
      }

      setMenuCombinationIntelligence(payload.combinations ?? [])
    } catch {
      setMenuCombinationIntelligence([])
    } finally {
      setIsLoadingMenuCombinationIntelligence(false)
    }
  }

  const fetchMenuRecommendationPreview = async (token: string, importId: string) => {
    if (!importId) {
      setMenuRecommendationPreview(null)
      return
    }

    setIsLoadingMenuRecommendationPreview(true)

    try {
      const response = await fetch(`${API_URL}/governance/recommendations/${importId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      const payload = (await response.json()) as
        | { status: 'ok'; recommendation: MenuRecommendationPreview }
        | { status: 'error'; message: string }

      if (!response.ok || payload.status !== 'ok') {
        throw new Error()
      }

      setMenuRecommendationPreview(payload.recommendation)
    } catch {
      setMenuRecommendationPreview(null)
    } finally {
      setIsLoadingMenuRecommendationPreview(false)
    }
  }

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

  const fetchInviteAudit = async (token: string) => {
    setIsLoadingInviteAudit(true)

    try {
      const response = await fetch(`${API_URL}/auth/invites/audit?limit=25`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      const payload = (await response.json()) as
        | { status: 'ok'; events: InviteAuditEvent[] }
        | { status: 'error'; message: string }

      if (!response.ok || payload.status !== 'ok') {
        throw new Error(
          'message' in payload ? payload.message : uiMessage.auth.genericSignInError,
        )
      }

      setInviteAuditEvents(payload.events ?? [])
    } catch {
      setInviteAuditEvents([])
    } finally {
      setIsLoadingInviteAudit(false)
    }
  }

  const fetchComplianceExportAudit = async (
    token: string,
    exportType:
      | 'all'
      | 'non_conformity_history'
      | 'action_plan_history'
      | 'compliance_export_audit',
    filter: ComplianceExportAuditFilter,
  ) => {
    setIsLoadingComplianceExportAudit(true)

    try {
      const query = new URLSearchParams({
        exportType,
        sortOrder: filter.sortOrder,
        page: String(complianceExportAuditPage),
        limit: String(complianceExportAuditLimit),
      })

      if (filter.exportId.trim()) {
        query.set('exportId', filter.exportId.trim())
      }

      if (filter.nonConformityId.trim()) {
        query.set('nonConformityId', filter.nonConformityId.trim())
      }

      if (filter.actionPlanId.trim()) {
        query.set('actionPlanId', filter.actionPlanId.trim())
      }

      if (filter.actor.trim()) {
        query.set('actor', filter.actor.trim())
      }

      if (filter.from) {
        query.set('from', filter.from)
      }

      if (filter.to) {
        query.set('to', filter.to)
      }

      const response = await fetch(
        `${API_URL}/compliance/exports/audit?${query.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      )

      const payload = (await response.json()) as
        | ({ status: 'ok' } & ComplianceExportAuditResponse)
        | { status: 'error'; message: string }

      if (!response.ok || payload.status !== 'ok') {
        throw new Error(
          'message' in payload ? payload.message : uiMessage.auth.genericSignInError,
        )
      }

      setComplianceExportAuditEvents(payload.events ?? [])
      setComplianceExportAuditHasNext(Boolean(payload.hasNext))
      setComplianceExportAuditTotal(payload.total ?? 0)
    } catch {
      setComplianceExportAuditEvents([])
      setComplianceExportAuditHasNext(false)
      setComplianceExportAuditTotal(0)
    } finally {
      setIsLoadingComplianceExportAudit(false)
    }
  }

  const getComplianceExportTypeLabel = (exportType: string) => {
    if (exportType === 'non_conformity_history') {
      return uiMessage.auth.complianceExportAuditTypeNonConformity
    }

    if (exportType === 'action_plan_history') {
      return uiMessage.auth.complianceExportAuditTypeActionPlan
    }

    if (exportType === 'compliance_export_audit') {
      return uiMessage.auth.complianceExportAuditTypeExportAudit
    }

    return exportType
  }

  const applyComplianceExportAuditEventFilter = (event: ComplianceExportAuditEvent) => {
    setComplianceExportAuditPage(1)
    setComplianceExportAuditFilter((current) => ({
      ...current,
      exportId: event.exportId,
      nonConformityId: event.nonConformityId ?? '',
      actionPlanId: event.actionPlanId ?? '',
    }))
    setAppliedComplianceExportAuditFilter((current) => ({
      ...current,
      exportId: event.exportId,
      nonConformityId: event.nonConformityId ?? '',
      actionPlanId: event.actionPlanId ?? '',
    }))
  }

  const handleExportComplianceExportAudit = async () => {
    if (!authState) {
      return
    }

    setDomainError(null)
    setIsExportingComplianceExportAudit(true)

    try {
      const query = new URLSearchParams({
        exportType: complianceExportAuditTypeFilter,
        sortOrder: appliedComplianceExportAuditFilter.sortOrder,
        exportScope: complianceExportAuditExportScope,
        page: String(complianceExportAuditPage),
        limit: String(complianceExportAuditLimit),
      })

      if (appliedComplianceExportAuditFilter.exportId.trim()) {
        query.set('exportId', appliedComplianceExportAuditFilter.exportId.trim())
      }

      if (appliedComplianceExportAuditFilter.nonConformityId.trim()) {
        query.set('nonConformityId', appliedComplianceExportAuditFilter.nonConformityId.trim())
      }

      if (appliedComplianceExportAuditFilter.actionPlanId.trim()) {
        query.set('actionPlanId', appliedComplianceExportAuditFilter.actionPlanId.trim())
      }

      if (appliedComplianceExportAuditFilter.actor.trim()) {
        query.set('actor', appliedComplianceExportAuditFilter.actor.trim())
      }

      if (appliedComplianceExportAuditFilter.from) {
        query.set('from', appliedComplianceExportAuditFilter.from)
      }

      if (appliedComplianceExportAuditFilter.to) {
        query.set('to', appliedComplianceExportAuditFilter.to)
      }

      const response = await fetch(`${API_URL}/compliance/exports/audit/export?${query.toString()}`, {
        headers: { Authorization: `Bearer ${authState.token}` },
      })

      if (!response.ok) {
        throw new Error('Falha ao exportar trilha de exportacoes.')
      }

      const csvContent = await response.text()
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const link = window.document.createElement('a')
      const now = new Date()
      const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
        now.getDate(),
      ).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(
        now.getMinutes(),
      ).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
      link.href = url
      link.download = `compliance-export-audit-${complianceExportAuditExportScope}-${stamp}.csv`
      window.document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      setDomainError(error instanceof Error ? error.message : 'Falha ao exportar trilha de exportacoes.')
    } finally {
      setIsExportingComplianceExportAudit(false)
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
    if (!authState || typeof window === 'undefined') {
      return
    }

    const storageKey = getCompanyComplianceExportAuditStorageKey(authState.user.companyName)
    const raw = window.localStorage.getItem(storageKey)

    if (!raw) {
      return
    }

    try {
      const parsed = JSON.parse(raw) as ComplianceExportAuditPreferences
      const isValidLimit = parsed.limit === 30 || parsed.limit === 50 || parsed.limit === 100
      const isValidScope = parsed.exportScope === 'page' || parsed.exportScope === 'all'
      const isValidPage = Number.isInteger(parsed.page) && parsed.page >= 1

      if (!isValidLimit || !isValidScope || !isValidPage) {
        return
      }

      setComplianceExportAuditTypeFilter(parsed.typeFilter)
      setComplianceExportAuditFilter(parsed.filter)
      setAppliedComplianceExportAuditFilter(parsed.appliedFilter)
      setComplianceExportAuditPage(parsed.page)
      setComplianceExportAuditLimit(parsed.limit)
      setComplianceExportAuditExportScope(parsed.exportScope)
    } catch {
      window.localStorage.removeItem(storageKey)
    }
  }, [authState?.user.companyName])

  useEffect(() => {
    if (!authState || typeof window === 'undefined') {
      return
    }

    const storageKey = getCompanyComplianceExportAuditStorageKey(authState.user.companyName)
    const payload: ComplianceExportAuditPreferences = {
      typeFilter: complianceExportAuditTypeFilter,
      filter: complianceExportAuditFilter,
      appliedFilter: appliedComplianceExportAuditFilter,
      page: complianceExportAuditPage,
      limit: complianceExportAuditLimit,
      exportScope: complianceExportAuditExportScope,
    }

    window.localStorage.setItem(storageKey, JSON.stringify(payload))
  }, [
    appliedComplianceExportAuditFilter,
    authState?.user.companyName,
    complianceExportAuditExportScope,
    complianceExportAuditFilter,
    complianceExportAuditLimit,
    complianceExportAuditPage,
    complianceExportAuditTypeFilter,
  ])

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
      setInviteAuditEvents([])
      setComplianceExportAuditEvents([])
      setComplianceExportAuditHasNext(false)
      setComplianceExportAuditTotal(0)
      return
    }

    void fetchInviteHistory(authState.token, inviteHistoryFilter)
    void fetchInviteAudit(authState.token)
    void fetchComplianceExportAudit(
      authState.token,
      complianceExportAuditTypeFilter,
      appliedComplianceExportAuditFilter,
    )
  }, [
    appliedComplianceExportAuditFilter.actionPlanId,
    appliedComplianceExportAuditFilter.actor,
    appliedComplianceExportAuditFilter.exportId,
    appliedComplianceExportAuditFilter.from,
    appliedComplianceExportAuditFilter.nonConformityId,
    appliedComplianceExportAuditFilter.sortOrder,
    appliedComplianceExportAuditFilter.to,
    authState?.token,
    complianceExportAuditLimit,
    complianceExportAuditPage,
    complianceExportAuditTypeFilter,
    inviteHistoryFilter,
  ])

  useEffect(() => {
    if (!authState) {
      setRecommendationPolicy(null)
      setMenuImports([])
      setSelectedMenuImportId('')
      setMenuImportAuditItems([])
      setMenuImportSuggestions([])
      setMenuAdjustedVersions([])
      setMenuEvaluationImports([])
      setMenuCombinationIntelligence([])
      setMenuRecommendationPreview(null)
      return
    }

    void fetchRecommendationPolicy(authState.token)
    void fetchMenuImports(authState.token)
    void fetchMenuEvaluationImports(authState.token)
    void fetchMenuCombinationIntelligence(authState.token)
  }, [authState?.token])

  useEffect(() => {
    if (!selectedMenuImportId && menuImports.length > 0) {
      setSelectedMenuImportId(menuImports[0].id)
    }
  }, [menuImports, selectedMenuImportId])

  useEffect(() => {
    if (!authState || !selectedMenuImportId) {
      setMenuImportAuditItems([])
      setMenuImportSuggestions([])
      setMenuAdjustedVersions([])
      setMenuRecommendationPreview(null)
      return
    }

    void fetchMenuImportAudit(authState.token, selectedMenuImportId)
    void fetchMenuImportSuggestions(authState.token, selectedMenuImportId)
    void fetchMenuAdjustedVersions(authState.token, selectedMenuImportId)
    void fetchMenuRecommendationPreview(authState.token, selectedMenuImportId)
  }, [authState?.token, selectedMenuImportId])

  useEffect(() => {
    if (!authState) {
      setDashboardSummary(null)
      setContracts([])
      setRules([])
      setNonConformities([])
      setActionPlans([])
      return
    }

    const loadDomainData = async () => {
      try {
        const [summaryResponse, contractsResponse, rulesResponse, nonConformityResponse] = await Promise.all([
          fetch(`${API_URL}/dashboard/summary`, {
            headers: { Authorization: `Bearer ${authState.token}` },
          }),
          fetch(`${API_URL}/contracts?limit=30`, {
            headers: { Authorization: `Bearer ${authState.token}` },
          }),
          fetch(`${API_URL}/rules?limit=30`, {
            headers: { Authorization: `Bearer ${authState.token}` },
          }),
          fetch(`${API_URL}/non-conformities?limit=30`, {
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

        if (nonConformityResponse.ok) {
          const payload = (await nonConformityResponse.json()) as {
            nonConformities?: NonConformityItem[]
          }
          setNonConformities(payload.nonConformities ?? [])
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

  useEffect(() => {
    if (!selectedNonConformityId && nonConformities.length > 0) {
      setSelectedNonConformityId(nonConformities[0].id)
    }
  }, [nonConformities, selectedNonConformityId])

  useEffect(() => {
    if (!authState || !selectedNonConformityId) {
      setActionPlans([])
      setActionPlanEvents([])
      setNonConformityEvents([])
      return
    }

    const loadActionPlans = async () => {
      try {
        const response = await fetch(
          `${API_URL}/non-conformities/${selectedNonConformityId}/actions`,
          {
            headers: { Authorization: `Bearer ${authState.token}` },
          },
        )

        if (!response.ok) {
          return
        }

        const payload = (await response.json()) as { actions?: ActionPlanItem[] }
        setActionPlans(payload.actions ?? [])
      } catch {
        setActionPlans([])
      }
    }

    void loadActionPlans()
  }, [authState?.token, selectedNonConformityId])

  useEffect(() => {
    if (!authState || !selectedNonConformityId) {
      setNonConformityEvents([])
      setNonConformityHistoryHasNext(false)
      setNonConformityHistoryTotal(0)
      return
    }

    const loadNonConformityHistory = async () => {
      setIsLoadingNonConformityHistory(true)

      try {
        const query = new URLSearchParams({
          limit: '20',
          page: String(nonConformityHistoryPage),
        })

        if (appliedNonConformityHistoryFilter.actor.trim()) {
          query.set('actor', appliedNonConformityHistoryFilter.actor.trim())
        }

        if (appliedNonConformityHistoryFilter.from) {
          query.set('from', appliedNonConformityHistoryFilter.from)
        }

        if (appliedNonConformityHistoryFilter.to) {
          query.set('to', appliedNonConformityHistoryFilter.to)
        }

        const response = await fetch(
          `${API_URL}/non-conformities/${selectedNonConformityId}/history?${query.toString()}`,
          {
            headers: { Authorization: `Bearer ${authState.token}` },
          },
        )

        if (!response.ok) {
          setNonConformityEvents([])
          setNonConformityHistoryHasNext(false)
          setNonConformityHistoryTotal(0)
          return
        }

        const payload = (await response.json()) as NonConformityHistoryResponse
        setNonConformityEvents(payload.events ?? [])
        setNonConformityHistoryHasNext(Boolean(payload.hasNext))
        setNonConformityHistoryTotal(payload.total ?? 0)
      } finally {
        setIsLoadingNonConformityHistory(false)
      }
    }

    void loadNonConformityHistory()
  }, [
    appliedNonConformityHistoryFilter.actor,
    appliedNonConformityHistoryFilter.from,
    appliedNonConformityHistoryFilter.to,
    authState?.token,
    nonConformityHistoryPage,
    selectedNonConformityId,
  ])

  useEffect(() => {
    setNonConformityHistoryPage(1)
  }, [selectedNonConformityId])

  useEffect(() => {
    if (!selectedActionPlanId && actionPlans.length > 0) {
      setSelectedActionPlanId(actionPlans[0].id)
    }
  }, [actionPlans, selectedActionPlanId])

  useEffect(() => {
    if (!authState || !selectedNonConformityId || !selectedActionPlanId) {
      setActionPlanEvents([])
      setActionPlanHistoryHasNext(false)
      setActionPlanHistoryTotal(0)
      return
    }

    const loadActionPlanHistory = async () => {
      setIsLoadingActionPlanHistory(true)

      try {
        const query = new URLSearchParams({
          limit: '20',
          page: String(actionPlanHistoryPage),
        })

        if (appliedActionPlanHistoryFilter.actor.trim()) {
          query.set('actor', appliedActionPlanHistoryFilter.actor.trim())
        }

        if (appliedActionPlanHistoryFilter.from) {
          query.set('from', appliedActionPlanHistoryFilter.from)
        }

        if (appliedActionPlanHistoryFilter.to) {
          query.set('to', appliedActionPlanHistoryFilter.to)
        }

        const response = await fetch(
          `${API_URL}/non-conformities/${selectedNonConformityId}/actions/${selectedActionPlanId}/history?${query.toString()}`,
          {
            headers: { Authorization: `Bearer ${authState.token}` },
          },
        )

        if (!response.ok) {
          setActionPlanEvents([])
          setActionPlanHistoryHasNext(false)
          setActionPlanHistoryTotal(0)
          return
        }

        const payload = (await response.json()) as ActionPlanHistoryResponse
        setActionPlanEvents(payload.events ?? [])
        setActionPlanHistoryHasNext(Boolean(payload.hasNext))
        setActionPlanHistoryTotal(payload.total ?? 0)
      } finally {
        setIsLoadingActionPlanHistory(false)
      }
    }

    void loadActionPlanHistory()
  }, [
    appliedActionPlanHistoryFilter.actor,
    appliedActionPlanHistoryFilter.from,
    appliedActionPlanHistoryFilter.to,
    actionPlanHistoryPage,
    authState?.token,
    selectedNonConformityId,
    selectedActionPlanId,
  ])

  useEffect(() => {
    setActionPlanHistoryPage(1)
    setActionPlanHistoryFilter({ actor: '', from: '', to: '' })
    setAppliedActionPlanHistoryFilter({ actor: '', from: '', to: '' })
  }, [selectedActionPlanId])

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

  const handleMenuImportSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!authState) {
      return
    }

    setDomainError(null)
    setIsSubmittingMenuImport(true)

    try {
      const recipes = menuImportForm.recipesText
        .split(/\n|,|;/)
        .map((item) => item.trim())
        .filter(Boolean)

      const response = await fetch(`${API_URL}/menus/imports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authState.token}`,
        },
        body: JSON.stringify({
          fileName: menuImportForm.fileName.trim(),
          unitName: menuImportForm.unitName.trim(),
          serviceName: menuImportForm.serviceName.trim(),
          referenceDate: menuImportForm.referenceDate,
          mealType: menuImportForm.mealType.trim(),
          financialGoal: Number(menuImportForm.financialGoal),
          mealCost: Number(menuImportForm.mealCost),
          recipes,
        }),
      })

      const payload = (await response.json()) as
        | { status: 'ok'; import: MenuImportItem }
        | { status: 'error'; message: string }

      if (!response.ok || payload.status !== 'ok') {
        throw new Error(
          'message' in payload ? payload.message : 'Falha ao importar cardapio PDF.',
        )
      }

      setMenuImportForm((current) => ({
        ...current,
        serviceName: '',
        referenceDate: '',
        mealType: 'Almoco',
        financialGoal: '',
        mealCost: '',
        recipesText: '',
      }))

      await fetchMenuImports(authState.token)
    } catch (error) {
      setDomainError(error instanceof Error ? error.message : 'Falha ao importar cardapio PDF.')
    } finally {
      setIsSubmittingMenuImport(false)
    }
  }

  const handleRunMenuImportAudit = async () => {
    if (!authState || !selectedMenuImportId) {
      return
    }

    setDomainError(null)
    setIsRunningMenuImportAudit(true)

    try {
      const response = await fetch(`${API_URL}/menus/imports/${selectedMenuImportId}/audit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authState.token}` },
      })

      const payload = (await response.json()) as
        | { status: 'ok'; results: MenuImportAuditItem[] }
        | { status: 'error'; message: string }

      if (!response.ok || payload.status !== 'ok') {
        throw new Error('message' in payload ? payload.message : 'Falha ao executar auditoria.')
      }

      setMenuImportAuditItems(payload.results ?? [])
      await fetchMenuImports(authState.token)
    } catch (error) {
      setDomainError(error instanceof Error ? error.message : 'Falha ao executar auditoria.')
    } finally {
      setIsRunningMenuImportAudit(false)
    }
  }

  const handleGenerateMenuImportSuggestions = async () => {
    if (!authState || !selectedMenuImportId) {
      return
    }

    setDomainError(null)
    setIsGeneratingMenuImportSuggestions(true)

    try {
      const response = await fetch(`${API_URL}/menus/imports/${selectedMenuImportId}/suggestions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authState.token}` },
      })

      const payload = (await response.json()) as
        | { status: 'ok'; suggestions: MenuImportSuggestionItem[] }
        | { status: 'error'; message: string }

      if (!response.ok || payload.status !== 'ok') {
        throw new Error('message' in payload ? payload.message : 'Falha ao gerar sugestoes.')
      }

      setMenuImportSuggestions(payload.suggestions ?? [])
    } catch (error) {
      setDomainError(error instanceof Error ? error.message : 'Falha ao gerar sugestoes.')
    } finally {
      setIsGeneratingMenuImportSuggestions(false)
    }
  }

  const handleGenerateAdjustedVersion = async () => {
    if (!authState || !selectedMenuImportId) {
      return
    }

    setDomainError(null)
    setIsGeneratingAdjustedVersion(true)

    try {
      const response = await fetch(`${API_URL}/menus/imports/${selectedMenuImportId}/adjusted-version`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authState.token}` },
      })

      const payload = (await response.json()) as
        | { status: 'ok'; adjustedVersion: MenuAdjustedVersionItem }
        | { status: 'error'; message: string }

      if (!response.ok || payload.status !== 'ok') {
        throw new Error('message' in payload ? payload.message : 'Falha ao gerar versao ajustada.')
      }

      await fetchMenuAdjustedVersions(authState.token, selectedMenuImportId)
    } catch (error) {
      setDomainError(error instanceof Error ? error.message : 'Falha ao gerar versao ajustada.')
    } finally {
      setIsGeneratingAdjustedVersion(false)
    }
  }

  const handleEvaluationImportSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!authState) {
      return
    }

    setDomainError(null)
    setIsSubmittingMenuEvaluationImport(true)

    try {
      const response = await fetch(`${API_URL}/evaluations/imports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authState.token}`,
        },
        body: JSON.stringify({
          fileName: evaluationImportForm.fileName.trim(),
          unitName: evaluationImportForm.unitName.trim(),
          serviceName: evaluationImportForm.serviceName.trim(),
          referenceDate: evaluationImportForm.referenceDate,
          score: Number(evaluationImportForm.score),
          evaluationsCount: Number(evaluationImportForm.evaluationsCount),
          comments: evaluationImportForm.comments.trim() || undefined,
        }),
      })

      const payload = (await response.json()) as
        | { status: 'ok'; evaluation: MenuEvaluationImportItem }
        | { status: 'error'; message: string }

      if (!response.ok || payload.status !== 'ok') {
        throw new Error('message' in payload ? payload.message : 'Falha ao importar avaliacoes.')
      }

      setEvaluationImportForm((current) => ({
        ...current,
        score: '',
        evaluationsCount: '',
        comments: '',
      }))

      await fetchMenuEvaluationImports(authState.token)
    } catch (error) {
      setDomainError(error instanceof Error ? error.message : 'Falha ao importar avaliacoes.')
    } finally {
      setIsSubmittingMenuEvaluationImport(false)
    }
  }

  const handleRebuildCombinationIntelligence = async () => {
    if (!authState) {
      return
    }

    setDomainError(null)
    setIsRebuildingMenuCombinationIntelligence(true)

    try {
      const response = await fetch(`${API_URL}/evaluations/intelligence/rebuild`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authState.token}` },
      })

      const payload = (await response.json()) as
        | { status: 'ok'; summary: { generatedCombinations: number } }
        | { status: 'error'; message: string }

      if (!response.ok || payload.status !== 'ok') {
        throw new Error(
          'message' in payload ? payload.message : 'Falha ao cruzar avaliacoes com cardapios.',
        )
      }

      await fetchMenuCombinationIntelligence(authState.token)
    } catch (error) {
      setDomainError(
        error instanceof Error ? error.message : 'Falha ao cruzar avaliacoes com cardapios.',
      )
    } finally {
      setIsRebuildingMenuCombinationIntelligence(false)
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
      await Promise.all([
        fetchInviteHistory(authState.token, inviteHistoryFilter),
        fetchInviteAudit(authState.token),
      ])
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

      await Promise.all([
        fetchInviteHistory(authState.token, inviteHistoryFilter),
        fetchInviteAudit(authState.token),
      ])
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
      await Promise.all([
        fetchInviteHistory(authState.token, inviteHistoryFilter),
        fetchInviteAudit(authState.token),
      ])
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

  const handleCreateNonConformity = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!authState) {
      return
    }

    setDomainError(null)
    setIsSubmittingNonConformity(true)

    try {
      const response = await fetch(`${API_URL}/non-conformities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authState.token}`,
        },
        body: JSON.stringify({
          ...nonConformityForm,
          status: 'open',
        }),
      })

      const payload = (await response.json()) as
        | { status: 'ok'; nonConformity: NonConformityItem }
        | { status: 'error'; message: string }

      if (!response.ok || payload.status !== 'ok') {
        throw new Error(
          'message' in payload ? payload.message : 'Falha ao registrar nao conformidade.',
        )
      }

      setNonConformities((current) => [payload.nonConformity, ...current])
      setSelectedNonConformityId(payload.nonConformity.id)
      setNonConformityForm({
        title: '',
        description: '',
        origin: '',
        impact: '',
        owner: '',
        dueDate: '',
      })
    } catch (error) {
      setDomainError(
        error instanceof Error ? error.message : 'Falha ao registrar nao conformidade.',
      )
    } finally {
      setIsSubmittingNonConformity(false)
    }
  }

  const handleCreateActionPlan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!authState || !selectedNonConformityId) {
      return
    }

    setDomainError(null)
    setIsSubmittingActionPlan(true)

    try {
      const response = await fetch(`${API_URL}/non-conformities/${selectedNonConformityId}/actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authState.token}`,
        },
        body: JSON.stringify(actionPlanForm),
      })

      const payload = (await response.json()) as
        | { status: 'ok'; action: ActionPlanItem }
        | { status: 'error'; message: string }

      if (!response.ok || payload.status !== 'ok') {
        throw new Error('message' in payload ? payload.message : 'Falha ao adicionar acao.')
      }

      setActionPlans((current) => [payload.action, ...current])
      setSelectedActionPlanId(payload.action.id)
      setActionPlanForm({
        description: '',
        owner: '',
        dueDate: '',
        status: 'pending',
      })
    } catch (error) {
      setDomainError(error instanceof Error ? error.message : 'Falha ao adicionar acao.')
    } finally {
      setIsSubmittingActionPlan(false)
    }
  }

  const handleUpdateActionPlanStatus = async (actionId: string, status: 'pending' | 'in_progress' | 'done') => {
    if (!authState || !selectedNonConformityId) {
      return
    }

    setDomainError(null)
    setIsUpdatingActionPlanId(actionId)

    try {
      const response = await fetch(
        `${API_URL}/non-conformities/${selectedNonConformityId}/actions/${actionId}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authState.token}`,
          },
          body: JSON.stringify({ status }),
        },
      )

      const payload = (await response.json()) as
        | { status: 'ok' }
        | { status: 'error'; message: string }

      if (!response.ok || payload.status !== 'ok') {
        throw new Error('message' in payload ? payload.message : 'Falha ao atualizar acao.')
      }

      setActionPlans((current) =>
        current.map((item) => (item.id === actionId ? { ...item, status } : item)),
      )

      if (selectedActionPlanId === actionId) {
        const response = await fetch(
          `${API_URL}/non-conformities/${selectedNonConformityId}/actions/${actionId}/history`,
          {
            headers: { Authorization: `Bearer ${authState.token}` },
          },
        )

        if (response.ok) {
          const payload = (await response.json()) as { events?: ActionPlanEvent[] }
          setActionPlanEvents(payload.events ?? [])
        }
      }
    } catch (error) {
      setDomainError(error instanceof Error ? error.message : 'Falha ao atualizar acao.')
    } finally {
      setIsUpdatingActionPlanId(null)
    }
  }

  const handleUpdateNonConformityStatus = async (
    nonConformityId: string,
    status: 'open' | 'in_progress' | 'resolved' | 'cancelled',
  ) => {
    if (!authState) {
      return
    }

    setDomainError(null)
    setIsUpdatingNonConformityId(nonConformityId)

    try {
      const response = await fetch(`${API_URL}/non-conformities/${nonConformityId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authState.token}`,
        },
        body: JSON.stringify({ status }),
      })

      const payload = (await response.json()) as
        | { status: 'ok' }
        | { status: 'error'; message: string }

      if (!response.ok || payload.status !== 'ok') {
        throw new Error(
          'message' in payload ? payload.message : 'Falha ao atualizar nao conformidade.',
        )
      }

      setNonConformities((current) =>
        current.map((item) => (item.id === nonConformityId ? { ...item, status } : item)),
      )

      if (selectedNonConformityId === nonConformityId) {
        const query = new URLSearchParams({
          limit: '20',
          page: String(nonConformityHistoryPage),
        })

        if (appliedNonConformityHistoryFilter.actor.trim()) {
          query.set('actor', appliedNonConformityHistoryFilter.actor.trim())
        }

        if (appliedNonConformityHistoryFilter.from) {
          query.set('from', appliedNonConformityHistoryFilter.from)
        }

        if (appliedNonConformityHistoryFilter.to) {
          query.set('to', appliedNonConformityHistoryFilter.to)
        }

        const historyResponse = await fetch(
          `${API_URL}/non-conformities/${nonConformityId}/history?${query.toString()}`,
          {
            headers: { Authorization: `Bearer ${authState.token}` },
          },
        )

        if (historyResponse.ok) {
          const historyPayload = (await historyResponse.json()) as NonConformityHistoryResponse
          setNonConformityEvents(historyPayload.events ?? [])
          setNonConformityHistoryHasNext(Boolean(historyPayload.hasNext))
          setNonConformityHistoryTotal(historyPayload.total ?? 0)
        }
      }
    } catch (error) {
      setDomainError(
        error instanceof Error ? error.message : 'Falha ao atualizar nao conformidade.',
      )
    } finally {
      setIsUpdatingNonConformityId(null)
    }
  }

  const handleExportNonConformityHistory = async () => {
    if (!authState || !selectedNonConformityId) {
      return
    }

    setDomainError(null)
    setIsExportingNonConformityHistory(true)

    try {
      const query = new URLSearchParams()

      if (appliedNonConformityHistoryFilter.actor.trim()) {
        query.set('actor', appliedNonConformityHistoryFilter.actor.trim())
      }

      if (appliedNonConformityHistoryFilter.from) {
        query.set('from', appliedNonConformityHistoryFilter.from)
      }

      if (appliedNonConformityHistoryFilter.to) {
        query.set('to', appliedNonConformityHistoryFilter.to)
      }

      const response = await fetch(
        `${API_URL}/non-conformities/${selectedNonConformityId}/history/export?${query.toString()}`,
        {
          headers: { Authorization: `Bearer ${authState.token}` },
        },
      )

      if (!response.ok) {
        throw new Error('Falha ao exportar historico de nao conformidade.')
      }

      const csvContent = await response.text()
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const link = window.document.createElement('a')
      link.href = url
      link.download = `non-conformity-history-${selectedNonConformityId}.csv`
      window.document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      setDomainError(
        error instanceof Error ? error.message : 'Falha ao exportar historico de nao conformidade.',
      )
    } finally {
      setIsExportingNonConformityHistory(false)
    }
  }

  const handleExportActionPlanHistory = async () => {
    if (!authState || !selectedNonConformityId || !selectedActionPlanId) {
      return
    }

    setDomainError(null)
    setIsExportingActionPlanHistory(true)

    try {
      const query = new URLSearchParams()

      if (appliedActionPlanHistoryFilter.actor.trim()) {
        query.set('actor', appliedActionPlanHistoryFilter.actor.trim())
      }

      if (appliedActionPlanHistoryFilter.from) {
        query.set('from', appliedActionPlanHistoryFilter.from)
      }

      if (appliedActionPlanHistoryFilter.to) {
        query.set('to', appliedActionPlanHistoryFilter.to)
      }

      const response = await fetch(
        `${API_URL}/non-conformities/${selectedNonConformityId}/actions/${selectedActionPlanId}/history/export?${query.toString()}`,
        {
          headers: { Authorization: `Bearer ${authState.token}` },
        },
      )

      if (!response.ok) {
        throw new Error('Falha ao exportar historico da acao.')
      }

      const csvContent = await response.text()
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const link = window.document.createElement('a')
      link.href = url
      link.download = `action-plan-history-${selectedActionPlanId}.csv`
      window.document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      setDomainError(error instanceof Error ? error.message : 'Falha ao exportar historico da acao.')
    } finally {
      setIsExportingActionPlanHistory(false)
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
            <h3>{uiMessage.auth.recommendationPolicyTitle}</h3>
            {isLoadingRecommendationPolicy ? (
              <p>{uiMessage.auth.recommendationPolicyLoading}</p>
            ) : recommendationPolicy ? (
              <ul>
                <li>
                  <strong>{uiMessage.auth.recommendationPolicyPriorityLabel}</strong>
                  <p>
                    {recommendationPolicy.priorityOrder
                      .map((item) => getRecommendationPolicyItemLabel(item))
                      .join(' -> ')}
                  </p>
                </li>
                <li>
                  <strong>{uiMessage.auth.recommendationPolicyLevelLabel}</strong>
                  <div className="history-filter-actions">
                    {recommendationPolicy.levels.map((level) => (
                      <span key={level.key} className={getRecommendationLevelBadgeClass(level.key)}>
                        {getRecommendationLevelLabel(level.key)} ·{' '}
                        {level.blocksApproval
                          ? uiMessage.auth.recommendationPolicyBlocks
                          : uiMessage.auth.recommendationPolicyNoBlocks}
                      </span>
                    ))}
                  </div>
                </li>
                <li>
                  <strong>{uiMessage.auth.recommendationPolicyBlockingLabel}</strong>
                  <p>
                    {recommendationPolicy.blockingCriteria
                      .map((item) => getRecommendationPolicyBlockingLabel(item))
                      .join(' · ')}
                  </p>
                </li>
              </ul>
            ) : (
              <p>{uiMessage.auth.recommendationPolicyLoading}</p>
            )}
          </div>

          <div className="next-actions">
            <h3>Contratos recentes</h3>
            {dashboardSummary?.recentContracts?.length ? (
              <ul>
                {dashboardSummary.recentContracts.map((contract) => (
                  <li key={contract.id}>
                    <strong>{contract.title}</strong>
                    <span className={getContractStatusBadgeClass(contract.status)}>
                      {getContractStatusLabel(contract.status)}
                    </span>
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

          <div className="invite-history-head">
            <h3>{uiMessage.auth.inviteAuditTitle}</h3>
          </div>

          {isLoadingInviteAudit ? (
            <p className="empty-note">{uiMessage.auth.inviteAuditLoading}</p>
          ) : inviteAuditEvents.length ? (
            <ul className="validation-history-list">
              {inviteAuditEvents.map((event) => (
                <li key={event.id}>
                  <div className="validation-history-row">
                    <strong>{getInviteAuditActionLabel(event.action)}</strong>
                    <span>{event.inviteToken}</span>
                  </div>
                  <p>{event.inviteEmail}</p>
                  <small>
                    {event.actorName} · {new Date(event.createdAt).toLocaleString(locale)}
                  </small>
                  {event.note ? <small>{event.note}</small> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-note">{uiMessage.auth.inviteAuditEmpty}</p>
          )}

          <div className="invite-history-head">
            <h3>{uiMessage.auth.complianceExportAuditTitle}</h3>
            <label>
              <span>{uiMessage.auth.complianceExportAuditFilterLabel}</span>
              <select
                value={complianceExportAuditTypeFilter}
                onChange={(event) =>
                  {
                    setComplianceExportAuditPage(1)
                    setComplianceExportAuditTypeFilter(
                      event.target.value as
                        | 'all'
                        | 'non_conformity_history'
                        | 'action_plan_history'
                        | 'compliance_export_audit',
                    )
                  }
                }
              >
                <option value="all">{uiMessage.auth.complianceExportAuditTypeAll}</option>
                <option value="non_conformity_history">
                  {uiMessage.auth.complianceExportAuditTypeNonConformity}
                </option>
                <option value="action_plan_history">
                  {uiMessage.auth.complianceExportAuditTypeActionPlan}
                </option>
                <option value="compliance_export_audit">
                  {uiMessage.auth.complianceExportAuditTypeExportAudit}
                </option>
              </select>
            </label>
          </div>

          <div className="history-filter-grid">
            <label>
              <span>{uiMessage.auth.complianceExportAuditExportIdFilterLabel}</span>
              <input
                type="text"
                value={complianceExportAuditFilter.exportId}
                onChange={(event) =>
                  setComplianceExportAuditFilter((current) => ({
                    ...current,
                    exportId: event.target.value,
                  }))
                }
                placeholder="UUID"
              />
            </label>
            <label>
              <span>{uiMessage.auth.complianceExportAuditSortOrderLabel}</span>
              <select
                value={complianceExportAuditFilter.sortOrder}
                onChange={(event) =>
                  setComplianceExportAuditFilter((current) => ({
                    ...current,
                    sortOrder: event.target.value as 'desc' | 'asc',
                  }))
                }
              >
                <option value="desc">{uiMessage.auth.complianceExportAuditSortOrderDesc}</option>
                <option value="asc">{uiMessage.auth.complianceExportAuditSortOrderAsc}</option>
              </select>
            </label>
            <label>
              <span>{uiMessage.auth.complianceExportAuditNonConformityIdFilterLabel}</span>
              <input
                type="text"
                value={complianceExportAuditFilter.nonConformityId}
                onChange={(event) =>
                  setComplianceExportAuditFilter((current) => ({
                    ...current,
                    nonConformityId: event.target.value,
                  }))
                }
                placeholder="NC ID"
              />
            </label>
            <label>
              <span>{uiMessage.auth.complianceExportAuditActionPlanIdFilterLabel}</span>
              <input
                type="text"
                value={complianceExportAuditFilter.actionPlanId}
                onChange={(event) =>
                  setComplianceExportAuditFilter((current) => ({
                    ...current,
                    actionPlanId: event.target.value,
                  }))
                }
                placeholder="AP ID"
              />
            </label>
            <label>
              <span>{uiMessage.auth.complianceExportAuditActorLabel}</span>
              <input
                type="text"
                value={complianceExportAuditFilter.actor}
                onChange={(event) =>
                  setComplianceExportAuditFilter((current) => ({
                    ...current,
                    actor: event.target.value,
                  }))
                }
                placeholder="Nome"
              />
            </label>
            <label>
              <span>{uiMessage.auth.complianceExportAuditFromLabel}</span>
              <input
                type="date"
                value={complianceExportAuditFilter.from}
                onChange={(event) =>
                  setComplianceExportAuditFilter((current) => ({
                    ...current,
                    from: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>{uiMessage.auth.complianceExportAuditToLabel}</span>
              <input
                type="date"
                value={complianceExportAuditFilter.to}
                onChange={(event) =>
                  setComplianceExportAuditFilter((current) => ({
                    ...current,
                    to: event.target.value,
                  }))
                }
              />
            </label>
            <div className="history-filter-actions">
              <button
                type="button"
                className="logout-button"
                onClick={() =>
                  {
                    setComplianceExportAuditPage(1)
                    setAppliedComplianceExportAuditFilter({
                      exportId: complianceExportAuditFilter.exportId.trim(),
                      nonConformityId: complianceExportAuditFilter.nonConformityId.trim(),
                      actionPlanId: complianceExportAuditFilter.actionPlanId.trim(),
                      sortOrder: complianceExportAuditFilter.sortOrder,
                      actor: complianceExportAuditFilter.actor.trim(),
                      from: complianceExportAuditFilter.from,
                      to: complianceExportAuditFilter.to,
                    })
                  }
                }
              >
                {uiMessage.auth.complianceExportAuditApplyButton}
              </button>
              <button
                type="button"
                className="logout-button"
                onClick={() => {
                  setComplianceExportAuditTypeFilter('all')
                  setComplianceExportAuditExportScope('page')
                  setComplianceExportAuditLimit(30)
                  setComplianceExportAuditFilter({
                    exportId: '',
                    nonConformityId: '',
                    actionPlanId: '',
                    sortOrder: 'desc',
                    actor: '',
                    from: '',
                    to: '',
                  })
                  setAppliedComplianceExportAuditFilter({
                    exportId: '',
                    nonConformityId: '',
                    actionPlanId: '',
                    sortOrder: 'desc',
                    actor: '',
                    from: '',
                    to: '',
                  })
                  setComplianceExportAuditPage(1)
                }}
              >
                {uiMessage.auth.complianceExportAuditResetButton}
              </button>
            </div>
          </div>

          <div className="history-pagination">
            <small>
              {uiMessage.auth.complianceExportAuditPageLabel} {complianceExportAuditPage} · {complianceExportAuditTotal}
            </small>
            <div className="history-filter-actions">
              <label>
                <span>{uiMessage.auth.complianceExportAuditLimitLabel}</span>
                <select
                  value={String(complianceExportAuditLimit)}
                  onChange={(event) => {
                    setComplianceExportAuditLimit(Number(event.target.value) as 30 | 50 | 100)
                    setComplianceExportAuditPage(1)
                  }}
                  disabled={isExportingComplianceExportAudit || isLoadingComplianceExportAudit}
                >
                  <option value="30">30</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </label>
              <label>
                <span>{uiMessage.auth.complianceExportAuditExportScopeLabel}</span>
                <select
                  value={complianceExportAuditExportScope}
                  onChange={(event) =>
                    setComplianceExportAuditExportScope(event.target.value as 'page' | 'all')
                  }
                  disabled={isExportingComplianceExportAudit || isLoadingComplianceExportAudit}
                >
                  <option value="page">{uiMessage.auth.complianceExportAuditExportScopePage}</option>
                  <option value="all">{uiMessage.auth.complianceExportAuditExportScopeAll}</option>
                </select>
              </label>
              <button
                type="button"
                className="logout-button"
                disabled={isExportingComplianceExportAudit || isLoadingComplianceExportAudit}
                onClick={handleExportComplianceExportAudit}
              >
                {isExportingComplianceExportAudit
                  ? uiMessage.auth.complianceExportAuditExportingButton
                  : uiMessage.auth.complianceExportAuditExportButton}
              </button>
              <button
                type="button"
                className="logout-button"
                disabled={complianceExportAuditPage <= 1 || isLoadingComplianceExportAudit}
                onClick={() => setComplianceExportAuditPage((current) => Math.max(1, current - 1))}
              >
                {uiMessage.auth.complianceExportAuditPrevButton}
              </button>
              <button
                type="button"
                className="logout-button"
                disabled={!complianceExportAuditHasNext || isLoadingComplianceExportAudit}
                onClick={() => setComplianceExportAuditPage((current) => current + 1)}
              >
                {uiMessage.auth.complianceExportAuditNextButton}
              </button>
            </div>
          </div>

          {isLoadingComplianceExportAudit ? (
            <p className="empty-note">{uiMessage.auth.complianceExportAuditLoading}</p>
          ) : complianceExportAuditEvents.length ? (
            <ul className="validation-history-list">
              {complianceExportAuditEvents.map((event) => (
                <li key={event.id}>
                  <div className="validation-history-row">
                    <strong>{getComplianceExportTypeLabel(event.exportType)}</strong>
                    <span>{event.actorName}</span>
                  </div>
                  <small>
                    {uiMessage.auth.complianceExportAuditExportIdLabel}: {event.exportId}
                    <button
                      type="button"
                      className="audit-inline-button"
                      onClick={() => applyComplianceExportAuditEventFilter(event)}
                    >
                      {uiMessage.auth.complianceExportAuditUseEventIdsButton}
                    </button>
                  </small>
                  <small>
                    {uiMessage.auth.complianceExportAuditFiltersLabel}: exportId={event.filterExportId ?? '-'} | ncId={event.filterNonConformityId ?? '-'} | apId={event.filterActionPlanId ?? '-'} | sort={event.filterSortOrder ?? '-'} | scope={event.filterExportScope ?? '-'} | actor={event.filterActor ?? '-'} | from={event.filterFrom ? new Date(event.filterFrom).toLocaleDateString(locale) : '-'} | to={event.filterTo ? new Date(event.filterTo).toLocaleDateString(locale) : '-'}
                  </small>
                  <small>
                    NC={event.nonConformityId ?? '-'} · AP={event.actionPlanId ?? '-'} · {new Date(event.createdAt).toLocaleString(locale)}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-note">{uiMessage.auth.complianceExportAuditEmpty}</p>
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
              <span className="section-kicker">Importacao operacional</span>
              <h2>Cardapio PDF da Genial</h2>
            </div>
          </div>

          <form className="crud-form" onSubmit={handleMenuImportSubmit}>
            <label>
              <span>Arquivo PDF</span>
              <input
                type="text"
                value={menuImportForm.fileName}
                onChange={(event) =>
                  setMenuImportForm((current) => ({ ...current, fileName: event.target.value }))
                }
                required
              />
            </label>

            <label>
              <span>Unidade</span>
              <input
                type="text"
                value={menuImportForm.unitName}
                onChange={(event) =>
                  setMenuImportForm((current) => ({ ...current, unitName: event.target.value }))
                }
                required
                minLength={2}
              />
            </label>

            <label>
              <span>Servico</span>
              <input
                type="text"
                value={menuImportForm.serviceName}
                onChange={(event) =>
                  setMenuImportForm((current) => ({ ...current, serviceName: event.target.value }))
                }
                required
                minLength={2}
              />
            </label>

            <label>
              <span>Data de referencia</span>
              <input
                type="date"
                value={menuImportForm.referenceDate}
                onChange={(event) =>
                  setMenuImportForm((current) => ({ ...current, referenceDate: event.target.value }))
                }
                required
              />
            </label>

            <label>
              <span>Tipo de refeicao</span>
              <input
                type="text"
                value={menuImportForm.mealType}
                onChange={(event) =>
                  setMenuImportForm((current) => ({ ...current, mealType: event.target.value }))
                }
                required
                minLength={2}
              />
            </label>

            <label>
              <span>Meta financeira (R$)</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={menuImportForm.financialGoal}
                onChange={(event) =>
                  setMenuImportForm((current) => ({ ...current, financialGoal: event.target.value }))
                }
                required
              />
            </label>

            <label>
              <span>Custo da refeicao (R$)</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={menuImportForm.mealCost}
                onChange={(event) =>
                  setMenuImportForm((current) => ({ ...current, mealCost: event.target.value }))
                }
                required
              />
            </label>

            <label>
              <span>Receitas extraidas (uma por linha ou separadas por virgula)</span>
              <textarea
                value={menuImportForm.recipesText}
                onChange={(event) =>
                  setMenuImportForm((current) => ({ ...current, recipesText: event.target.value }))
                }
              />
            </label>

            <button type="submit" className="auth-button" disabled={isSubmittingMenuImport}>
              {isSubmittingMenuImport ? 'Importando...' : 'Registrar importacao PDF'}
            </button>
          </form>

          {isLoadingMenuImports ? (
            <p className="empty-note">Carregando importacoes de cardapio...</p>
          ) : menuImports.length ? (
            <ul className="validation-history-list">
              {menuImports.map((item) => (
                <li key={item.id}>
                  <div className="validation-history-row">
                    <strong>{item.fileName}</strong>
                    <span className={getMenuImportStatusBadgeClass(item.validationStatus)}>
                      {getMenuImportStatusLabel(item.validationStatus)}
                    </span>
                  </div>
                  <small>
                    {item.unitName} · {item.serviceName} · {item.mealType} ·{' '}
                    {new Date(item.referenceDate).toLocaleDateString(locale)}
                  </small>
                  <small>
                    Meta R$ {item.financialGoal.toFixed(2)} | Custo R$ {item.mealCost.toFixed(2)}
                    {item.validationStatus === 'above_goal'
                      ? ` | Excedente R$ ${item.exceededValue.toFixed(2)} (${item.exceededPercent.toFixed(2)}%)`
                      : ''}
                  </small>
                  {item.recipes.length ? <small>Receitas: {item.recipes.join(' | ')}</small> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-note">Nenhum cardapio PDF importado ainda.</p>
          )}

          <div className="invite-history-head">
            <h3>Auditoria contratual do cardapio</h3>
            <label>
              <span>Importacao alvo</span>
              <select
                value={selectedMenuImportId}
                onChange={(event) => setSelectedMenuImportId(event.target.value)}
                disabled={!menuImports.length || isRunningMenuImportAudit}
              >
                <option value="">Selecione</option>
                {menuImports.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.fileName} · {new Date(item.referenceDate).toLocaleDateString(locale)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="history-filter-actions">
            <button
              type="button"
              className="logout-button"
              disabled={!selectedMenuImportId || isRunningMenuImportAudit}
              onClick={handleRunMenuImportAudit}
            >
              {isRunningMenuImportAudit ? 'Auditando...' : 'Executar auditoria contratual'}
            </button>
          </div>

          {isLoadingMenuImportAudit ? (
            <p className="empty-note">Carregando auditoria contratual...</p>
          ) : menuImportAuditItems.length ? (
            <ul className="validation-history-list">
              {menuImportAuditItems.map((item) => (
                <li key={item.id}>
                  <div className="validation-history-row">
                    <strong>{item.ruleTitle}</strong>
                    <span className={getMenuImportAuditStatusBadgeClass(item.resultStatus)}>
                      {getMenuImportAuditStatusLabel(item.resultStatus)}
                    </span>
                  </div>
                  <small>{item.evidence}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-note">Sem resultados de auditoria para a importacao selecionada.</p>
          )}

          <div className="invite-history-head">
            <h3>Sugestoes de ajuste</h3>
          </div>

          <div className="history-filter-actions">
            <button
              type="button"
              className="logout-button"
              disabled={!selectedMenuImportId || isGeneratingMenuImportSuggestions}
              onClick={handleGenerateMenuImportSuggestions}
            >
              {isGeneratingMenuImportSuggestions ? 'Gerando...' : 'Gerar sugestoes de ajuste'}
            </button>
          </div>

          {isLoadingMenuImportSuggestions ? (
            <p className="empty-note">Carregando sugestoes...</p>
          ) : menuImportSuggestions.length ? (
            <ul className="validation-history-list">
              {menuImportSuggestions.map((item) => (
                <li key={item.id}>
                  <div className="validation-history-row">
                    <strong>{item.suggestionText}</strong>
                    <span className={getSuggestionPriorityBadgeClass(item.priorityLevel)}>
                      {getSuggestionPriorityLabel(item.priorityLevel)}
                    </span>
                  </div>
                  <small>
                    Impacto financeiro estimado: R$ {item.estimatedFinancialImpact.toFixed(2)}
                  </small>
                  <small>{item.estimatedNutritionalImpact}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-note">Sem sugestoes geradas para a importacao selecionada.</p>
          )}

          <div className="invite-history-head">
            <h3>Versoes ajustadas</h3>
          </div>

          <div className="history-filter-actions">
            <button
              type="button"
              className="logout-button"
              disabled={!selectedMenuImportId || isGeneratingAdjustedVersion}
              onClick={handleGenerateAdjustedVersion}
            >
              {isGeneratingAdjustedVersion ? 'Gerando versao...' : 'Gerar nova versao ajustada'}
            </button>
          </div>

          {isLoadingMenuAdjustedVersions ? (
            <p className="empty-note">Carregando versoes ajustadas...</p>
          ) : menuAdjustedVersions.length ? (
            <ul className="validation-history-list">
              {menuAdjustedVersions.map((item) => (
                <li key={item.id}>
                  <div className="validation-history-row">
                    <strong>{item.versionLabel}</strong>
                    <span className="status-badge is-progress">
                      {item.appliedSuggestions.length} sugestoes aplicadas
                    </span>
                  </div>
                  <small>
                    Custo ajustado: R$ {item.adjustedMealCost.toFixed(2)} | Impacto financeiro total: R$ {item.totalFinancialImpact.toFixed(2)}
                  </small>
                  <small>{item.nutritionalImpactSummary}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-note">Nenhuma versao ajustada gerada ainda.</p>
          )}

          <div className="invite-history-head">
            <h3>Importacao de avaliacoes (PDF)</h3>
          </div>

          <form className="crud-form" onSubmit={handleEvaluationImportSubmit}>
            <label>
              <span>Arquivo PDF de avaliacoes</span>
              <input
                type="text"
                value={evaluationImportForm.fileName}
                onChange={(event) =>
                  setEvaluationImportForm((current) => ({ ...current, fileName: event.target.value }))
                }
                required
              />
            </label>

            <label>
              <span>Unidade</span>
              <input
                type="text"
                value={evaluationImportForm.unitName}
                onChange={(event) =>
                  setEvaluationImportForm((current) => ({ ...current, unitName: event.target.value }))
                }
                required
                minLength={2}
              />
            </label>

            <label>
              <span>Servico</span>
              <input
                type="text"
                value={evaluationImportForm.serviceName}
                onChange={(event) =>
                  setEvaluationImportForm((current) => ({ ...current, serviceName: event.target.value }))
                }
                required
                minLength={2}
              />
            </label>

            <label>
              <span>Data de referencia</span>
              <input
                type="date"
                value={evaluationImportForm.referenceDate}
                onChange={(event) =>
                  setEvaluationImportForm((current) => ({ ...current, referenceDate: event.target.value }))
                }
                required
              />
            </label>

            <label>
              <span>Nota media (0 a 10)</span>
              <input
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={evaluationImportForm.score}
                onChange={(event) =>
                  setEvaluationImportForm((current) => ({ ...current, score: event.target.value }))
                }
                required
              />
            </label>

            <label>
              <span>Quantidade de avaliacoes</span>
              <input
                type="number"
                min="1"
                step="1"
                value={evaluationImportForm.evaluationsCount}
                onChange={(event) =>
                  setEvaluationImportForm((current) => ({ ...current, evaluationsCount: event.target.value }))
                }
                required
              />
            </label>

            <label>
              <span>Comentarios</span>
              <textarea
                value={evaluationImportForm.comments}
                onChange={(event) =>
                  setEvaluationImportForm((current) => ({ ...current, comments: event.target.value }))
                }
              />
            </label>

            <button type="submit" className="auth-button" disabled={isSubmittingMenuEvaluationImport}>
              {isSubmittingMenuEvaluationImport ? 'Importando avaliacoes...' : 'Registrar avaliacao PDF'}
            </button>
          </form>

          {isLoadingMenuEvaluationImports ? (
            <p className="empty-note">Carregando avaliacoes importadas...</p>
          ) : menuEvaluationImports.length ? (
            <ul className="validation-history-list">
              {menuEvaluationImports.map((item) => (
                <li key={item.id}>
                  <div className="validation-history-row">
                    <strong>{item.fileName}</strong>
                    <span className="status-badge is-progress">Nota {item.score.toFixed(1)}</span>
                  </div>
                  <small>
                    {item.unitName} · {item.serviceName} · {new Date(item.referenceDate).toLocaleDateString(locale)}
                  </small>
                  <small>{item.evaluationsCount} avaliacoes</small>
                  {item.comments ? <small>{item.comments}</small> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-note">Nenhuma avaliacao importada ainda.</p>
          )}

          <div className="invite-history-head">
            <h3>Inteligencia de combinacoes</h3>
          </div>

          <div className="history-filter-actions">
            <button
              type="button"
              className="logout-button"
              disabled={isRebuildingMenuCombinationIntelligence}
              onClick={handleRebuildCombinationIntelligence}
            >
              {isRebuildingMenuCombinationIntelligence
                ? 'Cruzando avaliacao e cardapio...'
                : 'Recalcular inteligencia'}
            </button>
          </div>

          {isLoadingMenuCombinationIntelligence ? (
            <p className="empty-note">Carregando inteligencia de combinacoes...</p>
          ) : menuCombinationIntelligence.length ? (
            <ul className="validation-history-list">
              {menuCombinationIntelligence.map((item) => (
                <li key={item.id}>
                  <div className="validation-history-row">
                    <strong>{item.unitName} · {item.serviceName}</strong>
                    <span className={getCombinationTrendBadgeClass(item.trend)}>
                      {getCombinationTrendLabel(item.trend)}
                    </span>
                  </div>
                  <small>
                    Nota media {item.averageRating.toFixed(2)} · {item.evaluationsCount} avaliacoes · {item.mappedRecords} cruzamentos
                  </small>
                  <small>Receitas: {item.recipes.join(' | ')}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-note">Sem combinacoes calculadas ainda.</p>
          )}

          <div className="invite-history-head">
            <h3>Previa do motor de recomendacao</h3>
          </div>

          {isLoadingMenuRecommendationPreview ? (
            <p className="empty-note">Carregando previa de recomendacao...</p>
          ) : menuRecommendationPreview ? (
            <ul className="validation-history-list">
              <li>
                <div className="validation-history-row">
                  <strong>
                    {menuRecommendationPreview.decision.blocksApproval
                      ? 'Aprovacao bloqueada por camada obrigatoria'
                      : 'Aprovacao permitida na camada obrigatoria'}
                  </strong>
                  <span
                    className={
                      menuRecommendationPreview.decision.blocksApproval
                        ? 'status-badge is-negative'
                        : 'status-badge is-positive'
                    }
                  >
                    {menuRecommendationPreview.decision.blocksApproval ? 'Bloqueante' : 'Sem bloqueio'}
                  </span>
                </div>
                <small>
                  Meta R$ {menuRecommendationPreview.importContext.financialGoal.toFixed(2)} | Custo R${' '}
                  {menuRecommendationPreview.importContext.mealCost.toFixed(2)}
                </small>
                <small>Receitas atuais: {menuRecommendationPreview.importContext.currentRecipes.join(' | ')}</small>
              </li>
              {menuRecommendationPreview.decision.mandatoryFindings.map((item) => (
                <li key={item.criterion}>
                  <div className="validation-history-row">
                    <strong>{item.criterion}</strong>
                    <span className={getMandatoryFindingBadgeClass(item.status)}>
                      {item.status === 'violation' ? 'Violacao' : 'OK'}
                    </span>
                  </div>
                  <small>{item.detail}</small>
                </li>
              ))}
              <li>
                <div className="validation-history-row">
                  <strong>Camada historica (nao bloqueante)</strong>
                  <span className="status-badge is-progress">Somente recomendacao</span>
                </div>
                <small>{menuRecommendationPreview.historicalLayer.note}</small>
                {menuRecommendationPreview.historicalLayer.recommendedCombinations.length ? (
                  <small>
                    Top combinacoes: {menuRecommendationPreview.historicalLayer.recommendedCombinations
                      .map((combination) =>
                        `${combination.recipes.join(' + ')} (nota ${combination.averageRating.toFixed(2)})`,
                      )
                      .join(' | ')}
                  </small>
                ) : (
                  <small>Sem combinacoes historicas para recomendacao neste contexto.</small>
                )}
              </li>
            </ul>
          ) : (
            <p className="empty-note">Sem previa de recomendacao para a importacao selecionada.</p>
          )}
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
                    <strong>{getRuleStatusLabel(event.previousStatus)}</strong>
                    <span>{getRuleStatusLabel(event.nextStatus)}</span>
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
                  <span className={getContractStatusBadgeClass(contract.status)}>
                    {getContractStatusLabel(contract.status)}
                  </span>
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
                  <span className={getRuleStatusBadgeClass(rule.status)}>
                    {getRuleStatusLabel(rule.status)}
                  </span>
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

        <article className="panel">
          <div className="section-head compact">
            <div>
              <span className="section-kicker">Conformidade</span>
              <h2>{uiMessage.auth.nonConformityTitle}</h2>
            </div>
          </div>

          <p className="invite-admin-description">{uiMessage.auth.nonConformityDescription}</p>

          <form className="crud-form" onSubmit={handleCreateNonConformity}>
            <label>
              <span>{uiMessage.auth.nonConformityFormTitleLabel}</span>
              <input
                type="text"
                value={nonConformityForm.title}
                onChange={(event) =>
                  setNonConformityForm((current) => ({ ...current, title: event.target.value }))
                }
                required
              />
            </label>

            <label>
              <span>{uiMessage.auth.nonConformityFormDescriptionLabel}</span>
              <textarea
                value={nonConformityForm.description}
                onChange={(event) =>
                  setNonConformityForm((current) => ({ ...current, description: event.target.value }))
                }
                required
              />
            </label>

            <label>
              <span>{uiMessage.auth.nonConformityFormOriginLabel}</span>
              <input
                type="text"
                value={nonConformityForm.origin}
                onChange={(event) =>
                  setNonConformityForm((current) => ({ ...current, origin: event.target.value }))
                }
                required
              />
            </label>

            <label>
              <span>{uiMessage.auth.nonConformityFormImpactLabel}</span>
              <input
                type="text"
                value={nonConformityForm.impact}
                onChange={(event) =>
                  setNonConformityForm((current) => ({ ...current, impact: event.target.value }))
                }
                required
              />
            </label>

            <label>
              <span>{uiMessage.auth.nonConformityFormOwnerLabel}</span>
              <input
                type="text"
                value={nonConformityForm.owner}
                onChange={(event) =>
                  setNonConformityForm((current) => ({ ...current, owner: event.target.value }))
                }
                required
              />
            </label>

            <label>
              <span>{uiMessage.auth.nonConformityFormDueDateLabel}</span>
              <input
                type="date"
                value={nonConformityForm.dueDate}
                onChange={(event) =>
                  setNonConformityForm((current) => ({ ...current, dueDate: event.target.value }))
                }
                required
              />
            </label>

            <button type="submit" className="auth-button" disabled={isSubmittingNonConformity}>
              {isSubmittingNonConformity
                ? uiMessage.auth.nonConformityFormLoadingButton
                : uiMessage.auth.nonConformityFormButton}
            </button>
          </form>

          <ul className="records-list">
            {nonConformities.length ? (
              nonConformities.map((item) => (
                <li key={item.id}>
                  <strong>{item.title}</strong>
                  <span className={getNonConformityStatusBadgeClass(item.status)}>
                    {getNonConformityStatusLabel(item.status)}
                  </span>
                  <div className="invite-history-actions">
                    {item.status === 'open' ? (
                      <button
                        type="button"
                        className="logout-button"
                        disabled={isUpdatingNonConformityId === item.id}
                        onClick={() => handleUpdateNonConformityStatus(item.id, 'in_progress')}
                      >
                        {uiMessage.auth.nonConformityStartButton}
                      </button>
                    ) : null}
                    {item.status === 'in_progress' ? (
                      <button
                        type="button"
                        className="logout-button"
                        disabled={isUpdatingNonConformityId === item.id}
                        onClick={() => handleUpdateNonConformityStatus(item.id, 'resolved')}
                      >
                        {uiMessage.auth.nonConformityResolveButton}
                      </button>
                    ) : null}
                    {item.status === 'resolved' || item.status === 'cancelled' ? (
                      <button
                        type="button"
                        className="logout-button"
                        disabled={isUpdatingNonConformityId === item.id}
                        onClick={() => handleUpdateNonConformityStatus(item.id, 'open')}
                      >
                        {uiMessage.auth.nonConformityReopenButton}
                      </button>
                    ) : null}
                    {item.status !== 'cancelled' ? (
                      <button
                        type="button"
                        className="logout-button"
                        disabled={isUpdatingNonConformityId === item.id}
                        onClick={() => handleUpdateNonConformityStatus(item.id, 'cancelled')}
                      >
                        {uiMessage.auth.nonConformityCancelButton}
                      </button>
                    ) : null}
                  </div>
                </li>
              ))
            ) : (
              <li>
                <strong>{uiMessage.auth.nonConformityEmpty}</strong>
              </li>
            )}
          </ul>

          <div className="invite-history-head">
            <h3>{uiMessage.auth.nonConformityHistoryTitle}</h3>
          </div>

          <div className="history-filter-grid">
            <label>
              <span>{uiMessage.auth.nonConformityHistoryActorLabel}</span>
              <input
                type="text"
                value={nonConformityHistoryFilter.actor}
                onChange={(event) =>
                  setNonConformityHistoryFilter((current) => ({
                    ...current,
                    actor: event.target.value,
                  }))
                }
                placeholder="Nome"
              />
            </label>
            <label>
              <span>{uiMessage.auth.nonConformityHistoryFromLabel}</span>
              <input
                type="date"
                value={nonConformityHistoryFilter.from}
                onChange={(event) =>
                  setNonConformityHistoryFilter((current) => ({
                    ...current,
                    from: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>{uiMessage.auth.nonConformityHistoryToLabel}</span>
              <input
                type="date"
                value={nonConformityHistoryFilter.to}
                onChange={(event) =>
                  setNonConformityHistoryFilter((current) => ({
                    ...current,
                    to: event.target.value,
                  }))
                }
              />
            </label>
            <div className="history-filter-actions">
              <button
                type="button"
                className="logout-button"
                onClick={() => {
                  setNonConformityHistoryPage(1)
                  setAppliedNonConformityHistoryFilter({
                    actor: nonConformityHistoryFilter.actor.trim(),
                    from: nonConformityHistoryFilter.from,
                    to: nonConformityHistoryFilter.to,
                  })
                }}
              >
                {uiMessage.auth.nonConformityHistoryApplyButton}
              </button>
              <button
                type="button"
                className="logout-button"
                onClick={() => {
                  setNonConformityHistoryFilter({ actor: '', from: '', to: '' })
                  setAppliedNonConformityHistoryFilter({ actor: '', from: '', to: '' })
                  setNonConformityHistoryPage(1)
                }}
              >
                {uiMessage.auth.nonConformityHistoryClearButton}
              </button>
            </div>
          </div>

          <div className="history-pagination">
            <small>
              {uiMessage.auth.nonConformityHistoryPageLabel} {nonConformityHistoryPage} · {nonConformityHistoryTotal}
            </small>
            <div className="history-filter-actions">
              <button
                type="button"
                className="logout-button"
                disabled={isExportingNonConformityHistory || isLoadingNonConformityHistory}
                onClick={handleExportNonConformityHistory}
              >
                {isExportingNonConformityHistory
                  ? uiMessage.auth.nonConformityHistoryExportingButton
                  : uiMessage.auth.nonConformityHistoryExportButton}
              </button>
              <button
                type="button"
                className="logout-button"
                disabled={nonConformityHistoryPage <= 1 || isLoadingNonConformityHistory}
                onClick={() => setNonConformityHistoryPage((current) => Math.max(1, current - 1))}
              >
                {uiMessage.auth.nonConformityHistoryPrevButton}
              </button>
              <button
                type="button"
                className="logout-button"
                disabled={!nonConformityHistoryHasNext || isLoadingNonConformityHistory}
                onClick={() => setNonConformityHistoryPage((current) => current + 1)}
              >
                {uiMessage.auth.nonConformityHistoryNextButton}
              </button>
            </div>
          </div>

          {isLoadingNonConformityHistory ? (
            <p className="empty-note">{uiMessage.auth.nonConformityHistoryLoading}</p>
          ) : nonConformityEvents.length ? (
            <ul className="validation-history-list">
              {nonConformityEvents.map((event) => (
                <li key={event.id}>
                  <div className="validation-history-row">
                    <strong>{getNonConformityStatusLabel(event.previousStatus)}</strong>
                    <span>{getNonConformityStatusLabel(event.nextStatus)}</span>
                  </div>
                  <small>
                    {event.actorName} · {new Date(event.createdAt).toLocaleString(locale)}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-note">{uiMessage.auth.nonConformityHistoryEmpty}</p>
          )}
        </article>

        <article className="panel">
          <div className="section-head compact">
            <div>
              <span className="section-kicker">Conformidade</span>
              <h2>{uiMessage.auth.actionPlanTitle}</h2>
            </div>
          </div>

          <form className="crud-form" onSubmit={handleCreateActionPlan}>
            <label>
              <span>{uiMessage.auth.nonConformityTitle}</span>
              <select
                value={selectedNonConformityId}
                onChange={(event) => setSelectedNonConformityId(event.target.value)}
                required
              >
                <option value="" disabled>
                  Selecione uma nao conformidade
                </option>
                {nonConformities.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>{uiMessage.auth.actionPlanDescriptionLabel}</span>
              <textarea
                value={actionPlanForm.description}
                onChange={(event) =>
                  setActionPlanForm((current) => ({ ...current, description: event.target.value }))
                }
                required
              />
            </label>

            <label>
              <span>{uiMessage.auth.actionPlanOwnerLabel}</span>
              <input
                type="text"
                value={actionPlanForm.owner}
                onChange={(event) =>
                  setActionPlanForm((current) => ({ ...current, owner: event.target.value }))
                }
                required
              />
            </label>

            <label>
              <span>{uiMessage.auth.actionPlanDueDateLabel}</span>
              <input
                type="date"
                value={actionPlanForm.dueDate}
                onChange={(event) =>
                  setActionPlanForm((current) => ({ ...current, dueDate: event.target.value }))
                }
                required
              />
            </label>

            <button
              type="submit"
              className="auth-button"
              disabled={isSubmittingActionPlan || !selectedNonConformityId}
            >
              {isSubmittingActionPlan
                ? uiMessage.auth.actionPlanLoadingButton
                : uiMessage.auth.actionPlanButton}
            </button>
          </form>

          <ul className="records-list">
            {actionPlans.length ? (
              actionPlans.map((item) => (
                <li key={item.id}>
                  <strong>{item.description}</strong>
                  <span className={getActionPlanStatusBadgeClass(item.status)}>
                    {getActionPlanStatusLabel(item.status)}
                  </span>
                  <small>
                    {item.owner} · {new Date(item.dueDate).toLocaleDateString(locale)}
                  </small>
                  <div className="invite-history-actions">
                    {item.status === 'pending' ? (
                      <button
                        type="button"
                        className="logout-button"
                        disabled={isUpdatingActionPlanId === item.id}
                        onClick={() => handleUpdateActionPlanStatus(item.id, 'in_progress')}
                      >
                        {uiMessage.auth.actionPlanStartButton}
                      </button>
                    ) : null}
                    {item.status === 'in_progress' ? (
                      <button
                        type="button"
                        className="logout-button"
                        disabled={isUpdatingActionPlanId === item.id}
                        onClick={() => handleUpdateActionPlanStatus(item.id, 'done')}
                      >
                        {uiMessage.auth.actionPlanDoneButton}
                      </button>
                    ) : null}
                    {item.status === 'done' ? (
                      <button
                        type="button"
                        className="logout-button"
                        disabled={isUpdatingActionPlanId === item.id}
                        onClick={() => handleUpdateActionPlanStatus(item.id, 'pending')}
                      >
                        {uiMessage.auth.actionPlanReopenButton}
                      </button>
                    ) : null}
                  </div>
                </li>
              ))
            ) : (
              <li>
                <strong>{uiMessage.auth.actionPlanEmpty}</strong>
              </li>
            )}
          </ul>

          <div className="invite-history-head">
            <h3>{uiMessage.auth.actionPlanHistoryTitle}</h3>
            <label>
              <span>{uiMessage.auth.actionPlanHistorySelectLabel}</span>
              <select
                value={selectedActionPlanId}
                onChange={(event) => setSelectedActionPlanId(event.target.value)}
              >
                <option value="" disabled>
                  Selecione uma acao
                </option>
                {actionPlans.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.description}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="history-filter-grid">
            <label>
              <span>{uiMessage.auth.actionPlanHistoryActorLabel}</span>
              <input
                type="text"
                value={actionPlanHistoryFilter.actor}
                onChange={(event) =>
                  setActionPlanHistoryFilter((current) => ({
                    ...current,
                    actor: event.target.value,
                  }))
                }
                placeholder="Nome"
              />
            </label>
            <label>
              <span>{uiMessage.auth.actionPlanHistoryFromLabel}</span>
              <input
                type="date"
                value={actionPlanHistoryFilter.from}
                onChange={(event) =>
                  setActionPlanHistoryFilter((current) => ({
                    ...current,
                    from: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>{uiMessage.auth.actionPlanHistoryToLabel}</span>
              <input
                type="date"
                value={actionPlanHistoryFilter.to}
                onChange={(event) =>
                  setActionPlanHistoryFilter((current) => ({
                    ...current,
                    to: event.target.value,
                  }))
                }
              />
            </label>
            <div className="history-filter-actions">
              <button
                type="button"
                className="logout-button"
                onClick={() => {
                  setActionPlanHistoryPage(1)
                  setAppliedActionPlanHistoryFilter({
                    actor: actionPlanHistoryFilter.actor.trim(),
                    from: actionPlanHistoryFilter.from,
                    to: actionPlanHistoryFilter.to,
                  })
                }}
              >
                {uiMessage.auth.actionPlanHistoryApplyButton}
              </button>
              <button
                type="button"
                className="logout-button"
                onClick={() => {
                  setActionPlanHistoryFilter({ actor: '', from: '', to: '' })
                  setAppliedActionPlanHistoryFilter({ actor: '', from: '', to: '' })
                  setActionPlanHistoryPage(1)
                }}
              >
                {uiMessage.auth.actionPlanHistoryClearButton}
              </button>
            </div>
          </div>

          <div className="history-pagination">
            <small>
              {uiMessage.auth.actionPlanHistoryPageLabel} {actionPlanHistoryPage} · {actionPlanHistoryTotal}
            </small>
            <div className="history-filter-actions">
              <button
                type="button"
                className="logout-button"
                disabled={isExportingActionPlanHistory || isLoadingActionPlanHistory}
                onClick={handleExportActionPlanHistory}
              >
                {isExportingActionPlanHistory
                  ? uiMessage.auth.actionPlanHistoryExportingButton
                  : uiMessage.auth.actionPlanHistoryExportButton}
              </button>
              <button
                type="button"
                className="logout-button"
                disabled={actionPlanHistoryPage <= 1 || isLoadingActionPlanHistory}
                onClick={() => setActionPlanHistoryPage((current) => Math.max(1, current - 1))}
              >
                {uiMessage.auth.actionPlanHistoryPrevButton}
              </button>
              <button
                type="button"
                className="logout-button"
                disabled={!actionPlanHistoryHasNext || isLoadingActionPlanHistory}
                onClick={() => setActionPlanHistoryPage((current) => current + 1)}
              >
                {uiMessage.auth.actionPlanHistoryNextButton}
              </button>
            </div>
          </div>

          {isLoadingActionPlanHistory ? (
            <p className="empty-note">{uiMessage.auth.actionPlanHistoryLoading}</p>
          ) : actionPlanEvents.length ? (
            <ul className="validation-history-list">
              {actionPlanEvents.map((event) => (
                <li key={event.id}>
                  <div className="validation-history-row">
                    <strong>{getActionPlanStatusLabel(event.previousStatus)}</strong>
                    <span>{getActionPlanStatusLabel(event.nextStatus)}</span>
                  </div>
                  <small>
                    {event.actorName} · {new Date(event.createdAt).toLocaleString(locale)}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-note">{uiMessage.auth.actionPlanHistoryEmpty}</p>
          )}
        </article>
      </section>
    </main>
  )
}

export default App
