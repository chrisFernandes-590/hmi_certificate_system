import React, { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Link, router, Stack } from 'expo-router'
import { useAuth } from '@/contexts/auth'
import { Button, Input } from '@/components/ui'
import { ApiError } from '@/lib/api'
import { colors, fontSize, fontWeight, radius, spacing } from '@/lib/design'

export default function LoginScreen() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})

  function validate() {
    const e: typeof errors = {}
    if (!email.trim()) e.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email'
    if (!password) e.password = 'Password is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleLogin() {
    if (!validate()) return
    setLoading(true)
    try {
      await login(email.trim().toLowerCase(), password)
      router.replace('/(app)')
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 401) {
          Alert.alert('Sign In Failed', 'Email or password is incorrect.')
        } else if (err.statusCode === 403) {
          Alert.alert(
            'Email Not Verified',
            'Please verify your email before signing in. Check your inbox for a verification link.',
          )
        } else {
          Alert.alert('Error', err.message)
        }
      } else {
        Alert.alert('Error', 'Unable to connect. Check your network and API URL.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Sign In', headerBackVisible: false }} />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <Text style={styles.brandIcon}>🏆</Text>
            <Text style={styles.brandTitle}>HMI Certificate</Text>
            <Text style={styles.brandSubtitle}>Sign in to your account</Text>
          </View>

          <View style={styles.form}>
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
              placeholder="••••••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              error={errors.password}
              editable={!loading}
            />

            <Link href="/(auth)/forgot-password" asChild>
              <Pressable style={styles.forgotLink}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </Pressable>
            </Link>

            <Button label="Sign In" loading={loading} onPress={() => void handleLogin()} style={{ marginTop: spacing.md }} />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account?</Text>
            <Link href="/verify" asChild>
              <Pressable style={{ alignSelf: 'center', paddingVertical: spacing.sm }} accessibilityRole="link">
                <Text style={styles.footerLink}>Verify a certificate</Text>
              </Pressable>
            </Link>
            <Link href="/(auth)/register" asChild>
              <Pressable>
                <Text style={styles.footerLink}> Sign up</Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  brand: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  brandIcon: { fontSize: 52, marginBottom: spacing.sm },
  brandTitle: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  brandSubtitle: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
  },
  form: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  forgotLink: { alignSelf: 'flex-end', marginTop: -spacing.sm },
  forgotText: { fontSize: fontSize.sm, color: colors.accent },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.md },
  footerText: { fontSize: fontSize.base, color: colors.textSecondary },
  footerLink: { fontSize: fontSize.base, color: colors.accent, fontWeight: fontWeight.semibold },
})
