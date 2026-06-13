import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { useAuth } from '../auth'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

type RuleStatus = 'pending' | 'approved' | 'rejected'
type ConfidenceFilter = 'all' | 'high' | 'medium' | 'low' | 'unknown'

type RuleItem = {
  id: string
  tenantId?: string
  siteId?: string | null
  siteName?: string | null
  contractId: string
  title: string
  description: string
  category: string
  ruleType?: string | null
  periodicity?: string | null
  quantity?: number | null
  unitMeasure?: string | null
  calculationBasis?: string | null
  applicability?: string | null
  sourceExcerpt?: string | null
  sourceItem?: string | null
  sourcePage?: number | null
  sourceBlockId?: string | null
  evidenceConfidence?: number | null
  status: RuleStatus
  createdAt: string
  updatedAt?: string
}

type RuleEvidencePayload = {
  rule: {
    id: string
    contractId?: string
    sourcePage?: number | null
    sourceItem?: string | null
    sourceExcerpt?: string | null
    evidenceConfidence?: number | null
    sourceBlockId?: string | null
  }
  block: {
    id?: string | null
    blockType?: string | null
    pageNumber?: number | null
    sourceItem?: string | null
    rawText?: string | null
    normalizedText?: string | null
    normalizedTableMarkdown?: string | null
    normalizedTableJson?: string | null
    detectedUnitsJson?: string | null
  } | null
  page: {
    pageNumber?: number | null
    rawText?: string | null
    textQuality?: string | null
  } | null
}

type ContractItem = {
  id: string
  title: string
  status?: string
  siteName?: string | null
}

type RuleEditFormState = {
  title: string
  description: string
  category: string
  ruleType: string
  periodicity: string
  quantity: string
  unitMeasure: string
  calculationBasis: string
  applicability: string
}

type ControlPromotionFormState = {
  title: string
  operationalDescription: string
  frequency: 'daily' | 'weekly' | 'monthly' | 'per_shift' | 'on_demand'
  responsible: string
  expectedEvidence: string
  status: 'DRAFT' | 'ACTIVE'
}

const categoryLabels: Record<string, string> = {
  nutrition: 'Nutricao',
  management: 'Gestao',
  legal: 'Juridico',
  compliance: 'Conformidade',
  operations: 'Operacoes',
  PROTEIN: 'Proteina',
  SALAD: 'Salada',
  SIDE_DISH: 'Guarnicao',
  RICE: 'Arroz',
  BEAN: 'Feijao',
  JUICE: 'Suco',
  BEVERAGE: 'Bebida',
  DESSERT: 'Sobremesa',
  FRUIT: 'Fruta',
  EGG_REPLACEMENT: 'Substituicao por ovo',
  BUFFET_FREE: 'Buffet livre',
  BUFFET_SPECIAL: 'Buffet especial',
  SPECIAL_DISH: 'Prato especial',
  LIGHT_VEGAN_OPTION: 'Opcao light/vegana',
  MONTHLY_INCIDENCE: 'Incidencia mensal',
  WEEKLY_PERIODICITY: 'Periodicidade semanal',
  UNIT_SPECIFIC_RULE: 'Regra da unidade',
  MEAL_TIME: 'Horario de refeicao',
  MEAL_VOLUME: 'Volume de refeicao',
  MENU_COMPOSITION: 'Composicao do cardapio',
}

const statusLabel: Record<RuleStatus, string> = {
  pending: 'Pendente',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
}

const categoryOptions = [
  'PROTEIN',
  'SALAD',
  'SIDE_DISH',
  'RICE',
  'BEAN',
  'JUICE',
  'BEVERAGE',
  'DESSERT',
  'FRUIT',
  'EGG_REPLACEMENT',
  'BUFFET_FREE',
  'BUFFET_SPECIAL',
  'SPECIAL_DISH',
  'LIGHT_VEGAN_OPTION',
  'MONTHLY_INCIDENCE',
  'WEEKLY_PERIODICITY',
  'UNIT_SPECIFIC_RULE',
  'MEAL_TIME',
  'MEAL_VOLUME',
  'MENU_COMPOSITION',
  'nutrition',
  'management',
  'legal',
  'compliance',
  'operations',
]

