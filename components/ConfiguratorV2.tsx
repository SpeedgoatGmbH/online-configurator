'use client'

import { useState } from 'react'
import { CATEGORIES } from './configurator/data'
import type { ConfiguratorProps, FieldKey, SubCategory } from './configurator/types'

// Signal row type
type SignalRow = {
  id: string
  quantity: number
  specs: Record<FieldKey, string>
  expanded: boolean
  isCustomQuantity?: boolean
}

// Common channel count options
const CHANNEL_COUNT_OPTIONS = [1, 2, 4, 8, 16, 32, 64, 128]

// Application presets
const APPLICATION_PRESETS = {
  'general-control': { label: 'General Control', description: 'Standard test automation' },
  'motor-control': { label: 'Motor Control', description: 'Drive & motor validation' },
  'power-electronics': { label: 'Power Electronics', description: 'Converter testing' },
  'automotive-ecu': {label: 'Automotive ECU', description: 'Vehicle controller HIL' },
  'aerospace': { label: 'Aerospace', description: 'Flight control systems' },
  'academic-lab': { label: 'Academic Lab', description: 'Research & teaching' },
}

// Helper to get conditional options
function getConditionalOptions(
  sub: SubCategory,
  fieldKey: FieldKey,
  currentSpecs: Record<FieldKey, string>
): string[] | undefined {
  const field = sub.fields.find((f) => f.key === fieldKey)
  if (!field) return undefined

  if (Array.isArray(field.options)) {
    return field.options
  }

  // Conditional options
  const dependsOnKey = field.options.dependsOn
  const dependsOnValue = currentSpecs[dependsOnKey]
  const conditions = field.options.conditions[dependsOnValue]
  return conditions || []
}

// Helper to create spec summary text with labels
function createSpecSummary(sub: SubCategory, specs: Record<FieldKey, string>): JSX.Element {
  const fieldsToShow = sub.fields.slice(0, 3) // Show first 3 fields
  
  return (
    <>
      {fieldsToShow.map((field, idx) => (
        <span key={field.key}>
          {idx > 0 && <span className="mx-1.5 text-slate-300">•</span>}
          <span className="font-semibold text-[rgb(var(--speedgoat-blue))]/70">{field.label}:</span>{' '}
          <span className="text-slate-700">{specs[field.key]}</span>
        </span>
      ))}
    </>
  )
}

