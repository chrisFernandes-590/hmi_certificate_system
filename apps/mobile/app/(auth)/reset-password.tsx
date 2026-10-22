import React, { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Stack } from 'expo-router'
import { Button, Input } from '@/components/ui'
import { apiPost } from '@/lib/api'
import { ApiError } from '@/lib/api'
import { colors, fontSize, fontWeight, radius, spacing } from '@/lib/design'

export default function ResetPasswordScreen() {
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate() {
    const e: typeof errors = {}
    if (!token.trim()) e.token = 'Paste your reset token'
    if (password.length < 12) e.password = 'Password must be at least 12 characters'
    if (password !== confirm) e.confirm = 'Passwords do not match'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleReset() {
    if (!validate()) return
    setLoading(true)
    try {
      await apiPost('/auth/reset-password', { token: token.trim(), password })
      setDone(true)
    } catch (err) {
      if (err instanceof ApiError) {
        Alert.alert('Reset Failed', err.message)
      } else {
        Alert.alert('Error', 'Unable to connect.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Reset Password' }} />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            {done ? (
              <>
                <Text style={styles.icon}>✅</Text>
                <Text style={styles.title}>Password Updated</Text>
                <Text style={styles.body}>
                  Your password has been updated. Sign in with your new password.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.icon}>🔒</Text>
                <Text style={styles.title}>Choose a New Password</Text>
                <Text style={styles.body}>Paste the token from the reset email.</Text>
                <Input
                  label="Reset Token"
                  placeholder="Paste token from email"
                  value={token}
                  onChangeText={setToken}
                  autoCapitalize="none"
                  autoCorrect={false}
                  error={errors.token}
                  editable={!loading}
                />
                <Input
                  label="New Password"
                  placeholder="At least 12 characters"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  error={errors.password}
                  editable={!loading}
                />
                <Input
                  label="Confirm New Password"
                  placeholder="Repeat new password"
                  value={confirm}
                  onChangeText={setConfirm}
                  secureTextEntry
                  error={errors.confirm}
                  editable={!loading}
                />
                <Button label="Reset Password" loading={loading} onPress={() => void handleReset()} />
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
