'use client'

import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from 'react'
import { CATEGORIES } from './data'
import type { RequirementRow } from './proposalTypes'
import type { ConfiguratorProps, FieldKey, SpecsRecord, SubCategory } from './types'

// ─── Shared types ───────────────────────────────────────────────────────────────

export type SignalRow = {
  id: string
  quantity: number
  specs: SpecsRecord
}

export type EditingTarget = {
  categoryId: string
  subId: string
  rowId: string
} | null

export type DraftEdit = {
  quantity: number
  specs: SpecsRecord
} | null

export type ProtocolSelectorContext = {
  mode: 'add' | 'edit'
} | null

export type EditorAnchor = {
  x: number
  y: number
  width: number
  height: number
} | null

export type EditingContext = {
  category: (typeof CATEGORIES)[number]
  sub: SubCategory
  row: SignalRow
  rowIndex: number
}

export type ConfiguratorSummary = {
  totalSignals: number
  rowCount: number
  categoryTotals: Record<string, number>
}

export type ConfiguratorHookProps = ConfiguratorProps & {
  onSummaryChange?: (summary: ConfiguratorSummary) => void
  onRequirementsChange?: (payload: { rows: RequirementRow[] }) => void
}

// ─── Shared constants ───────────────────────────────────────────────────────────

export const PROTOCOL_INDUSTRY_ORDER = ['Cross', 'Automotive', 'Aerospace', 'Industrial'] as const

export type ProtocolIndustry = (typeof PROTOCOL_INDUSTRY_ORDER)[number]
export type ProtocolIndustryGroup = { industry: ProtocolIndustry; protocols: string[] }

