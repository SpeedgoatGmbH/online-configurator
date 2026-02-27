'use client'

import { CompactCard, CompactChip, CompactSectionLabel } from '@/components/ui/compact'
import type { ProposalGenerateResponse } from '@/components/configurator/proposalTypes'

type ProposalResultCardProps = {
  proposal: ProposalGenerateResponse
  machineName: string
}

export default function ProposalResultCard({ proposal, machineName }: ProposalResultCardProps) {
  const generatedLabel = new Date(proposal.generatedAt).toLocaleString()

  return (
    <CompactCard className="space-y-3 p-[var(--ui-pad-3)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <CompactSectionLabel>Generated Proposal (Simulated)</CompactSectionLabel>
          <p className="mt-0.5 text-sm font-semibold text-slate-900">{machineName}</p>
          <p className="text-xs text-slate-500">
            Proposal ID: {proposal.proposalId} · {generatedLabel}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <CompactChip>
            Requested: <span className="font-semibold text-slate-900">{proposal.summary.requestedChannels}</span>
          </CompactChip>
          <CompactChip>
            Covered: <span className="font-semibold text-slate-900">{proposal.summary.coveredChannels}</span>
          </CompactChip>
          <CompactChip>
            Unresolved: <span className="font-semibold text-slate-900">{proposal.summary.unresolvedCount}</span>
          </CompactChip>
          <CompactChip>
            Modules: <span className="font-semibold text-slate-900">{proposal.summary.moduleCount}</span>
          </CompactChip>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Recommended modules</p>
        {proposal.recommendedModules.length === 0 ? (
          <p className="text-xs text-slate-500">No modules could be matched.</p>
        ) : (
          <div className="space-y-1.5">
            {proposal.recommendedModules.map((module) => {
              const relatedDiffs = proposal.rowDiffs.filter((d) =>
                module.coveredRows.includes(d.rowId)
              )
              // Derive visual status from actual spec diffs (not confidence %)
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
                ? `${unresolvedCount} spec${unresolvedCount > 1 ? 's' : ''} not covered`
                : partialCount > 0
                ? `${partialCount} spec${partialCount > 1 ? 's' : ''} differ — review`
                : 'All specs match'
              const statusColor = unresolvedCount > 0
                ? 'text-red-600'
                : partialCount > 0
                ? 'text-amber-600'
                : 'text-green-600'

              return (
                <details key={module.moduleId} className={`group rounded-[var(--ui-radius-sm)] border border-slate-200 border-l-[3px] ${borderColor} bg-white`}>
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2 select-none [&::-webkit-details-marker]:hidden">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                      {module.quantity}×
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">
                        {module.moduleId}{' '}
                        <span className="font-normal text-slate-500">— {module.friendlyName}</span>
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {module.coveredChannels} ch covered
                      </p>
                    </div>
                    <span className={`shrink-0 text-[11px] font-medium ${statusColor}`}>
                      {statusIcon} {statusLabel}
                    </span>
                    <svg className="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform group-open:rotate-90" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd"/></svg>
                  </summary>
                  {relatedDiffs.length > 0 && (
                    <div className="space-y-2 border-t border-slate-100 px-3 pb-2.5 pt-2">
                      {hasIssues && (
                        <p className="text-[11px] text-slate-500">
                          {module.rationale}
                        </p>
                      )}
                      {relatedDiffs.map((row) => (
                        <div key={row.rowId}>
                          <div className="mb-1 flex items-center gap-2">
                            <p className="text-[11px] font-semibold text-slate-700">
                              {row.categoryLabel} / {row.subLabel} · {row.quantityRequested} ch
                            </p>
                          </div>
                          <div className="overflow-hidden rounded border border-slate-200">
                            <table className="w-full border-collapse text-[11px]">
                              <thead className="bg-slate-50">
                                <tr>
                                  <th className="px-2 py-1 text-left font-semibold text-slate-500">Spec</th>
                                  <th className="px-2 py-1 text-left font-semibold text-slate-500">Requested</th>
                                  <th className="px-2 py-1 text-left font-semibold text-slate-500">Provided</th>
                                  <th className="w-6 px-2 py-1"></th>
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
                                    <td className="px-2 py-1 font-medium text-slate-700">{diff.key}</td>
                                    <td className="px-2 py-1 text-slate-600">{diff.requested}</td>
                                    <td className={`px-2 py-1 ${
                                      diff.status === 'exact' ? 'text-slate-600' : diff.status === 'partial' ? 'font-medium text-amber-700' : 'font-medium text-red-700'
                                    }`}>{diff.provided}</td>
                                    <td className="px-2 py-1 text-center">
                                      {diff.status === 'exact' ? (
                                        <span className="text-green-500">✓</span>
                                      ) : diff.status === 'partial' ? (
                                        <span className="text-amber-500" title="Approximate match">≈</span>
                                      ) : (
                                        <span className="text-red-500" title="Not covered">✗</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {row.notes.length > 0 && <p className="mt-1 text-[10px] text-slate-500">{row.notes.join(' ')}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </details>
              )
            })}
          </div>
        )}
      </div>

      {proposal.unresolved.length > 0 && (
        <div className="space-y-1 rounded-[var(--ui-radius-sm)] border border-amber-200 bg-amber-50 p-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Unresolved rows</p>
          {proposal.unresolved.map((item) => (
            <div key={item.rowId} className="text-xs text-amber-800">
              <p className="font-semibold">
                {item.categoryLabel} / {item.subLabel} ({item.quantity} ch)
              </p>
              <p>{item.reason}</p>
              <p className="text-amber-700">{item.suggestion}</p>
            </div>
          ))}
        </div>
      )}
    </CompactCard>
  )
}
