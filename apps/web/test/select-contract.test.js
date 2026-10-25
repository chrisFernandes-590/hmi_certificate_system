import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.resolve(__dirname, '../src')

function scanDirectoryForSelect(dir) {
  const results = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...scanDirectoryForSelect(fullPath))
    } else if (/\.(tsx|jsx|html)$/.test(entry.name)) {
      const content = fs.readFileSync(fullPath, 'utf8')
      // Match raw HTML <select (not <Select from custom component)
      const matches = content.match(/<select[\s>]/g)
      if (matches) {
        results.push({ file: fullPath, count: matches.length })
      }
    }
  }
  return results
}

test('invariant: zero raw <select> elements remain in apps/web/src', () => {
  const violations = scanDirectoryForSelect(srcDir)
  assert.deepEqual(violations, [], `Expected zero raw <select> elements, but found violations in: ${JSON.stringify(violations)}`)
})

test('Select and Combobox components are properly exported and available', () => {
  const selectFile = path.join(srcDir, 'components/ui/Select.tsx')
  assert.ok(fs.existsSync(selectFile), 'Select.tsx should exist')
  const content = fs.readFileSync(selectFile, 'utf8')
  assert.ok(content.includes('export const Select ='), 'Select component should be exported')
  assert.ok(content.includes('export const Combobox ='), 'Combobox component should be exported')
  assert.ok(content.includes('inlineLabel'), 'inlineLabel should be supported')
  assert.ok(content.includes('notion-select-pill'), 'Pastel tag pills should be supported')
  assert.ok(content.includes('notion-select-drag-handle'), 'Mobile bottom sheet drag handle should be supported')
})
