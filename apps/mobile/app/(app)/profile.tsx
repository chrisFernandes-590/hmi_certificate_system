import React, { useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '@/contexts/auth'
import { Button, Card } from '@/components/ui'
import { formatDateTime } from '@/lib/format'
import { colors, fontSize, fontWeight, radius, spacing } from '@/lib/design'

export default function ProfileScreen() {
  const { user, logout } = useAuth()
  const [busy, setBusy] = useState(false)
  if (!user) return null

  function confirmLogout() {
    Alert.alert('Sign out?', 'You will need to sign in again to access your events and certificates.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setBusy(true)
          await logout()
          router.replace('/(auth)/login')
        },
      },
    ])
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.md }}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{user.name.trim().charAt(0).toUpperCase() || '?'}</Text>
      </View>
      <Text style={styles.name}>{user.name}</Text>
      <Text style={styles.email}>{user.email}</Text>
      <Card style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        <Text style={styles.label}>Email verified</Text>
        <Text style={styles.value}>{user.emailVerifiedAt ? formatDateTime(user.emailVerifiedAt) : 'Not verified'}</Text>
      </Card>
      <Button label="Verify a certificate" variant="secondary" onPress={() => router.push('/verify')} style={{ marginTop: spacing.lg }} />
      <Button label="Sign out" variant="danger" loading={busy} onPress={confirmLogout} style={{ marginTop: spacing.md }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  avatar: {
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  avatarText: { color: colors.textOnAccent, fontSize: fontSize.xxl, fontWeight: fontWeight.bold },
  name: { color: colors.textPrimary, fontSize: fontSize.xl, fontWeight: fontWeight.bold, textAlign: 'center', marginTop: spacing.md },
  email: { color: colors.textSecondary, fontSize: fontSize.base, textAlign: 'center' },
  label: { color: colors.textMuted, fontSize: fontSize.xs, textTransform: 'uppercase' },
  value: { color: colors.textPrimary, fontSize: fontSize.base },
})
