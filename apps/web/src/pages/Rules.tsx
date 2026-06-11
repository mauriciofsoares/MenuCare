import { useEffect, useState } from 'react'
import { AppShell } from '../components/layout/AppShell'
import { useAuth } from '../auth'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

type RuleItem = {
  id: string
  title: string
  description: string
  sourceExcerpt?: string | null
  category: string
  status: string
  createdAt: string
}

const CATEGORY_LABELS: Record<string, string> = {
  nutrition: 'Nutrição',
  management: 'Gestão',
  legal: 'Jurídico',
  compliance: 'Conformidade',
  operations: 'Operações',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Aguardando validação',
  approved: 'Validada',
  rejected: 'Recusada',
}

function getCategoryLabel(category: string) {
  return CATEGORY_LABELS[category] ?? category
}

function getStatusLabel(status: string) {
  return STATUS_LABELS[status] ?? status
}

export function RulesPage() {
  const { authState, logout } = useAuth()
  const [rules, setRules] = useState<RuleItem[]>([])
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null)

  useEffect(() => {
    if (!authState) {
      return
    }

    const load = async () => {
      const response = await fetch(`${API_URL}/rules?limit=30`, {
        headers: { Authorization: `Bearer ${authState.token}` },
      })

      if (!response.ok) {
        setRules([])
        return
      }

      const payload = (await response.json()) as { rules?: RuleItem[] }
      setRules(payload.rules ?? [])
    }

    void load()
  }, [authState])

  const handleDeleteRule = async (ruleId: string) => {
    if (!authState) {
      return
    }

    setDeletingRuleId(ruleId)

    try {
      const response = await fetch(`${API_URL}/rules/${encodeURIComponent(ruleId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authState.token}` },
      })

      if (!response.ok) {
        throw new Error('Falha ao excluir regra.')
      }

      setRules((current) => current.filter((rule) => rule.id !== ruleId))
    } catch {
      // Mantem a lista atual quando a exclusao falha.
    } finally {
      setDeletingRuleId(null)
    }
  }

  return (
    <AppShell onLogout={logout}>
      <section className="card mc-table-card">
        <div className="mc-card-head"><h2>Regras contratuais</h2></div>
        <table>
          <thead>
            <tr>
              <th>Título</th>
              <th>Categoria</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rules.length ? rules.map((rule) => (
              <tr key={rule.id}>
                <td>{rule.title}</td>
                <td>{getCategoryLabel(rule.category)}</td>
                <td><span className="mc-badge">{getStatusLabel(rule.status)}</span></td>
                <td>
                  {rule.status === 'rejected' ? (
                    <button
                      type="button"
                      className="mc-action-delete"
                      disabled={deletingRuleId === rule.id}
                      onClick={() => void handleDeleteRule(rule.id)}
                    >
                      {deletingRuleId === rule.id ? 'Excluindo...' : 'Excluir'}
                    </button>
                  ) : (
                    <span className="mc-muted-text">Sem ações</span>
                  )}
                </td>
              </tr>
            )) : (
              <tr><td colSpan={4}>Nenhuma regra encontrada.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </AppShell>
  )
}
