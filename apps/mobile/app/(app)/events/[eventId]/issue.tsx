import React, { useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { apiGet, apiPost, qs } from '@/lib/api'
import { errorMessage } from '@/lib/format'
import { nextPageParam, useDebounced } from '@/lib/hooks'
import type { BulkIssueResponse, BulkIssueResult, IssuedCertificate, Participant, ParticipantsResponse } from '@/lib/types'
import { Button, Card, EmptyState, ErrorMessage, Input, Loader, StatusPill } from '@/components/ui'
import { SearchBar } from '@/components/SearchBar'
import { colors, fontSize, fontWeight, radius, spacing } from '@/lib/design'

const MAX_BULK = 100
type Eligible = 'registered' | 'attended'

export default function IssueCertificatesScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [title, setTitle] = useState('Certificate of Achievement')
  const [description, setDescription] = useState('')
  const [selected, setSelected] = useState<Record<string, Participant>>({})
  const [results, setResults] = useState<BulkIssueResult[] | null>(null)
  const [titleError, setTitleError] = useState<string | undefined>()
  const debounced = useDebounced(search.trim())

  // Only registered / attended registrants are eligible for issuance (backend enforces this too).
  const registered = useParticipants(eventId, 'registered', debounced)
  const attended = useParticipants(eventId, 'attended', debounced)

  const loading = registered.isLoading || attended.isLoading
  const error = registered.error ?? attended.error
  const participants = [
    ...(registered.data?.pages.flatMap((p) => p.participants) ?? []),
    ...(attended.data?.pages.flatMap((p) => p.participants) ?? []),
  ]
  const selectedList = Object.values(selected)

  function toggle(p: Participant) {
    setSelected((cur) => {
      const next = { ...cur }
      if (next[p.participantId]) delete next[p.participantId]
      else if (Object.keys(next).length < MAX_BULK) next[p.participantId] = p
      return next
    })
  }

  const issue = useMutation({
    mutationFn: async (): Promise<BulkIssueResult[]> => {
      const ids = selectedList.map((p) => p.participantId)
      const common = { title: title.trim(), description: description.trim() || null }
      if (ids.length === 1) {
        try {
          const data = await apiPost<{ certificate: IssuedCertificate }>(`/events/${eventId}/certificates`, {
            participantId: ids[0],
            ...common,
          })
          return [{ participantId: ids[0], success: true, certificate: data.certificate }]
        } catch (e) {
          const statusCode = (e as { statusCode?: number }).statusCode ?? 500
          return [{ participantId: ids[0], success: false, error: { statusCode, message: errorMessage(e) } }]
        }
      }
      const data = await apiPost<BulkIssueResponse>(`/events/${eventId}/certificates/bulk`, { participantIds: ids, ...common })
      return data.results
    },
    onSuccess: async (r) => {
      setResults(r)
      setSelected({})
      await qc.invalidateQueries({ queryKey: ['event-certificates', eventId] })
      await qc.invalidateQueries({ queryKey: ['my-certificates'] })
    },
  })

  function submit() {
    if (!title.trim()) {
      setTitleError('Title is required')
      return
    }
    setTitleError(undefined)
    issue.mutate()
  }

  const selectedNames: Record<string, string> = {}
  for (const p of participants) selectedNames[p.participantId] = p.name

  if (results) {
    const nameOf = (id: string) => selectedNames[id] ?? id
    const ok = results.filter((r) => r.success).length
    return (
      <>
        <Stack.Screen options={{ title: 'Issuance Results' }} />
        <FlatList
          style={{ backgroundColor: colors.bg }}
          data={results}
          keyExtractor={(r) => r.participantId}
          contentContainerStyle={{ padding: spacing.md }}
          ListHeaderComponent={
            <Text style={styles.summary}>
              {ok} issued · {results.length - ok} failed
            </Text>
          }
          renderItem={({ item }) => (
            <Card style={{ marginBottom: spacing.sm }}>
              <View style={styles.row}>
                <Text style={[styles.name, { flex: 1 }]}>{nameOf(item.participantId)}</Text>
                <StatusPill status={item.success ? 'issued' : 'cancelled'} />
              </View>
              <Text style={item.success ? styles.okText : styles.failText}>
                {item.success ? `Issued ${item.certificate.certificateNumber}` : item.error.message}
              </Text>
            </Card>
          )}
          ListFooterComponent={<Button label="Issue more" variant="secondary" onPress={() => setResults(null)} />}
        />
      </>
    )
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Issue Certificates' }} />
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ padding: spacing.md, paddingBottom: 0 }}>
          <Input label="Certificate title" value={title} onChangeText={setTitle} error={titleError} maxLength={140} />
          <Input
            label="Description (optional)"
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={2000}
            style={{ minHeight: 60, textAlignVertical: 'top' }}
          />
        </View>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search recipients…" />
        {loading ? (
          <Loader />
        ) : error ? (
          <ErrorMessage message={errorMessage(error, 'Failed to load recipients')} onRetry={() => { void registered.refetch(); void attended.refetch() }} />
        ) : (
          <FlatList
            data={participants}
            keyExtractor={(p) => p.registrationId}
            contentContainerStyle={{ padding: spacing.md, paddingTop: spacing.xs }}
            onEndReached={() => {
              if (registered.hasNextPage && !registered.isFetchingNextPage) void registered.fetchNextPage()
              if (attended.hasNextPage && !attended.isFetchingNextPage) void attended.fetchNextPage()
            }}
            onEndReachedThreshold={0.4}
            ListEmptyComponent={<EmptyState message="No eligible recipients (registered or attended)." />}
            ListFooterComponent={registered.isFetchingNextPage || attended.isFetchingNextPage ? <ActivityIndicator color={colors.accent} /> : undefined}
            renderItem={({ item }) => {
              const on = Boolean(selected[item.participantId])
              return (
                <Pressable
                  onPress={() => toggle(item)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`Select ${item.name}`}
                  style={[styles.pick, on && styles.pickOn]}
                >
                  <Ionicons name={on ? 'checkbox' : 'square-outline'} size={24} color={on ? colors.accent : colors.textMuted} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.name}</Text>
                    <Text style={styles.email}>{item.email}</Text>
                  </View>
                  <StatusPill status={item.status} />
                </Pressable>
              )
            }}
          />
        )}
        <View style={styles.footer}>
          {issue.error ? <Text style={styles.failText}>{errorMessage(issue.error)}</Text> : null}
          <Button
            label={selectedList.length ? `Issue to ${selectedList.length} recipient${selectedList.length > 1 ? 's' : ''}` : 'Select recipients'}
            disabled={selectedList.length === 0}
            loading={issue.isPending}
            onPress={submit}
          />
          {selectedList.length >= MAX_BULK ? <Text style={styles.email}>Maximum {MAX_BULK} recipients per batch.</Text> : null}
        </View>
      </View>
    </>
  )
}

function useParticipants(eventId: string, status: Eligible, search: string) {
  return useInfiniteQuery({
    queryKey: ['participants', eventId, { search, filter: status, for: 'issue' }],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      apiGet<ParticipantsResponse>(
        `/events/${eventId}/participants${qs({ page: pageParam, pageSize: 50, search, status })}`,
      ),
    getNextPageParam: nextPageParam,
  })
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    minHeight: 56,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickOn: { borderColor: colors.accent },
  name: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  email: { color: colors.textSecondary, fontSize: fontSize.sm },
  footer: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bgCard, gap: spacing.sm },
  summary: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginBottom: spacing.md },
  okText: { color: colors.success, fontSize: fontSize.sm, marginTop: spacing.xs },
  failText: { color: colors.danger, fontSize: fontSize.sm, marginTop: spacing.xs },
})
