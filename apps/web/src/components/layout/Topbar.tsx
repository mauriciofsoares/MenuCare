type TopbarProps = {
  onToggleSidebar: () => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  onLogout: () => void
}

export function Topbar({ onToggleSidebar, theme, onToggleTheme, onLogout }: TopbarProps) {
  return (
    <header className="mc-topbar">
      <button type="button" className="mc-icon-btn" onClick={onToggleSidebar} aria-label="Alternar sidebar">
        ☰
      </button>

      <label className="mc-search">
        <span>⌕</span>
        <input type="search" placeholder="Buscar contratos, regras, cardápios..." />
      </label>

      <div className="mc-topbar-actions">
        <select defaultValue="30">
          <option value="30">Últimos 30 dias</option>
          <option value="90">Últimos 90 dias</option>
          <option value="365">Ano atual</option>
        </select>
        <button type="button" className="mc-icon-btn" aria-label="Notificações">🔔</button>
        <button type="button" className="mc-icon-btn" onClick={onToggleTheme} aria-label="Alternar tema">
          {theme === 'dark' ? '🌙' : '☀'}
        </button>
        <button type="button" className="mc-icon-btn" onClick={onLogout} aria-label="Sair">↦</button>
      </div>
    </header>
  )
}
