import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { useAuth } from '../auth'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

type ComplianceControlItem = {
  id: string
  title: string
  contractTitle?: string | null
  ruleTitle?: string | null
  operationalDescription: string
  frequency: string
  responsible: string
  expectedEvidence: string
  status: string
  activatedAt?: string | null
  lastExecutionStatus?: string | null
  lastExecutionAt?: string | null
  openFindingsCount?: number
}

type ComplianceExecutionItem = {
  id: string
  controlId: string
  controlTitle: string
  executionDate: string
  status: string
  evidenceSummary: string
  evidenceReference?: string | null
  executedBy: string
  executedAt: string
}

type ComplianceSummary = {
  totalControls: number
  activeControls: number
  pendingControls: number
  draftControls: number
  pausedControls: number
  nonCompliantControls: number
  completedControls: number
  openFindings: number
  failedExecutions: number
}

type ExecutionFormState = {
  executionDate: string
  status: 'completed' | 'failed'
  evidenceSummary: string
  evidenceReference: string
}

export function CompliancePage() {
  const navigate = useNavigate()
  const { authState, logout } = useAuth()
  const [controls, setControls] = useState<ComplianceControlItem[]>([])
  const [latestExecutions, setLatestExecutions] = useState<ComplianceExecutionItem[]>([])
  const [failures, setFailures] = useState<ComplianceExecutionItem[]>([])
  const [summary, setSummary] = useState<ComplianceSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [selectedControl, setSelectedControl] = useState<ComplianceControlItem | null>(null)
  const [submittingExecution, setSubmittingExecution] = useState(false)
  const [executionForm, setExecutionForm] = useState<ExecutionFormState>({
    executionDate: new Date().toISOString().slice(0, 10),
    status: 'completed',
    evidenceSummary: '',
    evidenceReference: '',
  })

  const frequencyLabel = (frequency: string) => {
    if (frequency === 'daily') return 'Diária'
    if (frequency === 'weekly') return 'Semanal'
    if (frequency === 'monthly') return 'Mensal'
    if (frequency === 'per_shift') return 'Por turno'
    if (frequency === 'on_demand') return 'Sob demanda'
    return frequency
  }

  const controlStatusLabel = (status: string) => {
    if (status === 'ACTIVE') return 'Ativo'
    if (status === 'DRAFT') return 'Aguardando ativação'
    if (status === 'PAUSED') return 'Pausado'
    if (status === 'NON_COMPLIANT') return 'Com problema'
    if (status === 'COMPLETED') return 'Concluído'
    return status
  }

  const controlStatusClassName = (status: string) => {
    if (status === 'ACTIVE') return 'ok'
    if (status === 'DRAFT') return 'warn'
    if (status === 'PAUSED') return 'muted'
    if (status === 'NON_COMPLIANT') return 'err'
    if (status === 'COMPLETED') return 'info'
    return 'info'
  }

  const executionStatusClassName = (status: string) => {
    if (status === 'completed') return 'ok'
    if (status === 'failed') return 'err'
    return 'info'
  }

  const load = async () => {
    if (!authState) {
      return
    }

      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`${API_URL}/compliance-controls?limit=30`, {
          headers: { Authorization: `Bearer ${authState.token}` },
        })

        if (!response.ok) {
          throw new Error('Falha ao carregar controles de conformidade.')
        }

        const payload = (await response.json()) as {
          summary?: ComplianceSummary
          controls?: ComplianceControlItem[]
          latestExecutions?: ComplianceExecutionItem[]
          failures?: ComplianceExecutionItem[]
        }

        setSummary(payload.summary ?? null)
        setControls(payload.controls ?? [])
        setLatestExecutions(payload.latestExecutions ?? [])
        setFailures(payload.failures ?? [])
      } catch (requestError) {
        setControls([])
        setLatestExecutions([])
        setFailures([])
        setSummary(null)
        setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar controles.')
      } finally {
        setLoading(false)
      }
  }

  useEffect(() => {
    if (!authState) {
      return
    }

    void load()
  }, [authState])

  useEffect(() => {
    if (!successMessage) {
      return
    }

    const timeoutId = window.setTimeout(() => setSuccessMessage(null), 4000)
    return () => window.clearTimeout(timeoutId)
  }, [successMessage])

  const openExecutionModal = (control: ComplianceControlItem) => {
    setSelectedControl(control)
    setExecutionForm({
      executionDate: new Date().toISOString().slice(0, 10),
      status: 'completed',
      evidenceSummary: '',
      evidenceReference: '',
    })
    setError(null)
  }

  const closeExecutionModal = () => {
    setSelectedControl(null)
    setSubmittingExecution(false)
  }

  const handleExecutionSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!authState || !selectedControl) {
      return
    }

    setSubmittingExecution(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/compliance-controls/${encodeURIComponent(selectedControl.id)}/executions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authState.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          executionDate: executionForm.executionDate,
          status: executionForm.status,
          evidenceSummary: executionForm.evidenceSummary.trim(),
          evidenceReference: executionForm.evidenceReference.trim() || undefined,
        }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null
        throw new Error(payload?.message ?? 'Falha ao registrar execução.')
      }

      closeExecutionModal()
      setSuccessMessage('Execução do controle registrada com evidência.')
      await load()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao registrar execução.')
    } finally {
      setSubmittingExecution(false)
    }
  }

  return (
    <AppShell onLogout={logout}>
      <section className="mc-compliance-grid">
        <article className="card mc-compliance-summary-card">
          <p>Controles ativos</p>
          <strong>{summary?.activeControls ?? 0}</strong>
        </article>
        <article className="card mc-compliance-summary-card">
          <p>Aguardando ativação</p>
          <strong>{summary?.pendingControls ?? 0}</strong>
        </article>
        <article className="card mc-compliance-summary-card">
          <p>Controles pausados</p>
          <strong>{summary?.pausedControls ?? 0}</strong>
        </article>
        <article className="card mc-compliance-summary-card">
          <p>Controles em risco</p>
          <strong>{summary?.nonCompliantControls ?? 0}</strong>
        </article>
        <article className="card mc-compliance-summary-card">
          <p>Findings abertos</p>
          <strong>{summary?.openFindings ?? 0}</strong>
        </article>
      </section>

      {error ? <p className="auth-error">{error}</p> : null}
      {successMessage ? <p className="mc-success-text">{successMessage}</p> : null}

      <section className="card mc-table-card">
        <div className="mc-card-head"><h2>Controles operacionais</h2></div>
        <table>
          <thead>
            <tr>
              <th>Título</th>
              <th>Responsável</th>
              <th>Status</th>
              <th>Frequência</th>
              <th>Última execução</th>
              <th>Findings</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7}>Carregando controles...</td></tr>
            ) : controls.length ? controls.map((item) => (
              <tr key={item.id} className="mc-row-clickable" onClick={() => navigate(`/compliance/${item.id}`)}>
                <td>
                  <strong>{item.title}</strong>
                  <p className="mc-rule-description">{item.operationalDescription}</p>
                  <p className="mc-muted-text">Origem: {item.contractTitle ?? 'Contrato não identificado'} · {item.ruleTitle ?? 'Regra aprovada'}</p>
                </td>
                <td>{item.responsible}</td>
                <td>
                  <span className={`mc-status ${controlStatusClassName(item.status)}`}>
                    {controlStatusLabel(item.status)}
                  </span>
                </td>
                <td>{frequencyLabel(item.frequency)}</td>
                <td>
                  {item.lastExecutionAt ? (
                    <>
                      <span className={`mc-status ${item.lastExecutionStatus === 'completed' ? 'ok' : item.lastExecutionStatus === 'failed' ? 'err' : 'info'}`}>
                        {item.lastExecutionStatus === 'completed' ? 'Conforme' : item.lastExecutionStatus === 'failed' ? 'Não conforme' : 'Sem status'}
                      </span>
                      <p className="mc-muted-text">{new Date(item.lastExecutionAt).toLocaleDateString('pt-BR')}</p>
                    </>
                  ) : <span className="mc-muted-text">Sem execução</span>}
                </td>
                <td>
                  <span className={`mc-status ${(item.openFindingsCount ?? 0) > 0 ? 'err' : 'ok'}`}>
                    {(item.openFindingsCount ?? 0) > 0 ? `${item.openFindingsCount} aberto(s)` : 'Sem abertos'}
                  </span>
                </td>
                <td>
                  <div className="mc-rule-actions">
                    <button type="button" className="mc-action-run" onClick={(event) => {
                      event.stopPropagation()
                      navigate(`/compliance/${item.id}`)
                    }}>
                      Ver histórico
                    </button>
                    {item.status === 'ACTIVE' || item.status === 'NON_COMPLIANT' ? (
                      <button type="button" className="mc-action-approve" onClick={(event) => {
                        event.stopPropagation()
                        openExecutionModal(item)
                      }}>
                        Registrar execução
                      </button>
                    ) : null}
                  </div>
                  {item.status !== 'ACTIVE' && item.status !== 'NON_COMPLIANT' ? (
                    <p className="mc-muted-text">Acompanhe o histórico antes da próxima execução.</p>
                  ) : null}
                </td>
              </tr>
            )) : (
              <tr><td colSpan={7}>Nenhum controle operacional criado.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="card mc-table-card">
        <div className="mc-card-head"><h2>Últimas execuções</h2></div>
        <table>
          <thead>
            <tr>
              <th>Controle</th>
              <th>Status</th>
              <th>Evidência</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            {latestExecutions.length ? latestExecutions.map((item) => (
              <tr key={item.id}>
                <td>{item.controlTitle}</td>
                <td>
                  <span className={`mc-status ${executionStatusClassName(item.status)}`}>
                    {item.status === 'completed' ? 'Concluída' : 'Falhou'}
                  </span>
                </td>
                <td>
                  <strong>{item.evidenceSummary}</strong>
                  <p className="mc-muted-text">{item.evidenceReference ?? 'Sem referência adicional'}</p>
                </td>
                <td>{new Date(item.executedAt).toLocaleDateString('pt-BR')}</td>
              </tr>
            )) : (
              <tr><td colSpan={4}>Nenhuma execução registrada.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="card mc-table-card">
        <div className="mc-card-head"><h2>Falhas recentes</h2></div>
        <table>
          <thead>
            <tr>
              <th>Controle</th>
              <th>Evidência registrada</th>
              <th>Executado por</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            {failures.length ? failures.map((item) => (
              <tr key={item.id}>
                <td>{item.controlTitle}</td>
                <td>{item.evidenceSummary}</td>
                <td>{item.executedBy}</td>
                <td>{new Date(item.executedAt).toLocaleDateString('pt-BR')}</td>
              </tr>
            )) : (
              <tr><td colSpan={4}>Nenhuma falha registrada nas últimas execuções.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      {selectedControl ? (
        <div className="modal-overlay" role="presentation" onClick={closeExecutionModal}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="execution-title" onClick={(event) => event.stopPropagation()}>
            <h3 id="execution-title">Execução do controle</h3>
            <form className="mc-auth-form" onSubmit={handleExecutionSubmit}>
              <div className="form-group">
                <label htmlFor="execution-date">Data</label>
                <input
                  id="execution-date"
                  type="date"
                  value={executionForm.executionDate}
                  onChange={(event) => setExecutionForm((current) => ({ ...current, executionDate: event.target.value }))}
                  required
                />
              </div>

              <fieldset className="mc-execution-status-group">
                <legend>Status</legend>
                <label className="mc-execution-status-option">
                  <input
                    type="radio"
                    name="execution-status"
                    value="completed"
                    checked={executionForm.status === 'completed'}
                    onChange={() => setExecutionForm((current) => ({ ...current, status: 'completed' }))}
                  />
                  Conforme
                </label>
                <label className="mc-execution-status-option">
                  <input
                    type="radio"
                    name="execution-status"
                    value="failed"
                    checked={executionForm.status === 'failed'}
                    onChange={() => setExecutionForm((current) => ({ ...current, status: 'failed' }))}
                  />
                  Não conforme
                </label>
              </fieldset>

              <div className="form-group">
                <label htmlFor="execution-evidence-summary">Evidência</label>
                <textarea
                  id="execution-evidence-summary"
                  value={executionForm.evidenceSummary}
                  onChange={(event) => setExecutionForm((current) => ({ ...current, evidenceSummary: event.target.value }))}
                  rows={4}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="execution-evidence-reference">Referência da evidência</label>
                <input
                  id="execution-evidence-reference"
                  type="text"
                  value={executionForm.evidenceReference}
                  onChange={(event) => setExecutionForm((current) => ({ ...current, evidenceReference: event.target.value }))}
                  placeholder="foto-temperatura-2026-06-11.jpg"
                />
              </div>

              <p className="form-hint">
                Controle: {selectedControl.title} · Evidência esperada: {selectedControl.expectedEvidence}
              </p>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeExecutionModal}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={submittingExecution}>
                  {submittingExecution ? 'Salvando...' : 'Salvar execução'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </AppShell>
  )
}
