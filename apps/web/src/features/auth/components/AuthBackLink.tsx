import { BackButton } from '../../navigation/BackButton'

export function AuthBackLink({ to = '/login' }: { to?: string }) {
  return <BackButton to={to} />
}
