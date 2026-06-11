import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { useAuth } from '../auth'

const API_URL = 'http://localhost:3001'

type RuleStatus = 'pending' | 'approved' | 'rejected'
type RuleCategory = 'nutrition' | 'management' | 'legal' | 'compliance' | 'operations'

type RuleItem = {
  id: string
  contractId: string
  title: string
  description: string
  category: RuleCategory
  sourceExcerpt?: string | null
  sourcePage?: number | null
  evidenceConfidence?: number | null
  status: RuleStatus
  createdAt: string
}

type ContractItem = {
  id: string
  title: string
  status?: string
}

type RuleFormState = {
  title: string
  description: string
  category: RuleCategory
}

type ControlPromotionFormState = {
  title: string
  operationalDescription: string
  frequency: 'daily' | 'weekly' | 'monthly' | 'per_shift' | 'on_demand'
  responsible: string
  expectedEvidence: string
  status: 'DRAFT' | 'ACTIVE'
}

const categoryLabel: Record<RuleCategory, string> = {
  nutrition: 'Nutrição',
  management: 'Gestão',
  legal: 'Jurídico',
  compliance: 'Conformidade',
  operations: 'Operações',
}

const statusLabel: Record<RuleStatus, string> = {
  pending: 'Aguardando validação',
  approved: 'Validada',
  rejected: 'Recusada',
}

