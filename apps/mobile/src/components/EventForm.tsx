import React, { useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import type { EventCreateInput, EventStatus } from '@hmi/shared'
import { Button, Input } from '@/components/ui'
import { FilterChips } from '@/components/FilterChips'
import { colors, fontSize, spacing } from '@/lib/design'

const STATUS_OPTIONS: { label: string; value: EventStatus }[] = [
  { label: 'Draft', value: 'draft' },
  { label: 'Published', value: 'published' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
]

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/** ISO string -> "YYYY-MM-DD HH:mm" in the device's local time. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "YYYY-MM-DD HH:mm" (local time) -> ISO string, or null when invalid. */
export function fromLocalInput(text: string): string | null {
  const m = DATE_RE.exec(text.trim())
  if (!m) return null
  const [, y, mo, d, h, mi] = m.map(Number) as number[]
  const date = new Date(y, mo - 1, d, h, mi)
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null
  return date.toISOString()
}

export type EventFormValues = {
  name: string
  description: string
  startDate: string
  endDate: string
  status: EventStatus
}

export const EMPTY_EVENT_FORM: EventFormValues = {
  name: '',
  description: '',
  startDate: '',
  endDate: '',
  status: 'draft',
}

export function EventForm({
  initial = EMPTY_EVENT_FORM,
  submitLabel,
  loading,
  serverError,
  onSubmit,
}: {
  initial?: EventFormValues
  submitLabel: string
  loading: boolean
  serverError?: string | null
  onSubmit: (input: EventCreateInput) => void
}) {
  const [values, setValues] = useState<EventFormValues>(initial)
  const [errors, setErrors] = useState<Partial<Record<keyof EventFormValues, string>>>({})

  function set<K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  function submit() {
    const e: typeof errors = {}
    const name = values.name.trim()
    if (!name) e.name = 'Name is required'
    const start = fromLocalInput(values.startDate)
    if (!start) e.startDate = 'Use format YYYY-MM-DD HH:mm'
    let end: string | null = null
    if (values.endDate.trim()) {
      end = fromLocalInput(values.endDate)
      if (!end) e.endDate = 'Use format YYYY-MM-DD HH:mm'
      else if (start && new Date(end) < new Date(start)) e.endDate = 'End must not be before start'
    }
    setErrors(e)
    if (Object.keys(e).length > 0 || !start) return
    onSubmit({
      name,
      description: values.description.trim() || null,
      startDate: start,
      endDate: end,
      status: values.status,
    })
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Input label="Event name" value={values.name} onChangeText={(t) => set('name', t)} error={errors.name} maxLength={200} />
      <Input
        label="Description (optional)"
        value={values.description}
        onChangeText={(t) => set('description', t)}
        multiline
        style={{ minHeight: 90, textAlignVertical: 'top' }}
      />
      <Input
        label="Start (local time)"
        placeholder="2026-11-01 10:00"
        value={values.startDate}
        onChangeText={(t) => set('startDate', t)}
        error={errors.startDate}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Input
        label="End (optional, local time)"
        placeholder="2026-11-01 15:00"
        value={values.endDate}
        onChangeText={(t) => set('endDate', t)}
        error={errors.endDate}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={styles.label}>Status</Text>
      <View style={{ marginHorizontal: -spacing.md, marginBottom: spacing.md }}>
        <FilterChips options={STATUS_OPTIONS} value={values.status} onChange={(s) => set('status', s)} />
      </View>
      <Text style={styles.hint}>Only published events can be discovered and registered for by other users.</Text>
      {serverError ? <Text style={styles.error}>{serverError}</Text> : null}
      <Button label={submitLabel} loading={loading} onPress={submit} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, paddingBottom: spacing.xxl },
  label: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.xs },
  hint: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing.md },
  error: { color: colors.danger, fontSize: fontSize.sm, marginBottom: spacing.md },
})
