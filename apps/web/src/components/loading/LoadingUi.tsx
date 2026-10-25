import { Component, type ErrorInfo, type ReactNode } from 'react'

type SpinnerSize = 'sm' | 'md' | 'lg'

export function NotionSpinner({ size = 'md', label = 'Loading' }: { size?: SpinnerSize; label?: string }) {
  return <span className={`notion-spinner notion-spinner--${size}`} role="status" aria-label={label}><span aria-hidden="true" /></span>
}

export function LoadingLabel({ children, size = 'sm' }: { children: ReactNode; size?: SpinnerSize }) {
  return <span className="loading-label"><NotionSpinner size={size} label={typeof children === 'string' ? children : 'Loading'} />{children}</span>
}

function Bone({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`loading-bone ${className}`} />
}

export function DashboardSkeleton() {
  return <div className="loading-skeleton" role="status" aria-label="Loading dashboard">
    <div className="loading-skeleton-heading"><Bone className="bone-title" /><Bone className="bone-copy" /></div>
    <div className="loading-stat-grid">{[0, 1, 2, 3].map((key) => <div className="loading-stat-card" key={key}><Bone className="bone-icon" /><div><Bone className="bone-value" /><Bone className="bone-label" /></div></div>)}</div>
    <div className="loading-dashboard-grid"><div className="loading-panel"><Bone className="bone-section-title" />{[0, 1, 2, 3].map((key) => <div className="loading-event-row" key={key}><Bone className="bone-icon" /><div><Bone className="bone-label" /><Bone className="bone-copy" /></div></div>)}</div><div className="loading-panel"><Bone className="bone-section-title" /><Bone className="bone-chart" /></div></div>
  </div>
}

export function DashboardStatsSkeleton() {
  return <div className="loading-stat-grid" role="status" aria-label="Loading dashboard statistics">{[0, 1, 2, 3].map((key) => <div className="loading-stat-card" key={key}><Bone className="bone-icon" /><div><Bone className="bone-value" /><Bone className="bone-label" /></div></div>)}</div>
}

export function EventRowsSkeleton() {
  return <div className="loading-skeleton" role="status" aria-label="Loading upcoming events">{[0, 1, 2].map((key) => <div className="loading-event-row" key={key}><Bone className="bone-icon" /><div><Bone className="bone-label" /><Bone className="bone-copy" /></div></div>)}</div>
}

export function EventListSkeleton() {
  return <div className="loading-skeleton loading-panel" role="status" aria-label="Loading events"><div className="loading-toolbar"><Bone className="bone-search" /><Bone className="bone-filter" /></div>{[0, 1, 2, 3, 4].map((key) => <div className="loading-table-row" key={key}><Bone className="bone-title" /><Bone className="bone-copy" /><Bone className="bone-copy" /><Bone className="bone-icon" /></div>)}</div>
}

export function TableSkeleton({ label = 'Loading records', columns = 5 }: { label?: string; columns?: number }) {
  const gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`
  return <div className="loading-skeleton loading-table" role="status" aria-label={label}><div className="loading-table-row loading-table-head" style={{ gridTemplateColumns }}>{Array.from({ length: columns }, (_, key) => <Bone key={key} className="bone-label" />)}</div>{[0, 1, 2, 3, 4].map((row) => <div className="loading-table-row" style={{ gridTemplateColumns }} key={row}>{Array.from({ length: columns }, (_, key) => <Bone key={key} className={key === 0 ? 'bone-title' : 'bone-copy'} />)}</div>)}</div>
}

export function CertificateListSkeleton() {
  return <div className="loading-skeleton" role="status" aria-label="Loading certificates"><div className="loading-toolbar"><Bone className="bone-search" /><Bone className="bone-filter" /></div>{[0, 1, 2].map((key) => <div className="loading-certificate-row" key={key}><div><Bone className="bone-title" /><Bone className="bone-copy" /><Bone className="bone-copy" /></div><Bone className="bone-actions" /></div>)}</div>
}

export function DetailSkeleton({ label = 'Loading details' }: { label?: string }) {
  return <div className="loading-skeleton loading-detail" role="status" aria-label={label}><Bone className="bone-copy" /><Bone className="bone-title" /><Bone className="bone-copy" /><div className="loading-detail-panel">{[0, 1, 2, 3].map((key) => <div key={key}><Bone className="bone-label" /><Bone className="bone-copy" /></div>)}</div></div>
}

export function AuthShellSkeleton() {
  return <main className="auth-shell" role="status" aria-label="Restoring your session"><section className="auth-card loading-skeleton"><Bone className="bone-copy" /><Bone className="bone-title" /><Bone className="bone-copy" /><Bone className="bone-copy" /></section></main>
}

type BoundaryProps = { children: ReactNode; fallback?: ReactNode }
type BoundaryState = { failed: boolean }

export class RouteErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false }

  static getDerivedStateFromError(): BoundaryState { return { failed: true } }

  componentDidCatch(_error: Error, _info: ErrorInfo) {}

  render() {
    if (!this.state.failed) return this.props.children
    return this.props.fallback ?? <main className="route-load-error" role="alert"><h1>This page could not be loaded</h1><p>Check your connection and try again.</p><button type="button" onClick={() => window.location.reload()}>Reload page</button></main>
  }
}
