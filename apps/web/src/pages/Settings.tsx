import { AppShell } from '../components/layout/AppShell'
import { useAuth } from '../auth'

export function SettingsPage() {
  const { logout } = useAuth()

  return (
    <AppShell onLogout={logout}>
      <section className="card mc-table-card">
        <h2>Configurações</h2>
        <p>Módulo em evolução. Em breve, preferências operacionais e governança avançada.</p>
      </section>
    </AppShell>
  )
}
