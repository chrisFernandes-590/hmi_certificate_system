import React, { useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { router, Stack } from 'expo-router'
import { useInfiniteQuery } from '@tanstack/react-query'
import { apiGet, qs } from '@/lib/api'
import { errorMessage, formatDate } from '@/lib/format'
import { nextPageParam, useDebounced } from '@/lib/hooks'
import type { CertificateStatus, MyCertificatesResponse } from '@/lib/types'
import { Card, EmptyState, ErrorMessage, Loader, StatusPill } from '@/components/ui'
import { SearchBar } from '@/components/SearchBar'
import { FilterChips } from '@/components/FilterChips'
import { colors, fontSize, fontWeight, spacing } from '@/lib/design'

type Filter = 'all' | CertificateStatus
const FILTERS: { label: string; value: Filter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Issued', value: 'issued' },
  { label: 'Revoked', value: 'revoked' },
]

export default function MyCertificatesScreen() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const debounced = useDebounced(search.trim())
  const q = useInfiniteQuery({
    queryKey: ['my-certificates', { search: debounced, filter }],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      apiGet<MyCertificatesResponse>(
        `/me/certificates${qs({ page: pageParam, pageSize: 20, search: debounced, status: filter === 'all' ? undefined : filter })}`,
      ),
    getNextPageParam: nextPageParam,
  })
  const items = q.data?.pages.flatMap((p) => p.certificates) ?? []

  return (
    <>
      <Stack.Screen options={{ title: 'My Certificates' }} />
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search number, title or event…" />
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
            ListEmptyComponent={<EmptyState message="No certificates yet." />}
            ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator color={colors.accent} style={{ margin: spacing.md }} /> : undefined}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open certificate ${item.certificateNumber}`}
                onPress={() => router.push({ pathname: '/(app)/certificates/[certificateId]', params: { certificateId: item.id } })}
              >
                <Card style={{ marginBottom: spacing.sm }}>
                  <View style={styles.row}>
                    <Text style={styles.name} numberOfLines={2}>{item.title}</Text>
                    <StatusPill status={item.status} />
                  </View>
                  <Text style={styles.sub}>{item.eventName}</Text>
                  <Text style={styles.meta}>{item.certificateNumber} · Issued {formatDate(item.issuedAt)}</Text>
                </Card>
              </Pressable>
            )}
          />
        )}
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.xs },
  name: { flex: 1, color: colors.textPrimary, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  sub: { color: colors.textSecondary, fontSize: fontSize.sm },
  meta: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
})
