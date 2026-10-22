import React, { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Link, Stack } from 'expo-router'
import { Button, Input } from '@/components/ui'
import { apiPost } from '@/lib/api'
import { ApiError } from '@/lib/api'
import { colors, fontSize, fontWeight, radius, spacing } from '@/lib/design'

export default function RegisterScreen() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate() {
    const e: typeof errors = {}
    if (!name.trim()) e.name = 'Name is required'
    if (!email.trim()) e.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email'
    if (password.length < 12) e.password = 'Password must be at least 12 characters'
    else if (password.length > 128) e.password = 'Password must be at most 128 characters'
    if (password !== confirm) e.confirm = 'Passwords do not match'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleRegister() {
    if (!validate()) return
    setLoading(true)
    try {
      await apiPost('/auth/register', { name: name.trim(), email: email.trim().toLowerCase(), password })
      setDone(true)
    } catch (err) {
      if (err instanceof ApiError) {
        Alert.alert('Registration Failed', err.message)
      } else {
        Alert.alert('Error', 'Unable to connect. Check your network and API URL.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Create Account' }} />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {done ? (
            <View style={styles.successCard}>
              <Text style={styles.successIcon}>📧</Text>
              <Text style={styles.successTitle}>Check your inbox</Text>
              <Text style={styles.successBody}>
                If this email address can be registered, a verification link has been sent. Please
                check your email and click the link to activate your account.
              </Text>
              <Link href="/(auth)/verify-email" asChild>
                <Pressable style={styles.verifyLink}>
                  <Text style={styles.verifyLinkText}>Enter verification token manually →</Text>
                </Pressable>
              </Link>
            </View>
          ) : (
            <>
              <Text style={styles.title}>Create an account</Text>
              <View style={styles.form}>
                <Input
                  label="Full name"
                  placeholder="John Smith"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  autoComplete="name"
                  error={errors.name}
                  editable={!loading}
                />
                <Input
                  label="Email"
                  placeholder="you@example.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  error={errors.email}
                  editable={!loading}
                />
                <Input
                  label="Password"
                  placeholder="At least 12 characters"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="new-password"
                  error={errors.password}
                  editable={!loading}
                />
                <Input
                  label="Confirm password"
                  placeholder="Repeat your password"
                  value={confirm}
                  onChangeText={setConfirm}
                  secureTextEntry
                  error={errors.confirm}
                  editable={!loading}
                />
                <Button label="Create Account" loading={loading} onPress={() => void handleRegister()} />
              </View>
              <View style={styles.footer}>
                <Text style={styles.footerText}>Already have an account?</Text>
                <Link href="/(auth)/login" asChild>
                  <Pressable>
                    <Text style={styles.footerLink}> Sign in</Text>
                  </Pressable>
                </Link>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  )
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: spacing.lg, justifyContent: 'center' },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  form: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  footer: { flexDirection: 'row', justifyContent: 'center' },
  footerText: { fontSize: fontSize.base, color: colors.textSecondary },
  footerLink: { fontSize: fontSize.base, color: colors.accent, fontWeight: fontWeight.semibold },
  successCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  successIcon: { fontSize: 48, marginBottom: spacing.md },
  successTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  successBody: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  verifyLink: { marginTop: spacing.lg },
  verifyLinkText: { fontSize: fontSize.sm, color: colors.accent },
})