const periodicityOptions = ['', 'DAILY', 'WEEKLY', 'MONTHLY', 'PER_SERVICE', 'PER_MENU_CYCLE']

const formatCategory = (category: string) => categoryLabels[category] ?? category

const confidenceBucket = (confidence?: number | null): ConfidenceFilter => {
  if (typeof confidence !== 'number') return 'unknown'
  if (confidence >= 0.8) return 'high'
  if (confidence >= 0.55) return 'medium'
  return 'low'
}

const confidenceLabel = (confidence?: number | null) => {
  const bucket = confidenceBucket(confidence)
  if (bucket === 'high') return `Alta (${Math.round((confidence ?? 0) * 100)}%)`
  if (bucket === 'medium') return `Media (${Math.round((confidence ?? 0) * 100)}%)`
  if (bucket === 'low') return `Baixa (${Math.round((confidence ?? 0) * 100)}%)`
  return 'Nao estimada'
}

const originLabel = (rule: RuleItem) => {
  const parts = [
    rule.sourcePage ? `Pagina ${rule.sourcePage}` : null,
    rule.sourceItem ? `Item ${rule.sourceItem}` : null,
    rule.sourceBlockId ? 'Bloco rastreado' : null,
  ].filter(Boolean)

  return parts.length ? parts.join(', ') : 'Origem nao identificada'
}

const shortText = (value?: string | null, maxLength = 150) => {
  const text = value?.trim()
  if (!text) return 'Nao informado.'
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text
}

const toEditForm = (rule: RuleItem): RuleEditFormState => ({
  title: rule.title,
  description: rule.description,
  category: rule.category,
  ruleType: rule.ruleType ?? '',
  periodicity: rule.periodicity ?? '',
  quantity: typeof rule.quantity === 'number' ? String(rule.quantity) : '',
  unitMeasure: rule.unitMeasure ?? '',
  calculationBasis: rule.calculationBasis ?? '',
  applicability: rule.applicability ?? '',
})

