'use client'

import MachineChassisStrip from '@/components/MachineChassisStrip'
import ProposalResultCard from '@/components/ProposalResultCard'
import { CompactButton, CompactChip } from '@/components/ui/compact'
import type { ProposalGenerateResponse, ProposalRowDiff } from '@/components/configurator/proposalTypes'
import { cn } from '@/lib/cn'
import Image from 'next/image'
import { useCallback, useState } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────

export type MachineOption = {
  id: string
  name: string
  keywords: string
  blurb: string
  image: string
  maxSlots: number
  maxSlotsExpanded: number
}

export type ConfiguratorSummary = {
  totalSignals: number
  rowCount: number
  categoryTotals: Record<string, number>
}

type SolutionProposalProps = {
  proposal: ProposalGenerateResponse
  machine: MachineOption
  summary: ConfiguratorSummary
  inferredSystemClass: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

/** Count total physical modules (expanded by quantity). */
function countSlots(proposal: ProposalGenerateResponse): number {
  return proposal.recommendedModules.reduce((sum, m) => sum + m.quantity, 0)
}

/** Derive category summary from row diffs. */
function buildCategorySummary(rowDiffs: ProposalRowDiff[]): { id: string; label: string; count: number }[] {
  const map = new Map<string, { label: string; count: number }>()
  for (const rd of rowDiffs) {
    const existing = map.get(rd.categoryId)
    if (existing) {
      existing.count += rd.quantityRequested
    } else {
      map.set(rd.categoryId, { label: rd.categoryLabel, count: rd.quantityRequested })
    }
  }
  return Array.from(map.entries()).map(([id, v]) => ({ id, label: v.label, count: v.count }))
}

// ─── Toast feedback for mock buttons ─────────────────────────────────────────

function ToastBanner({ message, onDone }: { message: string; onDone: () => void }) {
  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-2 fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-slate-200 bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-xl"
      onAnimationEnd={() => setTimeout(onDone, 1800)}
    >
      {message}
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SolutionProposal({
  proposal,
  machine,
  summary,
  inferredSystemClass,
}: SolutionProposalProps) {
  const [toast, setToast] = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2200)
  }, [])

  const coverPct =
    proposal.summary.requestedChannels > 0
      ? Math.round((proposal.summary.coveredChannels / proposal.summary.requestedChannels) * 100)
      : 0

  const slotsUsed = countSlots(proposal)
  const allOk = proposal.unresolved.length === 0 && !proposal.machineWarnings?.length
  const categorySummary = buildCategorySummary(proposal.rowDiffs)

  return (
    <div className="solution-proposal space-y-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm print:shadow-none print:border-slate-300">
      {/* ───── A. Document header ───── */}
      <div className="relative border-b border-slate-200 bg-gradient-to-r from-[rgb(var(--speedgoat-blue))] via-[rgb(var(--speedgoat-blue))] to-blue-700 px-5 py-4 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-200">Speedgoat</p>
            <h2 className="mt-0.5 text-lg font-bold leading-tight tracking-tight">
              Solution Proposal
            </h2>
            <p className="mt-1 text-[11px] leading-snug text-blue-100">
              Automated I/O module configuration for{' '}
              <span className="font-semibold text-white">{machine.name}</span> real-time target machine
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[10px] font-medium text-blue-200">{proposal.proposalId}</p>
            <p className="mt-0.5 text-[11px] font-semibold">{formatDate(proposal.generatedAt)}</p>
            <p className="text-[10px] text-blue-200">{formatTime(proposal.generatedAt)}</p>
          </div>
        </div>

        {/* Status badge */}
        <div className="mt-3 flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold',
              allOk
                ? 'bg-emerald-400/20 text-emerald-100'
                : 'bg-amber-400/20 text-amber-100',
            )}
          >
            {allOk ? '✓' : '⚠'} {allOk ? 'Ready for Review' : 'Action Required'}
          </span>
          <span className="text-[10px] text-blue-200">{inferredSystemClass}</span>
        </div>
      </div>

      {/* ───── B. Executive summary stats ───── */}
      <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* Coverage */}
          <div className="text-center">
            <p className={cn(
              'text-2xl font-bold tabular-nums',
              coverPct === 100 ? 'text-emerald-600' : coverPct >= 80 ? 'text-blue-600' : 'text-amber-600',
            )}>
              {coverPct}%
            </p>
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">I/O Coverage</p>
          </div>

          {/* Module count */}
          <div className="text-center">
            <p className="text-2xl font-bold tabular-nums text-slate-800">
              {proposal.summary.moduleCount}
            </p>
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
              Modules Selected
            </p>
          </div>

          {/* Channels resolved */}
          <div className="text-center">
            <p className="text-2xl font-bold tabular-nums text-slate-800">
              <span>{proposal.summary.coveredChannels}</span>
              <span className="text-sm font-medium text-slate-400">/{proposal.summary.requestedChannels}</span>
            </p>
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
              Channels Resolved
            </p>
          </div>

          {/* Machine utilization */}
          <div className="text-center">
            <p className="text-2xl font-bold tabular-nums text-slate-800">
              <span>{Math.min(slotsUsed, machine.maxSlots)}</span>
              <span className="text-sm font-medium text-slate-400">/{machine.maxSlots}</span>
            </p>
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
              Base Slots Used
            </p>
          </div>
        </div>

        {/* Category chips */}
        {categorySummary.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5">
            {categorySummary.map((cat) => (
              <CompactChip key={cat.id} variant="active">
                {cat.label}: {cat.count} ch
              </CompactChip>
            ))}
            {proposal.summary.unresolvedCount > 0 && (
              <CompactChip variant="warning">{proposal.summary.unresolvedCount} unresolved</CompactChip>
            )}
          </div>
        )}
      </div>

      {/* ───── C. Machine chassis visualization ───── */}
      <div className="border-b border-slate-100 px-5 py-3">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Hardware Layout
        </p>
        <MachineChassisStrip
          maxSlots={machine.maxSlots}
          machineName={machine.name}
          modules={proposal.recommendedModules}
          rowDiffs={proposal.rowDiffs}
        />
      </div>

      {/* ───── D. Module details (existing result card) ───── */}
      <div className="px-5 py-3">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Module Configuration Details
        </p>
        <ProposalResultCard proposal={proposal} machineName={machine.name} />
      </div>

      {/* ───── E. Actionable footer ───── */}
      <div className="border-t border-slate-200 bg-slate-50/70 px-5 py-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <CompactButton
            variant="primary"
            onClick={() => showToast('Quote request — coming soon')}
          >
            Request Quote
          </CompactButton>
          <CompactButton
            variant="secondary"
            onClick={() => showToast('Configuration saved (prototype)')}
          >
            Save Configuration
          </CompactButton>
          <CompactButton
            variant="ghost"
            onClick={() => {
              if (typeof navigator !== 'undefined' && navigator.clipboard) {
                navigator.clipboard.writeText(window.location.href)
                showToast('Link copied to clipboard')
              } else {
                showToast('Share — coming soon')
              }
            }}
          >
            Share Proposal
          </CompactButton>
          <span className="ml-auto text-[10px] text-slate-400 print:hidden">
            Proposal valid for 30 days · Ref: {proposal.proposalId}
          </span>
        </div>
      </div>

      {/* Toast */}
      {toast && <ToastBanner message={toast} onDone={() => setToast(null)} />}
    </div>
  )
}
