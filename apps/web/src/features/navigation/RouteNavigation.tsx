import { useQuery } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import type { EventData } from '@hmi/shared'
import { apiFetch } from '../../lib/api-client'
import { BackButton } from './BackButton'
import { Breadcrumbs, type BreadcrumbItem } from './Breadcrumbs'

type Navigation = { backTo?: string; items: BreadcrumbItem[] }
const dashboard = { label: 'Dashboard', to: '/admin/dashboard' }
const events = { label: 'Events', to: '/admin/events' }

export function RouteNavigation() {
  const { pathname } = useLocation()
  const path = pathname.replace(/\/+$/, '') || '/'
  const eventId = path.match(/^\/(?:admin\/events|admin\/participants|admin\/certificates|events)\/([^/]+)(?:\/edit)?$/)?.[1]
  const event = useQuery({
    queryKey: ['events', eventId],
    queryFn: () => apiFetch<EventData>(`/events/${eventId}`),
    enabled: Boolean(eventId && eventId !== 'new'),
  })
  const eventLabel = event.data?.event.name ?? 'Event'
  const navigation = routeNavigation(path, eventLabel)
  const showBack = navigation.backTo

  return <div className="route-navigation">
    {showBack && <BackButton to={navigation.backTo!} />}
    <Breadcrumbs items={navigation.items} />
  </div>
}

function routeNavigation(path: string, eventName: string): Navigation {
  if (path === '/admin/dashboard') return { items: [{ label: 'Dashboard' }] }
  if (path === '/admin/events') return { backTo: '/admin/dashboard', items: [dashboard, { label: 'Events' }] }
  if (path === '/admin/events/new') return { backTo: '/admin/events', items: [dashboard, events, { label: 'Create event' }] }

  const adminEdit = path.match(/^\/admin\/events\/([^/]+)\/edit$/)
  if (adminEdit) return { backTo: `/admin/events/${adminEdit[1]}`, items: [dashboard, events, { label: eventName, to: `/admin/events/${adminEdit[1]}` }, { label: 'Edit event' }] }
  const adminEvent = path.match(/^\/admin\/events\/([^/]+)$/)
  if (adminEvent) return { backTo: '/admin/events', items: [dashboard, events, { label: eventName }] }

  const adminParticipant = path.match(/^\/admin\/participants\/([^/]+)$/)
  if (adminParticipant) return { backTo: `/admin/events/${adminParticipant[1]}`, items: [dashboard, events, { label: eventName, to: `/admin/events/${adminParticipant[1]}` }, { label: 'Participants' }] }
  if (path === '/admin/participants') return { backTo: '/admin/dashboard', items: [dashboard, { label: 'Participants' }] }

  const adminCertificate = path.match(/^\/admin\/certificates\/([^/]+)$/)
  if (adminCertificate) return { backTo: `/admin/events/${adminCertificate[1]}`, items: [dashboard, events, { label: eventName, to: `/admin/events/${adminCertificate[1]}` }, { label: 'Certificates' }] }
  if (path === '/admin/certificates') return { backTo: '/admin/dashboard', items: [dashboard, { label: 'Certificates' }] }
  const adminMyCertificate = path.match(/^\/admin\/my-certificates\/([^/]+)$/)
  if (adminMyCertificate) return { backTo: '/admin/my-certificates', items: [dashboard, { label: 'My certificates', to: '/admin/my-certificates' }, { label: 'Certificate details' }] }
  if (path === '/admin/my-certificates') return { backTo: '/admin/dashboard', items: [dashboard, { label: 'My certificates' }] }

  if (path === '/events') return { backTo: '/admin/dashboard', items: [dashboard, events] }
  if (path === '/events/new') return { backTo: '/events', items: [dashboard, events, { label: 'Create event' }] }
  const edit = path.match(/^\/events\/([^/]+)\/edit$/)
  if (edit) return { backTo: `/events/${edit[1]}`, items: [dashboard, events, { label: eventName, to: `/events/${edit[1]}` }, { label: 'Edit event' }] }
  const eventDetails = path.match(/^\/events\/([^/]+)$/)
  if (eventDetails) return { backTo: '/events', items: [dashboard, events, { label: eventName }] }
  if (path === '/certificates') return { backTo: '/admin/dashboard', items: [dashboard, { label: 'My certificates' }] }
  if (/^\/certificates\/[^/]+$/.test(path)) return { backTo: '/certificates', items: [dashboard, { label: 'My certificates', to: '/certificates' }, { label: 'Certificate details' }] }
  if (path === '/account') return { backTo: '/admin/dashboard', items: [dashboard, { label: 'Your account' }] }
  return { items: [dashboard] }
}
