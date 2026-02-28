'use client'

import { CompactCard, CompactChip } from '@/components/ui/compact'
import type { ProposalGenerateResponse } from '@/components/configurator/proposalTypes'
import { getSpecLabel } from '@/components/configurator/data'
import { cn } from '@/lib/cn'
import { useEffect, useState } from 'react'

type ProposalResultCardProps = {
  proposal: ProposalGenerateResponse
  machineName: string
}

export default function ProposalResultCard({ proposal, machineName }: ProposalResultCardProps) {
  const [flashActive, setFlashActive] = useState(true)

  // Brief green flash on mount, then fade out
  useEffect(() => {
    const timer = setTimeout(() => setFlashActive(false), 1200)
    return () => clearTimeout(timer)
  }, [])

  const allOk = proposal.unresolved.length === 0 && !proposal.machineWarnings?.length
  const coverPct = proposal.summary.requestedChannels > 0
    ? Math.round((proposal.summary.coveredChannels / proposal.summary.requestedChannels) * 100)
    : 0

  const ts = new Date(proposal.generatedAt)
  const timeStr = ts.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <CompactCard
      className={cn(
        'space-y-2 p-[var(--ui-pad-2)] transition-all duration-700',
        flashActive && allOk && 'ring-2 ring-green-400/80 shadow-[0_0_12px_rgba(34,197,94,0.25)]',
        flashActive && !allOk && 'ring-2 ring-amber-400/80 shadow-[0_0_12px_rgba(245,158,11,0.25)]',
      )}
    >
      {/* Compact header row */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className={cn(
          'flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold',
          allOk ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700',
        )}>
          {allOk ? '✓' : '⚠'} {allOk ? 'Proposal Ready' : 'Review Needed'}
        </div>
        <span className="text-sm font-semibold text-slate-900">{machineName}</span>
        <span className="text-[11px] text-slate-400" title={proposal.generatedAt}>
          {proposal.proposalId} · {timeStr}
        </span>
        <div className="ml-auto flex flex-wrap gap-1">
          <CompactChip>{coverPct}% covered</CompactChip>
          <CompactChip>{proposal.summary.moduleCount} modules</CompactChip>
          {proposal.summary.unresolvedCount > 0 && (
            <CompactChip>{proposal.summary.unresolvedCount} unresolved</CompactChip>
          )}
        </div>
      </div>

      {/* Machine warnings — separate prominent section */}
      {proposal.machineWarnings && proposal.machineWarnings.length > 0 && (
        <div className="space-y-0.5 rounded-[var(--ui-radius-sm)] border border-orange-300 bg-orange-50 px-2 py-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-800">⚠ Machine Fit</p>
          {proposal.machineWarnings.map((warning, i) => (
            <p key={i} className="text-[11px] text-orange-800">{warning}</p>
          ))}
        </div>
      )}

      {/* Recommended modules — collapsed by default */}
      {proposal.recommendedModules.length === 0 ? (
        <p className="text-xs text-slate-500">No modules could be matched.</p>
      ) : (
        <div className="space-y-1">
          {proposal.recommendedModules.map((module) => {
            const relatedDiffs = proposal.rowDiffs.filter((d) =>
              module.coveredRows.includes(d.rowId)
            )
            const allSpecDiffs = relatedDiffs.flatMap((d) => d.specDiffs)
            const partialCount = allSpecDiffs.filter((s) => s.status === 'partial').length
            const unresolvedCount = allSpecDiffs.filter((s) => s.status === 'unresolved').length
            const hasIssues = partialCount > 0 || unresolvedCount > 0

            const borderColor = unresolvedCount > 0
              ? 'border-l-red-400'
              : partialCount > 0
              ? 'border-l-amber-400'
              : 'border-l-green-400'

            const statusIcon = unresolvedCount > 0 ? '⚠' : partialCount > 0 ? '◐' : '✓'
            const statusLabel = unresolvedCount > 0
              ? `${unresolvedCount} unresolved`
              : partialCount > 0
              ? `${partialCount} partial`
              : 'OK'
            const statusColor = unresolvedCount > 0
              ? 'text-red-600'
              : partialCount > 0
              ? 'text-amber-600'
              : 'text-green-600'

            return (
              <details key={module.moduleId} className={`group rounded-[var(--ui-radius-sm)] border border-slate-200 border-l-[3px] ${borderColor} bg-white`}>
                <summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-1.5 select-none [&::-webkit-details-marker]:hidden">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-700">
                    {module.quantity}×
                  </span>
                  <p className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-900">
                    {module.moduleId}
                    <span className="ml-1 font-normal text-slate-500">{module.friendlyName}</span>
                  </p>
                  <span className={`shrink-0 text-[10px] font-medium ${statusColor}`}>
                    {statusIcon} {statusLabel}
                  </span>
                  <svg className="h-3 w-3 shrink-0 text-slate-400 transition-transform group-open:rotate-90" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd"/></svg>
                </summary>
                {relatedDiffs.length > 0 && (
                  <div className="space-y-2 border-t border-slate-100 px-2.5 pb-2 pt-1.5">
                    {hasIssues && (
                      <p className="text-[11px] text-slate-500">{module.rationale}</p>
                    )}
                    {relatedDiffs.map((row) => (
                      <div key={row.rowId}>
                        <p className="mb-0.5 text-[11px] font-semibold text-slate-700">
                          {row.categoryLabel} / {row.subLabel} · {row.quantityRequested} ch
                        </p>
                        <div className="overflow-hidden rounded border border-slate-200">
                          <table className="w-full border-collapse text-[11px]">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="px-2 py-0.5 text-left font-semibold text-slate-500">Spec</th>
                                <th className="px-2 py-0.5 text-left font-semibold text-slate-500">Req</th>
                                <th className="px-2 py-0.5 text-left font-semibold text-slate-500">Prov</th>
                                <th className="w-5 px-1 py-0.5"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {row.specDiffs.map((diff, i) => (
                                <tr
                                  key={`${row.rowId}-${diff.key}-${i}`}
                                  className={`border-t ${
                                    diff.status === 'unresolved'
                                      ? 'border-red-100 bg-red-50/50'
                                      : diff.status === 'partial'
                                      ? 'border-amber-100 bg-amber-50/50'
                                      : 'border-slate-100'
                                  }`}
                                >
                                  <td className="px-2 py-0.5 font-medium text-slate-700">
                                    {getSpecLabel(row.categoryId, row.subId, diff.key)}
                                  </td>
                                  <td className="px-2 py-0.5 text-slate-600">{diff.requested}</td>
                                  <td className={`px-2 py-0.5 ${
                                    diff.status === 'exact' ? 'text-slate-600' : diff.status === 'partial' ? 'font-medium text-amber-700' : 'font-medium text-red-700'
                                  }`}>{diff.provided}</td>
                                  <td className="px-1 py-0.5 text-center">
                                    {diff.status === 'exact' ? (
                                      <span className="text-green-500">✓</span>
                                    ) : diff.status === 'partial' ? (
                                      <span className="text-amber-500">≈</span>
                                    ) : (
                                      <span className="text-red-500">✗</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {row.notes.length > 0 && <p className="mt-0.5 text-[10px] text-slate-500">{row.notes.join(' ')}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </details>
            )
          })}
        </div>
      )}

      {/* Unresolved rows — compact */}
      {proposal.unresolved.length > 0 && (
        <div className="space-y-0.5 rounded-[var(--ui-radius-sm)] border border-amber-200 bg-amber-50 px-2 py-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">Unresolved</p>
          {proposal.unresolved.map((item) => (
            <p key={item.rowId} className="text-[11px] text-amber-800">
              <span className="font-semibold">{item.categoryLabel} / {item.subLabel}</span> ({item.quantity} ch) — {item.reason}
            </p>
          ))}
        </div>
      )}
    </CompactCard>
  )
}
