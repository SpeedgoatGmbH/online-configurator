'use client'

import { useState } from 'react'
import { CATEGORIES } from './configurator/data'
import SubCategoryCard from './configurator/SubCategoryCard'
import WarningBanner from './configurator/WarningBanner'
import MachineSelection from './configurator/MachineSelection'
import {
  createInitialState,
  createInitialTempSpecs,
  getTotalChannelsForCategory,
  isDuplicateRow,
} from './configurator/state'
import type {
  ConfiguratorProps,
  EditRowData,
  FieldKey,
  RowData,
  SpecsRecord,
  SubCategoryState,
} from './configurator/types'

interface PendingSwitch {
  fromCategoryId: string
  toCategoryId: string
}

function createInitialStateWithDefaults(categories: typeof CATEGORIES) {
  // Return clean state with no default rows - cards will be collapsed
  return createInitialState(categories)
}

export default function Configurator({}: ConfiguratorProps = {}) {
  // Machine selection state
  const [selectedMachineType, setSelectedMachineType] = useState<string>('')
  const [selectedMachineModel, setSelectedMachineModel] = useState<string>('')
  
  const [enabledCategories, setEnabledCategories] = useState<Record<string, boolean>>({})
  const [showingConfig, setShowingConfig] = useState<Record<string, Record<string, boolean>>>({})
  const [editingRow, setEditingRow] = useState<string | null>(null)
  const [editRowData, setEditRowData] = useState<EditRowData | null>(null)
  const [warningMessage, setWarningMessage] = useState<string | null>(null)
  const [pendingSwitch, setPendingSwitch] = useState<PendingSwitch | null>(null)
  const [showSummary, setShowSummary] = useState(false)
  const [expandedAdditionalIO, setExpandedAdditionalIO] = useState(false)
  const [state, setState] = useState(() => createInitialStateWithDefaults(CATEGORIES))

  const handleMachineSelect = (machineType: string, machineModel: string) => {
    setSelectedMachineType(machineType)
    setSelectedMachineModel(machineModel)
  }

  const addCategory = (categoryId: string) => {
    // Check if a category is currently open and has changes
    const currentlyEnabledId = Object.keys(enabledCategories).find((id) => enabledCategories[id])
    
    if (currentlyEnabledId && currentlyEnabledId !== categoryId) {
      // Show smooth modal instead of browser confirm
      setPendingSwitch({ fromCategoryId: currentlyEnabledId, toCategoryId: categoryId })
      return
    }

    const category = CATEGORIES.find((c) => c.id === categoryId)
    if (!category) return

    // Close all other categories (accordion behavior)
    setEnabledCategories({ [categoryId]: true })
    
    // Add one default row to each subcategory
    setState((prev) => {
      const newCategoryState: Record<string, SubCategoryState> = {}
      
      category.subCategories.forEach((sub) => {
        // Only add default row if there are no rows yet
        if (prev[categoryId][sub.id].rows.length === 0) {
          newCategoryState[sub.id] = {
            rows: [
              {
                id: `${categoryId}-${sub.id}-${Date.now()}-${Math.random()}`,
                quantity: 8,
                specs: { ...sub.defaults },
              },
            ],
          }
        } else {
          newCategoryState[sub.id] = prev[categoryId][sub.id]
        }
      })
      
      return {
        ...prev,
        [categoryId]: newCategoryState,
      }
    })
  }

  const toggleConfigForm = (categoryId: string, subId: string) => {
    const isCurrentlyOpen = showingConfig[categoryId]?.[subId] ?? false
    
    // When opening the form, populate with default values
    if (!isCurrentlyOpen) {
      const category = CATEGORIES.find((c) => c.id === categoryId)
      const sub = category?.subCategories.find((s) => s.id === subId)
      if (sub) {
        setTempSpecs((prev) => ({
          ...prev,
          [categoryId]: {
            ...prev[categoryId],
            [subId]: {
              quantity: 8,
              specs: { ...sub.defaults },
            },
          },
        }))
      }
    }
    
    setShowingConfig((prev) => ({
      ...prev,
      [categoryId]: {
        ...prev[categoryId],
        [subId]: !isCurrentlyOpen,
      },
    }))
  }

  const removeCategory = (categoryId: string) => {
    setEnabledCategories((prev) => {
      const updated = { ...prev }
      delete updated[categoryId]
      return updated
    })
  }

  const cancelCategory = (categoryId: string) => {
    // Reset to empty state (remove auto-added default row)
    setState((prev) => {
      const updated = { ...prev }
      const category = CATEGORIES.find((c) => c.id === categoryId)
      if (category) {
        category.subCategories.forEach((sub) => {
          updated[categoryId][sub.id] = { rows: [] }
        })
      }
      return updated
    })
    // Then close the category
    removeCategory(categoryId)
  }

  const [tempSpecs, setTempSpecs] = useState(() => createInitialTempSpecs(CATEGORIES))

  const updateTempQuantity = (categoryId: string, subId: string, quantity: number) => {
    setTempSpecs((prev) => ({
      ...prev,
      [categoryId]: {
        ...prev[categoryId],
        [subId]: {
          ...prev[categoryId][subId],
          quantity,
        },
      },
    }))
  }

  const updateTempSpec = (categoryId: string, subId: string, fieldKey: FieldKey, value: string) => {
    setTempSpecs((prev) => ({
      ...prev,
      [categoryId]: {
        ...prev[categoryId],
        [subId]: {
          ...prev[categoryId][subId],
          specs: {
            ...prev[categoryId][subId].specs,
            [fieldKey]: value,
          },
        },
      },
    }))
  }

  const addRow = (categoryId: string, subId: string): boolean => {
    const temp = tempSpecs[categoryId][subId]
    
    // Check for duplicate configuration
    const existingRows = state[categoryId][subId].rows
    const isDuplicate = isDuplicateRow(existingRows, temp)

    if (isDuplicate) {
      setWarningMessage('This configuration already exists! Change specs to add a different variant.')
      setTimeout(() => setWarningMessage(null), 3000)
      return false
    }

    const newRow: RowData = {
      id: crypto.randomUUID(),
      quantity: temp.quantity,
      specs: { ...temp.specs },
    }

    setState((prev) => ({
      ...prev,
      [categoryId]: {
        ...prev[categoryId],
        [subId]: {
          rows: [...prev[categoryId][subId].rows, newRow],
        },
      },
    }))

    // Reset temp to defaults
    const category = CATEGORIES.find((c) => c.id === categoryId)
    const sub = category?.subCategories.find((s) => s.id === subId)
    if (sub) {
      setTempSpecs((prev) => ({
        ...prev,
        [categoryId]: {
          ...prev[categoryId],
          [subId]: {
            quantity: 8,
            specs: { ...sub.defaults },
          },
        },
      }))
    }
    return true
  }

  const removeRow = (categoryId: string, subId: string, rowId: string) => {
    setState((prev) => ({
      ...prev,
      [categoryId]: {
        ...prev[categoryId],
        [subId]: {
          rows: prev[categoryId][subId].rows.filter((r) => r.id !== rowId),
        },
      },
    }))
  }

  const updateRow = (categoryId: string, subId: string, rowId: string, quantity: number, specs: SpecsRecord): boolean => {
    // Check for duplicate configuration (excluding the row being edited)
    const existingRows = state[categoryId][subId].rows
    const isDuplicate = isDuplicateRow(existingRows, { id: rowId, quantity, specs })

    if (isDuplicate) {
      setWarningMessage('This configuration already exists! Change specs to make it unique.')
      setTimeout(() => setWarningMessage(null), 3000)
      return false
    }

    setState((prev) => ({
      ...prev,
      [categoryId]: {
        ...prev[categoryId],
        [subId]: {
          rows: prev[categoryId][subId].rows.map((r) =>
            r.id === rowId ? { ...r, quantity, specs } : r
          ),
        },
      },
    }))
    setEditingRow(null)
    setEditRowData(null)
    return true
  }

  const startEditRow = (row: RowData) => {
    setEditingRow(row.id)
    setEditRowData({ quantity: row.quantity, specs: { ...row.specs } })
  }

  const cancelEditRow = () => {
    setEditingRow(null)
    setEditRowData(null)
  }

  const totalForCategory = (categoryId: string) =>
    getTotalChannelsForCategory(state, categoryId)

  const handleSaveAndSwitch = () => {
    if (!pendingSwitch) return
    removeCategory(pendingSwitch.fromCategoryId)
    addCategory(pendingSwitch.toCategoryId)
    setPendingSwitch(null)
  }

  const handleDiscardAndSwitch = () => {
    if (!pendingSwitch) return
    cancelCategory(pendingSwitch.fromCategoryId)
    addCategory(pendingSwitch.toCategoryId)
    setPendingSwitch(null)
  }

  const handleKeepEditing = () => {
    setPendingSwitch(null)
  }

  const getConfiguredCategories = () => {
    return CATEGORIES.filter((cat) => getTotalChannelsForCategory(state, cat.id) > 0)
  }

  const getTotalAllChannels = () => {
    let total = 0
    getConfiguredCategories().forEach((cat) => {
      total += getTotalChannelsForCategory(state, cat.id)
    })
    return total
  }

  const PRIMARY_IO_IDS = ['analog', 'digital', 'communication']
  const getPrimaryCategories = () => CATEGORIES.filter((c) => PRIMARY_IO_IDS.includes(c.id))
  const getAdditionalCategories = () => CATEGORIES.filter((c) => !PRIMARY_IO_IDS.includes(c.id))

  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white/90 shadow-[0_25px_70px_-45px_rgba(15,23,42,0.35)] backdrop-blur">
      {warningMessage && (
        <WarningBanner
          message={warningMessage}
          onDismiss={() => setWarningMessage(null)}
        />
      )}
      <div className="space-y-6 px-4 py-5 md:px-6 md:py-6">
        {/* Primary I/O Categories (Analog, Digital, Communication) */}
        {getPrimaryCategories().map((category) => (
          <article key={category.id} className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 md:px-5">
              <div className="flex items-center gap-3">
                <p className="text-sm font-semibold text-slate-700">{category.label}</p>
                {totalForCategory(category.id) > 0 && (
                  <span className="inline-flex items-center rounded-full bg-[rgb(var(--speedgoat-blue))]/10 px-2.5 py-0.5 text-xs font-semibold text-[rgb(var(--speedgoat-blue))]">
                    {totalForCategory(category.id)} Channels
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => addCategory(category.id)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
              >
                {totalForCategory(category.id) > 0 ? 'Edit' : '+ Add'}
              </button>
            </div>
            {enabledCategories[category.id] && (
              <div className="border-t border-slate-200/70 px-4 py-4 md:px-5">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {category.subCategories.map((sub) => (
                    <SubCategoryCard
                      key={sub.id}
                      categoryId={category.id}
                      sub={sub}
                      rows={state[category.id]?.[sub.id]?.rows || []}
                      isFormOpen={showingConfig[category.id]?.[sub.id] ?? false}
                      editingRowId={editingRow}
                      editRowData={editRowData}
                      tempSpec={tempSpecs[category.id]?.[sub.id] || { quantity: 1, specs: {} }}
                      onToggleForm={toggleConfigForm}
                      onStartEdit={startEditRow}
                      onCancelEdit={cancelEditRow}
                      onRemoveRow={removeRow}
                      onUpdateRow={(rowId, quantity, specs) => updateRow(category.id, sub.id, rowId, quantity, specs)}
                      onUpdateEditRow={setEditRowData}
                      onChangeTempQuantity={(quantity) => updateTempQuantity(category.id, sub.id, quantity)}
                      onChangeTempSpec={(fieldKey, value) => updateTempSpec(category.id, sub.id, fieldKey, value)}
                      onAddRow={() => {
                        const success = addRow(category.id, sub.id)
                        if (success) toggleConfigForm(category.id, sub.id)
                      }}
                    />
                  ))}
                  <div className="flex gap-2 border-t border-slate-200/50 pt-3">
                    <button
                      type="button"
                      onClick={() => cancelCategory(category.id)}
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => removeCategory(category.id)}
                      className="flex-1 rounded-lg border border-[rgb(var(--speedgoat-blue))] bg-[rgb(var(--speedgoat-blue))] px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}
          </article>
        ))}

        {/* Additional I/O Categories (Collapsible) */}
        {getAdditionalCategories().length > 0 && (
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setExpandedAdditionalIO(!expandedAdditionalIO)}
              className="w-full px-4 py-3 md:px-5 text-left transition hover:bg-slate-50"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold text-slate-700">➕ Additional I/O Types</p>
                  {getAdditionalCategories().some((c) => totalForCategory(c.id) > 0) && (
                    <span className="inline-flex items-center rounded-full bg-[rgb(var(--speedgoat-accent))]/10 px-2.5 py-0.5 text-xs font-semibold text-[rgb(var(--speedgoat-accent))]">
                      {getAdditionalCategories().reduce((sum, c) => sum + totalForCategory(c.id), 0)} Channels
                    </span>
                  )}
                </div>
                <span className={`text-xl transition ${expandedAdditionalIO ? 'rotate-180' : ''}`}>▼</span>
              </div>
            </button>

            {expandedAdditionalIO && (
              <div className="border-t border-slate-200/70 px-4 py-4 md:px-5">
                <div className="space-y-4">
                  {getAdditionalCategories().map((category) => (
                    <article key={category.id} className="rounded-lg border border-slate-200/60 bg-slate-50/50">
                      <div className="flex items-center justify-between px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-700">{category.label}</p>
                          {totalForCategory(category.id) > 0 && (
                            <span className="inline-flex items-center rounded-full bg-[rgb(var(--speedgoat-blue))]/10 px-2 py-0.5 text-xs font-semibold text-[rgb(var(--speedgoat-blue))]">
                              {totalForCategory(category.id)}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => addCategory(category.id)}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                        >
                          {totalForCategory(category.id) > 0 ? 'Edit' : '+ Add'}
                        </button>
                      </div>
                      {enabledCategories[category.id] && (
                        <div className="border-t border-slate-200/60 px-3 py-3">
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                            {category.subCategories.map((sub) => (
                              <SubCategoryCard
                                key={sub.id}
                                categoryId={category.id}
                                sub={sub}
                                rows={state[category.id]?.[sub.id]?.rows || []}
                                isFormOpen={showingConfig[category.id]?.[sub.id] ?? false}
                                editingRowId={editingRow}
                                editRowData={editRowData}
                                tempSpec={tempSpecs[category.id]?.[sub.id] || { quantity: 1, specs: {} }}
                                onToggleForm={toggleConfigForm}
                                onStartEdit={startEditRow}
                                onCancelEdit={cancelEditRow}
                                onRemoveRow={removeRow}
                                onUpdateRow={(rowId, quantity, specs) => updateRow(category.id, sub.id, rowId, quantity, specs)}
                                onUpdateEditRow={setEditRowData}
                                onChangeTempQuantity={(quantity) => updateTempQuantity(category.id, sub.id, quantity)}
                                onChangeTempSpec={(fieldKey, value) => updateTempSpec(category.id, sub.id, fieldKey, value)}
                                onAddRow={() => {
                                  const success = addRow(category.id, sub.id)
                                  if (success) toggleConfigForm(category.id, sub.id)
                                }}
                              />
                            ))}
                            <div className="flex gap-2 border-t border-slate-200/40 pt-2.5">
                              <button
                                type="button"
                                onClick={() => cancelCategory(category.id)}
                                className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => removeCategory(category.id)}
                                className="flex-1 rounded-lg border border-[rgb(var(--speedgoat-blue))] bg-[rgb(var(--speedgoat-blue))] px-2 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Switch Category Modal */}
      {pendingSwitch && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/20 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-lg">
            <div className="border-b border-slate-200/70 px-6 py-4">
              <p className="text-sm font-semibold text-slate-900">
                Save changes to <span className="text-[rgb(var(--speedgoat-blue))]">{CATEGORIES.find((c) => c.id === pendingSwitch.fromCategoryId)?.label}</span>?
              </p>
              <p className="mt-1 text-xs text-slate-500">
                You are about to switch to <span className="font-medium">{CATEGORIES.find((c) => c.id === pendingSwitch.toCategoryId)?.label}</span>
              </p>
            </div>
            <div className="flex gap-2 px-6 py-4">
              <button
                type="button"
                onClick={handleKeepEditing}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={handleDiscardAndSwitch}
                className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleSaveAndSwitch}
                className="flex-1 rounded-lg border border-[rgb(var(--speedgoat-blue))] bg-[rgb(var(--speedgoat-blue))] px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
              >
                Save & Switch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fixed Footer Button */}
      {getConfiguredCategories().length > 0 && !pendingSwitch && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white px-4 py-4 md:px-6 md:py-5">
          <button
            type="button"
            onClick={() => setShowSummary(true)}
            className="w-full rounded-lg border border-[rgb(var(--speedgoat-blue))] bg-[rgb(var(--speedgoat-blue))] px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Review Configuration ({getTotalAllChannels()} Channels)
          </button>
        </div>
      )}

      {/* Summary Modal */}
      {showSummary && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/20 p-4">
          <div className="w-full max-w-2xl max-h-[80vh] overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
            <div className="sticky top-0 border-b border-slate-200 bg-white px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold text-slate-900">Configuration Review</p>
                  <p className="mt-1 text-sm text-slate-600">Total: {getTotalAllChannels()} Channels across {getConfiguredCategories().length} categories</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSummary(false)}
                  className="text-2xl text-slate-400 hover:text-slate-600"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="space-y-4 px-6 py-5">
              {/* Summary Section */}
              <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Summary</p>
                <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
                  {getConfiguredCategories().map((cat) => {
                    const total = getTotalChannelsForCategory(state, cat.id)
                    return (
                      <div key={cat.id} className="rounded-lg border border-slate-200 bg-white p-3 text-center">
                        <p className="text-xs text-slate-600">{cat.label}</p>
                        <p className="mt-1 text-lg font-bold text-[rgb(var(--speedgoat-blue))]">{total}</p>
                        <p className="text-xs text-slate-500">Channels</p>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Detailed Section */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Details</p>
                {getConfiguredCategories().map((cat) => (
                  <div key={cat.id} className="rounded-lg border border-slate-200 p-4">
                    <p className="font-semibold text-slate-900">{cat.label}</p>
                    <div className="mt-3 space-y-2">
                      {cat.subCategories.map((sub) => {
                        const rows = state[cat.id][sub.id]?.rows || []
                        const subTotal = rows.reduce((sum, row) => sum + row.quantity, 0)
                        return subTotal > 0 ? (
                          <div key={sub.id} className="border-l-2 border-slate-200 bg-slate-50/50 pl-3 py-1">
                            <p className="text-sm font-medium text-slate-700">{sub.label}</p>
                            {rows.map((row) => (
                              <div key={row.id} className="mt-1 text-xs text-slate-600">
                                <span className="font-semibold text-slate-700">{row.quantity} Ch:</span> {row.specs[sub.fields[0].key]} · {row.specs[sub.fields[1].key]} · {row.specs[sub.fields[2].key]}
                              </div>
                            ))}
                          </div>
                        ) : null
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => setShowSummary(false)}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
