import React, { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/contexts/auth'
import { colors } from '@/lib/design'

// Prevent auto-hide until the app is ready.
SplashScreen.preventAutoHideAsync()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Do not retry 401 / 403 / 404 — these are authoritative responses.
        if (error && typeof error === 'object' && 'statusCode' in error) {
          const code = (error as { statusCode: number }).statusCode
          if (code === 401 || code === 403 || code === 404) return false
        }
        return failureCount < 2
      },
      staleTime: 30_000,
    },
  },
})

export default function RootLayout() {
  useEffect(() => {
    // Hide the splash screen once the layout is mounted.
    void SplashScreen.hideAsync()
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bgCard },
            headerTintColor: colors.textPrimary,
            headerTitleStyle: { fontWeight: '600' },
            contentStyle: { backgroundColor: colors.bg },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
          <Stack.Screen name="verify" options={{ title: 'Verify Certificate' }} />
        </Stack>
      </AuthProvider>
    </QueryClientProvider>
  )
}
