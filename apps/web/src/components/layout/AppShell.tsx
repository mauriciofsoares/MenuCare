import { useEffect, useState, type ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

type AppShellProps = {
  children: ReactNode
  onLogout: () => void
}

const THEME_STORAGE_KEY = 'menucare.theme'
const SIDEBAR_STORAGE_KEY = 'menucare.sidebar.collapsed'

export function AppShell({ children, onLogout }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('light')

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
    const storedCollapsed = window.localStorage.getItem(SIDEBAR_STORAGE_KEY)

    if (storedTheme === 'light' || storedTheme === 'dark') {
      setTheme(storedTheme)
    }

    if (storedCollapsed === '1') {
      setCollapsed(true)
    }
  }, [])

  useEffect(() => {
    window.document.body.setAttribute('data-theme', theme)
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  return (
    <div className={`mc-shell ${collapsed ? 'is-collapsed' : ''}`}>
      <Sidebar collapsed={collapsed} />
      <div className="mc-main">
        <Topbar
          onToggleSidebar={() => setCollapsed((current) => !current)}
          theme={theme}
          onToggleTheme={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
          onLogout={onLogout}
        />
        <div className="mc-page">{children}</div>
      </div>
    </div>
  )
}
