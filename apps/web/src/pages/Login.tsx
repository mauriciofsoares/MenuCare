import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth'

export function LoginPage() {
  const { authState, login } = useAuth()
  const [email, setEmail] = useState('admin@menucare.local')
  const [password, setPassword] = useState('Admin@123')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      await login(email, password)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Falha no login')
    } finally {
      setSubmitting(false)
    }
  }

  if (authState) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <main className="mc-login-page">
      <section className="mc-login-card">
        <div className="mc-login-logo">
          M <span>MenuCare</span>
        </div>

        <form className="mc-auth-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>

          <label>
            Senha
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>

          {error ? <p className="auth-error">{error}</p> : null}

          <button type="submit" className="mc-login-button" disabled={submitting}>
            {submitting ? 'Entrando...' : 'Entrar no portal'}
          </button>
        </form>

        <aside className="mc-demo-box">
          <strong>Conta demo</strong>
          <p>admin@menucare.local</p>
          <p>Admin@123</p>
        </aside>
      </section>
    </main>
  )
}
