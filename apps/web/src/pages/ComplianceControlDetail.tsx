import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { useAuth } from '../auth'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

type ControlDetail = {
  id: string
  title: string
  status: string
  contractTitle?: string | null
  ruleTitle?: string | null
  frequency: string
  responsible: string
  expectedEvidence: string
  origin?: {
    contractTitle?: string | null
    ruleTitle?: string | null
    page?: number | null
    excerpt?: string | null
  }
}

type ExecutionItem = {
  id: string
  controlId?: string
  executionDate: string
  status: string
  evidenceSummary: string
  evidenceReference?: string | null
  executedBy: string
  executedAt: string
}

type TimelineItem = {
  id: string
  type: 'event' | 'execution' | 'finding'
  title: string
  description: string
  createdAt: string
  actorName: string
}

type DetailPayload = {
  control: ControlDetail
  executions: ExecutionItem[]
  timeline: TimelineItem[]
  findings: Array<{
    id: string
    status: string
    severity: string
    description: string
    detectedAt: string
    resolvedAt?: string | null
  }>
  evidenceReferences: Array<{
    id: string
    sourceType: string
    page?: number | null
    section?: string | null
    excerpt?: string | null
    createdAt: string
  }>
}

type ExecutionFormState = {
  executionDate: string
  result: 'completed' | 'failed'
  observation: string
  evidenceText: string
}

type FindingFormState = {
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  description: string
}

const statusLabel = (status: string) => {
  if (status === 'ACTIVE') return 'Ativo'
  if (status === 'DRAFT') return 'Rascunho'
  if (status === 'PAUSED') return 'Pausado'
  if (status === 'NON_COMPLIANT') return 'Com problema'
  if (status === 'COMPLETED') return 'Concluído'
  return status
}

const statusClassName = (status: string) => {
  if (status === 'ACTIVE') return 'ok'
  if (status === 'DRAFT') return 'warn'
  if (status === 'PAUSED') return 'muted'
  if (status === 'NON_COMPLIANT') return 'err'
  if (status === 'COMPLETED') return 'info'
  return 'info'
}

const executionLabel = (status: string) => (status === 'completed' ? 'Conforme' : 'Não conforme')
const executionClass = (status: string) => (status === 'completed' ? 'ok' : 'err')

const frequencyLabel = (frequency: string) => {
  if (frequency === 'daily') return 'Diária'
  if (frequency === 'weekly') return 'Semanal'
  if (frequency === 'monthly') return 'Mensal'
  if (frequency === 'per_shift') return 'Por turno'
  if (frequency === 'on_demand') return 'Sob demanda'
  return frequency
}

