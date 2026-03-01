'use client'

import type { ProposalRecommendedModule, ProposalRowDiff } from '@/components/configurator/proposalTypes'

// ─── Category → color map ────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  analog:        { bg: 'bg-blue-50',   border: 'border-blue-300',   text: 'text-blue-700',   label: 'Analog' },
  digital:       { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700', label: 'Digital' },
  communication: { bg: 'bg-amber-50',  border: 'border-amber-300',  text: 'text-amber-700',  label: 'Comm' },
  motion:        { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-700', label: 'Motion' },
  interface:     { bg: 'bg-slate-50',  border: 'border-slate-300',  text: 'text-slate-600',  label: 'Interface' },
}

const FALLBACK_COLOR = { bg: 'bg-slate-50', border: 'border-slate-300', text: 'text-slate-600', label: '' }

// ─── Types ───────────────────────────────────────────────────────────────────

type SlotEntry = {
  moduleId: string
  friendlyName: string
  confidence: number
  categoryId: string
}

type MachineChassisStripProps = {
  maxSlots: number
  machineName: string
  modules: ProposalRecommendedModule[] | null
  rowDiffs: ProposalRowDiff[] | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a moduleId → primary categoryId map from row diffs. */
function buildCategoryMap(rowDiffs: ProposalRowDiff[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const diff of rowDiffs) {
    for (const ref of diff.moduleRefs) {
      // First category wins (a module could appear in multiple rows)
      if (!map.has(ref)) map.set(ref, diff.categoryId)
    }
  }
  return map
}

/** Expand recommended modules (quantity > 1) into individual slot entries. */
function expandModules(
  modules: ProposalRecommendedModule[],
  categoryMap: Map<string, string>,
): SlotEntry[] {
  const slots: SlotEntry[] = []
  for (const mod of modules) {
    const categoryId = categoryMap.get(mod.moduleId) ?? 'interface'
    for (let i = 0; i < mod.quantity; i++) {
      slots.push({
        moduleId: mod.moduleId,
        friendlyName: mod.friendlyName,
        confidence: mod.confidence,
        categoryId,
      })
    }
  }
  // Sort: analog → communication → digital → motion → interface
  const order = ['analog', 'digital', 'communication', 'motion', 'interface']
  slots.sort((a, b) => {
    const ai = order.indexOf(a.categoryId)
    const bi = order.indexOf(b.categoryId)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })
  return slots
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function MachineChassisStrip({ maxSlots, machineName, modules, rowDiffs }: MachineChassisStripProps) {
  const categoryMap = rowDiffs ? buildCategoryMap(rowDiffs) : new Map<string, string>()
  const filledSlots = modules ? expandModules(modules, categoryMap) : []
  const visibleSlots = filledSlots.slice(0, maxSlots)
  const overflowCount = Math.max(0, filledSlots.length - maxSlots)

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      {/* Header */}
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-slate-800 text-[10px] font-bold text-white">
            ⊞
          </div>
          <span className="text-xs font-semibold text-slate-700">{machineName}</span>
          <span className="text-[10px] text-slate-400">·</span>
          <span className="text-[10px] text-slate-400">{maxSlots} base slots</span>
        </div>
        {filledSlots.length > 0 && (
          <span className="text-[10px] font-medium text-slate-500">
            {filledSlots.length} module{filledSlots.length !== 1 ? 's' : ''} assigned
          </span>
        )}
      </div>

      {/* Slot row */}
      <div className="flex items-end gap-1.5">
        {Array.from({ length: maxSlots }).map((_, idx) => {
          const slot = visibleSlots[idx]
          if (slot) {
            const colors = CATEGORY_COLORS[slot.categoryId] ?? FALLBACK_COLOR
            return (
              <div
                key={idx}
                className={`group relative flex h-[100px] w-[72px] flex-shrink-0 flex-col justify-between rounded-lg border-2 ${colors.border} ${colors.bg} p-1.5 transition-shadow hover:shadow-md`}
                title={`${slot.moduleId} — ${slot.friendlyName} (${slot.confidence}% confidence)`}
              >
                {/* Module ID */}
                <div className={`text-[11px] font-bold leading-tight ${colors.text}`}>
                  {slot.moduleId}
                </div>

                {/* Friendly name (truncated) */}
                <div className="flex-1 py-0.5">
                  <p className="line-clamp-2 text-[9px] leading-[1.2] text-slate-500">
                    {slot.friendlyName}
                  </p>
                </div>

                {/* Category + confidence */}
                <div className="flex items-center justify-between">
                  <span className={`text-[8px] font-semibold uppercase tracking-wider ${colors.text}`}>
                    {colors.label}
                  </span>
                  <span className="text-[8px] font-medium text-slate-400">
                    {slot.confidence}%
                  </span>
                </div>

                {/* Slot number badge */}
                <div className="absolute -top-1.5 right-1 rounded-full bg-white px-1 text-[7px] font-bold text-slate-400 shadow-sm ring-1 ring-slate-200">
                  {idx + 1}
                </div>
              </div>
            )
          }

          // Empty slot
          return (
            <div
              key={idx}
              className="flex h-[100px] w-[72px] flex-shrink-0 flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/50 transition-colors"
            >
              <span className="text-[10px] font-medium text-slate-300">Slot</span>
              <span className="text-[13px] font-bold text-slate-300">{idx + 1}</span>
            </div>
          )
        })}

        {/* Overflow label */}
        {overflowCount > 0 && (
          <div className="flex h-[100px] items-center pl-2">
            <div className="rounded-full bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
              +{overflowCount} in expansion
            </div>
          </div>
        )}
      </div>

      {/* Category legend */}
      {filledSlots.length > 0 && (() => {
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
  )
}
