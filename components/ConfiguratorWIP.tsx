'use client'

import {
  CompactAddLink,
  CompactButton,
  CompactCard,
  CompactField,
  CompactIconButton,
  CompactInspectorBlock,
  CompactSectionLabel,
  CompactTooltip,
} from '@/components/ui/compact'
import { cn } from '@/lib/cn'
import { CATEGORIES } from './configurator/data'
import type { StarterRow } from './configurator/industries'
import type { ClosedLoopRate } from './configurator/proposalTypes'
import type { FieldKey, SubCategory } from './configurator/types'
import {
  CHANNEL_PRESET_COUNTS,
  buildInitialSignalRows,
  type ConfiguratorHookProps,
  type SignalRow,
  buildProtocolIndustryGroups,
  getBasicFieldKey,
  getConditionalOptions,
  getSpecSummaryText,
  getSubCategory,
  isSpecsDefault,
  normalizeSpecsForSub,
  useConfigurator,
} from './configurator/useConfigurator'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'

const TIER1_IDS = ['analog', 'digital', 'communication', 'motion']
const TIER1_ORDER = ['analog', 'digital', 'communication', 'motion'] as const
const LIGHT_NATIVE_SELECT_STYLE = { colorScheme: 'light' } as const
const LIGHT_NATIVE_OPTION_STYLE = {
  backgroundColor: '#ffffff',
  color: '#334155',
} as const

/**
 * Visual display groups override the default category rendering.
 * Each group pulls specific subcategories from one or more data categories,
 * allowing cross-category grouping (e.g. PWM from digital + encoder from motion).
 */
type DisplayGroup = {
  id: string
  label: string
  slots: { categoryId: string; subId: string }[]
}

const DISPLAY_GROUPS: [DisplayGroup, DisplayGroup][] = [
  // Row 1: Analog | Digital (inputs + outputs only)
  [
    { id: 'analog', label: 'Analog', slots: [{ categoryId: 'analog', subId: 'inputs' }, { categoryId: 'analog', subId: 'outputs' }] },
    { id: 'digital', label: 'Digital', slots: [{ categoryId: 'digital', subId: 'inputs' }, { categoryId: 'digital', subId: 'outputs' }] },
  ],
  // Row 2: PWM & Position | Communication
  [
    { id: 'pwm-position', label: 'PWM & Position', slots: [
      { categoryId: 'digital', subId: 'pwm' },
      { categoryId: 'digital', subId: 'capture' },
      { categoryId: 'motion', subId: 'encoder' },
      { categoryId: 'motion', subId: 'resolver' },
    ]},
    { id: 'communication', label: 'Communication', slots: [{ categoryId: 'communication', subId: 'protocols' }] },
  ],
]

/** All subcategory slots claimed by display groups — used to filter tier2 */
const DISPLAY_GROUP_CLAIMED = new Set(
  DISPLAY_GROUPS.flat().flatMap((g) => g.slots.map((s) => `${s.categoryId}:${s.subId}`))
)

/**
 * Additional display-group rows — unclaimed categories paired into 2-column rows,
 * rendered identically to the core DISPLAY_GROUPS above.
 */
const ADDITIONAL_DISPLAY_GROUPS: [DisplayGroup, DisplayGroup | null][] = (() => {
  const extras = CATEGORIES
    .filter((cat) => cat.subCategories.some((sub) => !DISPLAY_GROUP_CLAIMED.has(`${cat.id}:${sub.id}`)))
    .map((cat) => ({
      id: cat.id,
      label: cat.label,
      slots: cat.subCategories
        .filter((sub) => !DISPLAY_GROUP_CLAIMED.has(`${cat.id}:${sub.id}`))
        .map((sub) => ({ categoryId: cat.id, subId: sub.id })),
    }) satisfies DisplayGroup)

  const rows: [DisplayGroup, DisplayGroup | null][] = []
  for (let i = 0; i < extras.length; i += 2) {
    rows.push([extras[i], extras[i + 1] ?? null])
  }
  return rows
})()

/** IDs of groups that start collapsed */
const INITIALLY_COLLAPSED = new Set(
  [
    ...DISPLAY_GROUPS.flat().map((g) => g.id),
    ...ADDITIONAL_DISPLAY_GROUPS.flat().filter(Boolean).map((g) => g!.id),
  ]
)

type ConfiguratorWIPProps = ConfiguratorHookProps & {
  /** Register loader so parent can import persisted configs */
  onLoadTemplate?: (fn: (rows: StarterRow[]) => void) => void
  /** Expose signal rows to parent for floating bar summary */
  onSignalRowsChange?: (rows: Record<string, Record<string, SignalRow[]>>) => void
  /** Global closed-loop rate selection — filters analog speed options */
  closedLoopRate?: ClosedLoopRate
  /** Optional surface variant when embedded in higher-level shells */
  visualVariant?: 'default' | 'layout-mock-v2'
}

/** Minimum speed threshold (in Hz) for each closed-loop rate tier */
const RATE_SPEED_THRESHOLDS: Record<ClosedLoopRate, number> = {
  '10k': 0,          // no filter — all options are valid
  '100k': 100_000,   // ≥ 100 kHz
  'above100k': 500_000, // ≥ 500 kHz
}

/** Parse a speed option string like "100 kHz" or "5 MHz" into Hz */
function parseSpeedHz(value: string): number {
  const m = value.match(/(\d+(?:\.\d+)?)\s*(k|m|g)?hz/i)
  if (!m) return 0
  const num = parseFloat(m[1])
  switch (m[2]?.toLowerCase()) {
    case 'k': return num * 1_000
    case 'm': return num * 1_000_000
    case 'g': return num * 1_000_000_000
    default: return num
  }
}

