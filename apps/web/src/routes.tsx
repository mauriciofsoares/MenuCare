import type { ReactElement } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth'
import { LoginPage } from './pages/Login'
import { CockpitDailyPage } from './pages/CockpitDaily'
import { ContractsPage } from './pages/Contracts'
import { ContractRulesPage } from './pages/ContractRules'
import { RulesPage } from './pages/Rules'
import { MenusPage } from './pages/Menus'
import { CompliancePage } from './pages/Compliance'
import { ComplianceControlDetailPage } from './pages/ComplianceControlDetail'
import { SettingsPage } from './pages/Settings'

function ProtectedRoute({ children }: { children: ReactElement }) {
  const { authState, loading } = useAuth()

  if (loading) {
    return <main className="mc-login-page"><section className="mc-login-card">Validando sessão...</section></main>
  }

  if (!authState) {
    return <Navigate to="/login" replace />
  }

  return children
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<ProtectedRoute><CockpitDailyPage /></ProtectedRoute>} />
      <Route path="/contracts" element={<ProtectedRoute><ContractsPage /></ProtectedRoute>} />
      <Route path="/contracts/:id/rules" element={<ProtectedRoute><ContractRulesPage /></ProtectedRoute>} />
      <Route path="/rules" element={<ProtectedRoute><RulesPage /></ProtectedRoute>} />
      <Route path="/menus" element={<ProtectedRoute><MenusPage /></ProtectedRoute>} />
      <Route path="/compliance" element={<ProtectedRoute><CompliancePage /></ProtectedRoute>} />
      <Route path="/compliance/:controlId" element={<ProtectedRoute><ComplianceControlDetailPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
