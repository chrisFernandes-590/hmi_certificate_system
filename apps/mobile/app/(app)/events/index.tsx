import React, { useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { router, Stack } from 'expo-router'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { apiGet, qs } from '@/lib/api'
import { errorMessage, formatDate } from '@/lib/format'
import { nextPageParam, useDebounced } from '@/lib/hooks'
import type { EventListResponse } from '@/lib/types'
import { Card, EmptyState, ErrorMessage, Loader, StatusPill } from '@/components/ui'
import { SearchBar } from '@/components/SearchBar'
import { colors, fontSize, fontWeight, spacing } from '@/lib/design'

export default function EventsIndexScreen() {
  const [search, setSearch] = useState('')
  const debounced = useDebounced(search.trim())

  const q = useInfiniteQuery({
    queryKey: ['events', { search: debounced }],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      apiGet<EventListResponse>(`/events${qs({ page: pageParam, pageSize: 20, search: debounced })}`),
    getNextPageParam: nextPageParam,
  })
  const events = q.data?.pages.flatMap((p) => p.events) ?? []

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Events',
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/(app)/events/create')}
              accessibilityLabel="Create new event"
              hitSlop={10}
            >
              <Ionicons name="add-circle" size={30} color={colors.accent} />
            </Pressable>
          ),
        }}
      />
      <View style={styles.screen}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search events…" />
        {q.isLoading ? (
          <Loader />
        ) : q.error ? (
          <ErrorMessage message={errorMessage(q.error, 'Failed to load events')} onRetry={() => q.refetch()} />
        ) : (
          <FlatList
            data={events}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl refreshing={q.isRefetching && !q.isFetchingNextPage} onRefresh={() => { void q.refetch() }} tintColor={colors.accent} />
            }
            onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
            onEndReachedThreshold={0.4}
            ListEmptyComponent={<EmptyState message={debounced ? 'No events match your search.' : 'No events available.'} />}
            ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator color={colors.accent} style={{ margin: spacing.md }} /> : undefined}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push({ pathname: '/(app)/events/[eventId]', params: { eventId: item.id } })}
                accessibilityRole="button"
                accessibilityLabel={`View event: ${item.name}`}
              >
                <Card style={styles.card}>
                  <View style={styles.row}>
                    <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
                    <StatusPill status={item.status} />
                  </View>
                  {item.description ? <Text style={styles.desc} numberOfLines={2}>{item.description}</Text> : null}
                  <View style={styles.row}>
                    <Text style={styles.meta}>📅 {formatDate(item.startDate)}</Text>
                    {item.accessRole === 'admin' ? <Text style={styles.admin}>Admin</Text> : null}
                  </View>
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
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.md, paddingTop: spacing.sm },
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  name: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.textPrimary, marginRight: spacing.sm },
  desc: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.sm, lineHeight: 20 },
  meta: { fontSize: fontSize.sm, color: colors.textMuted },
  admin: { fontSize: fontSize.xs, color: colors.accent, fontWeight: fontWeight.bold },
})