/** Pick the numerically-lowest speed option that still meets the minimum threshold. */
function getMinimumCompliantSpeedOption(options: string[], minHz: number): string | null {
  let bestOption: string | null = null
  let bestHz = Number.POSITIVE_INFINITY

  for (const option of options) {
    const hz = parseSpeedHz(option)
    if (hz < minHz) continue
    if (hz < bestHz) {
      bestHz = hz
      bestOption = option
    }
  }

  return bestOption
}

function splitTooltipSentences(tooltip: string): string[] {
  return tooltip
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function ConfiguratorWIP({
  onSummaryChange,
  onRequirementsChange,
  onLoadTemplate,
  onSignalRowsChange,
  closedLoopRate = '10k',
  visualVariant = 'default',
}: ConfiguratorWIPProps = {}) {
  const {
    signalRows,
    setSignalRows,
    editingTarget,
    editingContext,
    draftEdit,
    showDiscardConfirm,
    setShowDiscardConfirm,
    tier1Categories,
    tier2Categories,
    setCustomChannelRows,
    addSignalRow,
    removeSignalRow,
    openEditor,
    updateDraftSpec,
    updateRowQuantity,
    updateRowSpec,
    saveDraft,
    requestCloseEditor,
    discardDraftAndClose,
    handleAddVariant,
    getSubTotal,
    getCategoryTotal,
  } = useConfigurator({
    tier1Ids: TIER1_IDS,
    tier1Order: TIER1_ORDER,
    accordionMode: true,
    useEditorAnchors: true,
    useProtocolSelector: true,
    useCustomChannelRows: true,
    onSummaryChange,
    onRequirementsChange,
  })

  const isMockVariant = visualVariant === 'layout-mock-v2'

  // Track which category is showing the "pick subcategory" inline chooser
  const [addingForCategory, setAddingForCategory] = useState<string | null>(null)
  // Inline protocol picker: tracks whether we're adding a new protocol row or editing an existing row's protocol
  const [inlineProtocolPicker, setInlineProtocolPicker] = useState<{ mode: 'add' } | { mode: 'edit'; rowId: string } | null>(null)
  // Track which quantity cells are in custom-number-input mode
  const [customQuantityRows, setCustomQuantityRows] = useState<Set<string>>(() => new Set())
  // Track which groups are collapsed
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set(INITIALLY_COLLAPSED))
  const toggleGroup = useCallback((id: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  // Notify parent when signalRows change (for floating bar summary)
  useEffect(() => {
    if (onSignalRowsChange) onSignalRowsChange(signalRows)
  }, [signalRows, onSignalRowsChange])

  useEffect(() => {
    if (!isMockVariant || typeof window === 'undefined') return
    setCollapsedGroups(new Set(INITIALLY_COLLAPSED))
  }, [isMockVariant])

  // Keep analog speed values compliant with the selected closed-loop rate tier.
  // Runs on both tier changes and row changes (e.g., imports/new variants).
  useEffect(() => {
    const minHz = RATE_SPEED_THRESHOLDS[closedLoopRate]
    if (minHz === 0) return // no constraint at 10k tier

    const analogCat = CATEGORIES.find((c) => c.id === 'analog')
    const analogRows = signalRows.analog
    if (!analogCat || !analogRows) return

    let hasAnyChange = false
    const nextAnalogRows: Record<string, SignalRow[]> = { ...analogRows }

    for (const sub of analogCat.subCategories) {
      const rows = analogRows[sub.id]
      if (!rows || rows.length === 0) continue

      const speedField = sub.fields.find((f) => f.key === 'speed')
      if (!speedField || !Array.isArray(speedField.options)) continue

      const minCompliantSpeed = getMinimumCompliantSpeedOption(speedField.options, minHz)
      if (!minCompliantSpeed) continue

      let subChanged = false
      const normalizedRows = rows.map((row) => {
        const currentSpeed = row.specs.speed
        if (currentSpeed && parseSpeedHz(currentSpeed) >= minHz) return row
        if (currentSpeed === minCompliantSpeed) return row

        subChanged = true
        hasAnyChange = true
        return {
          ...row,
          specs: {
            ...row.specs,
            speed: minCompliantSpeed,
          },
        }
      })

      if (subChanged) {
        nextAnalogRows[sub.id] = normalizedRows
      }
    }

    if (!hasAnyChange) return

    setSignalRows((prev) => ({
      ...prev,
      analog: nextAnalogRows,
    }))
  }, [closedLoopRate, signalRows, setSignalRows])

  /**
   * Filter speed options for analog subcategories based on the global closed-loop rate.
   * For non-analog categories, returns options unchanged.
   */
  const filterSpeedOptions = useCallback((categoryId: string, fieldKey: FieldKey, options: string[]): string[] => {
    if (categoryId !== 'analog' || fieldKey !== 'speed') return options
    const minHz = RATE_SPEED_THRESHOLDS[closedLoopRate]
    if (minHz === 0) return options
    const filtered = options.filter((o) => parseSpeedHz(o) >= minHz)
    return filtered.length > 0 ? filtered : options // fallback: never empty
  }, [closedLoopRate])

  const resolveSelectedOption = useCallback(
    (categoryId: string, fieldKey: FieldKey, currentValue: string | undefined, options: string[]): string => {
      if (options.length === 0) return ''
      if (currentValue && options.includes(currentValue)) return currentValue

      if (categoryId === 'analog' && fieldKey === 'speed') {
        const minCompliant = getMinimumCompliantSpeedOption(options, RATE_SPEED_THRESHOLDS[closedLoopRate])
        if (minCompliant) return minCompliant
      }

      return options[0]
    },
    [closedLoopRate]
  )

  const loadTemplate = useCallback(
    (template: StarterRow[]) => {
      setSignalRows(() => {
        const next = buildInitialSignalRows()
        const now = Date.now()
        template.forEach((row, index) => {
          const sub = getSubCategory(row.categoryId, row.subId)
          if (!sub || row.quantity <= 0) return
          const normalizedSpecs = normalizeSpecsForSub(sub, row.specs as Record<string, string>)
          const loadedRow: SignalRow = {
            id: `${row.categoryId}-${row.subId}-${now}-${index}`,
            quantity: row.quantity,
            specs: normalizedSpecs,
          }
          next[row.categoryId][row.subId].push(loadedRow)
        })
        return next
      })

      setCustomChannelRows({})
    },
    [setCustomChannelRows, setSignalRows]
  )

  useEffect(() => {
    if (onLoadTemplate) onLoadTemplate(loadTemplate)
  }, [onLoadTemplate, loadTemplate])

  const renderDraftField = (sub: SubCategory, fieldKey: FieldKey) => {
    if (!draftEdit) return null

    const field = sub.fields.find((entry) => entry.key === fieldKey)
    if (!field) return null

    const rawOptions = getConditionalOptions(sub, field.key, draftEdit.specs)
    if (!rawOptions || rawOptions.length === 0) return null

    // Apply closed-loop rate filter for analog speed fields
    const editCategoryId = editingTarget?.categoryId ?? ''
    const options = filterSpeedOptions(editCategoryId, field.key, rawOptions)

    const selectedValue = resolveSelectedOption(editCategoryId, field.key, draftEdit.specs[field.key], options)

    if (editingTarget?.categoryId === 'communication' && editingTarget?.subId === 'protocols' && field.key === 'range') {
      return (
        <div key={field.key}>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-700">{field.label}</label>
          <CompactField
            as="select"
            value={selectedValue}
            onChange={(event) => updateDraftSpec(field.key, event.target.value)}
            className="px-2 text-sm"
            aria-label={field.label}
          >
            {options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </CompactField>
        </div>
      )
    }

    return (
      <div key={field.key}>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-700">
          {field.label}
        </label>
        <div className="flex items-center gap-1">
          <CompactField
            as="select"
            value={selectedValue}
            onChange={(event) => updateDraftSpec(field.key, event.target.value)}
            className="px-2 text-sm"
            aria-label={field.label}
          >
            {options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </CompactField>
          {field.tooltip && (
            <CompactTooltip
              className="ml-0 shrink-0"
              content={field.tooltip}
            />
          )}
        </div>
      </div>
    )
  }

  /* ── Inline protocol chip picker (replaces the overlay for WIP) ── */
  const renderInlineProtocolPicker = () => {
    if (!inlineProtocolPicker) return null

    const protocolSub = getSubCategory('communication', 'protocols')
    if (!protocolSub) return null
    const protocolField = protocolSub.fields.find((f) => f.key === 'range')
    const protocolOptions = protocolField && Array.isArray(protocolField.options) ? protocolField.options : []
    if (protocolOptions.length === 0) return null

    const industryGroups = buildProtocolIndustryGroups(protocolOptions)

    // Determine the currently selected protocol for highlighting
    const selectedProtocol = inlineProtocolPicker.mode === 'edit'
      ? (signalRows.communication?.protocols?.find((r) => r.id === inlineProtocolPicker.rowId)?.specs.range ?? undefined)
      : undefined

    const handleChipClick = (protocol: string) => {
      if (inlineProtocolPicker.mode === 'add') {
        addSignalRow('communication', 'protocols', { range: protocol })
      } else {
        updateRowSpec('communication', 'protocols', inlineProtocolPicker.rowId, 'range', protocol)
      }
      setInlineProtocolPicker(null)
    }

    return (
      <div
        className={cn(
          'mt-1',
          isMockVariant
            ? 'border-y border-slate-200 px-0 py-2'
            : 'rounded-[var(--ui-radius-sm)] border border-slate-200 bg-slate-50/80 px-2 py-1.5'
        )}
      >
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400">
            {inlineProtocolPicker.mode === 'add' ? 'Add protocol' : 'Change protocol'}
          </span>
          <button
            type="button"
            onClick={() => setInlineProtocolPicker(null)}
            className="text-[10px] text-slate-400 hover:text-slate-600"
            aria-label="Close picker"
          >
            ✕
          </button>
        </div>
        {industryGroups.map((group) => {
          if (group.protocols.length === 0) return null
          return (
            <div key={group.industry} className="mb-1 last:mb-0">
              <span className="mb-0.5 block text-[10px] font-medium text-slate-400">{group.industry}</span>
              <div className="flex flex-wrap gap-[3px]">
                {group.protocols.map((protocol) => {
                  const isSelected = selectedProtocol === protocol
                  return (
                    <button
                      key={protocol}
                      type="button"
                      onClick={() => handleChipClick(protocol)}
                      className={cn(
                        'inline-flex h-[22px] items-center rounded-[var(--ui-radius-sm)] border px-1.5 text-[11px] font-medium transition',
                        isSelected
                          ? 'border-[rgb(var(--speedgoat-blue))] bg-[rgb(var(--speedgoat-blue))]/10 text-[rgb(var(--speedgoat-blue))]'
                          : isMockVariant
                          ? 'border-slate-200 bg-white text-slate-600 hover:border-[rgb(var(--speedgoat-blue))]/35 hover:text-[rgb(var(--speedgoat-blue))]'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100'
                      )}
                    >
                      {protocol}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderSlideOverEditor = () => {
    if (!editingTarget || !editingContext || !draftEdit) return null

    const { category, sub, rowIndex } = editingContext
    const basicFieldKey = getBasicFieldKey(category.id, sub)
    const advancedFieldKeys = sub.fields.filter((field) => field.key !== basicFieldKey).map((field) => field.key)

    return (
      <div className="fixed inset-0 z-[90]">
        <button
          type="button"
          onClick={requestCloseEditor}
          className="absolute inset-0 bg-slate-900/12 backdrop-blur-[1px]"
          aria-label="Close edit panel"
        />

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-3 sm:p-4">
          <div className="pointer-events-auto w-[min(560px,92vw)]" style={{ minHeight: '320px', maxHeight: 'min(82vh, 680px)' }}>
            <div className="relative flex max-h-full flex-col overflow-hidden rounded-[var(--ui-radius-lg)] border border-slate-200 bg-white/95 shadow-2xl backdrop-blur">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
                <div className="min-w-0">
                  <CompactSectionLabel>Edit Variant</CompactSectionLabel>
                  <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">
                    {category.label} / {sub.label} / Variant {rowIndex + 1}
                  </p>
                </div>

                <CompactIconButton type="button" onClick={requestCloseEditor} aria-label="Close editor" title="Close">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </CompactIconButton>
              </div>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2">
                <CompactInspectorBlock className="space-y-[var(--ui-gap-2)] bg-white p-2">
                  {basicFieldKey ? (
                    renderDraftField(sub, basicFieldKey)
                  ) : (
                    <p className="text-sm text-slate-600">No basic parameters for this variant.</p>
                  )}
                </CompactInspectorBlock>

                <CompactInspectorBlock className="space-y-[var(--ui-gap-2)] bg-white p-2">
                  {advancedFieldKeys.map((fieldKey) => renderDraftField(sub, fieldKey))}
                  {advancedFieldKeys.length === 0 && (
                    <p className="text-sm text-slate-600">No additional parameters for this variant.</p>
                  )}
                </CompactInspectorBlock>
              </div>

              <div className="shrink-0 border-t border-slate-200 bg-white/95 px-3 py-2 backdrop-blur">
                <div className="flex items-center justify-end gap-[var(--ui-gap-1)]">
                  <CompactButton type="button" variant="secondary" onClick={requestCloseEditor}>
                    Cancel
                  </CompactButton>
                  <CompactButton type="button" variant="primary" onClick={saveDraft}>
                    Save
                  </CompactButton>
                </div>
              </div>

              {showDiscardConfirm && (
                <div className="absolute inset-0 z-10 flex items-end rounded-[var(--ui-radius-lg)] bg-slate-900/30 p-2">
                  <CompactCard className="w-full space-y-[var(--ui-gap-2)] p-[var(--ui-pad-2)]">
                    <p className="text-sm font-semibold text-slate-900">Discard unsaved changes?</p>
                    <p className="text-sm text-slate-600">Your edits in this panel have not been saved yet.</p>
                    <div className="flex items-center justify-end gap-[var(--ui-gap-1)]">
                      <CompactButton type="button" variant="secondary" onClick={() => setShowDiscardConfirm(false)}>
                        Keep editing
                      </CompactButton>
                      <CompactButton type="button" variant="danger" onClick={discardDraftAndClose}>
                        Discard
                      </CompactButton>
                    </div>
                  </CompactCard>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ── Inline spec select: one <select> per field, pipe-separated ── */
  const renderInlineSpecSelect = (
    categoryId: string,
    sub: SubCategory,
    row: SignalRow,
    fieldKey: FieldKey,
    fieldLabel: string
  ) => {
    const field = sub.fields.find((entry) => entry.key === fieldKey)
    const showInlineAnalogTooltip =
      categoryId === 'analog' && fieldKey === 'speed' && Boolean(field?.tooltip)

    // Communication/protocols "range" field — no longer shown inline (range is the row label now)
    // This branch is kept as a safety guard but should not be reached.

    const options = getConditionalOptions(sub, fieldKey, row.specs)
    if (!options || options.length === 0) return null

    const filteredOptions = filterSpeedOptions(categoryId, fieldKey, options)
    const currentValue = resolveSelectedOption(categoryId, fieldKey, row.specs[fieldKey], filteredOptions)

    const compactValue = (value: string) =>
      value
        .replace(/\s+V\b/g, 'V')
        .replace(/\s+(k|m|g)?Hz\b/gi, '$1Hz')
        .replace(/\s+(k|m|g)?bit\/s\b/gi, '$1bit/s')
        .replace(/Single-ended/g, 'SE')
        .replace(/Differential/g, 'Diff')
        .replace(/\bNone\b/g, '–')
        .replace(/Isolated/g, 'Iso')

    const tooltipText = showInlineAnalogTooltip && field?.tooltip ? field.tooltip : undefined

    return (
      <span key={fieldKey} className="inline-flex min-w-0 max-w-full items-center">
        <span className="relative inline-flex min-w-0 max-w-[120px] flex-1 items-center">
          <select
            value={currentValue}
            onChange={(e) => updateRowSpec(categoryId, sub.id, row.id, fieldKey, e.target.value)}
            style={LIGHT_NATIVE_SELECT_STYLE}
            className={cn(
              'w-full cursor-pointer appearance-none py-0 text-[10px] text-slate-700 transition focus:outline-none',
              isMockVariant
                ? 'h-6 rounded-md border border-slate-200 bg-white pl-1.5 pr-4 hover:border-[rgb(var(--speedgoat-blue))]/35 hover:text-[rgb(var(--speedgoat-blue))] focus:ring-1 focus:ring-[rgb(var(--speedgoat-blue))]/25'
                : 'h-5 rounded-[6px] border border-transparent bg-slate-100/80 pl-1.5 pr-4 hover:border-slate-200 hover:bg-slate-100 hover:text-[rgb(var(--speedgoat-blue))] focus:ring-1 focus:ring-[rgb(var(--speedgoat-blue))]/25'
            )}
            aria-label={fieldLabel}
            title={tooltipText ?? fieldLabel}
          >
            {filteredOptions.map((opt) => (
              <option key={opt} value={opt} style={LIGHT_NATIVE_OPTION_STYLE}>
                {compactValue(opt)}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-0.5 text-[7px] text-slate-400">▾</span>
        </span>
      </span>
    )
  }

  /* ── Decide which fields to show inline per row ── */
  const getInlineFields = (categoryId: string, sub: SubCategory) => {
    // Exclude signalType + inputMode/outputMode (master switches / wiring)
    // For protocols, also exclude 'range' — it's shown as the row label
    // Limit to max 3 inline dropdowns to fit on one line
    return sub.fields
      .filter((f) => {
        if (f.key === 'signalType' || f.key === 'inputMode' || f.key === 'outputMode') return false
        if (categoryId === 'communication' && sub.id === 'protocols' && f.key === 'range') return false
        return true
      })
      .slice(0, 3)
      .map((f) => f.key)
  }

  /* ── Signal row: flat row block within each display group ── */
  const renderSignalRow = (categoryId: string, sub: SubCategory, row: SignalRow, rowIndex: number) => {
    const isBaseRow = row.id.endsWith('-base')
    const channelOptions = CHANNEL_PRESET_COUNTS.includes(row.quantity)
      ? CHANNEL_PRESET_COUNTS
      : [...CHANNEL_PRESET_COUNTS, row.quantity].sort((a, b) => a - b)
    const inlineFields = getInlineFields(categoryId, sub)
    const hasQuantity = row.quantity > 0

    return (
      <div
        key={row.id}
        className={cn(
          'group grid grid-cols-[128px_42px_22px_1fr_18px] items-center gap-x-2 border-b border-slate-100 last:border-b-0',
          isMockVariant ? 'min-h-[34px] py-1' : 'py-1.5',
          !hasQuantity && 'opacity-40'
        )}
      >
        {/* Cell 1 — Label (strongest in the row) */}
        {categoryId === 'communication' && sub.id === 'protocols' ? (
          <button
            type="button"
            onClick={() => {
              const isActive = inlineProtocolPicker?.mode === 'edit' && inlineProtocolPicker.rowId === row.id
              setInlineProtocolPicker(isActive ? null : { mode: 'edit', rowId: row.id })
            }}
            className={cn(
              'truncate py-0.5 text-left text-[12px] font-semibold leading-5 transition',
              inlineProtocolPicker?.mode === 'edit' && inlineProtocolPicker.rowId === row.id
                ? 'text-[rgb(var(--speedgoat-blue))]'
                : row.specs.range
                  ? 'text-slate-900 hover:text-[rgb(var(--speedgoat-blue))]'
                  : 'text-slate-400 hover:text-slate-600'
            )}
            title="Click to change protocol"
          >
            {row.specs.range || 'Select…'}
          </button>
        ) : (
          <span className="truncate py-0.5 text-[12px] font-semibold leading-5 text-slate-900">
            {sub.label}
          </span>
        )}

        {/* Cell 2 — Quantity (second strongest) */}
        <div className="relative py-0.5">
          {customQuantityRows.has(row.id) ? (
            /* ── Custom numeric input mode ── */
            <>
              <input
                type="number"
                min={0}
                max={999}
                defaultValue={row.quantity}
                autoFocus
                onBlur={(e) => {
                  const v = Math.min(999, parseInt(e.target.value, 10) || 0)
                  if (v >= 0) updateRowQuantity(categoryId, sub.id, row.id, v)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                }}
                className={cn(
                  'w-full text-right text-[12px] font-medium tabular-nums transition focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
                  isMockVariant
                    ? 'h-6 rounded-md border border-slate-200 bg-white pl-1 pr-5 focus:ring-1 focus:ring-[rgb(var(--speedgoat-blue))]/40 hover:border-[rgb(var(--speedgoat-blue))]/35'
                    : 'h-5 rounded-[6px] border border-transparent bg-slate-50/90 pl-1 pr-5 focus:ring-1 focus:ring-[rgb(var(--speedgoat-blue))]/40 hover:border-slate-200 hover:bg-slate-100',
                  hasQuantity ? 'text-slate-700' : 'text-slate-500'
                )}
                aria-label={`${sub.label} channels (custom)`}
              />
              <button
                type="button"
                onClick={() => setCustomQuantityRows((prev) => { const next = new Set(prev); next.delete(row.id); return next })}
                className="absolute right-0.5 top-1/2 -translate-y-1/2 text-[7px] text-slate-400 hover:text-slate-600 transition"
                title="Switch to presets"
              >▾</button>
            </>
          ) : (
            /* ── Preset dropdown mode ── */
            <>
              <select
                value={String(row.quantity)}
                onChange={(e) => {
                  if (e.target.value === 'custom') {
                    setCustomQuantityRows((prev) => new Set(prev).add(row.id))
                  } else {
                    updateRowQuantity(categoryId, sub.id, row.id, parseInt(e.target.value, 10) || 0)
                  }
                }}
                style={LIGHT_NATIVE_SELECT_STYLE}
                className={cn(
                  'w-full cursor-pointer appearance-none text-right text-[12px] font-medium tabular-nums transition focus:outline-none',
                  isMockVariant
                    ? 'h-6 rounded-md border border-slate-200 bg-white pl-1 pr-3.5 hover:border-[rgb(var(--speedgoat-blue))]/35'
                    : 'h-5 rounded-[6px] border border-transparent bg-slate-50/90 pl-1 pr-3.5 hover:border-slate-200 hover:bg-slate-100',
                  hasQuantity ? 'text-slate-700' : 'text-slate-500'
                )}
                aria-label={`${sub.label} channels`}
              >
                {channelOptions.map((count) => (
                  <option key={count} value={count} style={LIGHT_NATIVE_OPTION_STYLE}>
                    {count}
                  </option>
                ))}
                <option value="custom" style={LIGHT_NATIVE_OPTION_STYLE}>Custom…</option>
              </select>
              <span className="pointer-events-none absolute right-0.5 top-1/2 -translate-y-1/2 text-[7px] text-slate-400">▾</span>
            </>
          )}
        </div>

        {/* Cell 3 — Unit (metadata tier) */}
        <span className="py-0.5 text-[10px] text-slate-500">ch</span>

        {/* Cell 4 — Specs cluster (metadata tier) */}
        <div className="flex min-w-0 flex-wrap items-center gap-1 overflow-visible py-0.5">
          {hasQuantity && inlineFields.map((fieldKey) => {
            const field = sub.fields.find((f) => f.key === fieldKey)
            if (!field) return null
            const rawOpts = getConditionalOptions(sub, fieldKey, row.specs)
            if (!rawOpts || rawOpts.length === 0) return null
            const options = filterSpeedOptions(categoryId, fieldKey, rawOpts)
            if (options.length === 0) return null
            return (
              <span key={fieldKey} className="inline-flex min-w-0 max-w-full items-center">
                {renderInlineSpecSelect(categoryId, sub, row, fieldKey, field.label)}
              </span>
            )
          })}
        </div>

        {/* Cell 5 — Remove */}
        <div className="flex items-center justify-center py-0.5">
          {!isBaseRow ? (
            <button
              type="button"
              onClick={() => removeSignalRow(categoryId, sub.id, row.id)}
              className="flex h-3.5 w-3.5 items-center justify-center rounded text-[9px] font-bold text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
              aria-label={`Remove ${sub.label} variant ${rowIndex + 1}`}
              title="Remove variant"
            >
              ×
            </button>
          ) : (
            <span className="h-4 w-4" />
          )}
        </div>
      </div>
    )
  }

  /* ── Category block (Tier 1): LABEL header + all subcategory rows + add link ── */
  const renderCategoryBlock = (category: (typeof CATEGORIES)[number]) => {
    const totalSignals = getCategoryTotal(category.id)
    const allRows: { sub: SubCategory; row: SignalRow; index: number }[] = []
    category.subCategories.forEach((sub) => {
      const rows = signalRows[category.id]?.[sub.id] || []
      rows.forEach((row, index) => allRows.push({ sub, row, index }))
    })

    const categoryLabel = category.label.toLowerCase()
    const hasManySubcategories = category.subCategories.length > 1

    return (
      <div key={category.id} className="py-2.5 first:pt-0">
        {/* Section header — quiet structural divider */}
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
            {category.label}
          </span>
          {totalSignals > 0 && (
            <span className="text-[11px] tabular-nums text-slate-400">
              {totalSignals}
            </span>
          )}
        </div>

        {/* Signal rows */}
        <div className="space-y-0">
          {allRows.map(({ sub, row, index }) => renderSignalRow(category.id, sub, row, index))}
        </div>

        {/* Add link with optional inline sub-category picker */}
        <div className="mt-1 px-0.5">
          {addingForCategory === category.id && hasManySubcategories ? (
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-slate-400">Add:</span>
              {category.subCategories.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => {
                    handleAddVariant(category.id, sub.id)
                    setAddingForCategory(null)
                  }}
                  className="inline-flex h-5 items-center rounded-[var(--ui-radius-sm)] border border-slate-200 bg-white px-2 text-[12px] font-medium text-slate-600 transition hover:border-[rgb(var(--speedgoat-blue))] hover:bg-[rgb(var(--speedgoat-blue))]/5 hover:text-[rgb(var(--speedgoat-blue))]"
                >
                  {sub.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAddingForCategory(null)}
                className="ml-1 text-[11px] text-slate-400 hover:text-slate-600"
                aria-label="Cancel"
              >
                ✕
              </button>
            </div>
          ) : (
            <CompactAddLink
              type="button"
              onClick={() => {
                if (hasManySubcategories) {
                  setAddingForCategory(category.id)
                } else {
                  handleAddVariant(category.id, category.subCategories[0].id)
                }
              }}
              className="mt-0.5 h-5 px-0.5 text-[12px] text-slate-400 hover:text-[rgb(var(--speedgoat-blue))]"
            >
              + Add {categoryLabel}
            </CompactAddLink>
          )}
        </div>
      </div>
    )
  }

  /* ── Display group block: cross-category visual grouping ── */
  const renderDisplayGroup = (group: DisplayGroup) => {
    // Resolve subcategories from the data layer
    const resolvedSlots = group.slots
      .map((s) => {
        const cat = CATEGORIES.find((c) => c.id === s.categoryId)
        const sub = cat?.subCategories.find((sc) => sc.id === s.subId)
        return sub ? { categoryId: s.categoryId, sub } : null
      })
      .filter(Boolean) as { categoryId: string; sub: SubCategory }[]

    // Collect all rows
    const allRows: { categoryId: string; sub: SubCategory; row: SignalRow; index: number }[] = []
    resolvedSlots.forEach(({ categoryId, sub }) => {
      const rows = signalRows[categoryId]?.[sub.id] || []
      rows.forEach((row, index) => allRows.push({ categoryId, sub, row, index }))
    })

    // Total signals across all slots in this group
    const totalSignals = resolvedSlots.reduce((sum, { categoryId, sub }) => sum + getSubTotal(categoryId, sub.id), 0)
    const configuredRows = allRows.filter(({ row }) => row.quantity > 0).length
    const groupLabel = group.label.toLowerCase()
    const hasManySlots = resolvedSlots.length > 1
    const isCollapsed = collapsedGroups.has(group.id)
    const renderQuickAddIcon = (categoryId: string, subId: string) => {
      if (categoryId === 'communication' && subId === 'protocols') {
        return (
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="6" cy="12" r="2.2" className="fill-[rgb(var(--speedgoat-blue))]/18" />
            <circle cx="18" cy="7" r="2.2" className="fill-[rgb(var(--speedgoat-blue))]/18" />
            <circle cx="18" cy="17" r="2.2" className="fill-[rgb(var(--speedgoat-blue))]/18" />
            <path d="M8.1 11.4 15.7 7.7M8.1 12.6l7.6 3.7" className="stroke-[rgb(var(--speedgoat-blue))]" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )
      }

      if (subId === 'encoder' || subId === 'resolver') {
        return (
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="6.5" className="stroke-[rgb(var(--speedgoat-blue))]/35" strokeWidth="1.5" />
            <path d="M12 12 16.5 9.5" className="stroke-[rgb(var(--speedgoat-blue))]" strokeWidth="1.7" strokeLinecap="round" />
            <circle cx="12" cy="12" r="1.5" className="fill-[rgb(var(--speedgoat-blue))]" />
          </svg>
        )
      }

      if (subId === 'pwm' || subId === 'capture' || categoryId === 'digital') {
        return (
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M3 15V9h4v6h5V7h4v8h5"
              className="stroke-[rgb(var(--speedgoat-blue))]"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )
      }

      return (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M3 12c1.6 0 2.4-5 4.2-5s2.4 10 4.2 10 2.6-8 4.2-8 2.2 3 5.4 3"
            className="stroke-[rgb(var(--speedgoat-blue))]"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    }

    const renderQuickAddButtons = () => (
      <div
        className={cn(
          'mt-1 grid gap-1',
          resolvedSlots.length === 1 ? 'grid-cols-1' : 'grid-cols-1 min-[440px]:grid-cols-2'
        )}
      >
        {resolvedSlots.map(({ categoryId, sub }) => {
          const isProtocolPicker = group.id === 'communication' && sub.id === 'protocols'
          const isProtocolPickerOpen = isProtocolPicker && inlineProtocolPicker?.mode === 'add'
          const configuredSignals = getSubTotal(categoryId, sub.id)
          const configuredVariants = (signalRows[categoryId]?.[sub.id] || []).filter((row) => row.quantity > 0).length
          const singularLabel = sub.label.toLowerCase().endsWith('s')
            ? sub.label.toLowerCase().slice(0, -1)
            : sub.label.toLowerCase()
          const metaLabel = isProtocolPicker
            ? configuredVariants > 0
              ? `${configuredVariants} protocol ${configuredVariants === 1 ? 'row' : 'rows'}`
              : 'Choose protocol type'
            : configuredSignals > 0
            ? `${configuredSignals} ch configured`
            : `Add ${singularLabel} module`

          return (
            <button
              key={`${group.id}-${categoryId}-${sub.id}`}
              type="button"
              onClick={() => {
                if (isProtocolPicker) {
                  setInlineProtocolPicker((prev) => (prev?.mode === 'add' ? null : { mode: 'add' }))
                  return
                }
                handleAddVariant(categoryId, sub.id)
              }}
              className={cn(
                'group/quick relative flex min-h-[32px] items-center gap-1.5 rounded-md border px-2 py-1 text-left transition',
                isProtocolPickerOpen
                  ? 'border-[rgb(var(--speedgoat-blue))]/35 bg-[rgb(var(--speedgoat-blue))]/[0.025]'
                  : 'border-slate-200/80 bg-white/72 hover:border-[rgb(var(--speedgoat-blue))]/20 hover:bg-slate-50/70'
              )}
              aria-label={isProtocolPicker ? 'Add protocol row' : `Add ${sub.label} module`}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-slate-200/80 bg-slate-50/85 text-[rgb(var(--speedgoat-blue))]">
                {renderQuickAddIcon(categoryId, sub.id)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[10px] font-semibold text-slate-800">
                  {isProtocolPicker ? 'Protocol' : sub.label}
                </span>
                <span className="mt-0.5 block truncate text-[8px] font-medium uppercase tracking-[0.08em] text-slate-400">
                  {metaLabel}
                </span>
              </span>
              <span
                className={cn(
                  'shrink-0 text-[9px] font-medium uppercase tracking-[0.08em] transition',
                  isProtocolPickerOpen
                    ? 'text-[rgb(var(--speedgoat-blue))]'
                    : 'text-slate-400 group-hover/quick:text-[rgb(var(--speedgoat-blue))]'
                )}
                aria-hidden="true"
              >
                Add
              </span>
            </button>
          )
        })}
      </div>
    )

    return (
      <div
        key={group.id}
        className={cn(
          'min-w-0',
          isMockVariant
            ? 'px-0 py-0'
            : 'rounded-[10px] border border-slate-100 bg-white/95 px-2.5 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]'
        )}
      >
        {/* Clickable section header — quiet structural divider */}
        <button
          type="button"
          onClick={() => toggleGroup(group.id)}
          className={cn(
            'flex w-full items-center justify-between',
            isMockVariant
              ? 'mb-2 border-b border-slate-200 px-0 py-2'
              : 'mb-2 rounded-[8px] bg-slate-50 px-2 py-1.5'
          )}
        >
          <span className="flex items-center gap-1">
            <svg
              className={cn('h-2 w-2 text-slate-500 transition-transform', !isCollapsed && 'rotate-90')}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
            <span className={cn(
              'text-[11px] font-semibold uppercase tracking-[0.12em]',
              isMockVariant ? 'text-slate-500' : 'text-slate-600'
            )}>
              {group.label}
            </span>
          </span>
          {(totalSignals > 0 || configuredRows > 1) && (
            <span className="flex items-center gap-2">
              {configuredRows > 1 && (
                <span className={cn(
                  'text-[10px] font-medium',
                  isMockVariant
                    ? 'text-slate-400'
                    : 'rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-slate-600'
                )}>
                  {configuredRows} rows
                </span>
              )}
              {totalSignals > 0 && (
                <span className="text-[11px] font-medium tabular-nums text-slate-500">
                  {totalSignals}
                </span>
              )}
            </span>
          )}
        </button>

        {!isCollapsed && (
          <>
            {/* Signal rows — strict grid: label | qty | unit | specs | remove */}
            <div
              className={cn(
                'space-y-0',
                isMockVariant ? 'px-0 py-0' : 'rounded-[8px] bg-white px-2 py-1'
              )}
            >
              {allRows.map(({ categoryId, sub, row, index }) => renderSignalRow(categoryId, sub, row, index))}
            </div>

            {/* Inline protocol picker (only for Communication group) */}
            {group.id === 'communication' && renderInlineProtocolPicker()}

            {/* Visual quick-add row in the mock shell */}
            {isMockVariant ? (
              renderQuickAddButtons()
            ) : (
            <div className={cn(isMockVariant ? 'mt-1' : 'mt-1.5')}>
          {addingForCategory === group.id && hasManySlots ? (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[11px] text-slate-400">Add:</span>
              {resolvedSlots.map(({ categoryId, sub }) => (
                <button
                  key={`${categoryId}-${sub.id}`}
                  type="button"
                  onClick={() => {
                    handleAddVariant(categoryId, sub.id)
                    setAddingForCategory(null)
                  }}
                  className="inline-flex h-5 items-center rounded-[var(--ui-radius-sm)] border border-slate-200 bg-white px-2 text-[12px] font-medium text-slate-600 transition hover:border-[rgb(var(--speedgoat-blue))] hover:bg-[rgb(var(--speedgoat-blue))]/5 hover:text-[rgb(var(--speedgoat-blue))]"
                >
                  {sub.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAddingForCategory(null)}
                className="ml-1 text-[11px] text-slate-400 hover:text-slate-600"
                aria-label="Cancel"
              >
                ✕
              </button>
            </div>
          ) : (
            <CompactAddLink
              type="button"
              onClick={() => {
                // Communication/protocols: toggle inline picker instead of overlay
                if (group.id === 'communication' && resolvedSlots.length === 1 && resolvedSlots[0]?.sub.id === 'protocols') {
                  setInlineProtocolPicker((prev) => prev?.mode === 'add' ? null : { mode: 'add' })
                  return
                }
                if (hasManySlots) {
                  setAddingForCategory(group.id)
                } else {
                  const first = resolvedSlots[0]
                  if (first) handleAddVariant(first.categoryId, first.sub.id)
                }
              }}
              className="h-5 px-0 text-[12px] text-slate-500 hover:text-[rgb(var(--speedgoat-blue))]"
            >
              + Add {groupLabel}
            </CompactAddLink>
          )}
            </div>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <>
      <CompactCard
        variant="default"
        className={cn(
          'relative overflow-visible',
          isMockVariant
            ? 'border-0 bg-transparent p-0 shadow-none'
            : 'border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(249,251,253,0.98))] p-3 shadow-[0_12px_24px_rgba(15,23,42,0.07)]'
        )}
      >
        {!isMockVariant ? (
          <>
            <div className="pointer-events-none absolute inset-0 rounded-[var(--ui-radius-lg)] bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(250,252,254,0.98))]" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-20 rounded-t-[var(--ui-radius-lg)] bg-[linear-gradient(180deg,rgba(0,105,180,0.06),rgba(0,105,180,0))]" />
          </>
        ) : null}
        {/* All display groups — core + additional, single 2-column flow */}
        <div className={cn('relative', isMockVariant ? 'space-y-4' : 'space-y-3')}>
          {DISPLAY_GROUPS.map(([left, right], rowIdx) => (
            <div key={rowIdx} className="grid grid-cols-1 items-start gap-x-4 gap-y-3 min-[640px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              {renderDisplayGroup(left)}
              {renderDisplayGroup(right)}
            </div>
          ))}
          {ADDITIONAL_DISPLAY_GROUPS.map(([left, right], rowIdx) => (
            <div key={`add-${rowIdx}`} className="grid grid-cols-1 items-start gap-x-4 gap-y-3 min-[640px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              {renderDisplayGroup(left)}
              {right && renderDisplayGroup(right)}
            </div>
          ))}
        </div>
      </CompactCard>

      {renderSlideOverEditor()}
    </>
  )
}

export default memo(ConfiguratorWIP)



