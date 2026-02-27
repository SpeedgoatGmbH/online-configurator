'use client'

import {
  CompactAddLink,
  CompactButton,
  CompactCard,
  CompactField,
  CompactIconButton,
  CompactInspectorBlock,
  CompactSectionLabel,
  CompactStatBadge,
} from '@/components/ui/compact'
import { cn } from '@/lib/cn'
import { useEffect, useMemo, useState } from 'react'
import { CATEGORIES } from './configurator/data'
import type { ConfiguratorProps, FieldKey, SpecsRecord, SubCategory } from './configurator/types'

type SignalRow = {
  id: string
  quantity: number
  specs: SpecsRecord
}

type EditingTarget = {
  categoryId: string
  subId: string
  rowId: string
} | null

type DraftEdit = {
  quantity: number
  specs: SpecsRecord
} | null

type ProtocolSelectorContext = {
  mode: 'add' | 'edit'
} | null

type EditorAnchor = {
  x: number
  y: number
  width: number
  height: number
} | null

type EditingContext = {
  category: (typeof CATEGORIES)[number]
  sub: SubCategory
  row: SignalRow
  rowIndex: number
}

const TIER1_IDS = ['analog', 'digital', 'communication', 'motion']
const TIER1_ORDER = ['analog', 'digital', 'communication', 'motion'] as const
const PROTOCOL_INDUSTRY_ORDER = ['Cross', 'Automotive', 'Aerospace', 'Industrial'] as const
const CHANNEL_PRESET_COUNTS = [0, 1, 2, 4, 8, 16, 32, 64, 128]

type ProtocolIndustry = (typeof PROTOCOL_INDUSTRY_ORDER)[number]
type ProtocolIndustryGroup = { industry: ProtocolIndustry; protocols: string[] }

const PROTOCOL_INDUSTRY_MAP: Record<ProtocolIndustry, string[]> = {
  Cross: [
    'RS-422',
    'RS-485',
    'RS-232',
    'SPI',
    'I2C',
    'PTP (IEEE 1588)',
    'IRIG + GPS',
    'MQTT',
    'DDS',
    'Raw Ethernet',
    'Real-Time UDP',
    'Aurora',
    'Shared Memory',
  ],
  Automotive: [
    'CAN',
    'CAN FD',
    'LIN',
    'FlexRay',
    'SENT',
    'PSI5',
    'Automotive Ethernet',
    'XCP over CAN',
    'XCP over Ethernet',
  ],
  Aerospace: ['AFDX (ARINC 664 P7)', 'ARINC 429', 'ARINC 629', 'ARINC 825', 'MIL-STD-1553'],
  Industrial: [
    'EtherCAT',
    'PROFINET',
    'EtherNet/IP',
    'POWERLINK',
    'OPC UA',
    'CANopen',
    'PROFIBUS',
    'Modbus RTU',
    'Modbus TCP',
    'DNP3',
    'IEC 61850',
    'MVB / WTB',
  ],
}

function buildInitialSignalRows(): Record<string, Record<string, SignalRow[]>> {
  const initial: Record<string, Record<string, SignalRow[]>> = {}
  CATEGORIES.forEach((category) => {
    initial[category.id] = {}
    category.subCategories.forEach((sub) => {
      initial[category.id][sub.id] = []
    })
  })
  return initial
}

function getCategory(categoryId: string) {
  return CATEGORIES.find((category) => category.id === categoryId)
}

function getSubCategory(categoryId: string, subId: string) {
  return getCategory(categoryId)?.subCategories.find((sub) => sub.id === subId)
}

function buildProtocolIndustryGroups(protocolOptions: string[]): ProtocolIndustryGroup[] {
  const uniqueOptions = Array.from(new Set(protocolOptions))
  const available = new Set(uniqueOptions)
  const assigned = new Set<string>()

  const groups = PROTOCOL_INDUSTRY_ORDER.map((industry) => {
    const protocols = PROTOCOL_INDUSTRY_MAP[industry].filter((protocol) => available.has(protocol))
    protocols.forEach((protocol) => assigned.add(protocol))
    return { industry, protocols }
  })

  const unclassified = uniqueOptions.filter((protocol) => !assigned.has(protocol))
  if (unclassified.length > 0) {
    const crossGroup = groups.find((group) => group.industry === 'Cross')
    if (crossGroup) {
      crossGroup.protocols = [...crossGroup.protocols, ...unclassified]
    }
  }

  return groups
}

