import React from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/auth'
import { apiGet } from '@/lib/api'
import { Card, Loader, StatusPill, ErrorMessage } from '@/components/ui'
import { colors, fontSize, fontWeight, spacing } from '@/lib/design'
import type { EventDto } from '@hmi/shared'

interface EventsListData {
  events: (EventDto & { registrationEligible?: boolean })[]
  total: number
  page: number
  pageSize: number
}

interface CertListData {
  certificates: {
    id: string
    certificateNumber: string
    eventName: string
    title: string
    issuedAt: string | null
    status: string
  }[]
  total: number
}

export default function DashboardScreen() {
  const { user } = useAuth()

  const eventsQuery = useQuery({
    queryKey: ['events', { page: 1, pageSize: 3 }],
    queryFn: () => apiGet<EventsListData>('/events?page=1&pageSize=3'),
  })

  const certsQuery = useQuery({
    queryKey: ['my-certificates', { page: 1, pageSize: 3 }],
    queryFn: () => apiGet<CertListData>('/me/certificates?page=1&pageSize=3'),
  })

  const refetching = eventsQuery.isRefetching || certsQuery.isRefetching

  function refetchAll() {
    void eventsQuery.refetch()
    void certsQuery.refetch()
  }

  const isLoading = eventsQuery.isLoading || certsQuery.isLoading

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refetching} onRefresh={refetchAll} tintColor={colors.accent} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>
          👋 Hello, {user?.name?.split(' ')[0] ?? 'there'}!
        </Text>
        <Text style={styles.subGreeting}>Here's what's happening</Text>
      </View>

      {isLoading ? (
        <Loader />
      ) : (
        <>
          {/* Recent Events */}
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Recent Events</Text>
              <Pressable onPress={() => router.push('/(app)/events')}>
                <Text style={styles.seeAll}>See all →</Text>
              </Pressable>
            </View>
            {eventsQuery.error ? (
              <ErrorMessage message="Could not load events" onRetry={eventsQuery.refetch} />
            ) : eventsQuery.data?.events.length === 0 ? (
              <Card>
                <Text style={styles.emptyText}>No events found. Create one or check back later.</Text>
              </Card>
            ) : (
              eventsQuery.data?.events.map((event) => (
                <Pressable
                  key={event.id}
                  onPress={() => router.push({ pathname: '/(app)/events/[eventId]', params: { eventId: event.id } })}
                >
                  <Card style={styles.eventCard}>
                    <View style={styles.eventRow}>
                      <Text style={styles.eventName} numberOfLines={1}>{event.name}</Text>
                      <StatusPill status={event.status} />
                    </View>
                    {event.accessRole === 'admin' && (
                      <Text style={styles.adminBadge}>⚙️ You are an admin of this event</Text>
                    )}
                    <Text style={styles.eventDate}>
                      {new Date(event.startDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                    </Text>
                  </Card>
                </Pressable>
              ))
            )}
          </View>

          {/* My Certificates */}
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>My Certificates</Text>
              <Pressable onPress={() => router.push('/(app)/certificates')}>
                <Text style={styles.seeAll}>See all →</Text>
              </Pressable>
            </View>
            {certsQuery.error ? (
              <ErrorMessage message="Could not load certificates" onRetry={certsQuery.refetch} />
            ) : certsQuery.data?.certificates.length === 0 ? (
              <Card>
                <Text style={styles.emptyText}>No certificates yet. Attend events to earn them.</Text>
              </Card>
            ) : (
              certsQuery.data?.certificates.map((cert) => (
                <Pressable
                  key={cert.id}
                  onPress={() => router.push({ pathname: '/(app)/certificates/[certificateId]', params: { certificateId: cert.id } })}
                >
                  <Card style={styles.certCard}>
                    <View style={styles.eventRow}>
                      <Text style={styles.certTitle} numberOfLines={1}>{cert.title}</Text>
                      <StatusPill status={cert.status} />
                    </View>
                    <Text style={styles.certMeta}>{cert.eventName}</Text>
                    {cert.issuedAt && (
                      <Text style={styles.certMeta}>
                        Issued {new Date(cert.issuedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                      </Text>
                    )}
                  </Card>
                </Pressable>
              ))
            )}
          </View>

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionRow}>
              <Pressable style={styles.actionCard} onPress={() => router.push('/(app)/events/create')}>
                <Text style={styles.actionIcon}>➕</Text>
                <Text style={styles.actionLabel}>Create Event</Text>
              </Pressable>
              <Pressable style={styles.actionCard} onPress={() => router.push('/verify')}>
                <Text style={styles.actionIcon}>🔍</Text>
                <Text style={styles.actionLabel}>Verify Certificate</Text>
              </Pressable>
              <Pressable style={styles.actionCard} onPress={() => router.push('/(app)/my-events')}>
                <Text style={styles.actionIcon}>📅</Text>
                <Text style={styles.actionLabel}>My Events</Text>
              </Pressable>
            </View>
          </View>
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { marginBottom: spacing.lg },
  greeting: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.textPrimary },
  subGreeting: { fontSize: fontSize.base, color: colors.textSecondary, marginTop: spacing.xs },
  section: { marginBottom: spacing.lg },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  seeAll: { fontSize: fontSize.sm, color: colors.accent },
  eventCard: { marginBottom: spacing.sm },
  eventRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  eventName: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.textPrimary, marginRight: spacing.sm },
  adminBadge: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing.xs },
  eventDate: { fontSize: fontSize.sm, color: colors.textSecondary },
  certCard: { marginBottom: spacing.sm },
  certTitle: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.textPrimary, marginRight: spacing.sm },
  certMeta: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  emptyText: { fontSize: fontSize.base, color: colors.textSecondary, textAlign: 'center' },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  actionCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionIcon: { fontSize: 28, marginBottom: spacing.xs },
  actionLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.medium, color: colors.textSecondary, textAlign: 'center' },
})
