import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { CalendarDays, FileBadge, LayoutDashboard, Menu, Moon, Sun, Users, X } from 'lucide-react'
import { RouteNavigation } from '../../navigation/RouteNavigation'
import { AccountMenu } from './AccountMenu'

const adminNavigation = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/events', label: 'Events', icon: CalendarDays },
  { to: '/admin/participants', label: 'Participants', icon: Users },
  { to: '/admin/certificates', label: 'Certificates', icon: FileBadge },
]

export function AdminLayout({ children, roleLabel = 'Admin', title = 'Dashboard' }: { children: ReactNode; roleLabel?: string; title?: string }) {
  const { pathname } = useLocation()
  const routePath = pathname.replace(/\/+$/, '') || '/'
  const navigate = useNavigate()
  const [dark, setDark] = useState(() => {
    const saved = window.localStorage.getItem('certify-theme')
    return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])
  useEffect(() => {
    if (!mobileNavOpen) return
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileNavOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [mobileNavOpen])
  function toggleTheme() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    window.localStorage.setItem('certify-theme', next ? 'dark' : 'light')
  }
  return <div className="admin-layout">
    <aside id="admin-navigation" className={`admin-sidebar${mobileNavOpen ? ' is-open' : ''}`}>
      <div className="admin-brand"><NavLink className="certify-wordmark" to="/admin/dashboard" onClick={() => setMobileNavOpen(false)}>Certify</NavLink><span className="admin-role-pill">{roleLabel}</span><button className="admin-mobile-close" type="button" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)}><X size={18} /></button></div>
      <nav aria-label="Administration">
        {adminNavigation.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setMobileNavOpen(false)} className={({ isActive }) => `admin-nav-link${isActive ? ' is-active' : ''}`}><Icon aria-hidden="true" /><span>{label}</span></NavLink>)}
      </nav>
      <div className="admin-user-block"><AccountMenu /></div>
    </aside>
    {mobileNavOpen && <button className="admin-nav-backdrop" type="button" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
    <div className="admin-main">
      <header className="admin-topbar">
        <button className="admin-mobile-menu" type="button" aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'} aria-controls="admin-navigation" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen((open) => !open)}>{mobileNavOpen ? <X size={18} /> : <Menu size={18} />}</button>
        <h1 className="admin-topbar-title">{title}</h1>
        <div className="admin-topbar-actions"><button className="admin-icon-button admin-theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`} title={`Switch to ${dark ? 'light' : 'dark'} mode`}>{dark ? <Sun size={17} /> : <Moon size={17} />}</button><button className="admin-create-event" type="button" onClick={() => navigate('/admin/events/new')}>+ Create event</button></div>
      </header>
      <main className="admin-page-content">{!['/admin/events', '/admin/participants', '/admin/certificates'].includes(routePath) && <RouteNavigation />}{children}</main>
    </div>
  </div>
}