function getConditionalOptions(sub: SubCategory, fieldKey: FieldKey, currentSpecs: SpecsRecord): string[] | undefined {
  const field = sub.fields.find((entry) => entry.key === fieldKey)
  if (!field) return undefined

  if (Array.isArray(field.options)) return field.options

  const dependsOnValue = currentSpecs[field.options.dependsOn]
  if (!dependsOnValue) return []
  return field.options.conditions[dependsOnValue] || []
}

function normalizeSpecsForSub(sub: SubCategory, currentSpecs: SpecsRecord): SpecsRecord {
  const normalized: SpecsRecord = { ...currentSpecs }

  sub.fields.forEach((field) => {
    const options = getConditionalOptions(sub, field.key, normalized)
    if (!options || options.length === 0) return

    const current = normalized[field.key]
    if (!current || !options.includes(current)) {
      normalized[field.key] = options[0]
    }
  })

  return normalized
}

function getSpecSummaryTokens(
  sub: SubCategory,
  specs: SpecsRecord,
  context?: { categoryId: string; subId: string }
): string[] {
  const isProtocolGroup = context?.categoryId === 'communication' && context?.subId === 'protocols'

  if (isProtocolGroup) {
    return [specs.range, specs.resolution, specs.speed].filter((value): value is string => Boolean(value))
  }

  const preferred = sub.fields
    .filter((field) => field.key !== 'signalType')
    .map((field) => specs[field.key])
    .filter((value): value is string => Boolean(value))

  if (preferred.length > 0) return preferred.slice(0, 4)

  const fallback = sub.fields
    .map((field) => specs[field.key])
    .filter((value): value is string => Boolean(value))

  return fallback.slice(0, 4)
}

function getSpecSummaryText(
  sub: SubCategory,
  specs: SpecsRecord,
  context?: { categoryId: string; subId: string }
): string {
  return getSpecSummaryTokens(sub, specs, context).join(' | ')
}

function getAddLabel(categoryId: string, subLabel: string): string {
  if (categoryId === 'communication') return '+ Add protocol type'
  const normalized = subLabel.toLowerCase().endsWith('s') ? subLabel.toLowerCase().slice(0, -1) : subLabel.toLowerCase()
  return `+ Add ${normalized} type`
}

function getBasicFieldKey(categoryId: string, sub: SubCategory): FieldKey | undefined {
  const hasField = (key: FieldKey) => sub.fields.some((field) => field.key === key)

  if (categoryId === 'analog') {
    if (hasField('signalRange')) return 'signalRange'
    if (hasField('range')) return 'range'
  }

  if (categoryId === 'digital' && hasField('signalType')) {
    return 'signalType'
  }

  if (categoryId === 'communication' && sub.id === 'protocols' && hasField('range')) {
    return 'range'
  }

  return sub.fields[0]?.key
}

type ConfiguratorV2Summary = {
  totalSignals: number
  rowCount: number
  categoryTotals: Record<string, number>
}

type ConfiguratorV2Props = ConfiguratorProps & {
  onSummaryChange?: (summary: ConfiguratorV2Summary) => void
}

