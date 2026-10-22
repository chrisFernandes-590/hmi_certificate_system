import { Redirect } from 'expo-router'
import { useAuth } from '@/contexts/auth'
import { Loader } from '@/components/ui'

export default function Index() {
  const { user, loading } = useAuth()
  if (loading) return <Loader text="Restoring session…" />
  return <Redirect href={user ? '/(app)' : '/(auth)/login'} />
}
