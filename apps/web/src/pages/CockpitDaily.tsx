import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { useAuth } from '../auth'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

type CockpitPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM'
type CockpitCriticality = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

type AttentionItem = {
  id: string
  type: string
  severity: CockpitPriority
  title: string
  detail: string
  ctaLabel: string
  ctaPath: string
  occurredAt: string
}

type TodayEvent = {
  id: string
  type: string
  title: string
  description: string
  occurredAt: string
  ctaPath: string
}

type CockpitPayload = {
  criticality: CockpitCriticality
  pendingControls: number
  overdueExecutions: number
  openFindings: number
  criticalFindings: number
  pendingRecommendations: number
  pendingMenus: number
  attentionItems: AttentionItem[]
  todayEvents: TodayEvent[]
}

const priorityRank: Record<CockpitPriority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
}

const criticalityLabel: Record<CockpitCriticality, string> = {
  CRITICAL: 'Crítico',
  HIGH: 'Alto',
  MEDIUM: 'Moderado',
  LOW: 'Estável',
}

const criticalityClassName = (criticality: CockpitCriticality) => {
  if (criticality === 'CRITICAL') return 'err'
  if (criticality === 'HIGH') return 'warn'
  if (criticality === 'MEDIUM') return 'info'
  return 'ok'
}

const priorityClassName = (priority: CockpitPriority) => {
  if (priority === 'CRITICAL') return 'err'
  if (priority === 'HIGH') return 'warn'
  return 'info'
}

