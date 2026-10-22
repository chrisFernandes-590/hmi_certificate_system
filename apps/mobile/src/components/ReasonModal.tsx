import React, { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, View } from 'react-native'
import { Button, Input } from '@/components/ui'
import { colors, fontSize, fontWeight, radius, spacing } from '@/lib/design'

/** Cross-platform confirmation dialog that requires a text reason (Alert.prompt is iOS-only). */
export function ReasonModal({
  visible,
  title,
  message,
  confirmLabel,
  loading,
  error,
  onCancel,
  onConfirm,
}: {
  visible: boolean
  title: string
  message: string
  confirmLabel: string
  loading?: boolean
  error?: string | null
  onCancel: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  useEffect(() => {
    if (visible) {
      setReason('')
      setTouched(false)
    }
  }, [visible])

  const trimmed = reason.trim()
  const invalid = trimmed.length < 3 || trimmed.length > 500

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet} accessibilityViewIsModal>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <Input
            label="Reason (3–500 characters)"
            value={reason}
            onChangeText={setReason}
            multiline
            maxLength={500}
            style={{ minHeight: 80, textAlignVertical: 'top' }}
            error={touched && invalid ? 'Enter a reason of at least 3 characters' : undefined}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <Button label="Cancel" variant="secondary" onPress={onCancel} disabled={loading} style={{ flex: 1 }} />
            <Button
              label={confirmLabel}
              variant="danger"
              loading={loading}
              onPress={() => {
                setTouched(true)
                if (!invalid) onConfirm(trimmed)
              }}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing.md },
  sheet: { backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: spacing.lg },
  title: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginBottom: spacing.xs },
  message: { color: colors.textSecondary, fontSize: fontSize.sm, marginBottom: spacing.md, lineHeight: 20 },
  error: { color: colors.danger, fontSize: fontSize.sm, marginBottom: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
})
