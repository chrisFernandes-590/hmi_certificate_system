import { useState } from 'react'
import { Select, Combobox, type SelectOption } from './Select'
import { Moon, Sun } from 'lucide-react'

export function SelectShowcase() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [basicVal, setBasicVal] = useState('upcoming')
  const [statusVal, setStatusVal] = useState('live')
  const [multiVal, setMultiVal] = useState<string[]>(['draft', 'live'])
  const [comboboxVal, setComboboxVal] = useState('apple')
  const [longListVal, setLongListVal] = useState('item-42')
  const [modalOpen, setModalOpen] = useState(false)

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    if (next === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  const basicOptions: SelectOption[] = [
    { value: 'all', label: 'All events', isDividerAfter: true },
    { value: 'draft', label: 'Drafts', color: 'gray' },
    { value: 'upcoming', label: 'Upcoming', color: 'green' },
    { value: 'live', label: 'Ongoing', color: 'yellow' },
    { value: 'completed', label: 'Completed', color: 'gray' },
    { value: 'cancelled', label: 'Cancelled', color: 'red' },
  ]

  const fruitOptions: SelectOption[] = [
    { value: 'apple', label: 'Apple', description: 'Fresh red delicious apple' },
    { value: 'banana', label: 'Banana', description: 'Tropical potassium source' },
    { value: 'cherry', label: 'Cherry', description: 'Sweet dark cherries' },
    { value: 'date', label: 'Date', description: 'Rich Mediterranean fruit' },
    { value: 'elderberry', label: 'Elderberry', description: 'Wild berry shrub' },
    { value: 'fig', label: 'Fig', description: 'Soft sweet tree fruit' },
    { value: 'grape', label: 'Grape', description: 'Wine & snack staple' },
    { value: 'honeydew', label: 'Honeydew', description: 'Sweet green melon' },
    { value: 'kiwi', label: 'Kiwi', description: 'Tangy fruit from New Zealand' },
    { value: 'lemon', label: 'Lemon', description: 'Tart citrus yellow fruit' },
    { value: 'mango', label: 'Mango', description: 'King of tropical fruits' },
    { value: 'orange', label: 'Orange', description: 'Juicy vitamin C classic' },
  ]

  const long500Options: SelectOption[] = Array.from({ length: 500 }, (_, i) => ({
    value: `item-${i + 1}`,
    label: `Participant #${i + 1} - Enterprise Guest`,
    description: `Registered user account ID: 2026-US-${(1000 + i).toString()}`,
  }))

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '32px 24px',
        background: 'var(--background)',
        color: 'var(--foreground)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div style={{ maxWidth: 840, margin: '0 auto' }}>
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 24,
            paddingBottom: 16,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>
              Notion-Style Select & Combobox Showcase
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-foreground)' }}>
              Accessible, pixel-perfect, Notion-spec dropdowns with light/dark theme support.
            </p>
          </div>
          <button
            type="button"
            id="theme-toggle-btn"
            onClick={toggleTheme}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--foreground)',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
            <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
          </button>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
          {/* Section 1: Closed & Hover State */}
          <div
            id="showcase-closed-section"
            style={{ padding: 18, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 8px' }}>
              1. Basic Status Filter (Notion Trigger)
            </h3>
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 12 }}>
              Inline label "Status", closed trigger height 32px, 1px hairline border, hover highlight.
            </p>
            <Select
              id="basic-status-select"
              inlineLabel="Status"
              value={basicVal}
              onValueChange={setBasicVal}
              options={basicOptions}
              clearable
            />
          </div>

          {/* Section 2: Compact Size (sm) */}
          <div
            id="showcase-compact-section"
            style={{ padding: 18, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 8px' }}>
              2. Compact Size (sm = 28px) for Tables
            </h3>
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 12 }}>
              Used for attendance in table rows. Size="sm", pastel badge option styling.
            </p>
            <Select
              id="compact-attendance-select"
              size="sm"
              value={statusVal}
              onValueChange={setStatusVal}
              options={[
                { value: 'registered', label: 'Registered', color: 'blue' },
                { value: 'attended', label: 'Attended', color: 'green' },
                { value: 'absent', label: 'Absent', color: 'yellow' },
                { value: 'cancelled', label: 'Cancelled', color: 'red' },
              ]}
            />
          </div>

          {/* Section 3: Disabled State */}
          <div
            id="showcase-disabled-section"
            style={{ padding: 18, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 8px' }}>
              3. Disabled State
            </h3>
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 12 }}>
              Trigger is dimmed (opacity 0.5) and interactions are disabled.
            </p>
            <Select
              id="disabled-select"
              disabled
              value="draft"
              options={basicOptions}
              inlineLabel="Status"
            />
          </div>

          {/* Section 4: Combobox with Search */}
          <div
            id="showcase-combobox-section"
            style={{ padding: 18, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 8px' }}>
              4. Combobox (Built-in Sticky Search)
            </h3>
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 12 }}>
              Auto-enabled when {'>'} 8 options. Sticky search input at top with instant filtering.
            </p>
            <Combobox
              id="combobox-fruits"
              value={comboboxVal}
              onValueChange={setComboboxVal}
              options={fruitOptions}
              fullWidth
            />
          </div>

          {/* Section 5: Multi-Select */}
          <div
            id="showcase-multi-section"
            style={{ padding: 18, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 8px' }}>
              5. Multi-Select Variant
            </h3>
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 12 }}>
              Checkmarks on selected items, menu stays open, displays tags or count badges.
            </p>
            <Select
              id="multi-status-select"
              multiple
              clearable
              value={multiVal}
              onValueChange={setMultiVal}
              options={basicOptions}
              fullWidth
            />
          </div>

          {/* Section 6: 500+ Items Virtualized List */}
          <div
            id="showcase-virtualized-section"
            style={{ padding: 18, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 8px' }}>
              6. Virtualized List (500+ Items)
            </h3>
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 12 }}>
              Windowed rendering for {'>'} 100 items. Smooth 60fps scrolling without DOM lag.
            </p>
            <Select
              id="virtualized-select"
              searchable
              value={longListVal}
              onValueChange={setLongListVal}
              options={long500Options}
              fullWidth
            />
          </div>

          {/* Section 7: Modal / Overflow Clipping Avoidance */}
          <div
            id="showcase-modal-section"
            style={{ padding: 18, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 8px' }}>
              7. Non-Clipping Portaling Inside Modal
            </h3>
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 12 }}>
              Opens inside an overflow:hidden modal dialog, portaled to document.body.
            </p>
            <button
              type="button"
              id="open-modal-demo-btn"
              onClick={() => setModalOpen(true)}
              style={{
                padding: '6px 12px',
                borderRadius: 4,
                border: '1px solid var(--border)',
                background: 'var(--accent)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              Open Overflow Modal
            </button>

            {modalOpen && (
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0,0,0,0.5)',
                  display: 'grid',
                  placeItems: 'center',
                  zIndex: 9000,
                }}
              >
                <div
                  style={{
                    background: 'var(--surface)',
                    padding: 24,
                    borderRadius: 8,
                    width: 380,
                    overflow: 'hidden',
                    border: '1px solid var(--border)',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                  }}
                >
                  <h4 style={{ margin: '0 0 12px' }}>Modal with overflow:hidden</h4>
                  <Select
                    id="modal-select-demo"
                    value={basicVal}
                    onValueChange={setBasicVal}
                    options={basicOptions}
                    fullWidth
                  />
                  <div style={{ marginTop: 16, textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => setModalOpen(false)}
                      style={{
                        padding: '4px 10px',
                        border: '1px solid var(--border)',
                        background: 'transparent',
                        color: 'var(--foreground)',
                        borderRadius: 4,
                        cursor: 'pointer',
                      }}
                    >
                      Close Modal
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
