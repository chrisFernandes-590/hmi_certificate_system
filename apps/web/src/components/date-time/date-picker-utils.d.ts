export function dateKey(date: Date): string
export function fromKey(value: string): Date
export function monthStart(date: Date): Date
export function monthLabel(date: Date, locale?: string): string
export function validDate(year: number, month: number, day: number): string | null
export function parseDate(text: string, locale?: string): string | null
export function formatDate(value: string | null, locale?: string, time?: boolean): string
export function parseTime(text: string): string | null
