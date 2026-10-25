import { createContext } from 'react'
import type { Profile, User } from './api-client'

export type AuthContextValue = { user: User | null; loading: boolean; profiles: Profile[]; activeProfile: Profile | null; refresh: () => Promise<void>; switchProfile: (type: Profile['type']) => Promise<void>; createOrganizer: (input: { displayName: string; institution?: string; roleLabel: Profile['roleLabel']; bio?: string; termsAccepted: true }) => Promise<Profile>; logout: () => Promise<void> }
export const AuthContext = createContext<AuthContextValue | null>(null)
