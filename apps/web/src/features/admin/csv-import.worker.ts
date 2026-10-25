type Mapping = { name: number; email: number; phone?: number; organization?: number }
type Contact = { row: number; name: string; email: string; phone: string; organization: string; issue?: string }
type Request = { type: 'inspect' | 'validate'; file: File; mapping?: Mapping }
type Progress = { type: 'progress'; bytesRead: number; totalBytes: number; rowsParsed: number }

const scope = self as unknown as { onmessage: ((event: MessageEvent<Request>) => void) | null; postMessage(message: unknown): void }
scope.onmessage = (event: MessageEvent<Request>) => { void handle(event.data) }

async function handle(request: Request) {
  const { file, type, mapping } = request
  const decoder = new TextDecoder()
  const reader = file.stream().getReader()
  const headers: string[] = []
  const previewRows: string[][] = []
  const validatedPreview: Contact[] = []
  const seen = new Set<string>()
  let field = ''
  let record: string[] = []
  let inQuotes = false
  let quotePending = false
  let rowCount = 0
  let bytesRead = 0
  let validRows = 0
  let duplicateRows = 0
  let invalidRows = 0
  const errors: Contact[] = []

  const processRecord = () => {
    record.push(field.trim())
    field = ''
    if (record.length > 100) throw new Error('CSV rows may contain no more than 100 columns.')
    if (headers.length === 0) {
      record.forEach((cell, index) => { headers.push(index === 0 ? cell.replace(/^\uFEFF/, '') : cell) })
      record = []
      return
    }
    const values = record
    record = []
    if (values.every((value) => !value)) return
    rowCount++
    if (rowCount > 20_000) throw new Error('This CSV contains more than 20,000 participant rows.')
    if (type === 'inspect') {
      if (previewRows.length < 15) previewRows.push(values)
      return
    }
    if (!mapping) throw new Error('Choose the name and email columns.')
    const name = values[mapping.name] ?? ''
    const email = (values[mapping.email] ?? '').trim().toLowerCase()
    const phone = mapping.phone === undefined ? '' : values[mapping.phone] ?? ''
    const organization = mapping.organization === undefined ? '' : values[mapping.organization] ?? ''
    let issue: string | undefined
    if (values.length !== headers.length) issue = `Expected ${headers.length} columns, found ${values.length}.`
    else if (!name.trim()) issue = 'Name is required.'
    else if (name.length > 200) issue = 'Name exceeds 200 characters.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) issue = 'Enter a valid email address.'
    else if (phone.length > 50) issue = 'Phone exceeds 50 characters.'
    else if (organization.length > 200) issue = 'Organization exceeds 200 characters.'
    else if (seen.has(email)) issue = 'This email appears more than once in the file.'
    if (email) seen.add(email)
    const contact: Contact = { row: rowCount + 1, name: name.slice(0, 200), email, phone: phone.slice(0, 50), organization: organization.slice(0, 200), ...(issue ? { issue } : {}) }
    if (issue && issue.includes('more than once')) duplicateRows++
    else if (issue) {
      invalidRows++
      if (errors.length < 20) errors.push(contact)
    } else validRows++
    if (issue?.includes('more than once') && errors.length < 20) errors.push(contact)
    if (validatedPreview.length < 15) validatedPreview.push(contact)
  }

  const consume = async (text: string) => {
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
        if (field.length) throw new Error('CSV contains an unexpected quote in a field.')
        inQuotes = true
      } else if (char === ',') { record.push(field.trim()); field = '' }
      else if (char === '\n' || char === '\r') {
        processRecord()
        if (char === '\r' && text[index + 1] === '\n') index++
      } else field += char
      if (field.length > 5000) throw new Error('A CSV field exceeds 5,000 characters.')
    }
  }

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      bytesRead += value.byteLength
      await consume(decoder.decode(value, { stream: true }))
      scope.postMessage({ type: 'progress', bytesRead, totalBytes: file.size, rowsParsed: rowCount } satisfies Progress)
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    }
    await consume(decoder.decode())
    if (inQuotes && !quotePending) throw new Error('CSV has an unclosed quoted field.')
    if (quotePending) { quotePending = false; inQuotes = false }
    if (field.length || record.length) processRecord()
    if (!headers.length) throw new Error('The CSV file is empty or has no header row.')
    if (rowCount === 0) throw new Error('No participant rows were found in this CSV.')
    const suggested = {
      name: findHeader(headers, ['name', 'full name', 'participant name']),
      email: findHeader(headers, ['email', 'email address']),
      phone: findHeader(headers, ['phone', 'phone number', 'mobile']),
      organization: findHeader(headers, ['organization', 'organisation', 'company']),
    }
    scope.postMessage({ type: 'result', result: type === 'inspect' ? { headers, rowCount, previewRows, suggested } : { headers, rowCount, validRows, duplicateRows, invalidRows, errors, previewRows: validatedPreview } })
  } catch (error) {
    await reader.cancel().catch(() => undefined)
    scope.postMessage({ type: 'error', error: error instanceof Error ? error.message : 'Could not inspect this CSV.' })
  } finally {
    reader.releaseLock()
  }
}

function findHeader(headers: string[], candidates: string[]) {
  const index = headers.findIndex((header) => candidates.includes(header.trim().toLowerCase()))
  return index < 0 ? undefined : index
}
