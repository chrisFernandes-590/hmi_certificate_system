import React, {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Popover } from '@base-ui/react/popover'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import './Select.css'

export interface SelectOption {
  value: string
  label: string
  icon?: React.ReactNode
  description?: string
  color?: 'gray' | 'green' | 'blue' | 'yellow' | 'red' | string
  disabled?: boolean
  group?: string
  isDividerAfter?: boolean
}

export interface SelectProps {
  value?: string | string[] | null
  defaultValue?: string | string[] | null
  onValueChange?: (value: any) => void
  onChange?: (event: { target: { value: any; name?: string } }) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  size?: 'sm' | 'md'
  name?: string
  id?: string
  className?: string
  triggerClassName?: string
  menuClassName?: string
  fullWidth?: boolean
  inlineLabel?: string
  clearable?: boolean
  multiple?: boolean
  searchable?: boolean
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  'aria-label'?: string
  'aria-labelledby'?: string
}

const STATUS_COLOR_MAP: Record<string, 'gray' | 'green' | 'blue' | 'yellow' | 'red'> = {
  draft: 'gray',
  drafts: 'gray',
  upcoming: 'green',
  published: 'green',
  live: 'yellow',
  ongoing: 'yellow',
  completed: 'gray',
  cancelled: 'red',
  revoked: 'red',
  failed: 'red',
  registered: 'blue',
  attended: 'green',
  absent: 'yellow',
  issued: 'green',
  valid: 'green',
}

function getOptionStatusColor(option: SelectOption): 'gray' | 'green' | 'blue' | 'yellow' | 'red' | undefined {
  if (option.color && ['gray', 'green', 'blue', 'yellow', 'red'].includes(option.color)) {
    return option.color as 'gray' | 'green' | 'blue' | 'yellow' | 'red'
  }
  const val = option.value.toLowerCase()
  const lbl = option.label.toLowerCase()
  return STATUS_COLOR_MAP[val] || STATUS_COLOR_MAP[lbl]
}

