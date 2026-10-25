import { AppError } from '../../errors/app-error.js'
import type { ParticipantImportMapping } from '../../db/schema.js'
import type { ImportContact } from '../../repositories/participants/participant-import-repository.js'

const MAX_FIELD_LENGTH = 5000

/** Incrementally parses a streamed S3 object and yields one mapped row at a time. */
export async function* parseParticipantImportCsv(
  stream: AsyncIterable<Uint8Array>,
  mapping: ParticipantImportMapping,
): AsyncGenerator<ImportContact> {
  const decoder = new TextDecoder()
  let field = ''
  let record: string[] = []
  let inQuotes = false
  let quotePending = false
  let header: string[] | undefined
  let rowNumber = 0

  const emit = (cell: string) => {
    record.push(cell.trim())
    field = ''
    if (record.length > 100) throw new AppError(422, 'CSV rows may contain no more than 100 columns')
  }
  const validateMapping = () => {
    if (!header) {
      throw new AppError(422, 'CSV file is missing its header row')
    }
    const indices = [mapping.name, mapping.email, ...(mapping.phone === undefined ? [] : [mapping.phone]), ...(mapping.organization === undefined ? [] : [mapping.organization])]
    if (indices.some((index) => !Number.isInteger(index) || index < 0 || index >= header!.length) || new Set(indices).size !== indices.length) {
      throw new AppError(422, 'Column mapping is invalid. Choose a different column for each field.')
    }
  }

  const processRecord = (): ImportContact | null => {
    emit(field)
    if (!header) {
      header = record.map((cell, index) => index === 0 ? cell.replace(/^\uFEFF/, '') : cell)
      record = []
      validateMapping()
      return null
    }
    rowNumber++
    const cells = record
    record = []
    if (cells.every((cell) => !cell)) return null
    const name = cells[mapping.name] ?? ''
    const email = (cells[mapping.email] ?? '').trim().toLowerCase()
    const phone = mapping.phone === undefined ? null : (cells[mapping.phone] ?? '').trim() || null
    const organization = mapping.organization === undefined ? null : (cells[mapping.organization] ?? '').trim() || null
    let error: string | undefined
    if (cells.length !== header.length) error = `Expected ${header.length} columns, found ${cells.length}.`
    else if (!name.trim()) error = 'Name is required.'
    else if (name.length > 200) error = 'Name exceeds the 200 character limit.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) error = 'Enter a valid email address.'
    else if (phone && phone.length > 50) error = 'Phone exceeds the 50 character limit.'
    else if (organization && organization.length > 200) error = 'Organization exceeds the 200 character limit.'
    return { row: rowNumber + 1, name: name.slice(0, 200), email, phone: phone?.slice(0, 50) ?? null, organization: organization?.slice(0, 200) ?? null, ...(error ? { error } : {}) }
  }

  const consume = async function* (text: string): AsyncGenerator<ImportContact> {
    for (let index = 0; index < text.length; index++) {
      const char = text[index]
      if (quotePending) {
        quotePending = false
        if (char === '"') { field += '"'; continue }
        inQuotes = false
      }
      if (inQuotes) {
        if (char === '"') {
          if (index + 1 < text.length && text[index + 1] === '"') { field += '"'; index++ }
          else if (index + 1 === text.length) quotePending = true
          else inQuotes = false
        } else field += char
      } else if (char === '"') {
        if (field.length) throw new AppError(422, 'CSV contains an unexpected quote in a field')
        inQuotes = true
      } else if (char === ',') emit(field)
      else if (char === '\n' || char === '\r') {
        const row = processRecord()
        if (row) yield row
        if (char === '\r' && text[index + 1] === '\n') index++
      } else field += char
      if (field.length > MAX_FIELD_LENGTH) throw new AppError(422, 'A CSV field exceeds the 5,000 character limit')
    }
  }

  for await (const chunk of stream) {
    yield* consume(decoder.decode(chunk, { stream: true }))
  }
  yield* consume(decoder.decode())
  if (inQuotes && !quotePending) throw new AppError(422, 'CSV has an unclosed quoted field')
  if (quotePending) { quotePending = false; inQuotes = false }
  if (field.length || record.length) {
    const row = processRecord()
    if (row) yield row
  }
  if (!header) throw new AppError(422, 'CSV file is empty or has no header row')
}
