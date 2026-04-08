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

/** IDs of groups that start collapsed (additional categories) */
const INITIALLY_COLLAPSED = new Set(
  ADDITIONAL_DISPLAY_GROUPS.flat().filter(Boolean).map((g) => g!.id)
)

type ConfiguratorV3Props = ConfiguratorHookProps & {
  /** Register loader so parent can import persisted configs */
  onLoadTemplate?: (fn: (rows: StarterRow[]) => void) => void
  /** Expose signal rows to parent for floating bar summary */
  onSignalRowsChange?: (rows: Record<string, Record<string, SignalRow[]>>) => void
  /** Global closed-loop rate selection — filters analog speed options */
  closedLoopRate?: ClosedLoopRate
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

function ConfiguratorV3({ onSummaryChange, onRequirementsChange, onLoadTemplate, onSignalRowsChange, closedLoopRate = '10k' }: ConfiguratorV3Props = {}) {
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
    protocolSelectorContext,
    setProtocolSelectorContext,
    setCustomChannelRows,
    removeSignalRow,
    openEditor,
    updateDraftSpec,
    updateRowQuantity,
    updateRowSpec,
    saveDraft,
    requestCloseEditor,
    discardDraftAndClose,
    handleAddVariant,
    handleProtocolSelect,
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

  // Track which category is showing the "pick subcategory" inline chooser
  const [addingForCategory, setAddingForCategory] = useState<string | null>(null)
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
          <CompactButton
            type="button"
            variant="secondary"
            onClick={() => setProtocolSelectorContext({ mode: 'edit' })}
            className="h-[var(--ui-control-h)] w-full justify-between px-2 text-sm"
          >
            <span className="truncate">{selectedValue || 'Select protocol'}</span>
            <span className="ml-2 text-xs text-slate-500">Select</span>
          </CompactButton>
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

  const renderProtocolSelectorOverlay = () => {
    if (!protocolSelectorContext) return null

    const selectorSub =
      protocolSelectorContext.mode === 'add'
        ? getSubCategory('communication', 'protocols')
        : editingContext?.category.id === 'communication' && editingContext.sub.id === 'protocols'
        ? editingContext.sub
        : null

    if (!selectorSub) return null

    const protocolField = selectorSub.fields.find((field) => field.key === 'range')
    const protocolOptions = protocolField && Array.isArray(protocolField.options) ? protocolField.options : []
    if (protocolOptions.length === 0) return null

    const industryGroups = buildProtocolIndustryGroups(protocolOptions)
    const selectedProtocol = protocolSelectorContext.mode === 'edit' ? draftEdit?.specs.range : undefined

    return (
      <div className="fixed inset-0 z-[110]">
        <button
          type="button"
          onClick={() => setProtocolSelectorContext(null)}
          className="absolute inset-0 bg-slate-900/20 backdrop-blur-[1px]"
          aria-label="Close protocol selector"
        />

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-3">
          <div className="pointer-events-auto w-full max-w-[880px]">
            <div className="flex max-h-[78vh] flex-col overflow-hidden rounded-[var(--ui-radius-lg)] border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-start justify-between gap-2 border-b border-slate-200 px-3 py-2">
                <div className="min-w-0">
                  <CompactSectionLabel>Protocol Selector</CompactSectionLabel>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900">
                    {protocolSelectorContext.mode === 'add'
                      ? 'Select protocol before adding'
                      : 'Select protocol for this variant'}
                  </p>
                </div>

                <CompactIconButton
                  type="button"
                  onClick={() => setProtocolSelectorContext(null)}
                  aria-label="Close protocol selector"
                  title="Close"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </CompactIconButton>
              </div>

              <div className="flex-1 overflow-auto px-3 py-2">
                <div className="grid grid-cols-[110px_minmax(0,1fr)] rounded-[var(--ui-radius-sm)] border border-slate-200 bg-slate-50 px-2 py-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Industry</span>
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Protocol Name</span>
                </div>

                <div className="mt-2 rounded-[var(--ui-radius-sm)] border border-slate-200 bg-white">
                  {industryGroups.map((group, index) => (
                    <div
                      key={group.industry}
                      className={cn('grid grid-cols-[110px_minmax(0,1fr)]', index > 0 && 'border-t border-slate-200')}
                    >
                      <div className="bg-slate-50 px-2 py-2 text-sm font-semibold text-slate-700">{group.industry}</div>
                      <div className="px-2 py-2">
                        {group.protocols.length > 0 ? (
                          <div className="flex flex-wrap gap-[var(--ui-gap-1)]">
                            {group.protocols.map((protocol) => {
                              const isSelected = selectedProtocol === protocol
                              return (
                                <button
                                  key={protocol}
                                  type="button"
                                  onClick={() => handleProtocolSelect(protocol)}
                                  className={cn(
                                    'inline-flex h-7 items-center rounded-[var(--ui-radius-sm)] border px-2 text-sm font-semibold transition',
                                    isSelected
                                      ? 'border-[rgb(var(--speedgoat-blue))] bg-[rgb(var(--speedgoat-blue))]/10 text-[rgb(var(--speedgoat-blue))]'
                                      : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'
                                  )}
                                >
                                  {protocol}
                                </button>
                              )
                            })}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">...</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-[var(--ui-gap-1)] border-t border-slate-200 px-3 py-2">
                <CompactButton type="button" variant="secondary" onClick={() => setProtocolSelectorContext(null)}>
                  Cancel
                </CompactButton>
              </div>
            </div>
          </div>
        </div>
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

    // Communication/protocols "range" field opens the protocol overlay instead
    if (categoryId === 'communication' && sub.id === 'protocols' && fieldKey === 'range') {
      return (
        <button
          key={fieldKey}
          type="button"
          onClick={() => {
            openEditor({ categoryId, subId: sub.id, rowId: row.id })
            setProtocolSelectorContext({ mode: 'edit' })
          }}
          className="inline-flex h-5 cursor-pointer items-center bg-transparent px-1 text-[11px] text-slate-500 transition hover:bg-slate-100/80 hover:text-[rgb(var(--speedgoat-blue))]"
          title={fieldLabel}
        >
          <span className="truncate">{row.specs[fieldKey] || 'Select'}</span>
          <span className="ml-0.5 text-[7px] text-slate-400">▾</span>
        </button>
      )
    }

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
      <span key={fieldKey} className="inline-flex max-w-full items-center gap-0">
        <span className="relative inline-flex min-w-[68px] min-w-0 flex-1 items-center">
          <select
            value={currentValue}
            onChange={(e) => updateRowSpec(categoryId, sub.id, row.id, fieldKey, e.target.value)}
            className="h-5 w-full cursor-pointer appearance-none border-0 bg-transparent py-0 pl-1 pr-3.5 text-[11px] text-slate-500 transition hover:bg-slate-100/80 hover:text-[rgb(var(--speedgoat-blue))] focus:outline-none"
            aria-label={fieldLabel}
            title={tooltipText ?? fieldLabel}
          >
            {filteredOptions.map((opt) => (
              <option key={opt} value={opt}>
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
    // Limit to max 3 inline dropdowns to fit on one line
    return sub.fields
      .filter((f) => f.key !== 'signalType' && f.key !== 'inputMode' && f.key !== 'outputMode')
      .slice(0, 3)
      .map((f) => f.key)
  }

  /* ── Signal row: grid cells via display:contents ── */
  const renderSignalRow = (categoryId: string, sub: SubCategory, row: SignalRow, rowIndex: number) => {
    const isBaseRow = row.id.endsWith('-base')
    const channelOptions = CHANNEL_PRESET_COUNTS.includes(row.quantity)
      ? CHANNEL_PRESET_COUNTS
      : [...CHANNEL_PRESET_COUNTS, row.quantity].sort((a, b) => a - b)
    const inlineFields = getInlineFields(categoryId, sub)
    const hasQuantity = row.quantity > 0

    return (
      <div key={row.id} className={cn('group contents', !hasQuantity && 'opacity-40')}>
        {/* Cell 1 — Label (strongest in the row) */}
        <span className="truncate py-[5px] text-[13px] font-semibold leading-5 text-slate-900">
          {sub.label}
        </span>

        {/* Cell 2 — Quantity (second strongest) */}
        <div className="relative py-[5px]">
          <select
            value={String(row.quantity)}
            onChange={(e) => updateRowQuantity(categoryId, sub.id, row.id, parseInt(e.target.value, 10) || 0)}
            className={cn(
              'h-6 w-full cursor-pointer appearance-none border-0 bg-transparent pl-1 pr-3.5 text-right text-[13px] font-medium tabular-nums transition hover:bg-slate-100/80 focus:outline-none',
              hasQuantity ? 'text-slate-700' : 'text-slate-400'
            )}
            aria-label={`${sub.label} channels`}
          >
            {channelOptions.map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-0.5 top-1/2 -translate-y-1/2 text-[7px] text-slate-400">▾</span>
        </div>

        {/* Cell 3 — Unit (metadata tier) */}
        <span className="py-[5px] text-[11px] text-slate-400">ch</span>

        {/* Cell 4 — Specs cluster (metadata tier) */}
        <div className="flex min-w-0 items-center gap-0.5 py-[5px]">
          {hasQuantity && inlineFields.map((fieldKey) => {
            const field = sub.fields.find((f) => f.key === fieldKey)
            if (!field) return null
            const rawOpts = getConditionalOptions(sub, fieldKey, row.specs)
            if (!rawOpts || rawOpts.length === 0) return null
            const options = filterSpeedOptions(categoryId, fieldKey, rawOpts)
            if (options.length === 0) return null
            return (
              <span key={fieldKey} className="inline-flex items-center">
                {renderInlineSpecSelect(categoryId, sub, row, fieldKey, field.label)}
              </span>
            )
          })}
        </div>

        {/* Cell 5 — Remove */}
        <div className="flex items-center justify-center py-[5px]">
          {!isBaseRow ? (
            <button
              type="button"
              onClick={() => removeSignalRow(categoryId, sub.id, row.id)}
              className="flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
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
    const groupLabel = group.label.toLowerCase()
    const hasManySlots = resolvedSlots.length > 1
    const isCollapsed = collapsedGroups.has(group.id)

    return (
      <div key={group.id} className="py-2 first:pt-0">
        {/* Clickable section header — quiet structural divider */}
        <button
          type="button"
          onClick={() => toggleGroup(group.id)}
          className="mb-1 flex w-full items-center justify-between"
        >
          <span className="flex items-center gap-1">
            <svg
              className={cn('h-2 w-2 text-slate-400 transition-transform', !isCollapsed && 'rotate-90')}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
              {group.label}
            </span>
          </span>
          {totalSignals > 0 && (
            <span className="text-[11px] tabular-nums text-slate-400">
              {totalSignals}
            </span>
          )}
        </button>

        {!isCollapsed && (
          <>
            {/* Signal rows — strict grid: label | qty | unit | specs | remove */}
            <div className="grid items-center gap-y-0 grid-cols-[140px_48px_24px_1fr_20px]">
              {allRows.map(({ categoryId, sub, row, index }) => renderSignalRow(categoryId, sub, row, index))}
            </div>

            {/* Add link — aligned to label column start */}
            <div className="mt-1">
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
                if (hasManySlots) {
                  setAddingForCategory(group.id)
                } else {
                  const first = resolvedSlots[0]
                  if (first) handleAddVariant(first.categoryId, first.sub.id)
                }
              }}
              className="h-5 px-0 text-[12px] text-slate-400 hover:text-[rgb(var(--speedgoat-blue))]"
            >
              + Add {groupLabel}
            </CompactAddLink>
          )}
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <>
      <CompactCard
        variant="default"
        className="relative overflow-visible border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(249,251,253,0.98))] p-3 shadow-[0_12px_24px_rgba(15,23,42,0.07)]"
      >
        <div className="pointer-events-none absolute inset-0 rounded-[var(--ui-radius-lg)] bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(250,252,254,0.98))]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 rounded-t-[var(--ui-radius-lg)] bg-[linear-gradient(180deg,rgba(0,105,180,0.06),rgba(0,105,180,0))]" />
        {/* All display groups — core + additional, single 2-column flow */}
        <div className="relative space-y-0 divide-y divide-slate-100">
          {DISPLAY_GROUPS.map(([left, right], rowIdx) => (
            <div key={rowIdx} className="grid grid-cols-1 items-start gap-x-4 min-[640px]:grid-cols-2">
              {renderDisplayGroup(left)}
              {renderDisplayGroup(right)}
            </div>
          ))}
          {ADDITIONAL_DISPLAY_GROUPS.map(([left, right], rowIdx) => (
            <div key={`add-${rowIdx}`} className="grid grid-cols-1 items-start gap-x-4 min-[640px]:grid-cols-2">
              {renderDisplayGroup(left)}
              {right && renderDisplayGroup(right)}
            </div>
          ))}
        </div>
      </CompactCard>

      {renderSlideOverEditor()}
      {renderProtocolSelectorOverlay()}
    </>
  )
}

export default memo(ConfiguratorV3)


