import React from 'react'
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPost } from '@/lib/api'
import { errorMessage, formatDateTime } from '@/lib/format'
import type { EventDetail, RegistrationMutation } from '@/lib/types'
import { Button, Card, ErrorMessage, Loader, SectionHeader, StatusPill } from '@/components/ui'
import { colors, fontSize, fontWeight, spacing } from '@/lib/design'

export default function EventDetailScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>()
  const qc = useQueryClient()

  const q = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => apiGet<{ event: EventDetail }>(`/events/${eventId}`),
  })

  async function invalidate() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['event', eventId] }),
      qc.invalidateQueries({ queryKey: ['events'] }),
      qc.invalidateQueries({ queryKey: ['my-events'] }),
    ])
  }

  const register = useMutation({
    mutationFn: () => apiPost<RegistrationMutation>(`/events/${eventId}/registration`),
    onSuccess: invalidate,
    onError: (e) => Alert.alert('Registration failed', errorMessage(e)),
  })
  const cancel = useMutation({
    mutationFn: () => apiDelete<RegistrationMutation>(`/events/${eventId}/registration`),
    onSuccess: invalidate,
    onError: (e) => Alert.alert('Could not cancel', errorMessage(e)),
  })
  const archive = useMutation({
    mutationFn: () => apiDelete(`/events/${eventId}`),
    onSuccess: async () => {
      await invalidate()
      router.replace('/(app)/events')
    },
    onError: (e) => Alert.alert('Could not archive event', errorMessage(e)),
  })

  if (q.isLoading) return <Loader />
  if (q.error || !q.data) {
    return <ErrorMessage message={errorMessage(q.error, 'Failed to load event')} onRetry={() => q.refetch()} />
  }

  const event = q.data.event
  const isAdmin = event.accessRole === 'admin'
  const regStatus = event.registrationStatus ?? null
  const activeRegistration = regStatus !== null && regStatus !== 'cancelled'

  function confirmCancel() {
    Alert.alert('Cancel registration?', 'You can register again before the event starts.', [
      { text: 'Keep registration', style: 'cancel' },
      { text: 'Cancel registration', style: 'destructive', onPress: () => cancel.mutate() },
    ])
  }
  function confirmArchive() {
    Alert.alert(
      'Archive event?',
      'The event will be hidden from lists. Registrations and certificate history are preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Archive', style: 'destructive', onPress: () => archive.mutate() },
      ],
    )
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Event' }} />
      <ScrollView
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { void q.refetch() }} tintColor={colors.accent} />}
      >
        <View style={styles.titleRow}>
          <Text style={styles.title}>{event.name}</Text>
          <StatusPill status={event.status} />
        </View>
        {event.description ? <Text style={styles.desc}>{event.description}</Text> : null}

        <Card style={{ marginTop: spacing.md }}>
          <Text style={styles.label}>Starts</Text>
          <Text style={styles.value}>{formatDateTime(event.startDate)}</Text>
          <Text style={[styles.label, { marginTop: spacing.sm }]}>Ends</Text>
          <Text style={styles.value}>{formatDateTime(event.endDate)}</Text>
        </Card>

        <SectionHeader title="Your registration" />
        <Card>
          {activeRegistration ? (
            <>
              <View style={styles.titleRow}>
                <Text style={styles.value}>You are registered</Text>
                <StatusPill status={regStatus ?? ''} />
              </View>
              {regStatus === 'registered' && (
                <Button
                  label="Cancel registration"
                  variant="danger"
                  loading={cancel.isPending}
                  onPress={confirmCancel}
                  style={{ marginTop: spacing.md }}
                />
              )}
            </>
          ) : event.registrationEligible ? (
            <>
              <Text style={styles.muted}>
                {regStatus === 'cancelled' ? 'Your registration was cancelled. You can register again.' : 'You are not registered for this event.'}
              </Text>
              <Button label="Register" loading={register.isPending} onPress={() => register.mutate()} style={{ marginTop: spacing.md }} />
            </>
          ) : (
            <Text style={styles.muted}>Registration is not open for this event.</Text>
          )}
        </Card>

        {isAdmin && (
          <>
            <SectionHeader title="Event administration" />
            <Card style={{ gap: spacing.sm }}>
              <Button
                label="Edit event"
                variant="secondary"
                onPress={() => router.push({ pathname: '/(app)/events/[eventId]/edit', params: { eventId } })}
              />
              <Button
                label="Participants & attendance"
                variant="secondary"
                onPress={() => router.push({ pathname: '/(app)/events/[eventId]/participants', params: { eventId } })}
              />
              <Button
                label="Certificates"
                variant="secondary"
                onPress={() => router.push({ pathname: '/(app)/events/[eventId]/certificates', params: { eventId } })}
              />
              <Button label="Archive event" variant="danger" loading={archive.isPending} onPress={confirmArchive} />
            </Card>
          </>
        )}
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, paddingBottom: spacing.xxl },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  title: { flex: 1, color: colors.textPrimary, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  desc: { color: colors.textSecondary, fontSize: fontSize.base, lineHeight: 22, marginTop: spacing.sm },
  label: { color: colors.textMuted, fontSize: fontSize.xs, textTransform: 'uppercase' },
  value: { color: colors.textPrimary, fontSize: fontSize.base },
  muted: { color: colors.textSecondary, fontSize: fontSize.sm },
})
