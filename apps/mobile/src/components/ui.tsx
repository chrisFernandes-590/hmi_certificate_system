import React from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
  type ViewProps,
} from 'react-native'
import { colors, fontSize, fontWeight, radius, spacing } from '@/lib/design'

/* ─── Button ─────────────────────────────────────────────────── */
interface ButtonProps extends PressableProps {
  label: string
  loading?: boolean
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md'
}

export function Button({
  label,
  loading = false,
  variant = 'primary',
  size = 'md',
  disabled,
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading
  const bg =
    variant === 'primary'
      ? colors.accent
      : variant === 'danger'
        ? colors.danger
        : variant === 'secondary'
          ? colors.bgCard
          : 'transparent'
  const textColor = variant === 'ghost' ? colors.accent : colors.textOnAccent
  const paddingV = size === 'sm' ? spacing.sm - 2 : spacing.sm + 2

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, paddingVertical: paddingV, opacity: isDisabled ? 0.5 : pressed ? 0.82 : 1 },
        style as object,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <Text style={[styles.buttonText, { color: textColor, fontSize: size === 'sm' ? fontSize.sm : fontSize.base }]}>
          {label}
        </Text>
      )}
    </Pressable>
  )
}

/* ─── TextInput wrapper ───────────────────────────────────────── */
interface InputProps extends TextInputProps {
  label?: string
  error?: string
}

export function Input({ label, error, style, ...props }: InputProps) {
  return (
    <View style={styles.inputWrapper}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.input, error ? styles.inputError : undefined, style]}
        {...props}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  )
}

/* ─── Card ────────────────────────────────────────────────────── */
export function Card({ style, children, ...props }: ViewProps) {
  return (
    <View style={[styles.card, style]} {...props}>
      {children}
    </View>
  )
}

/* ─── Screen ──────────────────────────────────────────────────── */
export function ScreenView({ style, children, ...props }: ViewProps) {
  return (
    <View style={[styles.screen, style]} {...props}>
      {children}
    </View>
  )
}

/* ─── Section header ──────────────────────────────────────────── */
export function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>
}

/* ─── StatusPill ──────────────────────────────────────────────── */
const STATUS_CONFIG: Record<string, { bg: string; fg: string }> = {
  issued: { bg: colors.successBg, fg: colors.success },
  draft: { bg: colors.bgMuted, fg: colors.textSecondary },
  revoked: { bg: colors.revokedBg, fg: colors.revoked },
  registered: { bg: '#1e3a5f', fg: '#60a5fa' },
  attended: { bg: colors.successBg, fg: colors.success },
  absent: { bg: colors.dangerBg, fg: colors.danger },
  cancelled: { bg: colors.bgMuted, fg: colors.textMuted },
  published: { bg: '#1e3a5f', fg: '#60a5fa' },
  completed: { bg: colors.successBg, fg: colors.success },
}

export function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { bg: colors.bgMuted, fg: colors.textSecondary }
  return (
    <View style={[styles.pill, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.pillText, { color: cfg.fg }]}>{status}</Text>
    </View>
  )
}

/* ─── ErrorMessage ────────────────────────────────────────────── */
export function ErrorMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorHeading}>Something went wrong</Text>
      <Text style={styles.errorBody}>{message}</Text>
      {onRetry && (
        <Button label="Retry" variant="ghost" size="sm" style={{ marginTop: spacing.md }} onPress={onRetry} />
      )}
    </View>
  )
}

/* ─── EmptyState ──────────────────────────────────────────────── */
export function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>📭</Text>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  )
}

/* ─── Loader ──────────────────────────────────────────────────── */
export function Loader({ text = 'Loading…' }: { text?: string }) {
  return (
    <View style={styles.loader}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={styles.loaderText}>{text}</Text>
    </View>
  )
}

/* ─── Divider ─────────────────────────────────────────────────── */
export function Divider() {
  return <View style={styles.divider} />
}

/* ─── Styles ──────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  button: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  buttonText: {
    fontWeight: fontWeight.semibold,
  },
  inputWrapper: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.bgInput,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    color: colors.textPrimary,
    fontSize: fontSize.base,
    minHeight: 44,
  },
  inputError: {
    borderColor: colors.danger,
  },
  errorText: {
    fontSize: fontSize.xs,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  sectionHeader: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  pill: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  pillText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textTransform: 'capitalize',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  errorHeading: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  errorBody: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loaderText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
})