export function ContractRulesPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { authState, logout } = useAuth()
  const token = authState?.token

  const [rules, setRules] = useState<RuleItem[]>([])
  const [contractTitle, setContractTitle] = useState('Contrato')
  const [contractSiteName, setContractSiteName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null)
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null)
  const [savingEditId, setSavingEditId] = useState<string | null>(null)
  const [loadingEvidenceId, setLoadingEvidenceId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [contractStatus, setContractStatus] = useState<string>('processing')
  const [promotingRuleId, setPromotingRuleId] = useState<string | null>(null)
  const [selectedRuleForControl, setSelectedRuleForControl] = useState<RuleItem | null>(null)
  const [selectedEvidenceRule, setSelectedEvidenceRule] = useState<RuleItem | null>(null)
  const [evidence, setEvidence] = useState<RuleEvidencePayload | null>(null)
  const [editingRule, setEditingRule] = useState<RuleItem | null>(null)
  const [editForm, setEditForm] = useState<RuleEditFormState | null>(null)
  const [rejectingRule, setRejectingRule] = useState<RuleItem | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | RuleStatus>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>('all')
  const [siteFilter, setSiteFilter] = useState('all')
  const [controlForm, setControlForm] = useState<ControlPromotionFormState>({
    title: '',
    operationalDescription: '',
    frequency: 'daily',
    responsible: '',
    expectedEvidence: '',
    status: 'ACTIVE',
  })

  const loadRules = async (contractId: string, authToken: string) => {
    if (!contractId || !authToken) {
      setRules([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/rules?contractId=${encodeURIComponent(contractId)}&limit=100`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })

      if (!response.ok) {
        throw new Error('Falha ao carregar regras do contrato.')
      }

      const payload = (await response.json()) as { rules?: RuleItem[] }
      setRules(payload.rules ?? [])
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar regras do contrato.')
      setRules([])
    } finally {
      setLoading(false)
    }
  }

  const loadContract = async (contractId: string, authToken: string) => {
    if (!contractId || !authToken) return

    try {
      const response = await fetch(`${API_URL}/contracts/${encodeURIComponent(contractId)}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })

      if (!response.ok) return

      const payload = (await response.json()) as { contract?: ContractItem }
      const contract = payload.contract

      if (contract?.title) {
        setContractTitle(contract.title)
        setContractSiteName(contract.siteName ?? null)
        if (contract.status) setContractStatus(contract.status)
      }
    } catch {
      // Keep fallback title when loading the contract fails.
    }
  }

  useEffect(() => {
    if (!id || !token) {
      setRules([])
      return
    }

    void Promise.all([loadContract(id, token), loadRules(id, token)])
  }, [id, token])

  const categoriesInRules = useMemo(
    () => Array.from(new Set(rules.map((rule) => rule.category))).sort(),
    [rules],
  )

  const sitesInRules = useMemo(
    () => Array.from(new Map(rules
      .filter((rule) => rule.siteId)
      .map((rule) => [rule.siteId as string, rule.siteName ?? rule.siteId as string])).entries()),
    [rules],
  )

  const filteredRules = useMemo(() => rules.filter((rule) => {
    if (statusFilter !== 'all' && rule.status !== statusFilter) return false
    if (categoryFilter !== 'all' && rule.category !== categoryFilter) return false
    if (confidenceFilter !== 'all' && confidenceBucket(rule.evidenceConfidence) !== confidenceFilter) return false
    if (siteFilter !== 'all' && rule.siteId !== siteFilter) return false
    return true
  }), [rules, statusFilter, categoryFilter, confidenceFilter, siteFilter])

  const pendingCount = rules.filter((rule) => rule.status === 'pending').length

  const contractStatusLabel = (status: string) => {
    if (status === 'processing') return 'Processando'
    if (status === 'rules_extracted') return 'Regras extraidas'
    if (status === 'active') return 'Ativo'
    if (status === 'inactive') return 'Inativo'
    if (status === 'extraction_failed') return 'Falha na extracao'
    return status
  }

  const contractStatusClassName = (status: string) => {
    if (status === 'active') return 'ok'
    if (status === 'processing') return 'warn'
    if (status === 'rules_extracted') return 'info'
    if (status === 'inactive') return 'muted'
    return 'err'
  }

  const closeEvidenceModal = () => {
    setSelectedEvidenceRule(null)
    setEvidence(null)
    setLoadingEvidenceId(null)
  }

  const openEvidenceModal = async (rule: RuleItem) => {
    if (!token) return

    setSelectedEvidenceRule(rule)
    setEvidence(null)
    setLoadingEvidenceId(rule.id)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/rules/${encodeURIComponent(rule.id)}/evidence`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        throw new Error(`Falha ao carregar evidencia (${response.status}).`)
      }

      const payload = (await response.json()) as { evidence?: RuleEvidencePayload }
      setEvidence(payload.evidence ?? null)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar evidencia.')
    } finally {
      setLoadingEvidenceId(null)
    }
  }

  const openEditModal = (rule: RuleItem) => {
    setEditingRule(rule)
    setEditForm(toEditForm(rule))
    setError(null)
  }

  const closeEditModal = () => {
    setEditingRule(null)
    setEditForm(null)
    setSavingEditId(null)
  }

  const handleEditRule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token || !editingRule || !editForm) return

    setSavingEditId(editingRule.id)
    setError(null)

    const quantity = editForm.quantity.trim() ? Number(editForm.quantity.replace(',', '.')) : null
    if (quantity !== null && !Number.isFinite(quantity)) {
      setError('Quantidade precisa ser um numero valido.')
      setSavingEditId(null)
      return
    }

    try {
      const response = await fetch(`${API_URL}/rules/${encodeURIComponent(editingRule.id)}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: editForm.title.trim(),
          description: editForm.description.trim(),
          category: editForm.category,
          ruleType: editForm.ruleType.trim() || null,
          periodicity: editForm.periodicity || null,
          quantity,
          unitMeasure: editForm.unitMeasure.trim() || null,
          calculationBasis: editForm.calculationBasis.trim() || null,
          applicability: editForm.applicability.trim() || null,
        }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null
        throw new Error(payload?.message ?? `Falha ao editar regra (${response.status}).`)
      }

      const payload = (await response.json()) as { rule?: RuleItem }
      if (payload.rule) {
        setRules((current) => current.map((rule) => (rule.id === editingRule.id ? payload.rule as RuleItem : rule)))
      }

      closeEditModal()
      setSuccessMessage('Regra atualizada e mantida pendente para aprovacao.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao editar regra.')
    } finally {
      setSavingEditId(null)
    }
  }

  const handleApproveRule = async (rule: RuleItem) => {
    if (!token) return

    setStatusUpdatingId(rule.id)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/rules/${encodeURIComponent(rule.id)}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'approved' }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null
        throw new Error(payload?.message ?? `Falha ao aprovar regra (${response.status}).`)
      }

      setRules((current) => current.map((item) => (item.id === rule.id ? { ...item, status: 'approved' } : item)))
      setSuccessMessage('Regra aprovada. A criacao de controle continua manual.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao aprovar regra.')
    } finally {
      setStatusUpdatingId(null)
    }
  }

  const openRejectModal = (rule: RuleItem) => {
    setRejectingRule(rule)
    setRejectNote('')
    setError(null)
  }

  const closeRejectModal = () => {
    setRejectingRule(null)
    setRejectNote('')
  }

  const handleRejectRule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token || !rejectingRule) return

    const note = rejectNote.trim()
    if (!note) {
      setError('Informe o motivo da rejeicao antes de continuar.')
      return
    }

    setStatusUpdatingId(rejectingRule.id)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/rules/${encodeURIComponent(rejectingRule.id)}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'rejected', note }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null
        throw new Error(payload?.message ?? `Falha ao rejeitar regra (${response.status}).`)
      }

      setRules((current) => current.map((item) => (item.id === rejectingRule.id ? { ...item, status: 'rejected' } : item)))
      closeRejectModal()
      setSuccessMessage('Regra rejeitada com motivo registrado.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao rejeitar regra.')
    } finally {
      setStatusUpdatingId(null)
    }
  }

  const handleDeleteRule = async (ruleId: string) => {
    if (!token || !ruleId) return

    setDeletingRuleId(ruleId)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/rules/${encodeURIComponent(ruleId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) throw new Error(`Falha ao excluir regra (${response.status}).`)

      setRules((current) => current.filter((rule) => rule.id !== ruleId))
      setSuccessMessage('Regra excluida com sucesso.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao excluir regra.')
    } finally {
      setDeletingRuleId(null)
    }
  }

  const openPromoteControlModal = (rule: RuleItem) => {
    setSelectedRuleForControl(rule)
    setControlForm({
      title: rule.title,
      operationalDescription: rule.description,
      frequency: 'daily',
      responsible: '',
      expectedEvidence: rule.sourceExcerpt?.trim()
        ? `Trecho contratual validado: ${rule.sourceExcerpt.trim().slice(0, 120)}`
        : 'Checklist operacional assinado com evidencia de execucao.',
      status: 'ACTIVE',
    })
    setError(null)
  }

  const closePromoteControlModal = () => {
    setSelectedRuleForControl(null)
    setPromotingRuleId(null)
  }

  const handlePromoteRuleToControl = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token || !selectedRuleForControl) return

    setPromotingRuleId(selectedRuleForControl.id)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/rules/${encodeURIComponent(selectedRuleForControl.id)}/promote-control`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: controlForm.title.trim() || selectedRuleForControl.title,
          operationalDescription: controlForm.operationalDescription.trim(),
          frequency: controlForm.frequency,
          responsible: controlForm.responsible.trim(),
          expectedEvidence: controlForm.expectedEvidence.trim(),
          status: controlForm.status,
        }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null
        throw new Error(payload?.message ?? `Falha ao criar controle (${response.status}).`)
      }

      closePromoteControlModal()
      setSuccessMessage('Controle operacional criado manualmente a partir da regra aprovada.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao criar controle.')
    } finally {
      setPromotingRuleId(null)
    }
  }

  useEffect(() => {
    if (!successMessage) return

    const timeoutId = window.setTimeout(() => setSuccessMessage(null), 4000)
    return () => window.clearTimeout(timeoutId)
  }, [successMessage])

  return (
    <AppShell onLogout={logout}>
      <section className="card mc-table-card mc-review-queue">
        <div className="mc-card-head mc-review-head">
          <div>
            <button type="button" className="mc-modal-cancel" onClick={() => navigate('/contracts')}>
              Voltar
            </button>
            <h2 className="mc-contract-rules-title">Revisao de Regras do Contrato</h2>
            <p className="mc-review-subtitle">
              {contractTitle}
              {contractSiteName ? ` - ${contractSiteName}` : ''}
            </p>
            <p className="mc-review-note">
              Regras sugeridas pela IA ficam pendentes ate aprovacao humana. Evidencia e confianca devem ser verificadas antes de qualquer decisao.
            </p>
          </div>
          <div className="mc-rule-header-actions">
            <span className={`mc-status ${contractStatusClassName(contractStatus)}`}>
              {contractStatusLabel(contractStatus)}
            </span>
            <span className="mc-review-counter">{pendingCount} pendente(s)</span>
          </div>
        </div>

        <div className="mc-review-manual-note">
          Cadastro manual fica indisponivel nesta fila porque toda regra precisa nascer com evidencia contratual.
        </div>

        <div className="mc-review-filters" aria-label="Filtros da fila de revisao">
          <label>
            Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | RuleStatus)}>
              <option value="all">Todos</option>
              <option value="pending">Pendentes</option>
              <option value="approved">Aprovadas</option>
              <option value="rejected">Rejeitadas</option>
            </select>
          </label>

          <label>
            Categoria
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="all">Todas</option>
              {categoriesInRules.map((category) => (
                <option key={category} value={category}>{formatCategory(category)}</option>
              ))}
            </select>
          </label>

          <label>
            Confianca IA
            <select value={confidenceFilter} onChange={(event) => setConfidenceFilter(event.target.value as ConfidenceFilter)}>
              <option value="all">Todas</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baixa</option>
              <option value="unknown">Nao estimada</option>
            </select>
          </label>

          <label>
            Unidade
            <select value={siteFilter} onChange={(event) => setSiteFilter(event.target.value)}>
              <option value="all">Todas</option>
              {sitesInRules.map(([siteId, siteName]) => (
                <option key={siteId} value={siteId}>{siteName}</option>
              ))}
            </select>
          </label>
        </div>

        {error ? <p className="auth-error">{error}</p> : null}
        {successMessage ? <p className="mc-success-text">{successMessage}</p> : null}

        <div className="mc-review-table-wrap">
          <table className="mc-clean-table mc-contracts-table mc-review-table">
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Regra</th>
                <th>Unidade</th>
                <th>Origem</th>
                <th>Evidencia</th>
                <th>Confianca IA</th>
                <th>Status</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8}>Carregando regras...</td></tr>
              ) : filteredRules.length ? (
                filteredRules.map((rule) => (
                  <tr key={rule.id} className={rule.status === 'pending' ? 'mc-review-row-pending' : undefined}>
                    <td><span className={`mc-category-badge mc-category-${rule.category}`}>{formatCategory(rule.category)}</span></td>
                    <td>
                      <strong>{rule.title}</strong>
                      <p className="mc-rule-description">{rule.description}</p>
                      <span className="mc-muted-text">
                        {rule.periodicity ? `${rule.periodicity}` : 'Periodicidade nao informada'}
                        {typeof rule.quantity === 'number' ? ` - ${rule.quantity} ${rule.unitMeasure ?? ''}` : ''}
                      </span>
                    </td>
                    <td>{rule.siteName ?? rule.siteId ?? 'Unidade nao identificada'}</td>
                    <td>{originLabel(rule)}</td>
                    <td>
                      <blockquote className="mc-review-evidence-short">{shortText(rule.sourceExcerpt, 130)}</blockquote>
                    </td>
                    <td>
                      <span className={`mc-confidence-badge mc-confidence-${confidenceBucket(rule.evidenceConfidence)}`}>
                        {confidenceLabel(rule.evidenceConfidence)}
                      </span>
                    </td>
                    <td>
                      <span className={`mc-status ${rule.status === 'approved' ? 'ok' : rule.status === 'pending' ? 'warn' : 'err'}`}>
                        {statusLabel[rule.status]}
                      </span>
                    </td>
                    <td>
                      <div className="mc-rule-actions mc-review-actions">
                        <button
                          type="button"
                          className="mc-action-secondary"
                          disabled={loadingEvidenceId === rule.id}
                          onClick={() => void openEvidenceModal(rule)}
                        >
                          {loadingEvidenceId === rule.id ? 'Abrindo...' : 'Ver evidencia'}
                        </button>
                        {rule.status === 'pending' ? (
                          <>
                            <button type="button" className="mc-action-secondary" onClick={() => openEditModal(rule)}>
                              Editar
                            </button>
                            <button
                              type="button"
                              className="mc-action-approve"
                              disabled={statusUpdatingId === rule.id}
                              onClick={() => void handleApproveRule(rule)}
                            >
                              Aprovar
                            </button>
                            <button
                              type="button"
                              className="mc-action-reject"
                              disabled={statusUpdatingId === rule.id}
                              onClick={() => openRejectModal(rule)}
                            >
                              Rejeitar
                            </button>
                          </>
                        ) : null}
                        {rule.status === 'approved' ? (
                          <button
                            type="button"
                            className="mc-action-promote"
                            disabled={promotingRuleId === rule.id}
                            onClick={() => openPromoteControlModal(rule)}
                          >
                            Criar controle
                          </button>
                        ) : null}
                        {rule.status === 'rejected' ? (
                          <button
                            type="button"
                            className="mc-action-delete"
                            disabled={deletingRuleId === rule.id}
                            onClick={() => void handleDeleteRule(rule.id)}
                          >
                            {deletingRuleId === rule.id ? 'Excluindo...' : 'Excluir'}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={8}>Nenhuma regra encontrada para os filtros selecionados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedEvidenceRule ? (
        <div className="modal-overlay" role="presentation" onClick={closeEvidenceModal}>
          <div className="modal mc-evidence-modal" role="dialog" aria-modal="true" aria-labelledby="rule-evidence-title" onClick={(event) => event.stopPropagation()}>
            <h3 id="rule-evidence-title">Evidencia da regra</h3>
            <p className="mc-rule-description">{selectedEvidenceRule.title}</p>
            {loadingEvidenceId ? (
              <p>Carregando evidencia...</p>
            ) : (
              <div className="mc-evidence-detail">
                <div className="mc-evidence-grid">
                  <span>Pagina: {evidence?.rule.sourcePage ?? selectedEvidenceRule.sourcePage ?? 'Nao informada'}</span>
                  <span>Item/secao: {evidence?.rule.sourceItem ?? selectedEvidenceRule.sourceItem ?? 'Nao informado'}</span>
                  <span>Confianca: {confidenceLabel(evidence?.rule.evidenceConfidence ?? selectedEvidenceRule.evidenceConfidence)}</span>
                  <span>Bloco: {evidence?.rule.sourceBlockId ?? selectedEvidenceRule.sourceBlockId ?? 'Nao vinculado'}</span>
                </div>

                <h4>Trecho de evidencia</h4>
                <blockquote className="mc-rule-evidence-excerpt">
                  {evidence?.rule.sourceExcerpt ?? selectedEvidenceRule.sourceExcerpt ?? 'Evidencia nao informada.'}
                </blockquote>

                {evidence?.block ? (
                  <>
                    <h4>Bloco de origem</h4>
                    <div className="mc-evidence-grid">
                      <span>Tipo: {evidence.block.blockType ?? 'Nao informado'}</span>
                      <span>Pagina do bloco: {evidence.block.pageNumber ?? 'Nao informada'}</span>
                      <span>Item do bloco: {evidence.block.sourceItem ?? 'Nao informado'}</span>
                    </div>
                    {evidence.block.normalizedText ? (
                      <pre className="mc-evidence-pre">{evidence.block.normalizedText}</pre>
                    ) : null}
                    {evidence.block.normalizedTableMarkdown ? (
                      <>
                        <h4>Tabela normalizada</h4>
                        <pre className="mc-evidence-pre">{evidence.block.normalizedTableMarkdown}</pre>
                      </>
                    ) : null}
                  </>
                ) : null}

                {evidence?.page?.rawText ? (
                  <>
                    <h4>Pagina extraida</h4>
                    <p className="mc-muted-text">Qualidade: {evidence.page.textQuality ?? 'UNKNOWN'}</p>
                    <pre className="mc-evidence-pre">{evidence.page.rawText}</pre>
                  </>
                ) : null}
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={closeEvidenceModal}>Fechar</button>
            </div>
          </div>
        </div>
      ) : null}

      {editingRule && editForm ? (
        <div className="modal-overlay" role="presentation" onClick={closeEditModal}>
          <div className="modal mc-edit-rule-modal" role="dialog" aria-modal="true" aria-labelledby="edit-rule-title" onClick={(event) => event.stopPropagation()}>
            <h3 id="edit-rule-title">Editar regra pendente</h3>
            <p className="form-hint">Evidencia, unidade, contrato e status nao podem ser alterados por esta tela.</p>
            <form className="mc-auth-form" onSubmit={handleEditRule}>
              <div className="form-group">
                <label htmlFor="edit-rule-title-field">Titulo</label>
                <input
                  id="edit-rule-title-field"
                  type="text"
                  value={editForm.title}
                  onChange={(event) => setEditForm((current) => current ? ({ ...current, title: event.target.value }) : current)}
                  minLength={3}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-rule-description">Descricao</label>
                <textarea
                  id="edit-rule-description"
                  value={editForm.description}
                  onChange={(event) => setEditForm((current) => current ? ({ ...current, description: event.target.value }) : current)}
                  rows={4}
                  required
                />
              </div>

              <div className="mc-edit-grid">
                <div className="form-group">
                  <label htmlFor="edit-rule-category">Categoria</label>
                  <select
                    id="edit-rule-category"
                    value={editForm.category}
                    onChange={(event) => setEditForm((current) => current ? ({ ...current, category: event.target.value }) : current)}
                  >
                    {categoryOptions.map((category) => (
                      <option key={category} value={category}>{formatCategory(category)}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="edit-rule-periodicity">Periodicidade</label>
                  <select
                    id="edit-rule-periodicity"
                    value={editForm.periodicity}
                    onChange={(event) => setEditForm((current) => current ? ({ ...current, periodicity: event.target.value }) : current)}
                  >
                    <option value="">Nao informada</option>
                    {periodicityOptions.filter(Boolean).map((periodicity) => (
                      <option key={periodicity} value={periodicity}>{periodicity}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="edit-rule-quantity">Quantidade</label>
                  <input
                    id="edit-rule-quantity"
                    type="text"
                    value={editForm.quantity}
                    onChange={(event) => setEditForm((current) => current ? ({ ...current, quantity: event.target.value }) : current)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="edit-rule-unit">Unidade de medida</label>
                  <input
                    id="edit-rule-unit"
                    type="text"
                    value={editForm.unitMeasure}
                    onChange={(event) => setEditForm((current) => current ? ({ ...current, unitMeasure: event.target.value }) : current)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="edit-rule-type">Tipo da regra</label>
                <input
                  id="edit-rule-type"
                  type="text"
                  value={editForm.ruleType}
                  onChange={(event) => setEditForm((current) => current ? ({ ...current, ruleType: event.target.value }) : current)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-rule-basis">Base de calculo</label>
                <input
                  id="edit-rule-basis"
                  type="text"
                  value={editForm.calculationBasis}
                  onChange={(event) => setEditForm((current) => current ? ({ ...current, calculationBasis: event.target.value }) : current)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-rule-applicability">Aplicabilidade</label>
                <input
                  id="edit-rule-applicability"
                  type="text"
                  value={editForm.applicability}
                  onChange={(event) => setEditForm((current) => current ? ({ ...current, applicability: event.target.value }) : current)}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeEditModal}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={savingEditId === editingRule.id}>
                  {savingEditId === editingRule.id ? 'Salvando...' : 'Salvar alteracoes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {rejectingRule ? (
        <div className="modal-overlay" role="presentation" onClick={closeRejectModal}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="reject-rule-title" onClick={(event) => event.stopPropagation()}>
            <h3 id="reject-rule-title">Rejeitar regra</h3>
            <p className="mc-rule-description">{rejectingRule.title}</p>
            <form className="mc-auth-form" onSubmit={handleRejectRule}>
              <div className="form-group">
                <label htmlFor="reject-note">Motivo da rejeicao</label>
                <textarea
                  id="reject-note"
                  value={rejectNote}
                  onChange={(event) => setRejectNote(event.target.value)}
                  rows={4}
                  minLength={3}
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeRejectModal}>Cancelar</button>
                <button type="submit" className="mc-action-reject" disabled={statusUpdatingId === rejectingRule.id}>
                  {statusUpdatingId === rejectingRule.id ? 'Rejeitando...' : 'Rejeitar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {selectedRuleForControl ? (
        <div className="modal-overlay" role="presentation" onClick={closePromoteControlModal}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="promote-control-title" onClick={(event) => event.stopPropagation()}>
            <h3 id="promote-control-title">Criar controle manual</h3>
            <form className="mc-auth-form" onSubmit={handlePromoteRuleToControl}>
              <div className="form-group">
                <label htmlFor="control-title">Titulo do controle</label>
                <input
                  id="control-title"
                  type="text"
                  value={controlForm.title}
                  onChange={(event) => setControlForm((current) => ({ ...current, title: event.target.value }))}
                  minLength={3}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="control-description">Descricao operacional</label>
                <textarea
                  id="control-description"
                  value={controlForm.operationalDescription}
                  onChange={(event) => setControlForm((current) => ({ ...current, operationalDescription: event.target.value }))}
                  rows={4}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="control-frequency">Frequencia</label>
                <select
                  id="control-frequency"
                  value={controlForm.frequency}
                  onChange={(event) => setControlForm((current) => ({
                    ...current,
                    frequency: event.target.value as ControlPromotionFormState['frequency'],
                  }))}
                >
                  <option value="daily">Diaria</option>
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensal</option>
                  <option value="per_shift">Por turno</option>
                  <option value="on_demand">Sob demanda</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="control-responsible">Responsavel</label>
                <input
                  id="control-responsible"
                  type="text"
                  value={controlForm.responsible}
                  onChange={(event) => setControlForm((current) => ({ ...current, responsible: event.target.value }))}
                  minLength={2}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="control-evidence">Evidencia esperada</label>
                <textarea
                  id="control-evidence"
                  value={controlForm.expectedEvidence}
                  onChange={(event) => setControlForm((current) => ({ ...current, expectedEvidence: event.target.value }))}
                  rows={3}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="control-status">Status inicial</label>
                <select
                  id="control-status"
                  value={controlForm.status}
                  onChange={(event) => setControlForm((current) => ({
                    ...current,
                    status: event.target.value as ControlPromotionFormState['status'],
                  }))}
                >
                  <option value="ACTIVE">Ativo</option>
                  <option value="DRAFT">Aguardando ativacao</option>
                </select>
              </div>

              <p className="form-hint">Origem: {originLabel(selectedRuleForControl)}</p>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closePromoteControlModal}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={promotingRuleId === selectedRuleForControl.id}>
                  {promotingRuleId === selectedRuleForControl.id ? 'Criando...' : 'Criar controle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </AppShell>
  )
}
