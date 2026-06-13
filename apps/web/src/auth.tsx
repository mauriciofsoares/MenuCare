import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
const STORAGE_KEY = 'menucare.auth'

type SessionUser = {
  id: string
  name: string
  email: string
  companyName: string
  accessProfile: string
}

export type AuthorizedSite = {
  id: string
  tenantId: string
  name: string
  city: string | null
  state: string | null
  role: string
}

type AuthState = {
  token: string
  user: SessionUser
  authorizedSites: AuthorizedSite[]
}

type AuthContextValue = {
  authState: AuthState | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)

    if (!stored) {
      setLoading(false)
      return
    }

    const hydrate = async () => {
      try {
        const parsed = JSON.parse(stored) as AuthState
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${parsed.token}` },
        })

        if (!response.ok) {
          throw new Error('Sessão expirada')
        }

        const payload = (await response.json()) as { user: SessionUser; authorizedSites?: AuthorizedSite[] }
        const nextState = { token: parsed.token, user: payload.user, authorizedSites: payload.authorizedSites ?? [] }
        setAuthState(nextState)
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState))
      } catch {
        window.localStorage.removeItem(STORAGE_KEY)
        setAuthState(null)
      } finally {
        setLoading(false)
      }
    }

    void hydrate()
  }, [])

  const login = async (email: string, password: string) => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
      throw new Error('Credenciais inválidas')
    }

    const payload = (await response.json()) as { token: string; user: SessionUser }
    const meResponse = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${payload.token}` },
    })
    const mePayload = meResponse.ok
      ? ((await meResponse.json()) as { authorizedSites?: AuthorizedSite[] })
      : { authorizedSites: [] }
    const nextState = {
      token: payload.token,
      user: payload.user,
      authorizedSites: mePayload.authorizedSites ?? [],
    }

    setAuthState(nextState)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState))
  }

  const logout = async () => {
    if (authState) {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authState.token}` },
      })
    }

    setAuthState(null)
    window.localStorage.removeItem(STORAGE_KEY)
  }

  const value = useMemo<AuthContextValue>(() => ({
    authState,
    loading,
    login,
    logout,
  }), [authState, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider')
  }

  return context
}