export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  {
    value: controlledValue,
    defaultValue,
    onValueChange,
    onChange,
    options = [],
    placeholder = 'Select…',
    disabled = false,
    size = 'md',
    name,
    id: customId,
    className,
    triggerClassName,
    menuClassName,
    fullWidth = false,
    inlineLabel,
    clearable = false,
    multiple = false,
    searchable: explicitlySearchable,
    loading = false,
    error = null,
    onRetry,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledby,
  },
  forwardedRef
) {
  const generatedId = useId()
  const selectId = customId || generatedId
  const listId = `${selectId}-list`

  // Controlled vs uncontrolled state
  const isControlled = controlledValue !== undefined
  const [internalValue, setInternalValue] = useState<string | string[]>(() => {
    if (defaultValue !== undefined && defaultValue !== null) return defaultValue
    return multiple ? [] : ''
  })

  const currentValue = useMemo(() => {
    return isControlled ? (controlledValue ?? (multiple ? [] : '')) : internalValue
  }, [isControlled, controlledValue, multiple, internalValue])

  // Popover open state
  const [isOpen, setIsOpen] = useState(false)
  const [isClosing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState<number>(-1)
  const [screenAnnouncement, setScreenAnnouncement] = useState('')

  // Virtualization & scroll refs
  const listRef = useRef<HTMLUListElement>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const typeaheadBuffer = useRef('')
  const typeaheadTimeout = useRef<any>(null)
  const touchStartY = useRef<number | null>(null)

  // Auto-enable search when options > 8 unless explicitly defined
  const isSearchable = explicitlySearchable ?? options.length > 8

  // Filtered options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options
    const query = searchQuery.toLowerCase().trim()
    return options.filter((opt) => {
      const matchLabel = opt.label.toLowerCase().includes(query)
      const matchDesc = opt.description ? opt.description.toLowerCase().includes(query) : false
      const matchVal = opt.value.toLowerCase().includes(query)
      return matchLabel || matchDesc || matchVal
    })
  }, [options, searchQuery])

  // Map of options by value for fast lookup
  const optionMap = useMemo(() => {
    const map = new Map<string, SelectOption>()
    for (const opt of options) {
      map.set(opt.value, opt)
    }
    return map
  }, [options])

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open)
    if (open) {
      setSearchQuery('')
      if (multiple) {
        setActiveIndex(0)
      } else {
        const found = filteredOptions.findIndex((opt) => opt.value === currentValue)
        setActiveIndex(found >= 0 ? found : 0)
      }
      if (isSearchable) {
        setTimeout(() => searchInputRef.current?.focus(), 50)
      }
    }
  }, [multiple, filteredOptions, currentValue, isSearchable])

  // Helper to update selection
  const handleSelectOption = useCallback(
    (option: SelectOption) => {
      if (option.disabled) return

      if (multiple) {
        const currentArr = Array.isArray(currentValue) ? currentValue : []
        const exists = currentArr.includes(option.value)
        const next = exists ? currentArr.filter((v) => v !== option.value) : [...currentArr, option.value]

        if (!isControlled) setInternalValue(next)
        onValueChange?.(next)
        onChange?.({ target: { value: next, name } })
        setScreenAnnouncement(`${exists ? 'Deselected' : 'Selected'} ${option.label}`)
      } else {
        if (!isControlled) setInternalValue(option.value)
        onValueChange?.(option.value)
        onChange?.({ target: { value: option.value, name } })
        setScreenAnnouncement(`Selected ${option.label}`)
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    },
    [multiple, currentValue, isControlled, onValueChange, onChange, name]
  )

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      const emptyVal = multiple ? [] : ''
      if (!isControlled) setInternalValue(emptyVal)
      onValueChange?.(emptyVal)
      onChange?.({ target: { value: emptyVal, name } })
      setScreenAnnouncement('Selection cleared')
      triggerRef.current?.focus()
    },
    [multiple, isControlled, onValueChange, onChange, name]
  )

  // Keyboard navigation inside list
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!isOpen) {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          setIsOpen(true)
        }
        return
      }

      const total = filteredOptions.length
      if (total === 0) {
        if (event.key === 'Escape') {
          event.preventDefault()
          setIsOpen(false)
          triggerRef.current?.focus()
        }
        return
      }

      switch (event.key) {
        case 'ArrowDown': {
          event.preventDefault()
          let next = activeIndex + 1
          while (next < total && filteredOptions[next]?.disabled) next++
          if (next < total) setActiveIndex(next)
          break
        }
        case 'ArrowUp': {
          event.preventDefault()
          let prev = activeIndex - 1
          while (prev >= 0 && filteredOptions[prev]?.disabled) prev--
          if (prev >= 0) setActiveIndex(prev)
          break
        }
        case 'Home': {
          event.preventDefault()
          let first = 0
          while (first < total && filteredOptions[first]?.disabled) first++
          if (first < total) setActiveIndex(first)
          break
        }
        case 'End': {
          event.preventDefault()
          let last = total - 1
          while (last >= 0 && filteredOptions[last]?.disabled) last--
          if (last >= 0) setActiveIndex(last)
          break
        }
        case 'PageDown': {
          event.preventDefault()
          const next = Math.min(total - 1, activeIndex + 10)
          setActiveIndex(next)
          break
        }
        case 'PageUp': {
          event.preventDefault()
          const prev = Math.max(0, activeIndex - 10)
          setActiveIndex(prev)
          break
        }
        case 'Enter': {
          event.preventDefault()
          const opt = filteredOptions[activeIndex]
          if (opt && !opt.disabled) {
            handleSelectOption(opt)
          }
          break
        }
        case ' ': {
          // If search input is focused, allow typing space
          if (document.activeElement === searchInputRef.current) return
          event.preventDefault()
          const opt = filteredOptions[activeIndex]
          if (opt && !opt.disabled) {
            handleSelectOption(opt)
          }
          break
        }
        case 'Escape': {
          event.preventDefault()
          setIsOpen(false)
          triggerRef.current?.focus()
          break
        }
        case 'Tab': {
          setIsOpen(false)
          break
        }
        default: {
          // Typeahead buffering (when search input is not active)
          if (document.activeElement !== searchInputRef.current && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            clearTimeout(typeaheadTimeout.current)
            typeaheadBuffer.current += event.key.toLowerCase()
            typeaheadTimeout.current = setTimeout(() => {
              typeaheadBuffer.current = ''
            }, 500)

            const query = typeaheadBuffer.current
            const foundIdx = filteredOptions.findIndex(
              (o) => !o.disabled && o.label.toLowerCase().startsWith(query)
            )
            if (foundIdx >= 0) {
              setActiveIndex(foundIdx)
            }
          }
          break
        }
      }
    },
    [isOpen, filteredOptions, activeIndex, handleSelectOption]
  )

  // Scroll active item into view
  useEffect(() => {
    if (isOpen && activeIndex >= 0 && listRef.current) {
      const activeEl = listRef.current.querySelector(`[data-index="${activeIndex}"]`) as HTMLElement | null
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [isOpen, activeIndex])

  // Mobile swipe down gesture handler
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0]?.clientY ?? null
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return
    const touchEndY = e.changedTouches[0]?.clientY ?? 0
    const deltaY = touchEndY - touchStartY.current
    if (deltaY > 60) {
      setIsOpen(false)
      triggerRef.current?.focus()
    }
    touchStartY.current = null
  }

  // Format trigger label representation
  const renderTriggerContent = () => {
    if (multiple) {
      const arr = Array.isArray(currentValue) ? currentValue : []
      if (arr.length === 0) {
        return <span className="notion-select-placeholder">{placeholder}</span>
      }
      if (arr.length <= 2) {
        return (
          <span className="notion-select-chips">
            {arr.map((val) => {
              const opt = optionMap.get(val)
              const statusColor = opt ? getOptionStatusColor(opt) : undefined
              return (
                <span key={val} className={cn('notion-select-chip', statusColor && `notion-select-pill--${statusColor}`)}>
                  {opt ? opt.label : val}
                </span>
              )
            })}
          </span>
        )
      }
      return (
        <span className="notion-select-chips">
          <span className="notion-select-count-badge">{arr.length} selected</span>
        </span>
      )
    }

    const singleVal = String(currentValue ?? '')
    if (!singleVal) {
      return <span className="notion-select-placeholder">{placeholder}</span>
    }

    const selectedOption = optionMap.get(singleVal)
    if (!selectedOption) {
      return <span className="notion-select-label-text">{singleVal}</span>
    }

    const statusColor = getOptionStatusColor(selectedOption)
    if (statusColor) {
      return (
        <span className={cn('notion-select-pill', `notion-select-pill--${statusColor}`)}>
          {selectedOption.icon}
          {selectedOption.label}
        </span>
      )
    }

    return (
      <span className="notion-select-label-text" title={selectedOption.label}>
        {selectedOption.icon && <span className="mr-1.5 inline-flex shrink-0">{selectedOption.icon}</span>}
        {selectedOption.label}
      </span>
    )
  }

  const isSelected = (val: string) => {
    if (multiple) {
      return Array.isArray(currentValue) && currentValue.includes(val)
    }
    return currentValue === val
  }

  const hasValue = multiple
    ? Array.isArray(currentValue) && currentValue.length > 0
    : Boolean(currentValue)

  // Virtualization threshold: virtualize when options > 100
  const isVirtualized = filteredOptions.length > 100
  const [scrollTop, setScrollTop] = useState(0)
  const rowHeight = 32
  const visibleCount = 10
  const overscan = 5

  const onListScroll = (e: React.UIEvent<HTMLUListElement>) => {
    if (isVirtualized) {
      setScrollTop(e.currentTarget.scrollTop)
    }
  }

  const startIndex = isVirtualized ? Math.max(0, Math.floor(scrollTop / rowHeight) - overscan) : 0
  const endIndex = isVirtualized ? Math.min(filteredOptions.length, Math.ceil((scrollTop + (visibleCount * rowHeight)) / rowHeight) + overscan) : filteredOptions.length
  const visibleOptions = filteredOptions.slice(startIndex, endIndex)
  const topPad = isVirtualized ? startIndex * rowHeight : 0
  const bottomPad = isVirtualized ? (filteredOptions.length - endIndex) * rowHeight : 0

  return (
    <Popover.Root open={isOpen} onOpenChange={handleOpenChange}>
      <div className={cn('inline-block', fullWidth && 'w-full', className)}>
        {/* Hidden native input for form submissions & react-hook-form */}
        {name && (
          multiple && Array.isArray(currentValue) ? (
            currentValue.map((val) => (
              <input key={val} type="hidden" name={name} value={val} />
            ))
          ) : (
            <input type="hidden" name={name} value={String(currentValue ?? '')} />
          )
        )}

        {/* Screen Reader live region */}
        <span className="sr-only" aria-live="polite" aria-atomic="true">
          {screenAnnouncement}
        </span>

        <Popover.Trigger
          ref={(node: HTMLButtonElement | null) => {
            triggerRef.current = node
            if (typeof forwardedRef === 'function') forwardedRef(node)
            else if (forwardedRef) forwardedRef.current = node
          }}
          id={selectId}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listId}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledby}
          data-state={isOpen ? 'open' : 'closed'}
          className={cn(
            'notion-select-trigger',
            size === 'sm' ? 'notion-select-trigger--sm' : 'notion-select-trigger--md',
            fullWidth && 'notion-select-trigger--full-width',
            isOpen && 'is-open',
            triggerClassName
          )}
          onKeyDown={handleKeyDown}
        >
          <span className="notion-select-trigger__content">
            {inlineLabel && <span className="notion-select-inline-label">{inlineLabel}</span>}
            {renderTriggerContent()}
          </span>

          <span className="notion-select-trigger__actions">
            {clearable && hasValue && !disabled && (
              <button
                type="button"
                className="notion-select-clear-btn"
                aria-label="Clear selection"
                onClick={handleClear}
              >
                <X size={12} aria-hidden="true" />
              </button>
            )}
            <ChevronDown size={14} className="notion-select-chevron" aria-hidden="true" />
          </span>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Backdrop className="notion-select-backdrop" />
          <Popover.Positioner
            side="bottom"
            sideOffset={4}
            align="start"
            className="notion-select-positioner"
          >
            <Popover.Popup
              role="presentation"
              className={cn('notion-select-menu', isClosing && 'is-closing', menuClassName)}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {/* Mobile drag handle */}
              <div className="notion-select-drag-handle" aria-hidden="true" />

              {/* Search Bar (Combobox mode or > 8 options) */}
              {isSearchable && (
                <div className="notion-select-search-wrap">
                  <Search size={14} className="notion-select-search-icon" aria-hidden="true" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    className="notion-select-search-input"
                    placeholder="Search…"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setActiveIndex(0)
                    }}
                    onKeyDown={handleKeyDown}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="notion-select-clear-btn"
                      aria-label="Clear search"
                      onClick={() => {
                        setSearchQuery('')
                        setActiveIndex(0)
                        searchInputRef.current?.focus()
                      }}
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                  )}
                </div>
              )}

              {/* Status & Options List */}
              {loading ? (
                <div className="notion-select-loading" role="status">
                  Loading options…
                </div>
              ) : error ? (
                <div className="notion-select-error" role="alert">
                  <span>{error}</span>
                  {onRetry && (
                    <button type="button" className="notion-select-retry-btn" onClick={onRetry}>
                      Retry
                    </button>
                  )}
                </div>
              ) : filteredOptions.length === 0 ? (
                <div className="notion-select-empty" role="status">
                  {searchQuery ? 'No results' : 'No options'}
                </div>
              ) : (
                <ul
                  ref={listRef}
                  id={listId}
                  role="listbox"
                  aria-multiselectable={multiple}
                  aria-label={ariaLabel || inlineLabel || placeholder}
                  className="notion-select-list"
                  tabIndex={-1}
                  onScroll={onListScroll}
                >
                  {isVirtualized && topPad > 0 && <div style={{ height: topPad }} aria-hidden="true" />}
                  {visibleOptions.map((option, localIdx) => {
                    const actualIdx = startIndex + localIdx
                    const selected = isSelected(option.value)
                    const highlighted = activeIndex === actualIdx
                    const statusColor = getOptionStatusColor(option)
                    const prevGroup = actualIdx > 0 ? filteredOptions[actualIdx - 1]?.group : undefined
                    const showGroup = option.group && option.group !== prevGroup

                    return (
                      <React.Fragment key={`${option.value}-${actualIdx}`}>
                        {showGroup && (
                          <li role="presentation" className="notion-select-group-header">
                            {option.group}
                          </li>
                        )}
                        <li
                          id={`${selectId}-opt-${option.value}`}
                          role="option"
                          aria-selected={selected}
                          aria-disabled={option.disabled}
                          data-index={actualIdx}
                          data-highlighted={highlighted ? '' : undefined}
                          className={cn(
                            'notion-select-option',
                            highlighted && 'is-highlighted',
                            selected && 'is-selected',
                            option.disabled && 'is-disabled'
                          )}
                          onClick={() => handleSelectOption(option)}
                          onMouseEnter={() => {
                            if (!option.disabled) setActiveIndex(actualIdx)
                          }}
                        >
                          <div className="notion-select-option__left">
                            {option.icon && <span className="shrink-0">{option.icon}</span>}
                            <div className="notion-select-option__text">
                              {statusColor ? (
                                <span className={cn('notion-select-pill', `notion-select-pill--${statusColor}`)}>
                                  {option.label}
                                </span>
                              ) : (
                                <span className="notion-select-option__label" title={option.label}>
                                  {option.label}
                                </span>
                              )}
                              {option.description && (
                                <span className="notion-select-option__desc">
                                  {option.description}
                                </span>
                              )}
                            </div>
                          </div>

                          {selected && (
                            <Check size={16} className="notion-select-option__check" aria-hidden="true" />
                          )}
                        </li>
                        {option.isDividerAfter && (
                          <li role="separator" className="notion-select-divider" aria-hidden="true" />
                        )}
                      </React.Fragment>
                    )
                  })}
                  {isVirtualized && bottomPad > 0 && <div style={{ height: bottomPad }} aria-hidden="true" />}
                </ul>
              )}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </div>
    </Popover.Root>
  )
})

export const Combobox = forwardRef<HTMLButtonElement, SelectProps>(function Combobox(props, ref) {
  return <Select ref={ref} searchable {...props} />
})
