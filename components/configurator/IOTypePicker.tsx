'use client'

import { CompactButton, CompactIconButton, CompactSectionLabel } from '@/components/ui/compact'
import { cn } from '@/lib/cn'
import { useState } from 'react'
import { CATEGORIES } from './data'
import type { SubCategory } from './types'

/** Subcategory slot claimed by core display groups in ConfiguratorV3 */
const CORE_CLAIMED = new Set([
  'analog:inputs',
  'analog:outputs',
  'digital:inputs',
  'digital:outputs',
  'digital:pwm',
  'digital:capture',
  'communication:protocols',
  'motion:encoder',
  'motion:resolver',
])

/** Short descriptions for each subcategory to help discoverability */
const SUB_DESCRIPTIONS: Record<string, string> = {
  'temperature:measurement': 'Thermocouple & RTD inputs',
  'temperature:simulation': 'Thermocouple simulation outputs',
  'strain:strain': 'Strain gauge / load cell bridges',
  'strain:vibration': 'IEPE / piezoelectric vibration',
  'fault:relays': 'Relay-based fault injection',
  'fault:switches': 'Solid-state fault switches',
  'highvoltage:measurement': 'High-voltage measurement',
  'highvoltage:switching': 'High-voltage switching',
  'resistor:simulation': 'Programmable resistor simulation',
  'bms:cell_emulation': 'Battery cell emulation',
  'bms:fault_insertion': 'Battery fault insertion',
  'bms:temp_emulation': 'NTC temperature emulation',
  'custom:gen_purpose': 'General purpose custom I/O',
}

/** Category icons (simple emoji-based for now) */
const CATEGORY_ICONS: Record<string, string> = {
  temperature: '🌡',
  strain: '📐',
  fault: '⚡',
  highvoltage: '🔌',
  resistor: 'Ω',
  bms: '🔋',
  custom: '⚙',
}

type IOTypePickerProps = {
  open: boolean
  onClose: () => void
  onSelect: (categoryId: string, subId: string) => void
  /** Signal rows to show active count badges */
  signalRows: Record<string, Record<string, { quantity: number }[]>>
}

export default function IOTypePicker({ open, onClose, onSelect, signalRows }: IOTypePickerProps) {
  const [search, setSearch] = useState('')

  if (!open) return null

  const query = search.trim().toLowerCase()

  // Build the list of additional (non-core) categories with their subcategories
  const additionalCategories = CATEGORIES.filter((cat) =>
    cat.subCategories.some((sub) => !CORE_CLAIMED.has(`${cat.id}:${sub.id}`))
  ).map((cat) => ({
    ...cat,
    subCategories: cat.subCategories.filter((sub) => !CORE_CLAIMED.has(`${cat.id}:${sub.id}`)),
  }))

  // Filter by search
  const filteredCategories = query
    ? additionalCategories
        .map((cat) => ({
          ...cat,
          subCategories: cat.subCategories.filter((sub) => {
            const desc = SUB_DESCRIPTIONS[`${cat.id}:${sub.id}`] || ''
            return (
              cat.label.toLowerCase().includes(query) ||
              sub.label.toLowerCase().includes(query) ||
              desc.toLowerCase().includes(query)
            )
          }),
        }))
        .filter((cat) => cat.subCategories.length > 0)
    : additionalCategories

  const getActiveCount = (categoryId: string, subId: string) => {
    const rows = signalRows[categoryId]?.[subId] || []
    return rows.reduce((sum, r) => sum + (r.quantity > 0 ? r.quantity : 0), 0)
  }

  return (
    <div className="fixed inset-0 z-[110]">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-[1px]"
        aria-label="Close I/O type picker"
      />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-3">
        <div className="pointer-events-auto w-full max-w-[620px]">
          <div className="flex max-h-[78vh] flex-col overflow-hidden rounded-[var(--ui-radius-lg)] border border-slate-200 bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 border-b border-slate-200 px-4 py-3">
              <div className="min-w-0">
                <CompactSectionLabel>Additional I/O</CompactSectionLabel>
                <p className="mt-0.5 text-sm font-semibold text-slate-900">
                  Browse specialized I/O types
                </p>
              </div>
              <CompactIconButton type="button" onClick={onClose} aria-label="Close" title="Close">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
                </svg>
              </CompactIconButton>
            </div>

            {/* Search */}
            <div className="border-b border-slate-100 px-4 py-2">
              <div className="relative">
                <svg
                  className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                  />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search I/O types..."
                  className="h-8 w-full rounded-[var(--ui-radius-md)] border border-slate-200 bg-slate-50 pl-7 pr-3 text-xs text-slate-700 placeholder:text-slate-400 focus:border-[rgb(var(--speedgoat-blue))] focus:outline-none"
                  autoFocus
                />
              </div>
            </div>

            {/* Category list */}
            <div className="flex-1 overflow-auto px-4 py-3">
              {filteredCategories.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-500">
                  No I/O types match &ldquo;{search}&rdquo;
                </p>
              ) : (
                <div className="space-y-4">
                  {filteredCategories.map((cat) => (
                    <div key={cat.id}>
                      <div className="mb-2 flex items-center gap-1.5">
                        <span className="text-sm">{CATEGORY_ICONS[cat.id] || '📦'}</span>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          {cat.label}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {cat.subCategories.map((sub) => {
                          const desc = SUB_DESCRIPTIONS[`${cat.id}:${sub.id}`] || ''
                          const activeCount = getActiveCount(cat.id, sub.id)
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => {
                                onSelect(cat.id, sub.id)
                                onClose()
                              }}
                              className={cn(
                                'group flex items-center justify-between rounded-[var(--ui-radius-md)] border px-3 py-2 text-left transition',
                                activeCount > 0
                                  ? 'border-[rgb(var(--speedgoat-blue))]/30 bg-[rgb(var(--speedgoat-blue))]/5'
                                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                              )}
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-800">{sub.label}</p>
                                {desc && (
                                  <p className="mt-0.5 truncate text-[11px] text-slate-500">{desc}</p>
                                )}
                              </div>
                              {activeCount > 0 && (
                                <span className="ml-2 shrink-0 rounded-full bg-[rgb(var(--speedgoat-blue))]/10 px-1.5 py-0.5 text-[10px] font-bold text-[rgb(var(--speedgoat-blue))]">
                                  {activeCount} ch
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end border-t border-slate-200 px-4 py-2">
              <CompactButton type="button" variant="secondary" onClick={onClose}>
                Close
              </CompactButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
