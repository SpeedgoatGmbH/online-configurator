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
          <div className="overflow-hidden rounded-[var(--ui-radius-sm)] border border-slate-200">
            <table className="w-full border-collapse text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wide text-slate-600">Qty</th>
                  <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wide text-slate-600">Module</th>
                  <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wide text-slate-600">Technical</th>
                  <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wide text-slate-600">Coverage</th>
                  <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wide text-slate-600">Why selected</th>
                </tr>
              </thead>
              <tbody>
                {proposal.recommendedModules.map((module) => (
                  <tr key={module.moduleId} className="border-t border-slate-200">
                    <td className="px-2 py-1.5 text-slate-900">{module.quantity}</td>
                    <td className="px-2 py-1.5 font-semibold text-slate-900">{module.friendlyName}</td>
                    <td className="px-2 py-1.5 text-slate-600">
                      {module.technicalName}
                      <div className="text-[11px] text-slate-500">{module.moduleId}</div>
                    </td>
                    <td className="px-2 py-1.5 text-slate-600">
                      {module.coveredChannels} ch
                      <div className="text-[11px] text-slate-500">{module.coveredRows.join(', ')}</div>
                    </td>
                    <td className="px-2 py-1.5 text-slate-600">
                      {module.rationale}
                      <div className="text-[11px] text-slate-500">Confidence: {module.confidence}%</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Requested vs provided spec diff</p>
        <div className="space-y-2">
          {proposal.rowDiffs.map((row) => (
            <div key={row.rowId} className="rounded-[var(--ui-radius-sm)] border border-slate-200 bg-white p-2">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-900">
                  {row.categoryLabel} / {row.subLabel} · Requested {row.quantityRequested} ch
                </p>
                <span
                  className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                    row.status === 'exact'
                      ? 'bg-green-100 text-green-700'
                      : row.status === 'partial'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {row.status}
                </span>
              </div>
              <div className="overflow-hidden rounded-[var(--ui-radius-sm)] border border-slate-200">
                <table className="w-full border-collapse text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wide text-slate-600">Spec</th>
                      <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wide text-slate-600">Requested</th>
                      <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wide text-slate-600">Provided</th>
                      <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wide text-slate-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.specDiffs.map((diff, index) => (
                      <tr key={`${row.rowId}-${diff.key}-${index}`} className="border-t border-slate-200">
                        <td className="px-2 py-1.5 text-slate-900">{diff.key}</td>
                        <td className="px-2 py-1.5 text-slate-600">{diff.requested}</td>
                        <td className="px-2 py-1.5 text-slate-600">{diff.provided}</td>
                        <td className="px-2 py-1.5 text-slate-600">{diff.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {row.notes.length > 0 && <p className="mt-1 text-[11px] text-slate-500">{row.notes.join(' ')}</p>}
            </div>
          ))}
        </div>
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
