import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { PublicUser } from '@hmi/shared'
import { apiGet, apiPost, setTokenGetter, setUnauthorizedHandler } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'
import { clearToken, loadToken, saveToken } from '@/lib/storage'

export type AuthUser = PublicUser

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  accessToken: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const queryClient = useQueryClient()
  const tokenRef = useRef<string | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)

  // Inject the token getter into the API client so all requests can include it.
  setTokenGetter(() => tokenRef.current)

  // An authenticated request got 401: the session is gone — clear everything.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      tokenRef.current = null
      setAccessToken(null)
      setUser(null)
      queryClient.clear()
      void clearToken()
    })
    return () => setUnauthorizedHandler(null)
  }, [queryClient])

  const restoreSession = useCallback(async () => {
    try {
      const stored = await loadToken()
      if (stored) {
        tokenRef.current = stored
        setAccessToken(stored)
        // Verify the token is still valid by fetching the current user
        const result = await apiGet<{ user: AuthUser }>('/auth/me')
        setUser(result.user)
      }
    } catch {
      // Token is invalid or expired — clear it
      tokenRef.current = null
      setAccessToken(null)
      await clearToken()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void restoreSession()
  }, [restoreSession])

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiPost<{ user: AuthUser; accessToken: string; expiresAt: string }>(
      '/auth/login',
      { email, password },
    )
    // Native login returns an accessToken (see app.ts login route, X-Auth-Client: native check)
    tokenRef.current = result.accessToken
    setAccessToken(result.accessToken)
    await saveToken(result.accessToken)
    setUser(result.user)
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiPost('/auth/logout')
    } catch {
      /* best-effort logout — always clear local state */
    } finally {
      tokenRef.current = null
      setAccessToken(null)
      await clearToken()
      setUser(null)
      queryClient.clear()
    }
  }, [queryClient])

  const refresh = useCallback(async () => {
    try {
      const result = await apiGet<{ user: AuthUser }>('/auth/me')
      setUser(result.user)
    } catch {
      tokenRef.current = null
      setAccessToken(null)
      await clearToken()
      setUser(null)
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, accessToken, login, logout, refresh }),
    [user, loading, accessToken, login, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
