import React from 'react'
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import { downloadAndSharePdf } from '@/lib/pdf'
import { errorMessage, formatDateTime } from '@/lib/format'
import type { MyCertificate } from '@/lib/types'
import { Button, Card, ErrorMessage, Loader, StatusPill } from '@/components/ui'
import { colors, fontSize, fontWeight, spacing } from '@/lib/design'

export default function CertificateDetailScreen() {
  const { certificateId } = useLocalSearchParams<{ certificateId: string }>()
  const q = useQuery({
    queryKey: ['certificate', certificateId],
    queryFn: () => apiGet<{ certificate: MyCertificate }>(`/certificates/${certificateId}`),
  })
  const pdf = useMutation({
    mutationFn: () => downloadAndSharePdf(certificateId),
    onError: (e) => Alert.alert('PDF unavailable', errorMessage(e, 'Could not download the PDF.')),
  })

  if (q.isLoading) return <Loader />
  if (q.error || !q.data) return <ErrorMessage message={errorMessage(q.error, 'Certificate not found')} onRetry={() => q.refetch()} />
  const c = q.data.certificate

  return (
    <>
      <Stack.Screen options={{ title: 'Certificate' }} />
      <ScrollView
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { void q.refetch() }} tintColor={colors.accent} />}
      >
        <View style={styles.titleRow}>
          <Text style={styles.title}>{c.title}</Text>
          <StatusPill status={c.status} />
        </View>
        <Card style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <Field label="Certificate number" value={c.certificateNumber} />
          <Field label="Event" value={c.eventName} />
          <Field label="Issued" value={formatDateTime(c.issuedAt)} />
          {c.revokedAt ? <Field label="Revoked" value={formatDateTime(c.revokedAt)} /> : null}
          {c.description ? <Field label="Description" value={c.description} /> : null}
        </Card>
        {c.status === 'revoked' && (
          <Text style={styles.warn}>This certificate has been revoked and is no longer valid.</Text>
        )}
        <Button
          label="Download / share PDF"
          loading={pdf.isPending}
          disabled={c.status === 'draft'}
          onPress={() => pdf.mutate()}
          style={{ marginTop: spacing.lg }}
        />
      </ScrollView>
    </>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} selectable>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  title: { flex: 1, color: colors.textPrimary, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  label: { color: colors.textMuted, fontSize: fontSize.xs, textTransform: 'uppercase' },
  value: { color: colors.textPrimary, fontSize: fontSize.base },
  warn: { color: colors.revoked, fontSize: fontSize.sm, marginTop: spacing.md },
})
