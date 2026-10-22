/**
 * Design tokens for the HMI Certificate mobile app.
 * Uses a dark-first palette with teal accent.
 */

export const colors = {
  // Backgrounds
  bg: '#0f172a',
  bgCard: '#1e293b',
  bgInput: '#1e293b',
  bgMuted: '#334155',

  // Borders
  border: '#334155',
  borderFocus: '#0ea5e9',

  // Text
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  textOnAccent: '#ffffff',

  // Accent / brand
  accent: '#0ea5e9',
  accentDark: '#0284c7',

  // Status
  success: '#10b981',
  successBg: '#064e3b',
  warning: '#f59e0b',
  warningBg: '#451a03',
  danger: '#ef4444',
  dangerBg: '#450a0a',
  revoked: '#f97316',
  revokedBg: '#431407',

  // Certificate status
  issued: '#10b981',
  draft: '#94a3b8',
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 9999,
} as const

export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  xxxl: 34,
} as const

export const fontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
}
