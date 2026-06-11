import { useEffect, useState } from 'react'
import { AppShell } from '../components/layout/AppShell'
import { useAuth } from '../auth'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

type ComplianceControlItem = {
  id: string
  title: string
  status: string
  responsible: string
  frequency: string
  lastExecutionAt?: string | null
  lastExecutionStatus?: string | null
  openFindingsCount?: number
}

type ComplianceSummary = {
  totalControls: number
  activeControls: number
  pendingControls: number
  pausedControls: number
  nonCompliantControls: number
  completedControls: number
  openFindings: number
  failedExecutions: number
}

export function DashboardPage() {
  const { authState, logout } = useAuth()
  const [summary, setSummary] = useState<ComplianceSummary | null>(null)
  const [controls, setControls] = useState<ComplianceControlItem[]>([])

  const activeControls = summary?.activeControls ?? 0
  const openFindings = summary?.openFindings ?? 0
  const controlsAtRisk = controls.filter((item) => item.status === 'NON_COMPLIANT' || (item.openFindingsCount ?? 0) > 0)

  const frequencyThresholdDays = (frequency: string) => {
    if (frequency === 'daily') return 1
    if (frequency === 'weekly') return 7
    if (frequency === 'monthly') return 30
    if (frequency === 'per_shift') return 1
    return 7
  }

  const pendingExecutions = controls.filter((item) => {
    if (item.status !== 'ACTIVE' && item.status !== 'NON_COMPLIANT') {
      return false
    }

    if (!item.lastExecutionAt) {
      return true
    }

    const lastExecution = new Date(item.lastExecutionAt)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - lastExecution.getTime()) / (1000 * 60 * 60 * 24))
    return diffDays >= frequencyThresholdDays(item.frequency)
  })

  const attentionToday = [
    ...controlsAtRisk.map((item) => ({
      id: `risk-${item.id}`,
      title: item.title,
      detail: `${item.status === 'NON_COMPLIANT' ? 'Controle em risco' : 'Finding aberto'} · Responsável: ${item.responsible}`,
    })),
    ...pendingExecutions
      .filter((item) => !controlsAtRisk.some((riskItem) => riskItem.id === item.id))
      .map((item) => ({
        id: `pending-${item.id}`,
        title: item.title,
        detail: `Execução pendente · Frequência ${item.frequency} · Responsável: ${item.responsible}`,
      })),
  ].slice(0, 8)

  useEffect(() => {
    if (!authState) {
      return
    }

    const load = async () => {
      const response = await fetch(`${API_URL}/compliance-controls?limit=40`, {
        headers: { Authorization: `Bearer ${authState.token}` },
      })

      if (!response.ok) {
        setSummary(null)
        setControls([])
        return
      }

      const payload = (await response.json()) as {
        summary?: ComplianceSummary
        controls?: ComplianceControlItem[]
      }

      setSummary(payload.summary ?? null)
      setControls(payload.controls ?? [])
    }

    void load()
  }, [authState])

  return (
    <AppShell onLogout={logout}>
      <section className="mc-dashboard">
        <header className="mc-greeting card">
          <h1>Olá, {authState?.user.name ?? 'Usuário'}!</h1>
          <p>Visão diária de risco operacional para priorizar ações de conformidade.</p>
        </header>

        <div className="mc-kpis">
          <article className="card mc-kpi-card">
            <div className="mc-kpi-top"><p>Controles ativos</p></div>
            <strong>{activeControls}</strong>
            <span className="mc-trend">Controles em operação hoje</span>
          </article>
          <article className="card mc-kpi-card">
            <div className="mc-kpi-top"><p>Execuções pendentes</p></div>
            <strong>{pendingExecutions.length}</strong>
            <span className={`mc-trend ${pendingExecutions.length === 0 ? 'is-positive' : ''}`}>
              {pendingExecutions.length === 0 ? 'Sem pendências imediatas' : 'Exigem registro manual'}
            </span>
          </article>
          <article className="card mc-kpi-card">
            <div className="mc-kpi-top"><p>Findings abertos</p></div>
            <strong>{openFindings}</strong>
            <span className={`mc-trend ${openFindings === 0 ? 'is-positive' : ''}`}>
              {openFindings === 0 ? 'Sem findings em aberto' : 'Demandam tratamento humano'}
            </span>
          </article>
          <article className="card mc-kpi-card">
            <div className="mc-kpi-top"><p>Controles em risco</p></div>
            <strong>{controlsAtRisk.length}</strong>
            <span className={`mc-trend ${controlsAtRisk.length === 0 ? 'is-positive' : ''}`}>
              {controlsAtRisk.length === 0 ? 'Sem risco crítico no momento' : 'Requer atenção imediata'}
            </span>
          </article>
        </div>

        <div className="mc-dashboard-grid">
          <article className="card mc-card-block mc-grid-span-8">
            <div className="mc-card-head">
              <h3>O que exige atenção hoje?</h3>
            </div>
            {attentionToday.length ? (
              <ul className="mc-insight-list">
                {attentionToday.map((item) => (
                  <li key={item.id}>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mc-muted-text">Nenhuma ação crítica aberta para hoje.</p>
            )}
          </article>

          <article className="card mc-card-block mc-grid-span-4">
            <div className="mc-card-head"><h3>Controles em risco</h3></div>
            <div className="mc-control-timeline">
              {controlsAtRisk.length ? controlsAtRisk.slice(0, 6).map((item) => (
                <article key={item.id} className="mc-control-timeline-item">
                  <header>
                    <strong>{item.title}</strong>
                    <span className={`mc-status ${item.status === 'NON_COMPLIANT' ? 'err' : 'warn'}`}>
                      {item.status === 'NON_COMPLIANT' ? 'Não conforme' : `${item.openFindingsCount ?? 0} finding(s)`}
                    </span>
                  </header>
                  <small>Responsável: {item.responsible}</small>
                </article>
              )) : <p className="mc-muted-text">Sem controles em risco.</p>}
            </div>
          </article>

          <article className="card mc-card-block mc-grid-span-6">
            <div className="mc-card-head"><h3>Execuções pendentes</h3></div>
            <ul className="mc-activity-list">
              {pendingExecutions.length ? pendingExecutions.slice(0, 6).map((item) => (
                <li key={item.id}>
                  <span>{item.title}</span>
                  <time>{item.lastExecutionAt ? new Date(item.lastExecutionAt).toLocaleDateString('pt-BR') : 'Sem execução'}</time>
                </li>
              )) : <li><span>Sem execuções pendentes no momento.</span><time>hoje</time></li>}
            </ul>
          </article>

          <article className="card mc-card-block mc-grid-span-6">
            <div className="mc-card-head"><h3>Leitura de risco do dia</h3></div>
            <ul className="mc-insight-list">
              <li>{openFindings} findings abertos exigem decisão operacional rastreável.</li>
              <li>{pendingExecutions.length} controles aguardam registro manual de execução.</li>
              <li>{controlsAtRisk.length} controles concentram risco operacional ativo.</li>
              <li>Priorize primeiro os controles não conformes e depois as pendências de execução.</li>
            </ul>
          </article>
        </div>
      </section>
    </AppShell>
  )
}
