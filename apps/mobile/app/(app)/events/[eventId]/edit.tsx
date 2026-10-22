import React from 'react'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { EventCreateInput } from '@hmi/shared'
import { apiGet, apiPatch } from '@/lib/api'
import { errorMessage } from '@/lib/format'
import type { EventDetail } from '@/lib/types'
import { EventForm, toLocalInput } from '@/components/EventForm'
import { ErrorMessage, Loader } from '@/components/ui'

export default function EditEventScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>()
  const qc = useQueryClient()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => apiGet<{ event: EventDetail }>(`/events/${eventId}`),
  })
  const mutation = useMutation({
    mutationFn: (input: EventCreateInput) => apiPatch(`/events/${eventId}`, input),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['event', eventId] }),
        qc.invalidateQueries({ queryKey: ['events'] }),
        qc.invalidateQueries({ queryKey: ['my-events'] }),
      ])
      router.back()
    },
  })

  if (isLoading) return <Loader />
  if (error || !data) return <ErrorMessage message={errorMessage(error, 'Failed to load event')} onRetry={refetch} />
  const e = data.event

  return (
    <>
      <Stack.Screen options={{ title: 'Edit Event' }} />
      <EventForm
        initial={{
          name: e.name,
          description: e.description ?? '',
          startDate: toLocalInput(e.startDate),
          endDate: toLocalInput(e.endDate),
          status: e.status,
        }}
        submitLabel="Save Changes"
        loading={mutation.isPending}
        serverError={mutation.error ? errorMessage(mutation.error) : null}
        onSubmit={(input) => mutation.mutate(input)}
      />
    </>
  )
}
