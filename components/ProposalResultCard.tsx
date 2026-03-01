'use client'

import { CompactCard, CompactChip } from '@/components/ui/compact'
import type { ProposalGenerateResponse, ProposalRecommendedModule } from '@/components/configurator/proposalTypes'
import { getSpecLabel } from '@/components/configurator/data'
import { cn } from '@/lib/cn'
import { useEffect, useState } from 'react'

type ProposalResultCardProps = {
  proposal: ProposalGenerateResponse
  machineName: string
}

// ─── Sample rate formatter ───────────────────────────────────────────────────

function formatSampleRate(hz: number): string {
  if (hz >= 1_000_000) return `${(hz / 1_000_000).toFixed(hz % 1_000_000 === 0 ? 0 : 1)} MHz`
  if (hz >= 1_000) return `${(hz / 1_000).toFixed(hz % 1_000 === 0 ? 0 : 1)} kHz`
  return `${hz} Hz`
}

function ModuleSpecsBadges({ module }: { module: ProposalRecommendedModule }) {
  const hasAnySpec = module.formFactor || module.voltageRange ||
    module.sampleRateHz || module.resolutionBits || module.fpgaLogicCells ||
    module.fpgaCategory || module.lifecycleStatus || module.configPackages?.length
  if (!hasAnySpec) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-1">
      {module.formFactor && (
        <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
          {module.formFactor}
        </span>
      )}
      {module.fpgaLogicCells && (
        <span className="inline-flex items-center rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600">
          FPGA {module.fpgaLogicCells}
        </span>
      )}
      {module.fpgaCategory && (
        <span className={cn(
          'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold',
          module.fpgaCategory === 'simulink-programmable'
            ? 'bg-violet-50 text-violet-600'
            : 'bg-cyan-50 text-cyan-600',
        )}>
          {module.fpgaCategory === 'simulink-programmable' ? 'Simulink-Programmable' : 'Configurable I/O'}
        </span>
      )}
      {module.lifecycleStatus && module.lifecycleStatus !== 'active' && module.lifecycleStatus !== 'recommended' && (
        <span className={cn(
          'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold',
          module.lifecycleStatus === 'discontinued' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600',
        )}>
          {module.lifecycleStatus === 'discontinued' ? '⊘ Discontinued' : '⏳ End of Life'}
        </span>
      )}
      {module.resolutionBits && (
        <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
          {module.resolutionBits}-bit
        </span>
      )}
      {module.sampleRateHz && module.sampleRateHz.length > 0 && (
        <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
          {formatSampleRate(Math.max(...module.sampleRateHz))}
        </span>
      )}
      {module.voltageRange && (
        <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
          {module.voltageRange.min > 0 ? '' : '±'}{Math.abs(module.voltageRange.max)} {module.voltageRange.unit}
        </span>
      )}
      {module.configPackages && module.configPackages.length > 0 && module.configPackages.map((pkg) => (
        <span key={pkg} className="inline-flex items-center rounded bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200">
          {pkg}
        </span>
      ))}
      {module.webSourcePage && (
        <a
          href={module.webSourcePage}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 hover:bg-blue-100"
        >
          Datasheet ↗
        </a>
      )}
    </div>
  )
}

// ─── I/O Line Utilization Bar ────────────────────────────────────────────────

function IOLineBar({ utilization }: { utilization: { used: number; total: number } }) {
  const pct = utilization.total > 0 ? Math.round((utilization.used / utilization.total) * 100) : 0
  const barColor = pct > 90 ? 'bg-red-400' : pct > 70 ? 'bg-amber-400' : 'bg-emerald-400'

  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="text-[10px] font-medium text-slate-500">I/O Lines</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="text-[10px] font-medium text-slate-600">{utilization.used}/{utilization.total} ({pct}%)</span>
    </div>
  )
}

// ─── Group modules: parents first, children nested under them ────────────────

type ModuleGroup = {
  parent: ProposalRecommendedModule
  children: ProposalRecommendedModule[]
}

