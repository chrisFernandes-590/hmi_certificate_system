import React, { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Stack } from 'expo-router'
import { Button, Input } from '@/components/ui'
import { apiPost } from '@/lib/api'
import { ApiError } from '@/lib/api'
import { colors, fontSize, fontWeight, radius, spacing } from '@/lib/design'

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | undefined>()

  async function handleSubmit() {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !/\S+@\S+\.\S+/.test(trimmed)) {
      setError('Enter a valid email address')
      return
    }
    setError(undefined)
    setLoading(true)
    try {
      await apiPost('/auth/forgot-password', { email: trimmed })
      setDone(true)
    } catch (err) {
      if (err instanceof ApiError) {
        Alert.alert('Error', err.message)
      } else {
        Alert.alert('Error', 'Unable to connect.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Forgot Password' }} />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            {done ? (
              <>
                <Text style={styles.icon}>📬</Text>
                <Text style={styles.title}>Instructions Sent</Text>
                <Text style={styles.body}>
                  If an account exists for that address, password reset instructions have been sent.
                  Check your email.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.icon}>🔑</Text>
                <Text style={styles.title}>Reset Password</Text>
                <Text style={styles.body}>
                  Enter your account email. We'll send a reset link if the account exists.
                </Text>
                <Input
                  label="Email"
                  placeholder="you@example.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  error={error}
                  editable={!loading}
                />
                <Button label="Send Reset Link" loading={loading} onPress={() => void handleSubmit()} />
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  )
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: spacing.lg, justifyContent: 'center' },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  icon: { fontSize: 48, marginBottom: spacing.md },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  body: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
})
