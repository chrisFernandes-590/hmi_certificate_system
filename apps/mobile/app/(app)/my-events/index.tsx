import React, { useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { router, Stack } from 'expo-router'
import { useInfiniteQuery } from '@tanstack/react-query'
import { apiGet, qs } from '@/lib/api'
import { errorMessage, formatDate } from '@/lib/format'
import { nextPageParam, useDebounced } from '@/lib/hooks'
import type { MyEventsResponse } from '@/lib/types'
import { Card, EmptyState, ErrorMessage, Loader, StatusPill } from '@/components/ui'
import { SearchBar } from '@/components/SearchBar'
import { colors, fontSize, fontWeight, spacing } from '@/lib/design'

export default function MyEventsScreen() {
  const [search, setSearch] = useState('')
  const debounced = useDebounced(search.trim())
  const q = useInfiniteQuery({
    queryKey: ['my-events', { search: debounced }],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => apiGet<MyEventsResponse>(`/me/events${qs({ page: pageParam, pageSize: 20, search: debounced })}`),
    getNextPageParam: nextPageParam,
  })
  const items = q.data?.pages.flatMap((p) => p.events) ?? []

  return (
    <>
      <Stack.Screen options={{ title: 'My Events' }} />
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search my events…" />
        {q.isLoading ? (
          <Loader />
        ) : q.error ? (
          <ErrorMessage message={errorMessage(q.error, 'Failed to load your events')} onRetry={() => q.refetch()} />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(e) => e.registrationId}
            contentContainerStyle={{ padding: spacing.md, paddingTop: spacing.xs }}
            refreshControl={<RefreshControl refreshing={q.isRefetching && !q.isFetchingNextPage} onRefresh={() => { void q.refetch() }} tintColor={colors.accent} />}
            onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
            onEndReachedThreshold={0.4}
            ListEmptyComponent={<EmptyState message="You haven't registered for any events yet." />}
            ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator color={colors.accent} style={{ margin: spacing.md }} /> : undefined}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${item.name}`}
                onPress={() => router.push({ pathname: '/(app)/events/[eventId]', params: { eventId: item.id } })}
              >
                <Card style={{ marginBottom: spacing.sm }}>
                  <View style={styles.row}>
                    <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
                    <StatusPill status={item.registrationStatus} />
                  </View>
                  <Text style={styles.meta}>📅 {formatDate(item.startDate)} · Registered {formatDate(item.registeredAt)}</Text>
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
  meta: { color: colors.textMuted, fontSize: fontSize.sm },
})
