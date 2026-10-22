import React, { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Stack } from 'expo-router'
import { Button, Input } from '@/components/ui'
import { apiPost } from '@/lib/api'
import { ApiError } from '@/lib/api'
import { colors, fontSize, fontWeight, radius, spacing } from '@/lib/design'

export default function VerifyEmailScreen() {
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | undefined>()

  async function handleVerify() {
    const trimmed = token.trim()
    if (!trimmed) {
      setError('Verification token is required')
      return
    }
    setError(undefined)
    setLoading(true)
    try {
      await apiPost('/auth/verify-email', { token: trimmed })
      setDone(true)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        Alert.alert('Error', 'Unable to connect. Check your network and API URL.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Verify Email' }} />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {done ? (
            <View style={styles.card}>
              <Text style={styles.icon}>✅</Text>
              <Text style={styles.successTitle}>Email Verified!</Text>
              <Text style={styles.body}>Your email has been verified. You can now sign in.</Text>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.icon}>📩</Text>
              <Text style={styles.title}>Verify Your Email</Text>
              <Text style={styles.body}>
                Paste the verification token from the email we sent you.
              </Text>
              <Input
                label="Verification Token"
                placeholder="Paste token here"
                value={token}
                onChangeText={setToken}
                autoCapitalize="none"
                autoCorrect={false}
                error={error}
                editable={!loading}
              />
              <Button label="Verify Email" loading={loading} onPress={() => void handleVerify()} />
            </View>
          )}
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
  successTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.success,
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
