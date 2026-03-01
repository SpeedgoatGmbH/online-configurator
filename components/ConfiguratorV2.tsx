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
import { CATEGORIES } from './configurator/data'
import type { FieldKey, SubCategory } from './configurator/types'
import {
  CHANNEL_PRESET_COUNTS,
  type ConfiguratorHookProps,
  type SignalRow,
  buildProtocolIndustryGroups,
  getAddLabel,
  getBasicFieldKey,
  getConditionalOptions,
  getSpecSummaryText,
  getSpecSummaryTokens,
  getSubCategory,
  isSpecsDefault,
  useConfigurator,
} from './configurator/useConfigurator'

const TIER1_IDS = ['analog', 'digital', 'communication', 'motion']
const TIER1_ORDER = ['analog', 'digital', 'communication', 'motion'] as const

export default function ConfiguratorV2({ onSummaryChange, onRequirementsChange }: ConfiguratorHookProps = {}) {
  const {
    signalRows,
    editingTarget,
    editingContext,
    draftEdit,
    showAdvancedEditor,
    setShowAdvancedEditor,
    showDiscardConfirm,
    setShowDiscardConfirm,
    tier1Open,
    setTier1Open,
    tier2Open,
    setTier2Open,
    tier1Categories,
    tier2Categories,
    editorAnchor,
    protocolSelectorContext,
    setProtocolSelectorContext,
    customChannelRows,
    setCustomChannelRows,
    isAdditionalStepOpen,
    setIsAdditionalStepOpen,
    removeSignalRow,
    openEditor,
    updateDraftSpec,
    updateRowQuantity,
    saveDraft,
    requestCloseEditor,
    discardDraftAndClose,
    handleAddVariant,
    handleProtocolSelect,
    createTier2OpenMap,
    getSubTotal,
    getCategoryTotal,
    additionalTotalSignals,
    additionalCollapsedActionLabel,
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
    const specsAreDefault = isSpecsDefault(sub, row.specs)
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
          <span className="inline-flex items-center gap-1">
            {!specsAreDefault && (
              <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--speedgoat-blue))]" title="Customized" />
            )}
            {summaryText}
          </span>
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

  const getTier1ActiveRows = (category: (typeof CATEGORIES)[number]) => {
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

  const renderTier1Category = (category: (typeof CATEGORIES)[number]) => {
    const isOpen = tier1Open[category.id] ?? false
    const totalSignals = getCategoryTotal(category.id)
    const hasConfiguredRows = category.subCategories.some((sub) => (signalRows[category.id]?.[sub.id] || []).length > 0)
    const collapsedActionLabel = hasConfiguredRows ? 'Show' : '+ Add'
    const activeRows = getTier1ActiveRows(category)

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

        {!isOpen && activeRows.length > 0 && (
          <div className="mt-[var(--ui-gap-1)] space-y-0.5">
            {activeRows.slice(0, 4).map((item) => {
              const line = `${item.sub.label}: ${item.row.quantity} ch${item.summaryText ? ` · ${item.summaryText}` : ''}`
              return (
                <p key={`${item.sub.id}-${item.row.id}`} className="truncate text-xs text-slate-500" title={line}>
                  {line}
                </p>
              )
            })}
            {activeRows.length > 4 && (
              <p className="text-xs text-slate-400">+{activeRows.length - 4} more</p>
            )}
          </div>
        )}

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
        <div className="space-y-2">
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
              aria-controls="v2-step-additional"
            >
              <span className="text-sm font-semibold text-slate-800">
                03 Additional I/O <span className="text-slate-500">({additionalTotalSignals})</span>
              </span>
              <span className="text-xs text-slate-500">{isAdditionalStepOpen ? 'Hide' : additionalCollapsedActionLabel}</span>
            </button>

            {isAdditionalStepOpen && (
              <div id="v2-step-additional" className="space-y-3 border-t border-slate-200 pt-3">
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