export function ContractRulesPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { authState, logout } = useAuth()
  const token = authState?.token

  const [rules, setRules] = useState<RuleItem[]>([])
  const [contractTitle, setContractTitle] = useState('Contrato')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null)
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [contractStatus, setContractStatus] = useState<string>('processing')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [promotingRuleId, setPromotingRuleId] = useState<string | null>(null)
  const [selectedRuleForControl, setSelectedRuleForControl] = useState<RuleItem | null>(null)
  const [controlForm, setControlForm] = useState<ControlPromotionFormState>({
    title: '',
    operationalDescription: '',
    frequency: 'daily',
    responsible: '',
    expectedEvidence: '',
    status: 'ACTIVE',
  })
  const [form, setForm] = useState<RuleFormState>({
    title: '',
    description: '',
    category: 'nutrition',
  })

  const loadRules = async (contractId: string, authToken: string) => {
    if (!contractId || !authToken) {
      setRules([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`http://localhost:3001/rules?contractId=${contractId}`, {
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
    if (!contractId || !authToken) {
      return
    }

    try {
      const response = await fetch(`${API_URL}/contracts/${encodeURIComponent(contractId)}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })

      if (!response.ok) {
        return
      }

      const payload = (await response.json()) as { contract?: ContractItem }
      const contract = payload.contract

      if (contract?.title) {
        setContractTitle(contract.title)
        if (contract.status) {
          setContractStatus(contract.status)
        }
      }
    } catch {
      // Keep fallback title when listing contracts fails.
    }
  }

  useEffect(() => {
    console.log('contractId:', id, 'token:', token ? 'ok' : 'missing')

    if (!id || !token) {
      setRules([])
      return
    }

    void Promise.all([loadContract(id, token), loadRules(id, token)])
  }, [id, token])

  const contractStatusLabel = (status: string) => {
    if (status === 'processing') return 'Processando...'
    if (status === 'rules_extracted') return 'Regras extraídas'
    if (status === 'active') return 'Ativo'
    if (status === 'inactive') return 'Inativo'
    if (status === 'extraction_failed') return 'Falha na extração'
    return status
  }

  const contractStatusClassName = (status: string) => {
    if (status === 'active') return 'ok'
    if (status === 'processing') return 'warn'
    if (status === 'rules_extracted') return 'info'
    if (status === 'inactive') return 'muted'
    return 'err'
  }

  const handleCreateRule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!token || !id) {
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/rules`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contractId: id,
          title: form.title.trim(),
          description: form.description.trim() || 'Sem descrição.',
          category: form.category,
          status: 'pending',
        }),
      })

      if (!response.ok) {
        throw new Error('Falha ao adicionar regra.')
      }

      const payload = (await response.json()) as { rule?: RuleItem }

      if (payload.rule) {
        setRules((current) => [payload.rule as RuleItem, ...current])
      }

      setForm({ title: '', description: '', category: 'nutrition' })
      setIsCreateModalOpen(false)
      setSuccessMessage('Regra adicionada ao contrato.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao adicionar regra.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusChange = async (ruleId: string, status: 'approved' | 'rejected') => {
    if (!token || !ruleId) {
      return
    }

    setStatusUpdatingId(ruleId)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/rules/${encodeURIComponent(ruleId)}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      })

      if (!response.ok) {
        throw new Error(`Falha ao atualizar status da regra (${response.status}).`)
      }

      setRules((current) => current.map((rule) => (rule.id === ruleId ? { ...rule, status } : rule)))
      setSuccessMessage(status === 'approved' ? 'Regra validada. Agora ela pode virar controle.' : 'Regra recusada.')
    } catch (requestError) {
      if (requestError instanceof Error) {
        console.error('PATCH error:', requestError.message, requestError)
        setError(requestError.message)
      } else {
        console.error('PATCH error:', requestError)
        setError('Falha ao atualizar status da regra.')
      }
    } finally {
      setStatusUpdatingId(null)
    }
  }

  const handleDeleteRule = async (ruleId: string) => {
    if (!token || !ruleId) {
      return
    }

    setDeletingRuleId(ruleId)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/rules/${encodeURIComponent(ruleId)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error(`Falha ao excluir regra (${response.status}).`)
      }

      setRules((current) => current.filter((rule) => rule.id !== ruleId))
      setSuccessMessage('Regra excluída com sucesso.')
    } catch (requestError) {
      if (requestError instanceof Error) {
        setError(requestError.message)
      } else {
        setError('Falha ao excluir regra.')
      }
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
        ? `Trecho contratual validado e checklist operacional vinculado à cláusula: ${rule.sourceExcerpt.trim().slice(0, 120)}`
        : 'Checklist operacional assinado com evidência de execução.',
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

    if (!token || !selectedRuleForControl) {
      return
    }

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
      setSuccessMessage('Controle operacional criado a partir da regra validada.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao criar controle.')
    } finally {
      setPromotingRuleId(null)
    }
  }

  useEffect(() => {
    if (!successMessage) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setSuccessMessage(null)
    }, 4000)

    return () => window.clearTimeout(timeoutId)
  }, [successMessage])

  return (
    <AppShell onLogout={logout}>
      <section className="card mc-table-card">
        <div className="mc-card-head">
          <div>
            <button type="button" className="mc-modal-cancel" onClick={() => navigate('/contracts')}>
              ← Voltar
            </button>
            <h2 className="mc-contract-rules-title">{contractTitle}</h2>
            <span className={`mc-status ${contractStatusClassName(contractStatus)}`}>
              {contractStatusLabel(contractStatus)}
            </span>
          </div>
          <div className="mc-rule-header-actions">
            <button type="button" className="mc-new-contract-btn" onClick={() => setIsCreateModalOpen(true)}>
              + Adicionar regra
            </button>
          </div>
        </div>

        {error ? <p className="auth-error">{error}</p> : null}
        {successMessage ? <p className="mc-success-text">{successMessage}</p> : null}
        <table className="mc-clean-table mc-contracts-table">
          <thead>
            <tr>
              <th>Título</th>
              <th>Categoria</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4}>Carregando regras...</td></tr>
            ) : rules.length ? (
              rules.map((rule) => (
                <tr key={rule.id}>
                  <td>
                    <strong>{rule.title}</strong>
                    <p className="mc-rule-description">{rule.description}</p>
                    <article className="mc-rule-evidence-card">
                      <header className="mc-rule-evidence-head">
                        <div>
                          <p className="mc-rule-evidence-eyebrow">Evidência contratual</p>
                          <p className="mc-rule-evidence-label">Trecho que originou esta regra</p>
                        </div>
                        <span className="mc-rule-evidence-icon" aria-hidden="true">📄</span>
                      </header>

                      <div className="mc-rule-evidence-badges">
                        <span className="mc-rule-evidence-badge">
                          {rule.sourcePage ? `Página ${rule.sourcePage}` : 'Página não identificada'}
                        </span>
                        <span className="mc-rule-evidence-badge">
                          {typeof rule.evidenceConfidence === 'number'
                            ? `Confiança ${Math.round(rule.evidenceConfidence * 100)}%`
                            : 'Confiança não estimada'}
                        </span>
                        <span className="mc-rule-evidence-badge">Origem validada</span>
                      </div>

                      <blockquote className="mc-rule-evidence-excerpt">
                        {rule.sourceExcerpt?.trim() ? rule.sourceExcerpt : 'Evidência não informada pela extração.'}
                      </blockquote>

                      <div className="mc-rule-evidence-footer">
                        <span className="mc-rule-evidence-meta">Base contratual utilizada para validação humana.</span>
                      </div>
                    </article>
                  </td>
                  <td><span className={`mc-category-badge mc-category-${rule.category}`}>{categoryLabel[rule.category]}</span></td>
                  <td>
                    <span className={`mc-status ${rule.status === 'approved' ? 'ok' : rule.status === 'pending' ? 'warn' : 'err'}`}>
                      {statusLabel[rule.status]}
                    </span>
                  </td>
                  <td>
                    {rule.status === 'pending' ? (
                      <div className="mc-rule-actions">
                        <button
                          type="button"
                          className="mc-action-approve"
                          disabled={statusUpdatingId === rule.id}
                          onClick={() => void handleStatusChange(rule.id, 'approved')}
                        >
                          Aprovar
                        </button>
                        <button
                          type="button"
                          className="mc-action-reject"
                          disabled={statusUpdatingId === rule.id}
                          onClick={() => void handleStatusChange(rule.id, 'rejected')}
                        >
                          Rejeitar
                        </button>
                      </div>
                    ) : rule.status === 'approved' || rule.status === 'rejected' ? (
                      <div className="mc-rule-actions">
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
                        <button
                          type="button"
                          className="mc-action-delete"
                          disabled={deletingRuleId === rule.id}
                          onClick={() => void handleDeleteRule(rule.id)}
                        >
                          {deletingRuleId === rule.id ? 'Excluindo...' : 'Excluir'}
                        </button>
                      </div>
                    ) : (
                      <span className="mc-muted-text">Sem ações</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={4}>Nenhuma regra cadastrada para este contrato.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      {isCreateModalOpen ? (
        <div className="modal-overlay" role="presentation" onClick={() => setIsCreateModalOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="new-rule-title" onClick={(event) => event.stopPropagation()}>
            <h3 id="new-rule-title">Nova regra</h3>
            <form className="mc-auth-form" onSubmit={handleCreateRule}>
              <div className="form-group">
                <label htmlFor="rule-title">Título</label>
                <input
                  id="rule-title"
                  type="text"
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  minLength={3}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="rule-description">Descrição</label>
                <textarea
                  id="rule-description"
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label htmlFor="rule-category">Categoria</label>
                <select
                  id="rule-category"
                  value={form.category}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      category: event.target.value as RuleCategory,
                    }))
                  }
                >
                  <option value="nutrition">Nutrição</option>
                  <option value="management">Gestão</option>
                  <option value="legal">Jurídico</option>
                  <option value="compliance">Conformidade</option>
                  <option value="operations">Operações</option>
                </select>
              </div>

              <p className="form-hint">Status inicial: Pendente</p>
              <p className="form-hint">Status inicial: Aguardando validação</p>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsCreateModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {selectedRuleForControl ? (
        <div className="modal-overlay" role="presentation" onClick={closePromoteControlModal}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="promote-control-title" onClick={(event) => event.stopPropagation()}>
            <h3 id="promote-control-title">Transformar regra em controle</h3>
            <form className="mc-auth-form" onSubmit={handlePromoteRuleToControl}>
              <div className="form-group">
                <label htmlFor="control-title">Título do controle</label>
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
                <label htmlFor="control-description">Descrição operacional</label>
                <textarea
                  id="control-description"
                  value={controlForm.operationalDescription}
                  onChange={(event) => setControlForm((current) => ({ ...current, operationalDescription: event.target.value }))}
                  rows={4}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="control-frequency">Frequência</label>
                <select
                  id="control-frequency"
                  value={controlForm.frequency}
                  onChange={(event) => setControlForm((current) => ({
                    ...current,
                    frequency: event.target.value as ControlPromotionFormState['frequency'],
                  }))}
                >
                  <option value="daily">Diária</option>
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensal</option>
                  <option value="per_shift">Por turno</option>
                  <option value="on_demand">Sob demanda</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="control-responsible">Responsável</label>
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
                <label htmlFor="control-evidence">Evidência esperada</label>
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
                  <option value="DRAFT">Aguardando ativação</option>
                </select>
              </div>

              <p className="form-hint">
                Origem: {selectedRuleForControl.title} · {selectedRuleForControl.sourcePage ? `Página ${selectedRuleForControl.sourcePage}` : 'Página não identificada'}
              </p>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closePromoteControlModal}>
                  Cancelar
                </button>
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
