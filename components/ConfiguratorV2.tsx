'use client'

import {
  CompactAddLink,
  CompactButton,
  CompactCard,
  CompactChip,
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
  type ConfiguratorHookProps,
  type SignalRow,
  buildProtocolIndustryGroups,
  getAddLabel,
  getBasicFieldKey,
  getConditionalOptions,
  getSpecSummaryText,
  getSpecSummaryTokens,
  useConfigurator,
} from './configurator/useConfigurator'

const TIER1_IDS = ['analog', 'digital', 'communication']
const TIER1_ORDER = ['analog', 'digital', 'communication'] as const

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
    addSignalRow,
    removeSignalRow,
    openEditor,
    updateDraftSpec,
    updateDraftQuantity,
    saveDraft,
    requestCloseEditor,
    discardDraftAndClose,
    getSubTotal,
    getCategoryTotal,
  } = useConfigurator({
    tier1Ids: TIER1_IDS,
    tier1Order: TIER1_ORDER,
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

  const renderProtocolIndustrySelector = (sub: SubCategory) => {
    if (!draftEdit) return null

    const protocolField = sub.fields.find((field) => field.key === 'range')
    const protocolOptions = protocolField && Array.isArray(protocolField.options) ? protocolField.options : []
    if (protocolOptions.length === 0) return null

    const industryGroups = buildProtocolIndustryGroups(protocolOptions)

    return (
      <div className="space-y-[var(--ui-gap-2)]">
        <div className="grid grid-cols-[96px_minmax(0,1fr)] rounded-[var(--ui-radius-sm)] border border-slate-200 bg-white px-2 py-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Industry</span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Protocol Name</span>
        </div>

        <div className="max-h-56 overflow-auto rounded-[var(--ui-radius-sm)] border border-slate-200 bg-white">
          {industryGroups.map((group, index) => (
            <div
              key={group.industry}
              className={cn('grid grid-cols-[96px_minmax(0,1fr)]', index > 0 && 'border-t border-slate-200')}
            >
              <div className="bg-slate-50 px-2 py-2 text-xs font-semibold text-slate-700">{group.industry}</div>

              <div className="px-2 py-2">
                {group.protocols.length > 0 ? (
                  <div className="flex flex-wrap gap-[var(--ui-gap-1)]">
                    {group.protocols.map((protocol) => {
                      const isSelected = draftEdit.specs.range === protocol
                      return (
                        <button
                          key={protocol}
                          type="button"
                          onClick={() => updateDraftSpec('range', protocol)}
                          className={cn(
                            'inline-flex h-6 items-center rounded-[var(--ui-radius-sm)] border px-2 text-[11px] font-semibold transition',
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
    )
  }

  const renderSlideOverEditor = () => {
    if (!editingTarget || !editingContext || !draftEdit) return null

    const { category, sub, rowIndex } = editingContext
    const basicFieldKey = getBasicFieldKey(category.id, sub)
    const advancedFieldKeys = sub.fields.filter((field) => field.key !== basicFieldKey).map((field) => field.key)
    const showProtocolIndustrySelector = category.id === 'communication' && sub.id === 'protocols'

    return (
      <div className="fixed inset-0 z-[90]">
        <button
          type="button"
          onClick={requestCloseEditor}
          className="absolute inset-0 bg-slate-900/25 backdrop-blur-[1px]"
          aria-label="Close edit panel"
        />

        <aside className="absolute inset-y-0 right-0 w-full max-w-[420px]">
          <div className="relative flex h-full flex-col border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-2 border-b border-slate-200 p-[var(--ui-pad-2)]">
              <div>
                <CompactSectionLabel>Edit Variant</CompactSectionLabel>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {category.label} / {sub.label} / Variant {rowIndex + 1}
                </p>
              </div>

              <CompactIconButton type="button" onClick={requestCloseEditor} aria-label="Close editor" title="Close">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
                </svg>
              </CompactIconButton>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-[var(--ui-pad-2)]">
              <CompactInspectorBlock className="space-y-[var(--ui-gap-2)]">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                    Quantity
                  </label>
                  <CompactField
                    type="number"
                    min="0"
                    max="999"
                    step="1"
                    value={draftEdit.quantity}
                    onChange={(event) => updateDraftQuantity(parseInt(event.target.value, 10) || 0)}
                    className="px-2 text-xs"
                    aria-label="Quantity"
                  />
                </div>

                {basicFieldKey && renderDraftField(sub, basicFieldKey)}
              </CompactInspectorBlock>

              <div className="space-y-[var(--ui-gap-2)]">
                <CompactButton
                  type="button"
                  variant="ghost"
                  onClick={() => setShowAdvancedEditor((prev) => !prev)}
                  className="h-7 px-2 text-xs text-slate-700"
                >
                  {showAdvancedEditor ? 'Hide advanced' : 'Show advanced'}
                </CompactButton>

                {showAdvancedEditor && (
                  <CompactInspectorBlock className="space-y-[var(--ui-gap-2)]">
                    {showProtocolIndustrySelector && renderProtocolIndustrySelector(sub)}
                    {advancedFieldKeys.map((fieldKey) => renderDraftField(sub, fieldKey))}
                    {!showProtocolIndustrySelector && advancedFieldKeys.length === 0 && (
                      <p className="text-xs text-slate-500">No additional parameters for this variant.</p>
                    )}
                  </CompactInspectorBlock>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-[var(--ui-gap-1)] border-t border-slate-200 p-[var(--ui-pad-2)]">
              <CompactButton type="button" variant="secondary" onClick={requestCloseEditor}>
                Cancel
              </CompactButton>
              <CompactButton type="button" variant="primary" onClick={saveDraft}>
                Save
              </CompactButton>
            </div>

            {showDiscardConfirm && (
              <div className="absolute inset-0 z-10 flex items-end bg-slate-900/30 p-[var(--ui-pad-2)]">
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
        </aside>
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

    return (
      <div
        key={row.id}
        className={cn(
          'flex items-center gap-[var(--ui-gap-1)] rounded-[var(--ui-radius-sm)] border p-1',
          isEditing ? 'border-[rgb(var(--speedgoat-blue))]/60 bg-blue-50/60' : 'border-slate-200 bg-white'
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-[var(--ui-gap-1)] rounded-[var(--ui-radius-sm)] px-1 py-0.5 text-left">
          <CompactChip className="min-w-[42px] justify-center rounded-[var(--ui-radius-sm)] text-xs font-semibold">
            {row.quantity}
          </CompactChip>

          <div className="flex min-w-0 flex-1 items-center gap-[var(--ui-gap-1)] overflow-hidden">
            {summaryTokens.length > 0 ? (
              summaryTokens.map((token, index) => (
                <CompactChip key={`${row.id}-${index}`} className="max-w-[150px] truncate text-xs" title={token}>
                  {token}
                </CompactChip>
              ))
            ) : (
              <span className="truncate text-xs text-slate-500">Default</span>
            )}
          </div>
        </div>

        <CompactIconButton
          type="button"
          onClick={() => openEditor({ categoryId, subId: sub.id, rowId: row.id })}
          aria-label={`Edit ${sub.label} variant ${rowIndex + 1}`}
          title="Edit"
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
          className="text-slate-500 hover:text-red-700"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
          </svg>
        </CompactIconButton>
      </div>
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
          <div className="space-y-[var(--ui-gap-1)]">{rows.map((row, index) => renderSignalRow(categoryId, sub, row, index))}</div>
        ) : (
          <p className="text-xs text-slate-500">No variants added.</p>
        )}

        <CompactAddLink type="button" onClick={() => addSignalRow(categoryId, sub.id)}>
          {getAddLabel(categoryId, sub.label)}
        </CompactAddLink>
      </div>
    )
  }

  const renderTier1Category = (category: (typeof CATEGORIES)[number]) => {
    const isOpen = tier1Open[category.id] ?? false
    const totalSignals = getCategoryTotal(category.id)

    return (
      <CompactCard key={category.id} variant="default" className="self-start p-[var(--ui-pad-2)]">
        <button
          type="button"
          onClick={() => {
            const nextOpenState = !isOpen
            setTier1Open((prev) => ({ ...prev, [category.id]: nextOpenState }))
          }}
          className="flex w-full items-center justify-between gap-[var(--ui-gap-2)] rounded-[var(--ui-radius-sm)] text-left"
          aria-expanded={isOpen}
          aria-controls={`tier1-${category.id}`}
        >
          <span className="text-sm font-semibold uppercase tracking-wide text-slate-700">{category.label}</span>
          <div className="flex items-center gap-[var(--ui-gap-1)]">
            {totalSignals > 0 && <CompactStatBadge>{totalSignals}</CompactStatBadge>}
            <span className="text-xs text-slate-500">{isOpen ? 'Hide' : 'Show'}</span>
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

    return (
      <CompactCard key={category.id} variant="outlined" className="self-start p-[var(--ui-pad-2)]">
        <button
          type="button"
          onClick={() =>
            setTier2Open((prev) => ({
              ...prev,
              [category.id]: !prev[category.id],
            }))
          }
          className="flex w-full items-center justify-between gap-[var(--ui-gap-1)] rounded-[var(--ui-radius-sm)] text-left"
          aria-expanded={isOpen}
          aria-controls={`additional-${category.id}`}
        >
          <span className="text-sm font-semibold text-slate-800">{category.label}</span>
          <div className="flex items-center gap-[var(--ui-gap-1)]">
            {totalSignals > 0 && <CompactStatBadge>{totalSignals}</CompactStatBadge>}
            <span className="text-xs text-slate-500">{isOpen ? 'Hide' : 'Show'}</span>
          </div>
        </button>

        {!isOpen && (
          <div className="mt-[var(--ui-gap-2)]">
            {activeRows.length > 0 ? (
              <div className="flex flex-wrap gap-[var(--ui-gap-1)]">
                {activeRows.slice(0, 4).map((item) => {
                  const chipLabel = `${item.sub.label}: ${item.row.quantity}${item.summaryText ? ` | ${item.summaryText}` : ''}`
                  return (
                    <CompactChip key={`${item.sub.id}-${item.row.id}`} className="max-w-full truncate" title={chipLabel}>
                      {chipLabel}
                    </CompactChip>
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
        <p className="text-sm text-slate-600">
          Configure required I/O variants. Use the pen icon on a variant row to edit details.
        </p>

        <div className="space-y-3">
          <div>
            <CompactSectionLabel>02 Core I/O</CompactSectionLabel>
            <p className="mt-1 text-xs text-slate-500">Required. Add at least one core I/O variant to continue.</p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {tier1Categories.map((category) => renderTier1Category(category))}
          </div>

          {tier2Categories.length > 0 && (
            <div className="space-y-2">
              <CompactSectionLabel>03 Additional I/O</CompactSectionLabel>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{tier2Categories.map((category) => renderTier2Tile(category))}</div>
            </div>
          )}
        </div>
      </CompactCard>

      {renderSlideOverEditor()}
    </>
  )
}
