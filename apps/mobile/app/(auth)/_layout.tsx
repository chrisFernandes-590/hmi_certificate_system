import { Redirect, Stack } from 'expo-router'
import React from 'react'
import { useAuth } from '@/contexts/auth'
import { Loader } from '@/components/ui'
import { colors } from '@/lib/design'

export default function AuthLayout() {
  const { user, loading } = useAuth()

  if (loading) return <Loader text="Restoring session…" />
  // If already authenticated, redirect to the app.
  if (user) return <Redirect href="/(app)" />

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bgCard },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  )
}