export const PROTOCOL_INDUSTRY_MAP: Record<ProtocolIndustry, string[]> = {
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

export const CHANNEL_PRESET_COUNTS = [0, 1, 2, 4, 8, 16, 32, 64, 128]

// ─── Pure helper functions ──────────────────────────────────────────────────────

export function buildInitialSignalRows(): Record<string, Record<string, SignalRow[]>> {
  const initial: Record<string, Record<string, SignalRow[]>> = {}
  CATEGORIES.forEach((category) => {
    initial[category.id] = {}
    category.subCategories.forEach((sub) => {
      initial[category.id][sub.id] = []
    })
  })
  return initial
}

export function getCategory(categoryId: string) {
  return CATEGORIES.find((category) => category.id === categoryId)
}

export function getSubCategory(categoryId: string, subId: string) {
  return getCategory(categoryId)?.subCategories.find((sub) => sub.id === subId)
}

export function buildProtocolIndustryGroups(protocolOptions: string[]): ProtocolIndustryGroup[] {
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

export function getConditionalOptions(
  sub: SubCategory,
  fieldKey: FieldKey,
  currentSpecs: SpecsRecord
): string[] | undefined {
  const field = sub.fields.find((entry) => entry.key === fieldKey)
  if (!field) return undefined

  if (Array.isArray(field.options)) return field.options

  const dependsOnValue = currentSpecs[field.options.dependsOn]
  if (!dependsOnValue) return []
  return field.options.conditions[dependsOnValue] || []
}

export function normalizeSpecsForSub(sub: SubCategory, currentSpecs: SpecsRecord): SpecsRecord {
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

export function getSpecSummaryTokens(
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

export function getSpecSummaryText(
  sub: SubCategory,
  specs: SpecsRecord,
  context?: { categoryId: string; subId: string }
): string {
  return getSpecSummaryTokens(sub, specs, context).join(' | ')
}

export function getAddLabel(categoryId: string, subLabel: string): string {
  if (categoryId === 'communication') return '+ Add protocol type'
  const normalized = subLabel.toLowerCase().endsWith('s') ? subLabel.toLowerCase().slice(0, -1) : subLabel.toLowerCase()
  return `+ Add ${normalized} type`
}

/** Returns true when the row's specs match the subcategory defaults (after normalization). */
export function isSpecsDefault(sub: SubCategory, specs: SpecsRecord): boolean {
  const defaultSpecs = normalizeSpecsForSub(sub, sub.defaults)
  const currentSpecs = normalizeSpecsForSub(sub, specs)
  return sub.fields.every((field) => (currentSpecs[field.key] ?? '') === (defaultSpecs[field.key] ?? ''))
}

export function getBasicFieldKey(categoryId: string, sub: SubCategory): FieldKey | undefined {
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

// ─── Hook options ───────────────────────────────────────────────────────────────

export interface UseConfiguratorOptions {
  /** Tier 1 category IDs — V1/V2: ['analog','digital','communication'], V3+: adds 'motion' */
  tier1Ids: string[]
  /** Display order of tier 1 categories */
  tier1Order: readonly string[]
  /** Whether this version uses accordion mode for addSignalRow (V3+) vs simple toggle (V1/V2) */
  accordionMode?: boolean
  /** Whether this version uses editor anchors (floating editor panels, V3+) */
  useEditorAnchors?: boolean
  /** Whether this version uses protocol selector context (V3+) */
  useProtocolSelector?: boolean
  /** Whether this version uses custom channel rows (V3+) */
  useCustomChannelRows?: boolean
  /** Optional extra cleanup when closing editor state (e.g. V3_3's closeProtocolSelector) */
  onCloseEditorExtra?: () => void
  /** Callbacks */
  onSummaryChange?: (summary: ConfiguratorSummary) => void
  onRequirementsChange?: (payload: { rows: RequirementRow[] }) => void
}

// ─── Hook return type ───────────────────────────────────────────────────────────

export interface UseConfiguratorReturn {
  // State
  signalRows: Record<string, Record<string, SignalRow[]>>
  setSignalRows: Dispatch<SetStateAction<Record<string, Record<string, SignalRow[]>>>>
  editingTarget: EditingTarget
  setEditingTarget: Dispatch<SetStateAction<EditingTarget>>
  editingContext: EditingContext | null
  draftEdit: DraftEdit
  setDraftEdit: Dispatch<SetStateAction<DraftEdit>>
  isDraftDirty: boolean
  showAdvancedEditor: boolean
  setShowAdvancedEditor: Dispatch<SetStateAction<boolean>>
  showDiscardConfirm: boolean
  setShowDiscardConfirm: Dispatch<SetStateAction<boolean>>
  tier1Open: Record<string, boolean>
  setTier1Open: Dispatch<SetStateAction<Record<string, boolean>>>
  tier2Open: Record<string, boolean>
  setTier2Open: Dispatch<SetStateAction<Record<string, boolean>>>

  // V3+ state (always present but may be unused by V1/V2)
  editorAnchor: EditorAnchor
  setEditorAnchor: Dispatch<SetStateAction<EditorAnchor>>
  protocolSelectorContext: ProtocolSelectorContext
  setProtocolSelectorContext: Dispatch<SetStateAction<ProtocolSelectorContext>>
  customChannelRows: Record<string, boolean>
  setCustomChannelRows: Dispatch<SetStateAction<Record<string, boolean>>>
  isAdditionalStepOpen: boolean
  setIsAdditionalStepOpen: Dispatch<SetStateAction<boolean>>

  // Derived data
  tier1Categories: (typeof CATEGORIES)[number][]
  tier2Categories: (typeof CATEGORIES)[number][]
  additionalTotalSignals: number
  hasAnyAdditionalRows: boolean
  additionalCollapsedActionLabel: string

  // Actions
  addSignalRow: (categoryId: string, subId: string, presetSpecs?: Partial<SpecsRecord>) => void
  removeSignalRow: (categoryId: string, subId: string, rowId: string) => void
  openEditor: (target: NonNullable<EditingTarget>, anchor?: EditorAnchor) => void
  closeEditorState: () => void
  updateDraftSpec: (fieldKey: FieldKey, value: string) => void
  updateDraftQuantity: (quantity: number) => void
  updateRowQuantity: (categoryId: string, subId: string, rowId: string, quantity: number) => void
  saveDraft: () => void
  requestCloseEditor: () => void
  discardDraftAndClose: () => void
  handleAddVariant: (categoryId: string, subId: string) => void
  handleProtocolSelect: (protocol: string) => void
  createTier1OpenMap: (openId?: string) => Record<string, boolean>
  createTier2OpenMap: (openId?: string) => Record<string, boolean>

  // Totals
  getSubTotal: (categoryId: string, subId: string) => number
  getCategoryTotal: (categoryId: string) => number
}

// ─── Hook implementation ────────────────────────────────────────────────────────

export function useConfigurator(options: UseConfiguratorOptions): UseConfiguratorReturn {
  const {
    tier1Ids,
    tier1Order,
    accordionMode = false,
    useEditorAnchors = false,
    useProtocolSelector = false,
    onCloseEditorExtra,
    onSummaryChange,
    onRequirementsChange,
  } = options

  // ─── State ──────────────────────────────────────────────────────────────────

  const [signalRows, setSignalRows] = useState<Record<string, Record<string, SignalRow[]>>>(() =>
    buildInitialSignalRows()
  )
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
    tier1Ids.forEach((id) => {
      initial[id] = false
    })
    return initial
  })
  const [tier2Open, setTier2Open] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    CATEGORIES.filter((category) => !tier1Ids.includes(category.id)).forEach((category) => {
      initial[category.id] = false
    })
    return initial
  })

  // ─── Derived data ───────────────────────────────────────────────────────────

  const orderedTier1Categories = tier1Order
    .map((id) => CATEGORIES.find((category) => category.id === id))
    .filter((category): category is (typeof CATEGORIES)[number] => Boolean(category))
  const overflowTier1Categories = CATEGORIES.filter(
    (category) => tier1Ids.includes(category.id) && !tier1Order.includes(category.id)
  )
  const tier1Categories = [...orderedTier1Categories, ...overflowTier1Categories]
  const tier2Categories = CATEGORIES.filter((category) => !tier1Ids.includes(category.id))

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

  // ─── Close editor ───────────────────────────────────────────────────────────

  const closeEditorState = () => {
    setEditingTarget(null)
    if (useEditorAnchors) setEditorAnchor(null)
    setDraftEdit(null)
    if (useProtocolSelector) setProtocolSelectorContext(null)
    setShowAdvancedEditor(false)
    setShowDiscardConfirm(false)
    onCloseEditorExtra?.()
  }

  // ─── Memos ──────────────────────────────────────────────────────────────────

  const editingContext = useMemo<EditingContext | null>(() => {
    if (!editingTarget) return null

    const category = getCategory(editingTarget.categoryId)
    if (!category) return null

    const sub = category.subCategories.find((entry) => entry.id === editingTarget.subId)
    if (!sub) return null

    const rows = signalRows[category.id]?.[sub.id] || []
    const rowIndex = rows.findIndex((row) => row.id === editingTarget.rowId)
    if (rowIndex === -1) return null

    return { category, sub, row: rows[rowIndex], rowIndex }
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

  // ─── Effects ────────────────────────────────────────────────────────────────

  // Stale editing cleanup
  useEffect(() => {
    if (editingTarget && !editingContext) {
      closeEditorState()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingContext, editingTarget])

  // Body overflow lock
  useEffect(() => {
    const shouldLock = useProtocolSelector
      ? !!(editingTarget || protocolSelectorContext)
      : !!editingTarget

    if (!shouldLock) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [editingTarget, protocolSelectorContext, useProtocolSelector])

  // Summary change
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

    onSummaryChange({ totalSignals, rowCount, categoryTotals })
  }, [onSummaryChange, signalRows])

  // Requirements change
  useEffect(() => {
    if (!onRequirementsChange) return

    const rows: RequirementRow[] = []
    CATEGORIES.forEach((category) => {
      category.subCategories.forEach((sub) => {
        const subRows = signalRows[category.id]?.[sub.id] || []
        subRows.forEach((row) => {
          const quantity = Math.max(0, row.quantity || 0)
          if (quantity <= 0) return

          const specs: Record<string, string> = {}
          sub.fields.forEach((field) => {
            const value = row.specs[field.key]
            if (typeof value === 'string' && value.length > 0) {
              specs[field.key] = value
            }
          })

          rows.push({
            categoryId: category.id,
            categoryLabel: category.label,
            subId: sub.id,
            subLabel: sub.label,
            rowId: row.id,
            quantity,
            specs,
          })
        })
      })
    })

    onRequirementsChange({ rows })
  }, [onRequirementsChange, signalRows])

  // ─── Actions ────────────────────────────────────────────────────────────────

  const addSignalRow = (categoryId: string, subId: string, presetSpecs?: Partial<SpecsRecord>) => {
    const sub = getSubCategory(categoryId, subId)
    if (!sub) return

    const row: SignalRow = {
      id: `${categoryId}-${subId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      quantity: 1,
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

    if (accordionMode) {
      // V3+ accordion: collapse other tiers, expand this one
      if (tier1Ids.includes(categoryId)) {
        setIsAdditionalStepOpen(false)
        setTier1Open((prev) => ({ ...prev, [categoryId]: true }))
        setTier2Open(createTier2OpenMap())
      } else {
        setIsAdditionalStepOpen(true)
        setTier2Open(createTier2OpenMap(categoryId))
        setTier1Open(createTier1OpenMap())
      }
    } else {
      // V1/V2 simple toggle: just open the relevant tier
      if (tier1Ids.includes(categoryId)) {
        setTier1Open((prev) => ({ ...prev, [categoryId]: true }))
      } else {
        setTier2Open((prev) => ({ ...prev, [categoryId]: true }))
      }
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

  const openEditor = (target: NonNullable<EditingTarget>, anchor?: EditorAnchor) => {
    const sub = getSubCategory(target.categoryId, target.subId)
    if (!sub) return

    const rows = signalRows[target.categoryId]?.[target.subId] || []
    const row = rows.find((entry) => entry.id === target.rowId)
    if (!row) return

    setEditingTarget(target)
    if (useEditorAnchors) setEditorAnchor(anchor || null)
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

    // V3+ also clean up custom channel rows
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

  const updateDraftQuantity = (quantity: number) => {
    const safeQuantity = Number.isFinite(quantity) ? Math.max(0, quantity) : 0
    setDraftEdit((prev) => (prev ? { ...prev, quantity: safeQuantity } : prev))
  }

  const updateRowQuantity = (categoryId: string, subId: string, rowId: string, quantity: number) => {
    const safeQuantity = Number.isFinite(quantity) ? Math.max(0, quantity) : 0

    setSignalRows((prev) => ({
      ...prev,
      [categoryId]: {
        ...prev[categoryId],
        [subId]: prev[categoryId][subId].map((row) =>
          row.id === rowId ? { ...row, quantity: safeQuantity } : row
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
            ? { ...row, quantity, specs }
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

  // ─── Totals ─────────────────────────────────────────────────────────────────

  const getSubTotal = (categoryId: string, subId: string) => {
    const rows = signalRows[categoryId]?.[subId] || []
    return rows.reduce((total, row) => total + Math.max(0, row.quantity || 0), 0)
  }

  const getCategoryTotal = (categoryId: string) => {
    const category = getCategory(categoryId)
    if (!category) return 0
    return category.subCategories.reduce((total, sub) => total + getSubTotal(categoryId, sub.id), 0)
  }

  const additionalTotalSignals = tier2Categories.reduce(
    (total, category) => total + getCategoryTotal(category.id),
    0
  )
  const hasAnyAdditionalRows = tier2Categories.some((category) =>
    category.subCategories.some((sub) => (signalRows[category.id]?.[sub.id] || []).length > 0)
  )
  const additionalCollapsedActionLabel = hasAnyAdditionalRows ? 'Show' : '+ Add'

  // ─── Return ─────────────────────────────────────────────────────────────────

  return {
    // State
    signalRows,
    setSignalRows,
    editingTarget,
    setEditingTarget,
    editingContext,
    draftEdit,
    setDraftEdit,
    isDraftDirty,
    showAdvancedEditor,
    setShowAdvancedEditor,
    showDiscardConfirm,
    setShowDiscardConfirm,
    tier1Open,
    setTier1Open,
    tier2Open,
    setTier2Open,

    // V3+ state
    editorAnchor,
    setEditorAnchor,
    protocolSelectorContext,
    setProtocolSelectorContext,
    customChannelRows,
    setCustomChannelRows,
    isAdditionalStepOpen,
    setIsAdditionalStepOpen,

    // Derived data
    tier1Categories,
    tier2Categories,
    additionalTotalSignals,
    hasAnyAdditionalRows,
    additionalCollapsedActionLabel,

    // Actions
    addSignalRow,
    removeSignalRow,
    openEditor,
    closeEditorState,
    updateDraftSpec,
    updateDraftQuantity,
    updateRowQuantity,
    saveDraft,
    requestCloseEditor,
    discardDraftAndClose,
    handleAddVariant,
    handleProtocolSelect,
    createTier1OpenMap,
    createTier2OpenMap,

    // Totals
    getSubTotal,
    getCategoryTotal,
  }
}
