import { NavLink } from 'react-router-dom'

type SidebarProps = {
  collapsed: boolean
}

const navItems = [
  { label: 'Cockpit Diário', to: '/dashboard', icon: '🏠' },
  { label: 'Contratos', to: '/contracts', icon: '📁' },
  { label: 'Regras Contratuais', to: '/rules', icon: '📋' },
  { label: 'Cardápios', to: '/menus', icon: '🍽️' },
  { label: 'Conformidade', to: '/compliance', icon: '✅' },
  { label: 'Análises', to: '/settings', icon: '📊', disabled: true },
  { label: 'Configurações', to: '/settings', icon: '⚙️' },
]

export function Sidebar({ collapsed }: SidebarProps) {
  return (
    <aside className={`mc-sidebar ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="mc-brand">
        <img className="mc-brand-logo" src="/menucare-logo.png" alt="Logo MenuCare" />
        <span className="mc-brand-name">
          Menu<span className="mc-brand-care">Care</span>
        </span>
      </div>

      <nav className="mc-nav">
        {navItems.map((item) =>
          item.disabled ? (
            <span key={item.label} className="mc-nav-disabled" aria-disabled="true">
              <span className="mc-nav-icon" aria-hidden="true">{item.icon}</span>
              <span className="mc-nav-label">{item.label}</span>
            </span>
          ) : (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'is-active' : '')}>
              <span className="mc-nav-icon" aria-hidden="true">{item.icon}</span>
              <span className="mc-nav-label">{item.label}</span>
            </NavLink>
          )
        )}
      </nav>

      <footer className="mc-sidebar-footer">
        <div className="mc-avatar">MS</div>
        <div className="mc-user-meta">
          <strong>Mariana Soares</strong>
          <small>Gestora de Operações</small>
        </div>
        <button type="button" className="mc-more">...</button>
      </footer>
    </aside>
  )
}
