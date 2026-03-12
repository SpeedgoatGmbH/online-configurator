'use client'

import * as RadixTooltip from '@radix-ui/react-tooltip'
import type { ProposalRecommendedModule, ProposalRowDiff } from '@/components/configurator/proposalTypes'
import type { MachineVariant } from '@/components/SolutionProposal'
import { cn } from '@/lib/cn'
import { useEffect, useRef, useState } from 'react'

// ─── Category → color map ────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; label: string; ring: string; chip: string }> = {
  analog:        { bg: 'bg-blue-50',    border: 'border-blue-300',   text: 'text-blue-700',    label: 'Analog',    ring: 'ring-blue-400',    chip: 'bg-blue-50 border-blue-200 text-blue-700' },
  digital:       { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700', label: 'Digital',   ring: 'ring-emerald-400', chip: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  communication: { bg: 'bg-amber-50',   border: 'border-amber-300',  text: 'text-amber-700',   label: 'Comm',      ring: 'ring-amber-400',   chip: 'bg-amber-50 border-amber-200 text-amber-700' },
  motion:        { bg: 'bg-purple-50',  border: 'border-purple-300', text: 'text-purple-700',  label: 'Motion',    ring: 'ring-purple-400',  chip: 'bg-purple-50 border-purple-200 text-purple-700' },
  interface:     { bg: 'bg-slate-50',   border: 'border-slate-300',  text: 'text-slate-600',   label: 'Interface', ring: 'ring-slate-400',   chip: 'bg-slate-50 border-slate-200 text-slate-500' },
}

const FALLBACK_COLOR = { bg: 'bg-slate-50', border: 'border-slate-300', text: 'text-slate-600', label: '', ring: 'ring-slate-300', chip: 'bg-slate-50 border-slate-200 text-slate-500' }

// ─── Types ───────────────────────────────────────────────────────────────────

type SlotEntry = {
  moduleId: string
  friendlyName: string
  categoryId: string
}

