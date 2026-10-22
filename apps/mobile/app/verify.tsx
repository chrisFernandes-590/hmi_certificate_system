import React, { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useMutation } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import { errorMessage, extractVerifyToken, formatDateTime } from '@/lib/format'
import type { VerifyResponse } from '@/lib/types'
import { Button, Card, Input, StatusPill } from '@/components/ui'
import { colors, fontSize, fontWeight, spacing } from '@/lib/design'

/** Public verification: works without a session. Shows only what the API returns. */
export default function VerifyScreen() {
  const params = useLocalSearchParams<{ token?: string }>()
  const [input, setInput] = useState(typeof params.token === 'string' ? params.token : '')
  const [error, setError] = useState<string | undefined>()

  const verify = useMutation({
    mutationFn: (token: string) => apiGet<VerifyResponse>(`/verify/${encodeURIComponent(token)}`),
  })

  function submit() {
    const token = extractVerifyToken(input)
    if (!token) {
      setError('Enter a verification token or link')
      return
    }
    setError(undefined)
    verify.mutate(token)
  }

  const result = verify.data

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Verify a certificate</Text>
        <Text style={styles.sub}>Paste the verification link or token printed on the certificate (or from its QR code).</Text>
        <Input
          label="Verification token or link"
          value={input}
          onChangeText={setInput}
          autoCapitalize="none"
          autoCorrect={false}
          error={error}
        />
        <Button label="Verify" loading={verify.isPending} onPress={submit} />

        {verify.error ? <Text style={styles.error}>{errorMessage(verify.error)}</Text> : null}

        {result && result.result === 'not_found' && (
          <Card style={[styles.result, { borderColor: colors.danger }]}>
            <Text style={[styles.resultTitle, { color: colors.danger }]}>Certificate not found</Text>
            <Text style={styles.sub}>No certificate matches this token. Check it and try again.</Text>
          </Card>
        )}

        {result && result.result !== 'not_found' && (
          <Card style={[styles.result, { borderColor: result.result === 'valid' ? colors.success : colors.revoked }]}>
            <View style={styles.row}>
              <Text style={[styles.resultTitle, { color: result.result === 'valid' ? colors.success : colors.revoked }]}>
                {result.result === 'valid' ? 'Valid certificate' : 'Certificate revoked'}
              </Text>
              <StatusPill status={result.result === 'valid' ? 'issued' : 'revoked'} />
            </View>
            <Row label="Certificate number" value={result.certificate.certificateNumber} />
            <Row label="Title" value={result.certificate.title} />
            <Row label="Recipient" value={result.certificate.participantName} />
            <Row label="Event" value={result.certificate.eventName} />
            <Row label="Issued" value={formatDateTime(result.certificate.issuedAt)} />
            {result.certificate.revokedAt ? <Row label="Revoked" value={formatDateTime(result.certificate.revokedAt)} /> : null}
          </Card>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ marginTop: spacing.sm }}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} selectable>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xxl },
  heading: { color: colors.textPrimary, fontSize: fontSize.xl, fontWeight: fontWeight.bold, marginBottom: spacing.xs },
  sub: { color: colors.textSecondary, fontSize: fontSize.sm, marginBottom: spacing.md, lineHeight: 20 },
  error: { color: colors.danger, marginTop: spacing.md, fontSize: fontSize.sm },
  result: { marginTop: spacing.lg, borderWidth: 1.5 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  label: { color: colors.textMuted, fontSize: fontSize.xs, textTransform: 'uppercase' },
  value: { color: colors.textPrimary, fontSize: fontSize.base },
})
