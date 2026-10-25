import type { ReactNode } from 'react'
import { LoadingLabel } from '../../../components/loading/LoadingUi'

export function AuthSubmitButton({ busy, children }: { busy: boolean; children: ReactNode }) {
  return <button className="auth-submit" type="submit" disabled={busy} aria-busy={busy}>{busy ? <LoadingLabel>{children}</LoadingLabel> : children}</button>
}
