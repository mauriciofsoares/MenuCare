import { useEffect, useState } from 'react'
import { AppShell } from '../components/layout/AppShell'
import { useAuth } from '../auth'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

type MenuItem = {
  id: string
  fileName: string
  unitName: string
  serviceName: string
  validationStatus: string
  referenceDate: string
}

export function MenusPage() {
  const { authState, logout } = useAuth()
  const [menus, setMenus] = useState<MenuItem[]>([])

  useEffect(() => {
    if (!authState) {
      return
    }

    const load = async () => {
      const response = await fetch(`${API_URL}/menus/imports?limit=20`, {
        headers: { Authorization: `Bearer ${authState.token}` },
      })

      if (!response.ok) {
        setMenus([])
        return
      }

      const payload = (await response.json()) as { imports?: MenuItem[] }
      setMenus(payload.imports ?? [])
    }

    void load()
  }, [authState])

  return (
    <AppShell onLogout={logout}>
      <section className="card mc-table-card">
        <div className="mc-card-head"><h2>Cardápios</h2></div>
        <table>
          <thead>
            <tr>
              <th>Arquivo</th>
              <th>Unidade</th>
              <th>Status</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            {menus.length ? menus.map((item) => (
              <tr key={item.id}>
                <td>{item.fileName}</td>
                <td>{item.unitName} / {item.serviceName}</td>
                <td><span className="mc-badge">{item.validationStatus}</span></td>
                <td>{new Date(item.referenceDate).toLocaleDateString('pt-BR')}</td>
              </tr>
            )) : (
              <tr><td colSpan={4}>Nenhum cardápio encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </AppShell>
  )
}