function groupModules(modules: ProposalRecommendedModule[]): (ProposalRecommendedModule | ModuleGroup)[] {
  const childMap = new Map<string, ProposalRecommendedModule[]>()
  const parentIds = new Set<string>()

  // Identify children (interface boards/extensions)
  for (const mod of modules) {
    if (mod.interfaceForModule) {
      const arr = childMap.get(mod.interfaceForModule) ?? []
      arr.push(mod)
      childMap.set(mod.interfaceForModule, arr)
    }
  }
  // Mark modules that have children
  for (const key of childMap.keys()) parentIds.add(key)

  const result: (ProposalRecommendedModule | ModuleGroup)[] = []
  for (const mod of modules) {
    if (mod.interfaceForModule) continue // skip children — they'll appear under parent
    const children = childMap.get(mod.moduleId)
    if (children && children.length > 0) {
      result.push({ parent: mod, children })
    } else {
      result.push(mod)
    }
  }
  return result
}

// ─── Single module row (reused for both standalone and nested) ───────────────

function ModuleRow({
  module,
  proposal,
  isChild,
}: {
  module: ProposalRecommendedModule
  proposal: ProposalGenerateResponse
  isChild?: boolean
}) {
  const relatedDiffs = proposal.rowDiffs.filter((d) =>
    module.coveredRows.includes(d.rowId)
  )
  const allSpecDiffs = relatedDiffs.flatMap((d) => d.specDiffs)
  const partialCount = allSpecDiffs.filter((s) => s.status === 'partial').length
  const unresolvedCount = allSpecDiffs.filter((s) => s.status === 'unresolved').length
  const hasIssues = partialCount > 0 || unresolvedCount > 0

  const borderColor = isChild
    ? 'border-l-slate-300'
    : unresolvedCount > 0
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
    <details className={cn(
      `group rounded-[var(--ui-radius-sm)] border border-slate-200 border-l-[3px] ${borderColor} bg-white`,
      isChild && 'ml-5 border-l-2',
    )}>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-1.5 select-none [&::-webkit-details-marker]:hidden">
        {isChild && (
          <span className="text-[10px] text-slate-400">↳</span>
        )}
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-700">
          {module.quantity}×
        </span>
        <p className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-900">
          {module.moduleId}
          <span className="ml-1 font-normal text-slate-500">{module.friendlyName}</span>
        </p>
        {isChild && (
          <span className="shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[9px] font-semibold text-slate-500">
            {module.moduleId.includes('IO33X') ? 'Interface Board' : 'Extension'}
          </span>
        )}
        {!isChild && (
          <span className={`shrink-0 text-[10px] font-medium ${statusColor}`}>
            {statusIcon} {statusLabel}
          </span>
        )}
        <svg className="h-3 w-3 shrink-0 text-slate-400 transition-transform group-open:rotate-90" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd"/></svg>
      </summary>
      <div className="space-y-2 border-t border-slate-100 px-2.5 pb-2 pt-1.5">
        <ModuleSpecsBadges module={module} />
        {module.ioLineUtilization && <IOLineBar utilization={module.ioLineUtilization} />}
        {hasIssues && (
          <p className="text-[11px] text-slate-500">{module.rationale}</p>
        )}
        {!hasIssues && isChild && module.rationale && (
          <p className="text-[11px] text-slate-500">{module.rationale}</p>
        )}
        {relatedDiffs.length > 0 && relatedDiffs.map((row) => (
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
    </details>
  )
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

      {/* Recommended modules — nested FPGA grouping */}
      {proposal.recommendedModules.length === 0 ? (
        <p className="text-xs text-slate-500">No modules could be matched.</p>
      ) : (
        <div className="space-y-1">
          {groupModules(proposal.recommendedModules).map((item) => {
            if ('parent' in item) {
              // Grouped FPGA module with children
              return (
                <div key={item.parent.moduleId} className="space-y-0.5">
                  <ModuleRow module={item.parent} proposal={proposal} />
                  {item.children.map((child) => (
                    <ModuleRow key={child.moduleId} module={child} proposal={proposal} isChild />
                  ))}
                </div>
              )
            }
            // Standalone module (no children)
            return <ModuleRow key={item.moduleId} module={item} proposal={proposal} />
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
