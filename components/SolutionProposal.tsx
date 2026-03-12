'use client'

import MachineChassisStrip from '@/components/MachineChassisStrip'
import ProposalResultCard from '@/components/ProposalResultCard'
import { CompactButton, CompactChip, CompactField, CompactSectionLabel } from '@/components/ui/compact'
import type { ProposalGenerateResponse, ProposalRecommendedModule, ProposalRowDiff } from '@/components/configurator/proposalTypes'
import { cn } from '@/lib/cn'
import { SLOT_MAP_STORAGE_KEY, type SlotMapStoragePayload } from '@/lib/slotMapStorage'
import { useCallback, useState } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────

export type MachineVariant = {
  suffix: string
  maxSlots: number
}

export type MachineOption = {
  id: string
  name: string
  keywords: string
  blurb: string
  image: string
  maxSlots: number
  maxSlotsExpanded: number
  variants?: MachineVariant[]
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
  onSaveConfiguration?: () => void
  devMode?: boolean
}

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || ''

type QuoteFormState = {
  fullName: string
  workEmail: string
  company: string
  phone: string
  country: string
  notes: string
  consent: boolean
}

type QuoteFormErrors = Partial<Record<keyof QuoteFormState, string>>

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
  summary: _summary,
  onSaveConfiguration,
  devMode,
}: SolutionProposalProps) {
  const [toast, setToast] = useState<string | null>(null)
  const [quoteModalOpen, setQuoteModalOpen] = useState(false)
  const [quoteSubmitting, setQuoteSubmitting] = useState(false)
  const [quoteForm, setQuoteForm] = useState<QuoteFormState>({
    fullName: '',
    workEmail: '',
    company: '',
    phone: '',
    country: '',
    notes: '',
    consent: false,
  })
  const [quoteErrors, setQuoteErrors] = useState<QuoteFormErrors>({})
  const actionButtonClass = 'h-10 min-w-[140px] px-4 text-[13px] font-semibold whitespace-nowrap'

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

  const handleOpenSlotMap = useCallback(() => {
    if (typeof window === 'undefined') return

    const payload: SlotMapStoragePayload = {
      schemaVersion: '1.0.0',
      savedAt: new Date().toISOString(),
      machine: {
        id: machine.id,
        name: machine.name,
        image: machine.image,
        keywords: machine.keywords,
        blurb: machine.blurb,
        maxSlots: machine.maxSlots,
        maxSlotsExpanded: machine.maxSlotsExpanded,
        variants: machine.variants,
      },
      proposal,
    }

    window.localStorage.setItem(SLOT_MAP_STORAGE_KEY, JSON.stringify(payload))
    window.location.assign(`${BASE_PATH}/slot-map`)
  }, [machine, proposal])

  const openQuoteModal = () => {
    setQuoteModalOpen(true)
  }

  const closeQuoteModal = () => {
    if (quoteSubmitting) return
    setQuoteModalOpen(false)
  }

  const updateQuoteField = <K extends keyof QuoteFormState>(key: K, value: QuoteFormState[K]) => {
    setQuoteForm((prev) => ({ ...prev, [key]: value }))
    setQuoteErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const validateQuoteForm = (): QuoteFormErrors => {
    const nextErrors: QuoteFormErrors = {}
    if (!quoteForm.fullName.trim()) nextErrors.fullName = 'Full name is required.'
    if (!quoteForm.workEmail.trim()) {
      nextErrors.workEmail = 'Work email is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(quoteForm.workEmail.trim())) {
      nextErrors.workEmail = 'Enter a valid email address.'
    }
    if (!quoteForm.company.trim()) nextErrors.company = 'Company is required.'
    if (!quoteForm.country.trim()) nextErrors.country = 'Country is required.'
    if (!quoteForm.consent) nextErrors.consent = 'Please confirm we can contact you.'
    return nextErrors
  }

  const handleSubmitQuoteRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors = validateQuoteForm()
    if (Object.keys(nextErrors).length > 0) {
      setQuoteErrors(nextErrors)
      return
    }

    setQuoteSubmitting(true)

    // Placeholder: in production this should post to CRM / lead-capture endpoint.
    await new Promise((resolve) => setTimeout(resolve, 600))

    const quoteLead = {
      createdAt: new Date().toISOString(),
      proposalId: proposal.proposalId,
      machineName: machine.name,
      requestedChannels: proposal.summary.requestedChannels,
      ...quoteForm,
    }
    console.info('Quote request captured (prototype):', quoteLead)

    setQuoteSubmitting(false)
    setQuoteModalOpen(false)
    setQuoteForm({
      fullName: '',
      workEmail: '',
      company: '',
      phone: '',
      country: '',
      notes: '',
      consent: false,
    })
    setQuoteErrors({})
    showToast('Quote request sent. Sales will contact you shortly.')
  }

  return (
    <div className="solution-proposal space-y-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm print:shadow-none print:border-slate-300">
      {/* ───── A. Document header ───── */}
      <div className="relative border-b border-slate-200 bg-gradient-to-r from-[rgb(var(--speedgoat-blue))] via-[rgb(var(--speedgoat-blue))] to-blue-700 px-5 py-3 text-white">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold tracking-tight">Solution Proposal</h2>
            <span className="text-[10px] text-blue-200">
              {machine.name} · {proposal.proposalId}
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
                allOk
                  ? 'bg-emerald-400/20 text-emerald-100'
                  : 'bg-amber-400/20 text-amber-100',
              )}
            >
              {allOk ? '✓ Ready' : '⚠ Action Required'}
            </span>
          </div>
          <p className="shrink-0 text-[10px] text-blue-200">
            {formatDate(proposal.generatedAt)} · {formatTime(proposal.generatedAt)}
          </p>
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
          maxSlotsExpanded={machine.maxSlotsExpanded}
          machineName={machine.name}
          modules={proposal.recommendedModules}
          rowDiffs={proposal.rowDiffs}
          variants={machine.variants}
        />
      </div>

      {/* ───── D. Module details (existing result card) ───── */}
      <div className="px-5 py-3">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Module Configuration Details
        </p>
        <ProposalResultCard proposal={proposal} machineName={machine.name} devMode={devMode} />
      </div>

      {/* ───── E. Actionable footer ───── */}
      <div className="border-t border-slate-200 bg-slate-50/70 px-5 py-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2.5">
          <CompactButton
            variant="primary"
            onClick={openQuoteModal}
            className={actionButtonClass}
          >
            Request Quote
          </CompactButton>
          <CompactButton
            variant="secondary"
            className={actionButtonClass}
            onClick={() => {
              if (onSaveConfiguration) {
                onSaveConfiguration()
                showToast('Configuration JSON downloaded')
                return
              }
              showToast('Configuration saved (prototype)')
            }}
          >
            Save Configuration
          </CompactButton>
          <CompactButton variant="secondary" className={actionButtonClass} onClick={handleOpenSlotMap}>
            Open Slot Map
          </CompactButton>
          <CompactButton
            variant="secondary"
            className="h-10 min-w-[128px] border-slate-200 bg-transparent px-4 text-[13px] font-semibold text-slate-600 hover:bg-slate-100"
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

      {quoteModalOpen && (
        <div className="fixed inset-0 z-[120]">
          <button
            type="button"
            aria-label="Close quote request form"
            onClick={closeQuoteModal}
            className="absolute inset-0 bg-slate-900/35 backdrop-blur-[1px]"
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-3">
            <div className="pointer-events-auto w-full max-w-[560px]">
              <div className="rounded-[var(--ui-radius-lg)] border border-slate-200 bg-white shadow-2xl">
                <form onSubmit={handleSubmitQuoteRequest} className="space-y-3 p-[var(--ui-pad-3)]">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CompactSectionLabel>Quote Request</CompactSectionLabel>
                      <p className="mt-0.5 text-sm font-semibold text-slate-900">Get in touch with Sales</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Proposal {proposal.proposalId} · {machine.name}
                      </p>
                    </div>
                    <CompactButton type="button" variant="ghost" className="h-7 px-2 text-xs" onClick={closeQuoteModal}>
                      Close
                    </CompactButton>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Full name *</label>
                      <CompactField
                        type="text"
                        value={quoteForm.fullName}
                        onChange={(event) => updateQuoteField('fullName', event.target.value)}
                        placeholder="Jane Doe"
                        className="px-2 text-xs"
                      />
                      {quoteErrors.fullName && <p className="text-[11px] text-rose-600">{quoteErrors.fullName}</p>}
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Work email *</label>
                      <CompactField
                        type="email"
                        value={quoteForm.workEmail}
                        onChange={(event) => updateQuoteField('workEmail', event.target.value)}
                        placeholder="jane@company.com"
                        className="px-2 text-xs"
                      />
                      {quoteErrors.workEmail && <p className="text-[11px] text-rose-600">{quoteErrors.workEmail}</p>}
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Company *</label>
                      <CompactField
                        type="text"
                        value={quoteForm.company}
                        onChange={(event) => updateQuoteField('company', event.target.value)}
                        placeholder="ACME Corp"
                        className="px-2 text-xs"
                      />
                      {quoteErrors.company && <p className="text-[11px] text-rose-600">{quoteErrors.company}</p>}
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Phone</label>
                      <CompactField
                        type="tel"
                        value={quoteForm.phone}
                        onChange={(event) => updateQuoteField('phone', event.target.value)}
                        placeholder="+1 555 000 0000"
                        className="px-2 text-xs"
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Country *</label>
                      <CompactField
                        type="text"
                        value={quoteForm.country}
                        onChange={(event) => updateQuoteField('country', event.target.value)}
                        placeholder="United States"
                        className="px-2 text-xs"
                      />
                      {quoteErrors.country && <p className="text-[11px] text-rose-600">{quoteErrors.country}</p>}
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Project notes</label>
                      <textarea
                        value={quoteForm.notes}
                        onChange={(event) => updateQuoteField('notes', event.target.value)}
                        placeholder="Delivery timeline, additional requirements, or context"
                        className="h-20 w-full resize-y rounded-[var(--ui-radius-md)] border border-slate-300 bg-white px-2 py-2 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                      />
                    </div>
                  </div>

                  <label className="flex items-start gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={quoteForm.consent}
                      onChange={(event) => updateQuoteField('consent', event.target.checked)}
                      className="mt-[2px] h-3.5 w-3.5 rounded border-slate-300"
                    />
                    <span>
                      I agree that Speedgoat sales can contact me about this quote request.
                    </span>
                  </label>
                  {quoteErrors.consent && <p className="text-[11px] text-rose-600">{quoteErrors.consent}</p>}

                  <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
                    <CompactButton type="button" variant="secondary" onClick={closeQuoteModal} disabled={quoteSubmitting}>
                      Cancel
                    </CompactButton>
                    <CompactButton type="submit" variant="primary" disabled={quoteSubmitting}>
                      {quoteSubmitting ? 'Sending...' : 'Send Quote Request'}
                    </CompactButton>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <ToastBanner message={toast} onDone={() => setToast(null)} />}
    </div>
  )
}
