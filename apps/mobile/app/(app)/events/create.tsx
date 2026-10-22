import React from 'react'
import { router, Stack } from 'expo-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { EventCreateInput, EventData } from '@hmi/shared'
import { apiPost } from '@/lib/api'
import { errorMessage } from '@/lib/format'
import { EventForm } from '@/components/EventForm'

export default function CreateEventScreen() {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: (input: EventCreateInput) => apiPost<EventData>('/events', input),
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: ['events'] })
      router.replace({ pathname: '/(app)/events/[eventId]', params: { eventId: data.event.id } })
    },
  })

  return (
    <>
      <Stack.Screen options={{ title: 'New Event' }} />
      <EventForm
        submitLabel="Create Event"
        loading={mutation.isPending}
        serverError={mutation.error ? errorMessage(mutation.error) : null}
        onSubmit={(input) => mutation.mutate(input)}
      />
    </>
  )
}
