import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export type BreadcrumbItem = { label: string; to?: string }

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return <nav className="route-breadcrumbs" aria-label="Breadcrumb">
    <ol>
      {items.map((item, index) => {
        const current = index === items.length - 1
        return <li key={`${item.label}-${index}`}>
          {index > 0 && <ChevronRight aria-hidden="true" size={14} />}
          {item.to && !current
            ? <Link to={item.to}>{item.label}</Link>
            : <span aria-current={current ? 'page' : undefined}>{item.label}</span>}
        </li>
      })}
    </ol>
  </nav>
}
