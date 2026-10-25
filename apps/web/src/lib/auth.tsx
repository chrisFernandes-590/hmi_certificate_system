import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { apiFetch, apiRequest, type Profile, type User } from './api-client'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)
  const refresh = useCallback(async () => {
    try {
      const result = await apiRequest<{ user: User }>('/me')
      setUser(result.user)
      const profileResult = await apiFetch<{ profiles: Profile[]; activeProfileId: string | null }>('/profiles')
      setProfiles(profileResult.profiles)
      setActiveProfileId(profileResult.activeProfileId)
    } catch {
      setUser(null)
      setProfiles([])
      setActiveProfileId(null)
    } finally {
      setLoading(false)
    }
  }, [])
  const logout = useCallback(async () => {
    await apiRequest('/logout', { method: 'POST' })
    queryClient.clear()
    setUser(null)
    setProfiles([])
    setActiveProfileId(null)
  }, [queryClient])
  const switchProfile = useCallback(async (type: Profile['type']) => {
    await apiFetch('/profiles/active', { method: 'POST', body: JSON.stringify({ type }) })
    await refresh()
  }, [refresh])
  const createOrganizer = useCallback(async (input: { displayName: string; institution?: string; roleLabel: Profile['roleLabel']; bio?: string; termsAccepted: true }) => {
    const result = await apiFetch<{ profile: Profile }>('/profiles/organizer', { method: 'POST', body: JSON.stringify(input) })
    await refresh()
    return result.profile
  }, [refresh])
  useEffect(() => { void Promise.resolve().then(refresh) }, [refresh])
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) ?? null
  const value = useMemo(() => ({ user, loading, profiles, activeProfile, refresh, switchProfile, createOrganizer, logout }), [user, loading, profiles, activeProfile, refresh, switchProfile, createOrganizer, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