export function CockpitDailyPage() {
  const navigate = useNavigate()
  const { authState, logout } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cockpit, setCockpit] = useState<CockpitPayload | null>(null)

  useEffect(() => {
    if (!authState) {
      return
    }

    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`${API_URL}/dashboard/cockpit`, {
          headers: {
            Authorization: `Bearer ${authState.token}`,
          },
        })

        if (!response.ok) {
          throw new Error('Falha ao carregar cockpit diário.')
        }

        const payload = (await response.json()) as { status?: string } & CockpitPayload

        setCockpit({
          criticality: payload.criticality ?? 'LOW',
          pendingControls: payload.pendingControls ?? 0,
          overdueExecutions: payload.overdueExecutions ?? 0,
          openFindings: payload.openFindings ?? 0,
          criticalFindings: payload.criticalFindings ?? 0,
          pendingRecommendations: payload.pendingRecommendations ?? 0,
          pendingMenus: payload.pendingMenus ?? 0,
          attentionItems: payload.attentionItems ?? [],
          todayEvents: payload.todayEvents ?? [],
        })
      } catch (requestError) {
        setCockpit(null)
        setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar cockpit diário.')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [authState])

  const sortedAttentionItems = useMemo(() => {
    const source = cockpit?.attentionItems ?? []

    return [...source].sort((a, b) => {
      const byPriority = priorityRank[a.severity] - priorityRank[b.severity]

      if (byPriority !== 0) {
        return byPriority
      }

      return new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
    })
  }, [cockpit?.attentionItems])

  const pendingDecisions = useMemo(() => {
    return sortedAttentionItems.filter((item) => item.type === 'PENDING_MENU_DECISION')
  }, [sortedAttentionItems])

  const dueToday = useMemo(() => {
    return sortedAttentionItems.filter((item) => item.type === 'DUE_TODAY')
  }, [sortedAttentionItems])

  const recentFailures = useMemo(() => {
    return cockpit?.todayEvents.filter((item) => item.type === 'execution_failed') ?? []
  }, [cockpit?.todayEvents])

  const decisionsTotal = (cockpit?.pendingRecommendations ?? 0) + (cockpit?.pendingMenus ?? 0)

  const handleNavigate = (path: string) => {
    navigate(path)
  }

  return (
    <AppShell onLogout={logout}>
      <section className="mc-dashboard mc-cockpit-page">
        <header className="card mc-greeting mc-cockpit-hero">
          <div>
            <h1>O que exige atenção hoje?</h1>
            <p>
              Central operacional de conformidade para priorizar risco, decisão humana e execução diária.
            </p>
          </div>
          <div className="mc-cockpit-hero-status">
            <span className={`mc-status ${criticalityClassName(cockpit?.criticality ?? 'LOW')}`}>
              Criticidade {criticalityLabel[cockpit?.criticality ?? 'LOW']}
            </span>
            <button
              type="button"
              className="mc-action-run"
              disabled={loading}
              onClick={() => window.location.reload()}
            >
              {loading ? 'Atualizando...' : 'Atualizar visão'}
            </button>
          </div>
        </header>

        {error ? <p className="auth-error">{error}</p> : null}

        <div className="mc-kpis">
          <article className="card mc-kpi-card">
            <div className="mc-kpi-top"><p>Controles pendentes</p></div>
            <strong>{cockpit?.pendingControls ?? 0}</strong>
            <span className={`mc-trend ${(cockpit?.pendingControls ?? 0) === 0 ? 'is-positive' : ''}`}>
              {(cockpit?.pendingControls ?? 0) === 0 ? 'Sem pendências de ativação' : 'Exigem decisão operacional'}
            </span>
          </article>
          <article className="card mc-kpi-card">
            <div className="mc-kpi-top"><p>Execuções atrasadas</p></div>
            <strong>{cockpit?.overdueExecutions ?? 0}</strong>
            <span className={`mc-trend ${(cockpit?.overdueExecutions ?? 0) === 0 ? 'is-positive' : ''}`}>
              {(cockpit?.overdueExecutions ?? 0) === 0 ? 'Rotina diária em dia' : 'Priorizar execução hoje'}
            </span>
          </article>
          <article className="card mc-kpi-card">
            <div className="mc-kpi-top"><p>Findings abertos</p></div>
            <strong>{cockpit?.openFindings ?? 0}</strong>
            <span className={`mc-trend ${(cockpit?.openFindings ?? 0) === 0 ? 'is-positive' : ''}`}>
              {(cockpit?.openFindings ?? 0) === 0
                ? 'Sem findings em aberto'
                : `${cockpit?.criticalFindings ?? 0} crítico(s) exigem prioridade`}
            </span>
          </article>
          <article className="card mc-kpi-card">
            <div className="mc-kpi-top"><p>Decisões pendentes</p></div>
            <strong>{decisionsTotal}</strong>
            <span className={`mc-trend ${decisionsTotal === 0 ? 'is-positive' : ''}`}>
              {decisionsTotal === 0 ? 'Nenhuma decisão pendente' : 'Requer decisão humana registrada'}
            </span>
          </article>
        </div>

        <div className="mc-dashboard-grid">
          <article className="card mc-card-block mc-grid-span-8">
            <div className="mc-card-head"><h3>Lista de atenção priorizada</h3></div>
            {sortedAttentionItems.length ? (
              <ul className="mc-insight-list mc-cockpit-attention-list">
                {sortedAttentionItems.map((item) => (
                  <li key={item.id}>
                    <div className="mc-cockpit-attention-main">
                      <span className={`mc-status ${priorityClassName(item.severity)}`}>{item.severity}</span>
                      <strong>{item.title}</strong>
                      <p>{item.detail}</p>
                    </div>
                    <button type="button" className="mc-action-run" onClick={() => handleNavigate(item.ctaPath)}>
                      {item.ctaLabel}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mc-muted-text">Nenhuma pendência crítica aberta para hoje.</p>
            )}
          </article>

          <article className="card mc-card-block mc-grid-span-4">
            <div className="mc-card-head"><h3>Decisões pendentes</h3></div>
            <ul className="mc-activity-list">
              {pendingDecisions.length ? pendingDecisions.map((item) => (
                <li key={item.id}>
                  <span>{item.title}</span>
                  <button type="button" className="mc-action-run" onClick={() => handleNavigate(item.ctaPath)}>
                    Decidir
                  </button>
                </li>
              )) : <li><span>Sem decisões pendentes.</span><time>hoje</time></li>}
            </ul>
          </article>

          <article className="card mc-card-block mc-grid-span-6">
            <div className="mc-card-head"><h3>Execução do dia</h3></div>
            <h4 className="mc-cockpit-subtitle">Controles que vencem hoje</h4>
            <ul className="mc-activity-list">
              {dueToday.length ? dueToday.map((item) => (
                <li key={item.id}>
                  <span>{item.title}</span>
                  <button type="button" className="mc-action-run" onClick={() => handleNavigate(item.ctaPath)}>
                    Executar
                  </button>
                </li>
              )) : <li><span>Sem controles vencendo hoje.</span><time>ok</time></li>}
            </ul>

            <h4 className="mc-cockpit-subtitle">Falhas recentes</h4>
            <ul className="mc-activity-list">
              {recentFailures.length ? recentFailures.map((item) => (
                <li key={item.id}>
                  <span>{item.title}</span>
                  <button type="button" className="mc-action-reject" onClick={() => handleNavigate(item.ctaPath)}>
                    Tratar
                  </button>
                </li>
              )) : <li><span>Sem falhas recentes hoje.</span><time>ok</time></li>}
            </ul>
          </article>

          <article className="card mc-card-block mc-grid-span-6">
            <div className="mc-card-head"><h3>Timeline curta</h3></div>
            <ul className="mc-activity-list">
              {cockpit?.todayEvents.length ? cockpit.todayEvents.map((event) => (
                <li key={event.id}>
                  <span>
                    <strong>{event.title}</strong>
                    <p className="mc-muted-text">{event.description}</p>
                  </span>
                  <button type="button" className="mc-action-run" onClick={() => handleNavigate(event.ctaPath)}>
                    Ver
                  </button>
                </li>
              )) : <li><span>Sem eventos relevantes registrados hoje.</span><time>hoje</time></li>}
            </ul>
          </article>
        </div>
      </section>
    </AppShell>
  )
}
