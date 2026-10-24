import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import './navigation.css'

export function BackButton({ to }: { to: string }) {
  return <Link className="route-back-button" to={to} aria-label="Back" title="Back">
    <ArrowLeft aria-hidden="true" size={16} />
    <span>Back</span>
  </Link>
}