type MachineChassisStripProps = {
  maxSlots: number
  maxSlotsExpanded: number
  machineName: string
  modules: ProposalRecommendedModule[] | null
  rowDiffs: ProposalRowDiff[] | null
  variants?: MachineVariant[]
  showDetails?: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a moduleId → primary categoryId map from row diffs. */
function buildCategoryMap(rowDiffs: ProposalRowDiff[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const diff of rowDiffs) {
    for (const ref of diff.moduleRefs) {
      if (!map.has(ref)) map.set(ref, diff.categoryId)
    }
  }
  return map
}

/** Build a moduleId → all row diffs map. */
function buildModuleRowsMap(rowDiffs: ProposalRowDiff[]): Map<string, ProposalRowDiff[]> {
  const map = new Map<string, ProposalRowDiff[]>()
  for (const diff of rowDiffs) {
    for (const ref of diff.moduleRefs) {
      const arr = map.get(ref) ?? []
      arr.push(diff)
      map.set(ref, arr)
    }
  }
  return map
}

/** Expand recommended modules (quantity > 1) into individual slot entries. */
function expandModules(
  modules: ProposalRecommendedModule[],
  categoryMap: Map<string, string>,
): SlotEntry[] {
  // Separate parents from children (interface boards/extensions)
  const children = new Map<string, ProposalRecommendedModule[]>()
  const parents: ProposalRecommendedModule[] = []
  for (const mod of modules) {
    if (mod.interfaceForModule) {
      const arr = children.get(mod.interfaceForModule) ?? []
      arr.push(mod)
      children.set(mod.interfaceForModule, arr)
    } else {
      parents.push(mod)
    }
  }

  // Sort parents by category, then attach children immediately after
  const order = ['analog', 'digital', 'communication', 'motion', 'interface']
  const sortedParents = [...parents].sort((a, b) => {
    const aCat = categoryMap.get(a.moduleId) ?? 'interface'
    const bCat = categoryMap.get(b.moduleId) ?? 'interface'
    const ai = order.indexOf(aCat)
    const bi = order.indexOf(bCat)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })

  const slots: SlotEntry[] = []
  for (const mod of sortedParents) {
    const categoryId = categoryMap.get(mod.moduleId) ?? 'interface'
    for (let i = 0; i < mod.quantity; i++) {
      slots.push({ moduleId: mod.moduleId, friendlyName: mod.friendlyName, categoryId })
    }
    // Immediately place children after parent
    const kids = children.get(mod.moduleId) ?? []
    for (const kid of kids) {
      for (let i = 0; i < kid.quantity; i++) {
        slots.push({ moduleId: kid.moduleId, friendlyName: kid.friendlyName, categoryId: 'interface' })
      }
    }
  }

  // Add orphan children (no parent found in list — shouldn't happen normally)
  for (const mod of modules) {
    if (mod.interfaceForModule && !parents.some(p => p.moduleId === mod.interfaceForModule)) {
      for (let i = 0; i < mod.quantity; i++) {
        slots.push({ moduleId: mod.moduleId, friendlyName: mod.friendlyName, categoryId: 'interface' })
      }
    }
  }

  return slots
}

// ─── Component ───────────────────────────────────────────────────────────────

/** Pick the smallest variant that fits, or the largest if nothing fits. */
function pickVariant(variants: MachineVariant[], needed: number): MachineVariant {
  const sorted = [...variants].sort((a, b) => a.maxSlots - b.maxSlots)
  return sorted.find((v) => v.maxSlots >= needed) ?? sorted[sorted.length - 1]
}

export default function MachineChassisStrip({
  maxSlots,
  maxSlotsExpanded,
  machineName,
  modules,
  rowDiffs,
  variants,
  showDetails = true,
}: MachineChassisStripProps) {
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null)
  const legendRefs = useRef<(HTMLDivElement | null)[]>([])
  const categoryMap = rowDiffs ? buildCategoryMap(rowDiffs) : new Map<string, string>()
  const moduleRowsMap = rowDiffs ? buildModuleRowsMap(rowDiffs) : new Map<string, ProposalRowDiff[]>()
  const filledSlots = modules ? expandModules(modules, categoryMap) : []

  useEffect(() => {
    if (hoveredSlot !== null) {
      legendRefs.current[hoveredSlot]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [hoveredSlot])

  // For machines with variants (e.g. Baseline-S / Baseline-M), auto-pick the variant
  const chosenVariant = variants?.length ? pickVariant(variants, filledSlots.length) : null
  const activeSlots = chosenVariant ? chosenVariant.maxSlots : maxSlots
  const activeName = chosenVariant ? `${machineName}-${chosenVariant.suffix}` : machineName
  const hasExpansion = maxSlotsExpanded > activeSlots

  const visibleSlots = filledSlots.slice(0, activeSlots)
  const overflowCount = Math.max(0, filledSlots.length - activeSlots)

  return (
    <RadixTooltip.Provider delayDuration={120} skipDelayDuration={0}>
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        {showDetails && (
          <div className="mb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded bg-slate-800 text-[10px] font-bold text-white">
                ⊞
              </div>
              <span className="text-xs font-semibold text-slate-700">{activeName}</span>
              <span className="text-[10px] text-slate-400">·</span>
              <span className="text-[10px] text-slate-400">{activeSlots} module slots</span>
            </div>
            {filledSlots.length > 0 && (
              <span className="text-[10px] font-medium text-slate-500">
                {filledSlots.length} module{filledSlots.length !== 1 ? 's' : ''} assigned
              </span>
            )}
          </div>
        )}

        {/* Slot row */}
        <div className={cn('flex items-end gap-1 overflow-x-auto', showDetails ? 'pb-1' : '')}>
          {Array.from({ length: activeSlots }).map((_, idx) => {
            const slot = visibleSlots[idx]
            const isHovered = hoveredSlot === idx

            if (slot) {
              const colors = CATEGORY_COLORS[slot.categoryId] ?? FALLBACK_COLOR
              const coveredRows = moduleRowsMap.get(slot.moduleId) ?? []
              return (
                <RadixTooltip.Root key={idx}>
                  <RadixTooltip.Trigger asChild>
                    <div
                      ref={(el) => { legendRefs.current[idx] = el as HTMLDivElement | null }}
                      className={cn(
                        'relative flex h-[72px] w-[52px] flex-shrink-0 flex-col justify-between rounded-md border p-1 transition-all duration-150 cursor-pointer',
                        colors.border, colors.bg,
                        isHovered ? `ring-2 ring-offset-1 ${colors.ring} shadow-md` : 'shadow-sm hover:shadow-md',
                      )}
                      onMouseEnter={() => setHoveredSlot(idx)}
                      onMouseLeave={() => setHoveredSlot(null)}
                    >
                      {/* Module ID */}
                      <div className={`text-[8px] font-bold leading-tight ${colors.text}`}>
                        {slot.moduleId}
                      </div>

                      {/* Friendly name */}
                      <div className="flex-1">
                        <p className="line-clamp-2 text-[7px] leading-[1.15] text-slate-500">
                          {slot.friendlyName}
                        </p>
                      </div>

                      {/* Category + rows count */}
                      <div className="flex items-center justify-between">
                        <span className={`text-[7px] font-semibold uppercase tracking-wide ${colors.text}`}>
                          {colors.label}
                        </span>
                        {coveredRows.length > 0 && (
                          <span className="text-[6px] text-slate-400">{coveredRows.length}r</span>
                        )}
                      </div>

                      {/* Slot number badge */}
                      <div className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white text-[6px] font-bold text-slate-400 shadow-sm ring-1 ring-slate-200">
                        {idx + 1}
                      </div>
                    </div>
                  </RadixTooltip.Trigger>

                  <RadixTooltip.Portal>
                    <RadixTooltip.Content
                      side="top"
                      sideOffset={6}
                      className="z-50 rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5 animate-in fade-in-0 zoom-in-95"
                    >
                      <div className="w-52 space-y-2 p-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className={`text-xs font-bold leading-tight ${colors.text}`}>{slot.moduleId}</p>
                            <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{slot.friendlyName}</p>
                          </div>
                          <span className={cn('shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold', colors.chip)}>
                            {colors.label}
                          </span>
                        </div>
                        {coveredRows.length > 0 && (
                          <div className="border-t border-slate-100 pt-1.5">
                            <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-slate-400">Covers</p>
                            <ul className="space-y-0.5">
                              {coveredRows.slice(0, 4).map((diff, i) => (
                                <li key={i} className="text-[10px] text-slate-600">
                                  {diff.categoryId} · {diff.subId} ({diff.quantityRequested} ch)
                                </li>
                              ))}
                              {coveredRows.length > 4 && (
                                <li className="text-[10px] text-slate-400">+{coveredRows.length - 4} more</li>
                              )}
                            </ul>
                          </div>
                        )}
                        <div className="border-t border-slate-100 pt-1">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Slot {idx + 1}</p>
                        </div>
                      </div>
                      <RadixTooltip.Arrow className="fill-white drop-shadow-sm" />
                    </RadixTooltip.Content>
                  </RadixTooltip.Portal>
                </RadixTooltip.Root>
              )
            }

            // Empty slot
            return (
              <div
                key={idx}
                className="flex h-[72px] w-[52px] flex-shrink-0 flex-col items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50/50 transition-colors"
              >
                <span className="text-[8px] font-medium text-slate-300">Slot</span>
                <span className="text-[10px] font-bold text-slate-300">{idx + 1}</span>
              </div>
            )
          })}

          {/* Overflow label */}
          {showDetails && overflowCount > 0 && (
            <div className="flex h-[72px] items-center pl-2">
              {hasExpansion ? (
                <div className="rounded-full bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
                  +{overflowCount} in expansion
                </div>
              ) : (
                <div className="rounded-full bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-600 ring-1 ring-red-200">
                  +{overflowCount} over capacity ⚠
                </div>
              )}
            </div>
          )}
        </div>

        {/* Category legend */}
        {showDetails && filledSlots.length > 0 && (() => {
          const counts = new Map<string, number>()
          for (const s of filledSlots) {
            counts.set(s.categoryId, (counts.get(s.categoryId) ?? 0) + 1)
          }
          return (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {Array.from(counts.entries()).map(([catId, count]) => {
                const c = CATEGORY_COLORS[catId] ?? FALLBACK_COLOR
                return (
                  <div key={catId} className="flex items-center gap-1.5">
                    <div className={`h-2.5 w-2.5 rounded-sm border ${c.border} ${c.bg}`} />
                    <span className="text-[10px] font-medium text-slate-600">
                      {c.label || catId} <span className="text-slate-400">({count})</span>
                    </span>
                </div>
              )
            })}
          </div>
        )
      })()}
      </div>
    </RadixTooltip.Provider>
  )
}
