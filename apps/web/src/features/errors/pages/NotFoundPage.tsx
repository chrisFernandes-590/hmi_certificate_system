import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../../../components/ui/button'
import { useAuth } from '../../../lib/use-auth'
import { NotFoundIllustration } from '../components/NotFoundIllustration'
import '../styles/not-found.css'

export function NotFoundPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const fallback = user ? '/admin/dashboard' : '/login'

  return <main className="not-found-page">
    <section className="not-found-content" aria-labelledby="not-found-heading">
      <Link className="not-found-wordmark" to="/" aria-label="Certify home">Certify</Link>
      <NotFoundIllustration />
      <p className="not-found-code">404</p>
      <h1 id="not-found-heading">Page not found</h1>
      <p className="not-found-description">The page you’re looking for doesn’t exist or may have been moved.</p>
      <div className="not-found-actions">
        <Button className="not-found-button" size="lg" type="button" onClick={() => navigate(fallback)}>{user ? 'Back to dashboard' : 'Back to sign in'}</Button>
      </div>
    </section>
  </main>
}
