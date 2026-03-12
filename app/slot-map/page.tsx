'use client'

import MachineSlotMapImage from '@/components/MachineSlotMapImage'
import { CompactButton, CompactCard, CompactChip, CompactSectionLabel } from '@/components/ui/compact'
import { SLOT_MAP_STORAGE_KEY, type SlotMapStoragePayload } from '@/lib/slotMapStorage'
import { useEffect, useMemo, useState } from 'react'

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || ''

function parseStoredPayload(raw: string | null): SlotMapStoragePayload | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const record = parsed as Record<string, unknown>
    if (record.schemaVersion !== '1.0.0') return null
    if (!record.machine || typeof record.machine !== 'object' || Array.isArray(record.machine)) return null
    if (!record.proposal || typeof record.proposal !== 'object' || Array.isArray(record.proposal)) return null
    return parsed as SlotMapStoragePayload
  } catch {
    return null
  }
}

function countRequestedModules(payload: SlotMapStoragePayload | null): number {
  if (!payload) return 0
  return payload.proposal.recommendedModules.reduce((sum, module) => sum + module.quantity, 0)
}

export default function SlotMapPage() {
  const [payload, setPayload] = useState<SlotMapStoragePayload | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const stored = parseStoredPayload(window.localStorage.getItem(SLOT_MAP_STORAGE_KEY))
    setPayload(stored)
    setIsLoaded(true)
  }, [])

  const assignedModules = useMemo(() => countRequestedModules(payload), [payload])
  const generatedAtLabel = useMemo(() => {
    if (!payload?.proposal.generatedAt) return 'Unknown'
    const generated = new Date(payload.proposal.generatedAt)
    if (Number.isNaN(generated.getTime())) return 'Unknown'
    return generated.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }, [payload])

  const clearStoredContext = () => {
    window.localStorage.removeItem(SLOT_MAP_STORAGE_KEY)
    setPayload(null)
  }

  const goBackToConfigurator = () => {
    // Prefer browser back to preserve in-memory configurator state.
    if (window.history.length > 1) {
      window.history.back()
      return
    }
    window.location.assign(`${BASE_PATH}/`)
  }

  if (!isLoaded) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 md:px-8">
        <div className="mx-auto max-w-[1200px]">
          <CompactCard className="p-[var(--ui-pad-3)]">
            <p className="text-sm text-slate-600">Loading slot map...</p>
          </CompactCard>
        </div>
      </main>
    )
  }

  if (!payload) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 md:px-8">
        <div className="mx-auto max-w-[980px] space-y-4">
          <CompactCard className="space-y-3 p-[var(--ui-pad-3)]">
            <div>
              <CompactSectionLabel>Slot Mapping</CompactSectionLabel>
              <h1 className="mt-1 text-xl font-semibold text-slate-900">No proposal context found</h1>
              <p className="mt-1 text-sm text-slate-600">
                Generate a proposal in the configurator and click &quot;Open Slot Map&quot; to render module assignments on the machine image.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <CompactButton type="button" variant="primary" onClick={goBackToConfigurator}>
                Back to Configurator
              </CompactButton>
            </div>
          </CompactCard>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-[1320px] space-y-4">
        <CompactCard className="space-y-3 p-[var(--ui-pad-3)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CompactSectionLabel>Phase 1 · Separate Page</CompactSectionLabel>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900">Proposal Slot Mapping</h1>
              <p className="mt-1 text-sm text-slate-600">
                Visual prototype that maps proposed modules into image slot positions. Next step is embedding this view directly in the configurator page.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <CompactButton type="button" variant="secondary" onClick={goBackToConfigurator}>
                Back to Configurator
              </CompactButton>
              <CompactButton type="button" variant="ghost" onClick={clearStoredContext}>
                Clear Stored Context
              </CompactButton>
            </div>
          </div>

          <div className="flex flex-wrap gap-[var(--ui-gap-1)]">
            <CompactChip variant="active">Machine: {payload.machine.name}</CompactChip>
            <CompactChip>Proposal: {payload.proposal.proposalId}</CompactChip>
            <CompactChip>{assignedModules} modules mapped</CompactChip>
            <CompactChip>Generated: {generatedAtLabel}</CompactChip>
          </div>
        </CompactCard>

        {payload.proposal.machineWarnings && payload.proposal.machineWarnings.length > 0 && (
          <CompactCard className="space-y-1 border border-amber-200 bg-amber-50 p-[var(--ui-pad-2)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Machine Warnings</p>
            {payload.proposal.machineWarnings.map((warning, index) => (
              <p key={index} className="text-xs text-amber-800">
                {warning}
              </p>
            ))}
          </CompactCard>
        )}

        <CompactCard className="space-y-3 p-[var(--ui-pad-3)]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Mapped Hardware View</p>
            <p className="text-xs text-slate-600">
              Slots are filled left-to-right as a first-pass mapping rule. This page uses your latest generated proposal payload.
            </p>
          </div>
          <MachineSlotMapImage
            machine={payload.machine}
            modules={payload.proposal.recommendedModules}
            rowDiffs={payload.proposal.rowDiffs}
          />
        </CompactCard>
      </div>
    </main>
  )
}
