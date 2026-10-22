import React, { useState } from 'react'
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Pressable } from 'react-native'
import { apiGet, apiPatch, qs } from '@/lib/api'
import { errorMessage, formatDate } from '@/lib/format'
import { nextPageParam, useDebounced } from '@/lib/hooks'
import type { CertificateStatus, EventCertificate, EventCertificatesResponse, RevocationResult } from '@/lib/types'
import { Button, Card, EmptyState, ErrorMessage, Loader, StatusPill } from '@/components/ui'
import { SearchBar } from '@/components/SearchBar'
import { FilterChips } from '@/components/FilterChips'
import { ReasonModal } from '@/components/ReasonModal'
import { colors, fontSize, fontWeight, spacing } from '@/lib/design'

type Filter = 'all' | CertificateStatus
const FILTERS: { label: string; value: Filter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Issued', value: 'issued' },
  { label: 'Revoked', value: 'revoked' },
  { label: 'Draft', value: 'draft' },
]

export default function EventCertificatesScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [target, setTarget] = useState<EventCertificate | null>(null)
  const debounced = useDebounced(search.trim())

  const q = useInfiniteQuery({
    queryKey: ['event-certificates', eventId, { search: debounced, filter }],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      apiGet<EventCertificatesResponse>(
        `/events/${eventId}/certificates${qs({ page: pageParam, pageSize: 25, search: debounced, status: filter === 'all' ? undefined : filter })}`,
      ),
    getNextPageParam: nextPageParam,
  })
  const items = q.data?.pages.flatMap((p) => p.certificates) ?? []

  const revoke = useMutation({
    mutationFn: (v: { id: string; reason: string }) =>
      apiPatch<{ certificate: RevocationResult }>(`/certificates/${v.id}/revoke`, { reason: v.reason }),
    onSuccess: async () => {
      setTarget(null)
      await qc.invalidateQueries({ queryKey: ['event-certificates', eventId] })
      await qc.invalidateQueries({ queryKey: ['my-certificates'] })
    },
  })

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Event Certificates',
          headerRight: () => (
            <Pressable
              onPress={() => router.push({ pathname: '/(app)/events/[eventId]/issue', params: { eventId } })}
              accessibilityLabel="Issue certificates"
              hitSlop={10}
            >
              <Ionicons name="add-circle" size={30} color={colors.accent} />
            </Pressable>
          ),
        }}
      />
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search number, recipient or title…" />
        <FilterChips options={FILTERS} value={filter} onChange={setFilter} />
        {q.isLoading ? (
          <Loader />
        ) : q.error ? (
          <ErrorMessage message={errorMessage(q.error, 'Failed to load certificates')} onRetry={() => q.refetch()} />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(c) => c.id}
            contentContainerStyle={{ padding: spacing.md, paddingTop: spacing.xs }}
            refreshControl={<RefreshControl refreshing={q.isRefetching && !q.isFetchingNextPage} onRefresh={() => { void q.refetch() }} tintColor={colors.accent} />}
            onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
            onEndReachedThreshold={0.4}
            ListEmptyComponent={<EmptyState message="No certificates yet. Tap + to issue some." />}
            ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator color={colors.accent} style={{ margin: spacing.md }} /> : undefined}
            renderItem={({ item }) => (
              <Card style={{ marginBottom: spacing.sm }}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.participantName}</Text>
                    <Text style={styles.sub}>{item.title}</Text>
                    <Text style={styles.meta}>
                      {item.certificateNumber} · Issued {formatDate(item.issuedAt)}
                      {item.revokedAt ? ` · Revoked ${formatDate(item.revokedAt)}` : ''}
                    </Text>
                  </View>
                  <StatusPill status={item.status} />
                </View>
                {item.status === 'issued' && (
                  <Button
                    label="Revoke"
                    variant="danger"
                    size="sm"
                    style={{ marginTop: spacing.md }}
                    onPress={() => {
                      revoke.reset()
                      setTarget(item)
                    }}
                  />
                )}
              </Card>
            )}
          />
        )}
      </View>
      <ReasonModal
        visible={target !== null}
        title="Revoke certificate?"
        message={
          target
            ? `${target.certificateNumber} (${target.participantName}) will be marked revoked and public verification will report it as revoked. This cannot be undone from the app.`
            : ''
        }
        confirmLabel="Revoke"
        loading={revoke.isPending}
        error={revoke.error ? errorMessage(revoke.error) : null}
        onCancel={() => setTarget(null)}
        onConfirm={(reason) => target && revoke.mutate({ id: target.id, reason })}
      />
    </>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  name: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  sub: { color: colors.textSecondary, fontSize: fontSize.sm },
  meta: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
})