export default function ConfiguratorV3({ onSummaryChange }: ConfiguratorV2Props = {}) {
  const [signalRows, setSignalRows] = useState<Record<string, Record<string, SignalRow[]>>>(() => buildInitialSignalRows())
  const [editingTarget, setEditingTarget] = useState<EditingTarget>(null)
  const [editorAnchor, setEditorAnchor] = useState<EditorAnchor>(null)
  const [draftEdit, setDraftEdit] = useState<DraftEdit>(null)
  const [protocolSelectorContext, setProtocolSelectorContext] = useState<ProtocolSelectorContext>(null)
  const [showAdvancedEditor, setShowAdvancedEditor] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [customChannelRows, setCustomChannelRows] = useState<Record<string, boolean>>({})
  const [isAdditionalStepOpen, setIsAdditionalStepOpen] = useState(false)
  const [tier1Open, setTier1Open] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    TIER1_IDS.forEach((id) => {
      initial[id] = false
    })
    return initial
  })
  const [tier2Open, setTier2Open] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    CATEGORIES.filter((category) => !TIER1_IDS.includes(category.id)).forEach((category) => {
      initial[category.id] = false
    })
    return initial
  })

  const orderedTier1Categories = TIER1_ORDER.map((id) => CATEGORIES.find((category) => category.id === id)).filter(
    (category): category is (typeof CATEGORIES)[number] => Boolean(category)
  )
  const overflowTier1Categories = CATEGORIES.filter(
    (category) => TIER1_IDS.includes(category.id) && !TIER1_ORDER.includes(category.id as (typeof TIER1_ORDER)[number])
  )
  const tier1Categories = [...orderedTier1Categories, ...overflowTier1Categories]
  const tier2Categories = CATEGORIES.filter((category) => !TIER1_IDS.includes(category.id))

  const createTier1OpenMap = (openId?: string) => {
    const next: Record<string, boolean> = {}
    tier1Categories.forEach((category) => {
      next[category.id] = category.id === openId
    })
    return next
  }

  const createTier2OpenMap = (openId?: string) => {
    const next: Record<string, boolean> = {}
    tier2Categories.forEach((category) => {
      next[category.id] = category.id === openId
    })
    return next
  }

  const closeEditorState = () => {
    setEditingTarget(null)
    setEditorAnchor(null)
    setDraftEdit(null)
    setProtocolSelectorContext(null)
    setShowAdvancedEditor(false)
    setShowDiscardConfirm(false)
  }

  const editingContext = useMemo<EditingContext | null>(() => {
    if (!editingTarget) return null

    const category = getCategory(editingTarget.categoryId)
    if (!category) return null

    const sub = category.subCategories.find((entry) => entry.id === editingTarget.subId)
    if (!sub) return null

    const rows = signalRows[category.id]?.[sub.id] || []
    const rowIndex = rows.findIndex((row) => row.id === editingTarget.rowId)
    if (rowIndex === -1) return null

    return {
      category,
      sub,
      row: rows[rowIndex],
      rowIndex,
    }
  }, [editingTarget, signalRows])

  const isDraftDirty = useMemo(() => {
    if (!editingContext || !draftEdit) return false
    if (draftEdit.quantity !== editingContext.row.quantity) return true

    return editingContext.sub.fields.some((field) => {
      const original = editingContext.row.specs[field.key] ?? ''
      const draft = draftEdit.specs[field.key] ?? ''
      return original !== draft
    })
  }, [draftEdit, editingContext])

  useEffect(() => {
    if (editingTarget && !editingContext) {
      closeEditorState()
    }
  }, [editingContext, editingTarget])

  useEffect(() => {
    if (!editingTarget && !protocolSelectorContext) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [editingTarget, protocolSelectorContext])

  useEffect(() => {
    if (!onSummaryChange) return

    const categoryTotals: Record<string, number> = {}
    let rowCount = 0
    let totalSignals = 0

    CATEGORIES.forEach((category) => {
      let categoryTotal = 0
      category.subCategories.forEach((sub) => {
        const rows = signalRows[category.id]?.[sub.id] || []
        rows.forEach((row) => {
          const quantity = Math.max(0, row.quantity || 0)
          categoryTotal += quantity
          totalSignals += quantity
          if (quantity > 0) rowCount += 1
        })
      })
      categoryTotals[category.label] = categoryTotal
    })

    onSummaryChange({
      totalSignals,
      rowCount,
      categoryTotals,
    })
  }, [onSummaryChange, signalRows])

  const addSignalRow = (categoryId: string, subId: string, presetSpecs?: Partial<SpecsRecord>) => {
    const sub = getSubCategory(categoryId, subId)
    if (!sub) return

    const row: SignalRow = {
      id: `${categoryId}-${subId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      quantity: 32,
      specs: normalizeSpecsForSub(sub, {
        ...sub.defaults,
        ...(presetSpecs || {}),
      }),
    }

    setSignalRows((prev) => ({
      ...prev,
      [categoryId]: {
        ...prev[categoryId],
        [subId]: [...prev[categoryId][subId], row],
      },
    }))

    if (TIER1_IDS.includes(categoryId)) {
      setIsAdditionalStepOpen(false)
      setTier1Open((prev) => ({
        ...prev,
        [categoryId]: true,
      }))
      setTier2Open(createTier2OpenMap())
    } else {
      setIsAdditionalStepOpen(true)
      setTier2Open(createTier2OpenMap(categoryId))
      setTier1Open(createTier1OpenMap())
    }
  }

  const handleAddVariant = (categoryId: string, subId: string) => {
    if (categoryId === 'communication' && subId === 'protocols') {
      setProtocolSelectorContext({ mode: 'add' })
      return
    }
    addSignalRow(categoryId, subId)
  }

  const handleProtocolSelect = (protocol: string) => {
    if (!protocolSelectorContext) return

    if (protocolSelectorContext.mode === 'add') {
      addSignalRow('communication', 'protocols', { range: protocol })
      setProtocolSelectorContext(null)
      return
    }

    updateDraftSpec('range', protocol)
    setProtocolSelectorContext(null)
  }

  const openEditor = (
    target: NonNullable<EditingTarget>,
    anchor?: {
      x: number
      y: number
      width: number
      height: number
    }
  ) => {
    const sub = getSubCategory(target.categoryId, target.subId)
    if (!sub) return

    const rows = signalRows[target.categoryId]?.[target.subId] || []
    const row = rows.find((entry) => entry.id === target.rowId)
    if (!row) return

    setEditingTarget(target)
    setEditorAnchor(anchor || null)
    setDraftEdit({
      quantity: row.quantity,
      specs: normalizeSpecsForSub(sub, { ...row.specs }),
    })
    setShowAdvancedEditor(false)
    setShowDiscardConfirm(false)
  }

  const removeSignalRow = (categoryId: string, subId: string, rowId: string) => {
    const isEditedRowBeingRemoved =
      editingTarget?.categoryId === categoryId && editingTarget?.subId === subId && editingTarget?.rowId === rowId

    setSignalRows((prev) => ({
      ...prev,
      [categoryId]: {
        ...prev[categoryId],
        [subId]: prev[categoryId][subId].filter((row) => row.id !== rowId),
      },
    }))
    setCustomChannelRows((prev) => {
      if (!prev[rowId]) return prev
      const next = { ...prev }
      delete next[rowId]
      return next
    })

    if (isEditedRowBeingRemoved) {
      closeEditorState()
    }
  }

  const updateDraftSpec = (fieldKey: FieldKey, value: string) => {
    if (!editingTarget) return

    const sub = getSubCategory(editingTarget.categoryId, editingTarget.subId)
    if (!sub) return

    setDraftEdit((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        specs: normalizeSpecsForSub(sub, {
          ...prev.specs,
          [fieldKey]: value,
        }),
      }
    })
  }

  const updateRowQuantity = (categoryId: string, subId: string, rowId: string, quantity: number) => {
    const safeQuantity = Number.isFinite(quantity) ? Math.max(0, quantity) : 0

    setSignalRows((prev) => ({
      ...prev,
      [categoryId]: {
        ...prev[categoryId],
        [subId]: prev[categoryId][subId].map((row) =>
          row.id === rowId
            ? {
                ...row,
                quantity: safeQuantity,
              }
            : row
        ),
      },
    }))

    if (
      editingTarget &&
      editingTarget.categoryId === categoryId &&
      editingTarget.subId === subId &&
      editingTarget.rowId === rowId
    ) {
      setDraftEdit((prev) => (prev ? { ...prev, quantity: safeQuantity } : prev))
    }
  }

  const saveDraft = () => {
    if (!editingTarget || !draftEdit) return

    const sub = getSubCategory(editingTarget.categoryId, editingTarget.subId)
    if (!sub) return

    const quantity = Math.max(0, Number.isFinite(draftEdit.quantity) ? draftEdit.quantity : 0)
    const specs = normalizeSpecsForSub(sub, { ...draftEdit.specs })

    setSignalRows((prev) => ({
      ...prev,
      [editingTarget.categoryId]: {
        ...prev[editingTarget.categoryId],
        [editingTarget.subId]: prev[editingTarget.categoryId][editingTarget.subId].map((row) =>
          row.id === editingTarget.rowId
            ? {
                ...row,
                quantity,
                specs,
              }
            : row
        ),
      },
    }))

    closeEditorState()
  }

  const requestCloseEditor = () => {
    if (isDraftDirty) {
      setShowDiscardConfirm(true)
      return
    }
    closeEditorState()
  }

  const discardDraftAndClose = () => {
    closeEditorState()
  }

  const getSubTotal = (categoryId: string, subId: string) => {
    const rows = signalRows[categoryId]?.[subId] || []
    return rows.reduce((total, row) => total + Math.max(0, row.quantity || 0), 0)
  }

  const getCategoryTotal = (categoryId: string) => {
    const category = getCategory(categoryId)
    if (!category) return 0

    return category.subCategories.reduce((total, sub) => total + getSubTotal(categoryId, sub.id), 0)
  }

  const additionalTotalSignals = tier2Categories.reduce((total, category) => total + getCategoryTotal(category.id), 0)
  const hasAnyAdditionalRows = tier2Categories.some((category) =>
    category.subCategories.some((sub) => (signalRows[category.id]?.[sub.id] || []).length > 0)
  )
  const additionalCollapsedActionLabel = hasAnyAdditionalRows ? 'Show' : '+ Add'

  const renderDraftField = (sub: SubCategory, fieldKey: FieldKey) => {
    if (!draftEdit) return null

    const field = sub.fields.find((entry) => entry.key === fieldKey)
    if (!field) return null

    const options = getConditionalOptions(sub, field.key, draftEdit.specs)
    if (!options || options.length === 0) return null

    const selectedValue = draftEdit.specs[field.key] ?? options[0] ?? ''

    if (editingTarget?.categoryId === 'communication' && editingTarget?.subId === 'protocols' && field.key === 'range') {
      return (
        <div key={field.key}>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-700">{field.label}</label>
          <CompactButton
            type="button"
            variant="secondary"
            onClick={() => setProtocolSelectorContext({ mode: 'edit' })}
            className="h-[var(--ui-control-h)] w-full justify-between px-2 text-xs"
          >
            <span className="truncate">{selectedValue || 'Select protocol'}</span>
            <span className="ml-2 text-[11px] text-slate-500">Select</span>
          </CompactButton>
        </div>
      )
    }

    return (
      <div key={field.key}>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-700">{field.label}</label>
        <CompactField
          as="select"
          value={selectedValue}
          onChange={(event) => updateDraftSpec(field.key, event.target.value)}
          className="px-2 text-xs"
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
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Industry</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Protocol Name</span>
                </div>

                <div className="mt-2 rounded-[var(--ui-radius-sm)] border border-slate-200 bg-white">
                  {industryGroups.map((group, index) => (
                    <div
                      key={group.industry}
                      className={cn('grid grid-cols-[110px_minmax(0,1fr)]', index > 0 && 'border-t border-slate-200')}
                    >
                      <div className="bg-slate-50 px-2 py-2 text-xs font-semibold text-slate-700">{group.industry}</div>
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
                                    'inline-flex h-7 items-center rounded-[var(--ui-radius-sm)] border px-2 text-xs font-semibold transition',
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
                          <span className="text-xs text-slate-400">...</span>
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
    const viewportWidth = typeof window === 'undefined' ? 1280 : window.innerWidth
    const viewportHeight = typeof window === 'undefined' ? 800 : window.innerHeight
    const margin = 12
    const floatingBottomGap = 48
    const minPanelHeight = 220
    const desiredPanelHeight = Math.min(Math.round(viewportHeight * 0.62), 520)
    const panelWidth = Math.min(390, Math.max(300, viewportWidth - margin * 2))
    const anchorX = editorAnchor?.x ?? viewportWidth - panelWidth - margin
    const anchorY = editorAnchor?.y ?? 96
    const anchorWidth = editorAnchor?.width ?? 0
    const anchorHeight = editorAnchor?.height ?? 0

    let panelLeft = anchorX + anchorWidth + 10
    const leftSideCandidate = anchorX - panelWidth - 10
    if (panelLeft + panelWidth > viewportWidth - margin && leftSideCandidate >= margin) {
      panelLeft = leftSideCandidate
    }
    panelLeft = Math.min(Math.max(panelLeft, margin), viewportWidth - panelWidth - margin)

    const preferredTop = anchorY + anchorHeight + 8
    const maxTopForFloating = Math.max(margin, viewportHeight - floatingBottomGap - minPanelHeight)
    let panelTop = Math.min(Math.max(preferredTop, margin), maxTopForFloating)

    let panelHeight = Math.min(desiredPanelHeight, viewportHeight - panelTop - floatingBottomGap)
    if (panelHeight < minPanelHeight) {
      panelTop = margin
      panelHeight = Math.min(desiredPanelHeight, viewportHeight - margin * 2)
    }
    panelHeight = Math.max(160, panelHeight)

    return (
      <div className="fixed inset-0 z-[90]">
        <button
          type="button"
          onClick={requestCloseEditor}
          className="absolute inset-0 bg-slate-900/12 backdrop-blur-[1px]"
          aria-label="Close edit panel"
        />

        <div className="pointer-events-none absolute inset-0">
          <div
            className="pointer-events-auto fixed"
            style={{
              top: panelTop,
              left: panelLeft,
              width: panelWidth,
            }}
          >
            <div
              className="relative flex flex-col overflow-hidden rounded-[var(--ui-radius-lg)] border border-slate-200 bg-white/95 shadow-2xl backdrop-blur"
              style={{ height: panelHeight }}
            >
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

              <div className="flex-1 space-y-2 overflow-y-auto px-3 py-2">
                <CompactInspectorBlock className="space-y-[var(--ui-gap-2)] bg-white p-2">
                  {basicFieldKey ? (
                    renderDraftField(sub, basicFieldKey)
                  ) : (
                    <p className="text-xs text-slate-500">No basic parameters for this variant.</p>
                  )}
                </CompactInspectorBlock>

                <div className="space-y-[var(--ui-gap-1)]">
                  <CompactButton
                    type="button"
                    variant="ghost"
                    onClick={() => setShowAdvancedEditor((prev) => !prev)}
                    className="h-7 px-2 text-xs text-slate-700"
                  >
                    {showAdvancedEditor ? 'Hide advanced' : 'Show advanced'}
                  </CompactButton>

                  {showAdvancedEditor && (
                    <CompactInspectorBlock className="space-y-[var(--ui-gap-2)] bg-white p-2">
                      {advancedFieldKeys.map((fieldKey) => renderDraftField(sub, fieldKey))}
                      {advancedFieldKeys.length === 0 && (
                        <p className="text-xs text-slate-500">No additional parameters for this variant.</p>
                      )}
                    </CompactInspectorBlock>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-[var(--ui-gap-1)] border-t border-slate-200 px-3 py-2">
                <CompactButton type="button" variant="secondary" onClick={requestCloseEditor}>
                  Cancel
                </CompactButton>
                <CompactButton type="button" variant="primary" onClick={saveDraft}>
                  Save
                </CompactButton>
              </div>

              {showDiscardConfirm && (
                <div className="absolute inset-0 z-10 flex items-end rounded-[var(--ui-radius-lg)] bg-slate-900/30 p-2">
                  <CompactCard className="w-full space-y-[var(--ui-gap-2)] p-[var(--ui-pad-2)]">
                    <p className="text-sm font-semibold text-slate-900">Discard unsaved changes?</p>
                    <p className="text-xs text-slate-600">Your edits in this panel have not been saved yet.</p>
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

  const renderSignalRow = (categoryId: string, sub: SubCategory, row: SignalRow, rowIndex: number) => {
    const isEditing =
      editingTarget?.categoryId === categoryId && editingTarget?.subId === sub.id && editingTarget?.rowId === row.id

    const summaryTokens = getSpecSummaryTokens(sub, row.specs, {
      categoryId,
      subId: sub.id,
    })
    const summaryText = summaryTokens.length > 0 ? summaryTokens.join(' · ') : 'Default'
    const channelOptions = CHANNEL_PRESET_COUNTS.includes(row.quantity)
      ? CHANNEL_PRESET_COUNTS
      : [...CHANNEL_PRESET_COUNTS, row.quantity].sort((a, b) => a - b)
    const isCustomChannelMode = customChannelRows[row.id] || !CHANNEL_PRESET_COUNTS.includes(row.quantity)

    return (
      <tr
        key={row.id}
        className={cn(
          'border-b border-slate-200 last:border-b-0',
          isEditing && 'bg-blue-50/60'
        )}
      >
        <td className="px-1.5 py-1.5">
          {isCustomChannelMode ? (
            <CompactField
              type="number"
              min="0"
              max="999"
              step="1"
              value={row.quantity}
              onChange={(event) => updateRowQuantity(categoryId, sub.id, row.id, parseInt(event.target.value, 10) || 0)}
              onBlur={() => {
                if (CHANNEL_PRESET_COUNTS.includes(row.quantity)) {
                  setCustomChannelRows((prev) => ({ ...prev, [row.id]: false }))
                }
              }}
              className="h-7 w-[78px] px-1 text-xs"
              aria-label={`${sub.label} channels custom`}
            />
          ) : (
            <CompactField
              as="select"
              value={String(row.quantity)}
              onChange={(event) => {
                const nextValue = event.target.value
                if (nextValue === 'custom') {
                  setCustomChannelRows((prev) => ({ ...prev, [row.id]: true }))
                  return
                }
                setCustomChannelRows((prev) => ({ ...prev, [row.id]: false }))
                updateRowQuantity(categoryId, sub.id, row.id, parseInt(nextValue, 10) || 0)
              }}
              className="h-7 w-[78px] px-1 text-xs"
              aria-label={`${sub.label} channels`}
            >
              {channelOptions.map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
              <option value="custom">Custom...</option>
            </CompactField>
          )}
        </td>
        <td className="px-1.5 py-1.5 text-xs leading-5 text-slate-600 whitespace-normal break-words" title={summaryText}>
          {summaryText}
        </td>
        <td className="px-1.5 py-1.5">
          <div className="flex items-center justify-end gap-0.5">
            <CompactIconButton
              type="button"
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect()
                openEditor(
                  { categoryId, subId: sub.id, rowId: row.id },
                  { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
                )
              }}
              aria-label={`Edit ${sub.label} variant ${rowIndex + 1}`}
              title="Edit"
              className="h-6 w-6"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16.862 3.487a2.1 2.1 0 113.03 2.906L8.19 18.096 4 19l.904-4.19L16.862 3.487z"
                />
              </svg>
            </CompactIconButton>

            <CompactIconButton
              type="button"
              onClick={() => removeSignalRow(categoryId, sub.id, row.id)}
              aria-label={`Remove ${sub.label} variant`}
              title="Remove"
              className="h-6 w-6 text-slate-500 hover:text-red-700"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
              </svg>
            </CompactIconButton>
          </div>
        </td>
      </tr>
    )
  }

  const renderSubCategory = (categoryId: string, sub: SubCategory) => {
    const rows = signalRows[categoryId]?.[sub.id] || []
    const total = getSubTotal(categoryId, sub.id)

    return (
      <div key={sub.id} className="space-y-[var(--ui-gap-2)]">
        <div className="flex items-center justify-between gap-[var(--ui-gap-2)]">
          <p className="text-sm font-semibold text-slate-800">{sub.label}</p>
          <CompactStatBadge>Total: {total}</CompactStatBadge>
        </div>

        {rows.length > 0 ? (
          <div className="overflow-hidden rounded-[var(--ui-radius-sm)] border border-slate-200 bg-white">
            <table className="w-full table-fixed border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="w-[86px] px-1.5 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                    Channels
                  </th>
                  <th className="px-1.5 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                    Key specs
                  </th>
                  <th className="w-[58px] px-1.5 py-1.5 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>{rows.map((row, index) => renderSignalRow(categoryId, sub, row, index))}</tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-500">No variants added.</p>
        )}

        <CompactAddLink type="button" onClick={() => handleAddVariant(categoryId, sub.id)}>
          {getAddLabel(categoryId, sub.label)}
        </CompactAddLink>
      </div>
    )
  }

  const renderTier1Category = (category: (typeof CATEGORIES)[number]) => {
    const isOpen = tier1Open[category.id] ?? false
    const totalSignals = getCategoryTotal(category.id)
    const hasConfiguredRows = category.subCategories.some((sub) => (signalRows[category.id]?.[sub.id] || []).length > 0)
    const collapsedActionLabel = hasConfiguredRows ? 'Show' : '+ Add'

    return (
      <CompactCard key={category.id} variant="outlined" className="self-start p-[var(--ui-pad-2)]">
        <button
          type="button"
          onClick={() => {
            setTier1Open((prev) => ({
              ...prev,
              [category.id]: !isOpen,
            }))
          }}
          className="flex w-full items-center justify-between gap-[var(--ui-gap-2)] rounded-[var(--ui-radius-sm)] text-left"
          aria-expanded={isOpen}
          aria-controls={`tier1-${category.id}`}
        >
          <span className="text-sm font-semibold text-slate-700">
            {category.label} <span className="text-slate-500">({totalSignals})</span>
          </span>
          <div className="flex items-center gap-[var(--ui-gap-1)]">
            <span className="text-xs text-slate-500">{isOpen ? 'Hide' : collapsedActionLabel}</span>
          </div>
        </button>

        {isOpen && (
          <div id={`tier1-${category.id}`} className="mt-[var(--ui-gap-2)] space-y-3 border-t border-slate-200 pt-[var(--ui-gap-2)]">
            {category.subCategories.map((sub, index) => (
              <div key={sub.id} className={cn(index > 0 && 'border-t border-slate-200 pt-[var(--ui-gap-2)]')}>
                {renderSubCategory(category.id, sub)}
              </div>
            ))}
          </div>
        )}
      </CompactCard>
    )
  }

  const getTier2ActiveRows = (category: (typeof CATEGORIES)[number]) => {
    return category.subCategories.flatMap((sub) =>
      (signalRows[category.id]?.[sub.id] || [])
        .filter((row) => row.quantity > 0)
        .map((row) => ({
          sub,
          row,
          summaryText: getSpecSummaryText(sub, row.specs, { categoryId: category.id, subId: sub.id }),
        }))
    )
  }

  const renderTier2Tile = (category: (typeof CATEGORIES)[number]) => {
    const isOpen = tier2Open[category.id] ?? false
    const totalSignals = getCategoryTotal(category.id)
    const activeRows = getTier2ActiveRows(category)
    const hasConfiguredRows = category.subCategories.some((sub) => (signalRows[category.id]?.[sub.id] || []).length > 0)
    const collapsedActionLabel = hasConfiguredRows ? 'Show' : '+ Add'

    return (
      <CompactCard key={category.id} variant="outlined" className="self-start p-[var(--ui-pad-2)]">
        <button
          type="button"
          onClick={() => {
            const nextOpenState = !isOpen
            setTier2Open(createTier2OpenMap(nextOpenState ? category.id : undefined))
          }}
          className="flex w-full items-center justify-between gap-[var(--ui-gap-1)] rounded-[var(--ui-radius-sm)] text-left"
          aria-expanded={isOpen}
          aria-controls={`additional-${category.id}`}
        >
          <span className="text-sm font-semibold text-slate-800">
            {category.label} <span className="text-slate-500">({totalSignals})</span>
          </span>
          <div className="flex items-center gap-[var(--ui-gap-1)]">
            <span className="text-xs text-slate-500">{isOpen ? 'Hide' : collapsedActionLabel}</span>
          </div>
        </button>

        {!isOpen && (
          <div className="mt-[var(--ui-gap-2)]">
            {activeRows.length > 0 ? (
              <div className="space-y-1">
                {activeRows.slice(0, 3).map((item) => {
                  const line = `${item.sub.label}: ${item.row.quantity} ch${item.summaryText ? ` · ${item.summaryText}` : ''}`
                  return (
                    <p key={`${item.sub.id}-${item.row.id}`} className="truncate text-xs text-slate-600" title={line}>
                      {line}
                    </p>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500">No active variants.</p>
            )}
          </div>
        )}

        {isOpen && (
          <div
            id={`additional-${category.id}`}
            className="mt-[var(--ui-gap-2)] space-y-3 border-t border-slate-200 pt-[var(--ui-gap-2)]"
          >
            {category.subCategories.map((sub, index) => (
              <div key={sub.id} className={cn(index > 0 && 'border-t border-slate-200 pt-[var(--ui-gap-2)]')}>
                {renderSubCategory(category.id, sub)}
              </div>
            ))}
          </div>
        )}
      </CompactCard>
    )
  }

  return (
    <>
      <CompactCard variant="default" className="space-y-3 p-[var(--ui-pad-3)]">
        <div className="grid grid-cols-1 items-start gap-3 min-[1200px]:grid-cols-2">
          {tier1Categories.map((category) => (
            <div key={category.id}>{renderTier1Category(category)}</div>
          ))}
        </div>

        {tier2Categories.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => {
                const nextOpen = !isAdditionalStepOpen
                setIsAdditionalStepOpen(nextOpen)
              }}
              className="flex w-full items-center justify-between rounded-[var(--ui-radius-sm)] border border-slate-200 bg-slate-50 px-3 py-2 text-left"
              aria-expanded={isAdditionalStepOpen}
              aria-controls="v3-step-additional"
            >
              <span className="text-sm font-semibold text-slate-800">
                03 Additional I/O <span className="text-slate-500">({additionalTotalSignals})</span>
              </span>
              <span className="text-xs text-slate-500">{isAdditionalStepOpen ? 'Hide' : additionalCollapsedActionLabel}</span>
            </button>

            {isAdditionalStepOpen && (
              <div id="v3-step-additional" className="space-y-3 border-t border-slate-200 pt-3">
                <div className="grid grid-cols-1 gap-3">{tier2Categories.map((category) => renderTier2Tile(category))}</div>
              </div>
            )}
          </>
        )}
      </CompactCard>

      {renderSlideOverEditor()}
      {renderProtocolSelectorOverlay()}
    </>
  )
}

