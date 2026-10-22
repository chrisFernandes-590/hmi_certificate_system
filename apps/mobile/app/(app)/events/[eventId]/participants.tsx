import React, { useState } from 'react'
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch, qs } from '@/lib/api'
import { errorMessage, formatDate } from '@/lib/format'
import { nextPageParam, useDebounced } from '@/lib/hooks'
import type { Participant, ParticipantsResponse } from '@/lib/types'
import { Button, Card, EmptyState, ErrorMessage, Loader, StatusPill } from '@/components/ui'
import { SearchBar } from '@/components/SearchBar'
import { FilterChips } from '@/components/FilterChips'
import { colors, fontSize, fontWeight, spacing } from '@/lib/design'

type Filter = 'all' | 'registered' | 'attended' | 'absent' | 'cancelled'
const FILTERS: { label: string; value: Filter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Registered', value: 'registered' },
  { label: 'Attended', value: 'attended' },
  { label: 'Absent', value: 'absent' },
  { label: 'Cancelled', value: 'cancelled' },
]
const SETTABLE = ['registered', 'attended', 'absent'] as const

export default function ParticipantsScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const debounced = useDebounced(search.trim())

  const q = useInfiniteQuery({
    queryKey: ['participants', eventId, { search: debounced, filter }],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      apiGet<ParticipantsResponse>(
        `/events/${eventId}/participants${qs({ page: pageParam, pageSize: 25, search: debounced, status: filter === 'all' ? undefined : filter })}`,
      ),
    getNextPageParam: nextPageParam,
  })
  const items = q.data?.pages.flatMap((p) => p.participants) ?? []

  const update = useMutation({
    mutationFn: (v: { participantId: string; status: (typeof SETTABLE)[number] }) =>
      apiPatch(`/events/${eventId}/participants/${v.participantId}`, { status: v.status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['participants', eventId] }),
    onError: (e) => Alert.alert('Could not update status', errorMessage(e)),
  })

  function renderItem(p: Participant) {
    const pending = update.isPending && update.variables?.participantId === p.participantId
    return (
      <Card style={{ marginBottom: spacing.sm }}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{p.name}</Text>
            <Text style={styles.email}>{p.email}</Text>
            <Text style={styles.meta}>Registered {formatDate(p.registeredAt)}</Text>
          </View>
          <StatusPill status={p.status} />
        </View>
        {p.status !== 'cancelled' && (
          <View style={styles.actions}>
            {SETTABLE.map((s) => (
              <Button
                key={s}
                label={s.charAt(0).toUpperCase() + s.slice(1)}
                size="sm"
                variant={p.status === s ? 'primary' : 'secondary'}
                disabled={p.status === s || update.isPending}
                loading={pending && update.variables?.status === s}
                onPress={() => update.mutate({ participantId: p.participantId, status: s })}
                style={{ flex: 1 }}
              />
            ))}
          </View>
        )}
      </Card>
    )
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Participants' }} />
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search participants…" />
        <FilterChips options={FILTERS} value={filter} onChange={setFilter} />
        {q.isLoading ? (
          <Loader />
        ) : q.error ? (
          <ErrorMessage message={errorMessage(q.error, 'Failed to load participants')} onRetry={() => q.refetch()} />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(p) => p.registrationId}
            contentContainerStyle={{ padding: spacing.md, paddingTop: spacing.xs }}
            refreshControl={<RefreshControl refreshing={q.isRefetching && !q.isFetchingNextPage} onRefresh={() => { void q.refetch() }} tintColor={colors.accent} />}
            onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
            onEndReachedThreshold={0.4}
            ListHeaderComponent={q.data ? <Text style={styles.total}>{q.data.pages[0].total} participant(s)</Text> : undefined}
            ListEmptyComponent={<EmptyState message="No participants found." />}
            ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator color={colors.accent} style={{ margin: spacing.md }} /> : undefined}
            renderItem={({ item }) => renderItem(item)}
          />
        )}
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  name: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  email: { color: colors.textSecondary, fontSize: fontSize.sm },
  meta: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  total: { color: colors.textMuted, fontSize: fontSize.xs, marginBottom: spacing.sm },
})