export function ComplianceControlDetailPage() {
  const navigate = useNavigate()
  const { controlId } = useParams<{ controlId: string }>()
  const { authState, logout } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<DetailPayload | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [executionModalOpen, setExecutionModalOpen] = useState(false)
  const [submittingExecution, setSubmittingExecution] = useState(false)
  const [executionForm, setExecutionForm] = useState<ExecutionFormState>({
    executionDate: new Date().toISOString().slice(0, 10),
    result: 'completed',
    observation: '',
    evidenceText: '',
  })
  const [findingModalExecution, setFindingModalExecution] = useState<ExecutionItem | null>(null)
  const [submittingFinding, setSubmittingFinding] = useState(false)
  const [findingForm, setFindingForm] = useState<FindingFormState>({
    severity: 'HIGH',
    description: '',
  })

  const timeline = useMemo(() => payload?.timeline ?? [], [payload])
  const failedExecutions = useMemo(() => (payload?.executions ?? []).filter((item) => item.status === 'failed'), [payload])

  useEffect(() => {
    if (!authState || !controlId) {
      return
    }

    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`${API_URL}/compliance-controls/${encodeURIComponent(controlId)}`, {
          headers: { Authorization: `Bearer ${authState.token}` },
        })

        if (!response.ok) {
          throw new Error('Falha ao carregar detalhe do controle.')
        }

        const data = (await response.json()) as { status: string } & DetailPayload
        setPayload({
          control: data.control,
          executions: data.executions ?? [],
          timeline: data.timeline ?? [],
          findings: data.findings ?? [],
          evidenceReferences: data.evidenceReferences ?? [],
        })
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar detalhe do controle.')
        setPayload(null)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [authState, controlId])

  useEffect(() => {
    if (!successMessage) {
      return
    }

    const timeoutId = window.setTimeout(() => setSuccessMessage(null), 4000)
    return () => window.clearTimeout(timeoutId)
  }, [successMessage])

  const loadDetail = async () => {
    if (!authState || !controlId) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/compliance-controls/${encodeURIComponent(controlId)}`, {
        headers: { Authorization: `Bearer ${authState.token}` },
      })

      if (!response.ok) {
        throw new Error('Falha ao carregar detalhe do controle.')
      }

      const data = (await response.json()) as { status: string } & DetailPayload
      setPayload({
        control: data.control,
        executions: data.executions ?? [],
        timeline: data.timeline ?? [],
        findings: data.findings ?? [],
        evidenceReferences: data.evidenceReferences ?? [],
      })
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar detalhe do controle.')
      setPayload(null)
    } finally {
      setLoading(false)
    }
  }

  const openExecutionModal = () => {
    setExecutionForm({
      executionDate: new Date().toISOString().slice(0, 10),
      result: 'completed',
      observation: '',
      evidenceText: '',
    })
    setExecutionModalOpen(true)
    setError(null)
  }

  const closeExecutionModal = () => {
    setExecutionModalOpen(false)
    setSubmittingExecution(false)
  }

  const openFindingModal = (execution: ExecutionItem) => {
    setFindingModalExecution(execution)
    setFindingForm({
      severity: 'HIGH',
      description: `Não conformidade registrada em ${new Date(execution.executedAt).toLocaleDateString('pt-BR')}: ${execution.evidenceSummary}`,
    })
    setError(null)
  }

  const closeFindingModal = () => {
    setFindingModalExecution(null)
    setSubmittingFinding(false)
  }

  const handleExecutionSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!authState || !controlId) {
      return
    }

    setSubmittingExecution(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/compliance-controls/${encodeURIComponent(controlId)}/executions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authState.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          executionDate: executionForm.executionDate,
          status: executionForm.result,
          evidenceSummary: executionForm.observation.trim(),
          evidenceReference: executionForm.evidenceText.trim() || undefined,
        }),
      })

      if (!response.ok) {
        const payloadError = (await response.json().catch(() => null)) as { message?: string } | null
        throw new Error(payloadError?.message ?? 'Falha ao registrar execução.')
      }

      closeExecutionModal()
      setSuccessMessage(
        executionForm.result === 'failed'
          ? 'Execução não conforme registrada. Avalie abrir um finding manualmente.'
          : 'Execução conforme registrada com sucesso.',
      )
      await loadDetail()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao registrar execução.')
    } finally {
      setSubmittingExecution(false)
    }
  }

  const handleFindingSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!authState || !controlId || !findingModalExecution) {
      return
    }

    setSubmittingFinding(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/compliance-controls/${encodeURIComponent(controlId)}/findings`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authState.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          executionId: findingModalExecution.id,
          severity: findingForm.severity,
          description: findingForm.description.trim(),
          status: 'OPEN',
        }),
      })

      if (!response.ok) {
        const payloadError = (await response.json().catch(() => null)) as { message?: string } | null
        throw new Error(payloadError?.message ?? 'Falha ao abrir finding manual.')
      }

      closeFindingModal()
      setSuccessMessage('Finding aberto manualmente e registrado na timeline do controle.')
      await loadDetail()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao abrir finding manual.')
    } finally {
      setSubmittingFinding(false)
    }
  }

  return (
    <AppShell onLogout={logout}>
      <section className="card mc-table-card">
        <div className="mc-card-head">
          <div>
            <button type="button" className="mc-modal-cancel" onClick={() => navigate('/compliance')}>
              ← Voltar para conformidade
            </button>
            <h2>{payload?.control.title ?? 'Controle operacional'}</h2>
            {payload?.control ? (
              <span className={`mc-status ${statusClassName(payload.control.status)}`}>
                {statusLabel(payload.control.status)}
              </span>
            ) : null}
          </div>
          {payload?.control && (payload.control.status === 'ACTIVE' || payload.control.status === 'NON_COMPLIANT') ? (
            <button type="button" className="mc-action-approve" onClick={openExecutionModal}>
              Registrar execução
            </button>
          ) : null}
        </div>

        {error ? <p className="auth-error">{error}</p> : null}
        {successMessage ? <p className="mc-success-text">{successMessage}</p> : null}
        {loading ? <p className="mc-muted-text">Carregando detalhe do controle...</p> : null}

        {payload?.control ? (
          <div className="mc-control-detail-grid">
            <article className="mc-control-detail-card">
              <h3>Origem</h3>
              <p><strong>Contrato:</strong> {payload.control.origin?.contractTitle ?? payload.control.contractTitle ?? 'Não identificado'}</p>
              <p><strong>Regra:</strong> {payload.control.origin?.ruleTitle ?? payload.control.ruleTitle ?? 'Não identificada'}</p>
              <p><strong>Página:</strong> {payload.control.origin?.page ?? 'Sem página registrada'}</p>
            </article>

            <article className="mc-control-detail-card">
              <h3>Configuração</h3>
              <p><strong>Frequência:</strong> {frequencyLabel(payload.control.frequency)}</p>
              <p><strong>Responsável:</strong> {payload.control.responsible}</p>
              <p><strong>Evidência esperada:</strong> {payload.control.expectedEvidence}</p>
            </article>
          </div>
        ) : null}
      </section>

      {failedExecutions.length ? (
        <section className="card mc-table-card mc-risk-callout">
          <div className="mc-card-head">
            <h2>Atenção operacional</h2>
          </div>
          <p>
            Existem {failedExecutions.length} execução(ões) não conforme neste controle. A abertura de finding continua manual e depende de decisão humana.
          </p>
        </section>
      ) : null}

      <section className="card mc-table-card">
        <div className="mc-card-head"><h2>Execuções</h2></div>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Status</th>
              <th>Evidência</th>
              <th>Usuário</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {payload?.executions?.length ? payload.executions.map((item) => (
              <tr key={item.id}>
                <td>{new Date(item.executedAt).toLocaleDateString('pt-BR')}</td>
                <td>
                  <span className={`mc-status ${executionClass(item.status)}`}>
                    {executionLabel(item.status)}
                  </span>
                </td>
                <td>
                  <strong>{item.evidenceSummary}</strong>
                  <p className="mc-muted-text">{item.evidenceReference ?? 'Sem referência adicional'}</p>
                </td>
                <td>{item.executedBy}</td>
                <td>
                  {item.status === 'failed' ? (
                    <button type="button" className="mc-action-reject" onClick={() => openFindingModal(item)}>
                      Abrir Finding
                    </button>
                  ) : <span className="mc-muted-text">Sem ação</span>}
                </td>
              </tr>
            )) : (
              <tr><td colSpan={5}>Sem execuções registradas.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="card mc-table-card">
        <div className="mc-card-head"><h2>Timeline operacional única</h2></div>
        <div className="mc-control-timeline">
          {timeline.length ? timeline.map((item) => (
            <article key={item.id} className="mc-control-timeline-item">
              <header>
                <strong>{item.title}</strong>
                <time>{new Date(item.createdAt).toLocaleString('pt-BR')}</time>
              </header>
              <p>{item.description}</p>
              <small>{item.actorName}</small>
            </article>
          )) : <p className="mc-muted-text">Sem histórico registrado.</p>}
        </div>
      </section>

      {executionModalOpen ? (
        <div className="mc-modal-overlay" role="presentation">
          <div className="mc-modal" role="dialog" aria-modal="true" aria-label="Registrar execução">
            <h3>Registrar execução</h3>
            <form className="mc-auth-form" onSubmit={(event) => void handleExecutionSubmit(event)}>
              <label>
                Data da execução
                <input
                  type="date"
                  required
                  value={executionForm.executionDate}
                  onChange={(event) => setExecutionForm((previous) => ({ ...previous, executionDate: event.target.value }))}
                />
              </label>

              <fieldset className="mc-execution-status-group">
                <legend>Resultado</legend>
                <label className="mc-execution-status-option">
                  <input
                    type="radio"
                    name="execution-result"
                    value="completed"
                    checked={executionForm.result === 'completed'}
                    onChange={() => setExecutionForm((previous) => ({ ...previous, result: 'completed' }))}
                  />
                  Conforme
                </label>
                <label className="mc-execution-status-option">
                  <input
                    type="radio"
                    name="execution-result"
                    value="failed"
                    checked={executionForm.result === 'failed'}
                    onChange={() => setExecutionForm((previous) => ({ ...previous, result: 'failed' }))}
                  />
                  Não conforme
                </label>
              </fieldset>

              <label>
                Observação
                <textarea
                  required
                  minLength={3}
                  value={executionForm.observation}
                  onChange={(event) => setExecutionForm((previous) => ({ ...previous, observation: event.target.value }))}
                />
              </label>

              <label>
                Evidência textual
                <textarea
                  value={executionForm.evidenceText}
                  onChange={(event) => setExecutionForm((previous) => ({ ...previous, evidenceText: event.target.value }))}
                />
              </label>

              <div className="mc-modal-actions">
                <button type="button" className="mc-modal-cancel" onClick={closeExecutionModal}>
                  Cancelar
                </button>
                <button type="submit" className="mc-action-approve" disabled={submittingExecution}>
                  {submittingExecution ? 'Salvando...' : 'Salvar execução'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {findingModalExecution ? (
        <div className="mc-modal-overlay" role="presentation">
          <div className="mc-modal" role="dialog" aria-modal="true" aria-label="Abrir finding">
            <h3>Abrir Finding</h3>
            <p className="mc-muted-text">
              Execução não conforme em {new Date(findingModalExecution.executedAt).toLocaleDateString('pt-BR')}.
            </p>
            <form className="mc-auth-form" onSubmit={(event) => void handleFindingSubmit(event)}>
              <label>
                Severidade
                <select
                  value={findingForm.severity}
                  onChange={(event) => setFindingForm((previous) => ({
                    ...previous,
                    severity: event.target.value as FindingFormState['severity'],
                  }))}
                >
                  <option value="LOW">Baixa</option>
                  <option value="MEDIUM">Média</option>
                  <option value="HIGH">Alta</option>
                  <option value="CRITICAL">Crítica</option>
                </select>
              </label>

              <label>
                Descrição do finding
                <textarea
                  required
                  minLength={5}
                  value={findingForm.description}
                  onChange={(event) => setFindingForm((previous) => ({ ...previous, description: event.target.value }))}
                />
              </label>

              <div className="mc-modal-actions">
                <button type="button" className="mc-modal-cancel" onClick={closeFindingModal}>
                  Cancelar
                </button>
                <button type="submit" className="mc-action-reject" disabled={submittingFinding}>
                  {submittingFinding ? 'Abrindo...' : 'Confirmar abertura'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </AppShell>
  )
}
