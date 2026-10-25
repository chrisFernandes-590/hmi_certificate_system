import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { AccountMenu } from './AccountMenu'

export function ParticipantLayout({ children }: { children: ReactNode }) {
  return <div className="participant-layout">
    <header className="participant-topbar">
      <Link className="certify-wordmark" to="/">Certify</Link>
      <nav aria-label="Participant navigation">
        <NavLink to="/app">Home</NavLink>
        <NavLink to="/app/explore">Explore events</NavLink>
        <NavLink to="/app/events">My events</NavLink>
        <NavLink to="/app/certificates">My certificates</NavLink>
        <NavLink to="/verify">Verify a certificate</NavLink>
      </nav>
      <AccountMenu />
    </header>
    <div className="participant-content">{children}</div>
    <footer className="participant-footer"><Link className="certify-wordmark" to="/">Certify</Link><span>Create. Issue. Verify.</span></footer>
  </div>
}