export default function ConfiguratorV2({ title, description }: ConfiguratorProps) {
  const [applicationPreset, setApplicationPreset] = useState<string>('general-control')
  const [signalRows, setSignalRows] = useState<Record<string, Record<string, SignalRow[]>>>(() => {
    // Initialize empty state for all categories
    const initial: Record<string, Record<string, SignalRow[]>> = {}
    CATEGORIES.forEach((cat) => {
      initial[cat.id] = {}
      cat.subCategories.forEach((sub) => {
        initial[cat.id][sub.id] = []
      })
    })
    return initial
  })
  const [expandedTiers, setExpandedTiers] = useState<Record<string, boolean>>({})

  // Tier 1: Core signal types (always visible)
  const TIER1_IDS = ['analog', 'digital', 'communication', 'motion']
  const tier1Categories = CATEGORIES.filter((c) => TIER1_IDS.includes(c.id))
  const tier2Categories = CATEGORIES.filter((c) => !TIER1_IDS.includes(c.id))

  // Add new signal row
  const addSignalRow = (categoryId: string, subId: string) => {
    const category = CATEGORIES.find((c) => c.id === categoryId)
    const sub = category?.subCategories.find((s) => s.id === subId)
    if (!sub) return

    const newRow: SignalRow = {
      id: `${categoryId}-${subId}-${Date.now()}-${Math.random()}`,
      quantity: 32, // Default from best-selling modules
      specs: { ...sub.defaults },
      expanded: false,
      isCustomQuantity: false,
    }

    setSignalRows((prev) => ({
      ...prev,
      [categoryId]: {
        ...prev[categoryId],
        [subId]: [...prev[categoryId][subId], newRow],
      },
    }))
  }

  // Remove signal row
  const removeSignalRow = (categoryId: string, subId: string, rowId: string) => {
    setSignalRows((prev) => ({
      ...prev,
      [categoryId]: {
        ...prev[categoryId],
        [subId]: prev[categoryId][subId].filter((r) => r.id !== rowId),
      },
    }))
  }

  // Update row quantity
  const updateQuantity = (categoryId: string, subId: string, rowId: string, quantity: number) => {
    setSignalRows((prev) => ({
      ...prev,
      [categoryId]: {
        ...prev[categoryId],
        [subId]: prev[categoryId][subId].map((r) => (r.id === rowId ? { ...r, quantity } : r)),
      },
    }))
  }

  // Update row spec
  const updateSpec = (
    categoryId: string,
    subId: string,
    rowId: string,
    fieldKey: FieldKey,
    value: string
  ) => {
    setSignalRows((prev) => ({
      ...prev,
      [categoryId]: {
        ...prev[categoryId],
        [subId]: prev[categoryId][subId].map((r) =>
          r.id === rowId
            ? {
                ...r,
                specs: {
                  ...r.specs,
                  [fieldKey]: value,
                },
              }
            : r
        ),
      },
    }))
  }

  // Toggle row expansion
  const toggleRowExpansion = (categoryId: string, subId: string, rowId: string) => {
    setSignalRows((prev) => ({
      ...prev,
      [categoryId]: {
        ...prev[categoryId],
        [subId]: prev[categoryId][subId].map((r) =>
          r.id === rowId ? { ...r, expanded: !r.expanded } : r
        ),
      },
    }))
  }

  // Get total channels
  const getTotalChannels = () => {
    let total = 0
    Object.values(signalRows).forEach((catRows) => {
      Object.values(catRows).forEach((rows) => {
        rows.forEach((row) => {
          total += row.quantity
        })
      })
    })
    return total
  }

  // Render signal row component
  const renderSignalRow = (
    categoryId: string,
    sub: SubCategory,
    row: SignalRow,
    rowIndex: number
  ) => {
    const summary = createSpecSummary(sub, row.specs)
    const hasQuantity = row.quantity > 0
    
    // Determine if using custom quantity
    const isPresetQuantity = CHANNEL_COUNT_OPTIONS.includes(row.quantity)
    const showCustomInput = row.isCustomQuantity || !isPresetQuantity

    return (
      <div key={row.id} className="group">
        {/* Two-column layout: Quantity | Specs */}
        <div className="flex items-start gap-3">
          {/* Left: Quantity input */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 min-w-[60px]">
              {rowIndex === 0 ? sub.label : `${sub.label} ${String.fromCharCode(65 + rowIndex)}`}
            </span>
            
            {/* Dropdown for preset quantities */}
            <select
              value={showCustomInput ? 'custom' : row.quantity}
              onChange={(e) => {
                const value = e.target.value
                if (value === 'custom') {
                  setSignalRows((prev) => ({
                    ...prev,
                    [categoryId]: {
                      ...prev[categoryId],
                      [sub.id]: prev[categoryId][sub.id].map((r) =>
                        r.id === row.id ? { ...r, isCustomQuantity: true } : r
                      ),
                    },
                  }))
                } else {
                  updateQuantity(categoryId, sub.id, row.id, parseInt(value))
                  setSignalRows((prev) => ({
                    ...prev,
                    [categoryId]: {
                      ...prev[categoryId],
                      [sub.id]: prev[categoryId][sub.id].map((r) =>
                        r.id === row.id ? { ...r, isCustomQuantity: false } : r
                      ),
                    },
                  }))
                }
              }}
              className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-center font-medium shadow-sm transition focus:border-[rgb(var(--speedgoat-blue))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--speedgoat-blue))]/20 hover:border-slate-400"
              aria-label="Channel count"
            >
              {CHANNEL_COUNT_OPTIONS.map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
              <option value="custom">Custom</option>
            </select>
            
            {/* Custom number input (shown when Custom is selected) */}
            {showCustomInput && (
              <input
                type="number"
                min="1"
                max="999"
                value={row.quantity}
                onChange={(e) =>
                  updateQuantity(categoryId, sub.id, row.id, parseInt(e.target.value) || 0)
                }
                className="w-20 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-center font-medium shadow-sm transition focus:border-[rgb(var(--speedgoat-blue))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--speedgoat-blue))]/20 hover:border-slate-400"
                placeholder="Enter"
                aria-label="Custom channel count"
              />
            )}
          </div>

          {/* Right: Spec summary (expandable) */}
          {hasQuantity && (
            <div className="flex-1 flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleRowExpansion(categoryId, sub.id, row.id)}
                className="flex-1 rounded-lg border border-slate-200 bg-gradient-to-r from-slate-50 to-white px-4 py-2 text-left text-xs transition hover:border-slate-300 hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="flex-1">{summary}</span>
                  <span className="ml-2 text-slate-400 text-[10px]">▼</span>
                </div>
              </button>
              {signalRows[categoryId][sub.id].length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSignalRow(categoryId, sub.id, row.id)}
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                >
                  ×
                </button>
              )}
            </div>
          )}

          {!hasQuantity && signalRows[categoryId][sub.id].length > 1 && (
            <button
              type="button"
              onClick={() => removeSignalRow(categoryId, sub.id, row.id)}
              className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-400 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
            >
              × Remove
            </button>
          )}
        </div>

        {/* Expanded parameter panel (inline, below the row) */}
        {row.expanded && hasQuantity && (
          <div className="mt-3 ml-[76px] rounded-xl border-2 border-[rgb(var(--speedgoat-blue))]/20 bg-gradient-to-br from-blue-50/80 to-white p-4 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-600">
              Configuration Options
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sub.fields.map((field) => {
                const options = getConditionalOptions(sub, field.key, row.specs)
                if (!options || options.length === 0) return null

                return (
                  <div key={field.key}>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-700">
                      {field.label}
                    </label>
                    <select
                      value={row.specs[field.key]}
                      onChange={(e) =>
                        updateSpec(categoryId, sub.id, row.id, field.key, e.target.value)
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-[rgb(var(--speedgoat-blue))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--speedgoat-blue))]/20 hover:border-slate-400"
                      aria-label={field.label}
                    >
                      {options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>
            <div className="mt-4 flex justify-end border-t border-slate-200/50 pt-3">
              <button
                type="button"
                onClick={() => toggleRowExpansion(categoryId, sub.id, row.id)}
                className="rounded-lg bg-[rgb(var(--speedgoat-blue))] px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                ✓ Done
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Render subcategory section
  const renderSubCategory = (categoryId: string, sub: SubCategory) => {
    const rows = signalRows[categoryId][sub.id]
    
    // Always show at least one row
    if (rows.length === 0) {
      addSignalRow(categoryId, sub.id)
      return null
    }

    return (
      <div key={sub.id} className="space-y-2">
        {rows.map((row, idx) => renderSignalRow(categoryId, sub, row, idx))}
        
        {/* + Add variant button */}
        <button
          type="button"
          onClick={() => addSignalRow(categoryId, sub.id)}
          className="ml-[76px] flex items-center gap-1 text-xs text-slate-500 transition hover:text-[rgb(var(--speedgoat-blue))]"
        >
          <span className="text-sm">+</span> Add variant
        </button>
      </div>
    )
  }

  // Render tier 1 category (always visible)
  const renderTier1Category = (category: typeof CATEGORIES[0]) => {
    return (
      <div key={category.id} className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">
          {category.label}
        </h3>
        <div className="space-y-4">
          {category.subCategories.map((sub) => renderSubCategory(category.id, sub))}
        </div>
      </div>
    )
  }

  // Render tier 2 category tile
  const renderTier2Tile = (category: typeof CATEGORIES[0]) => {
    const isExpanded = expandedTiers[category.id]
    const hasSignals =
      category.subCategories.some((sub) =>
        signalRows[category.id][sub.id].some((row) => row.quantity > 0)
      )

    return (
      <div key={category.id}>
        <button
          type="button"
          onClick={() =>
            setExpandedTiers((prev) => ({ ...prev, [category.id]: !prev[category.id] }))
          }
          className={`w-full rounded-lg border p-4 text-left transition hover:shadow-sm ${
            isExpanded
              ? 'border-[rgb(var(--speedgoat-blue))] bg-blue-50/50 shadow-sm'
              : hasSignals
              ? 'border-slate-300 bg-slate-50'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">{category.label}</span>
            {hasSignals && !isExpanded && (
              <span className="rounded-full bg-[rgb(var(--speedgoat-blue))]/10 px-2.5 py-1 text-xs font-semibold text-[rgb(var(--speedgoat-blue))]">
                •
              </span>
            )}
          </div>
        </button>

        {isExpanded && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
            <div className="space-y-4">
              {category.subCategories.map((sub) => renderSubCategory(category.id, sub))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white/90 shadow-[0_25px_70px_-45px_rgba(15,23,42,0.35)] backdrop-blur">
      <div className="border-b border-slate-200/70 px-5 py-5 md:px-7">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Configuration</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900 md:text-3xl">{title}</h2>
        {description && <p className="mt-2 text-sm text-slate-600 md:text-base">{description}</p>}
      </div>

      <div className="space-y-5 px-5 py-5 md:px-7 md:py-6">
        {/* Application Preset Selector */}
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Application Preset
          </label>
          <select
            value={applicationPreset}
            onChange={(e) => setApplicationPreset(e.target.value)}
            className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[rgb(var(--speedgoat-blue))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--speedgoat-blue))]/20"
            aria-label="Application Preset"
          >
            {Object.entries(APPLICATION_PRESETS).map(([key, preset]) => (
              <option key={key} value={key}>
                {preset.label} — {preset.description}
              </option>
            ))}
          </select>
        </div>

        {/* Tier 1: Core Signal Types (Always Visible) */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {tier1Categories.map((cat) => renderTier1Category(cat))}
        </div>

        {/* Tier 2: Additional Signal Types (Expandable Tiles) */}
        {tier2Categories.length > 0 && (
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-700">
              Additional Signal Types
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {tier2Categories.map((cat) => renderTier2Tile(cat))}
            </div>
          </div>
        )}
      </div>

      {/* Sticky Footer Summary */}
      {getTotalChannels() > 0 && (
        <div className="sticky bottom-0 border-t border-slate-200 bg-white px-5 py-4 md:px-7">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <span className="font-semibold text-slate-900">Total Signals:</span>{' '}
              <span className="text-lg font-bold text-[rgb(var(--speedgoat-blue))]">
                {getTotalChannels()}
              </span>
            </div>
            <button
              type="button"
              className="rounded-lg border border-[rgb(var(--speedgoat-blue))] bg-[rgb(var(--speedgoat-blue))] px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Generate System Proposal
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
