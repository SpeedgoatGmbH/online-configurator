'use client'

import { CompactCard, CompactChip } from '@/components/ui/compact'
import type { ProposalGenerateResponse, ProposalRecommendedModule, SoftwareRecommendation } from '@/components/configurator/proposalTypes'
import { getSpecLabel } from '@/components/configurator/data'
import { cn } from '@/lib/cn'
import { useEffect, useState } from 'react'

type ProposalResultCardProps = {
  proposal: ProposalGenerateResponse
  machineName: string
  devMode?: boolean
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
        <span
          key={pkg}
          className={cn(
            'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ring-1',
            module.selectedConfigPackage === pkg
              ? 'bg-indigo-50 text-indigo-700 ring-indigo-300 font-semibold'
              : 'bg-slate-50 text-slate-400 ring-slate-200 opacity-50',
          )}
        >
          {module.selectedConfigPackage === pkg ? '● ' : ''}{pkg}
        </span>
      ))}
      {module.configPackageWarning && (
        <span className="inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200">
          ⚠ {module.configPackageWarning}
        </span>
      )}
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
      <span className="text-[10px] font-medium text-slate-500">FPGA Util.</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="text-[10px] font-medium text-slate-600">{utilization.used}/{utilization.total} ({pct}%)</span>
    </div>
  )
}

// ─── FPGA Dev Panel ──────────────────────────────────────────────────────────

const RESOURCE_LABELS: Record<string, { label: string; abbr: string; icon: string }> = {
  slices: { label: 'Slices', abbr: 'SLC', icon: '▦' },
  lut: { label: 'Look-Up Tables', abbr: 'LUT', icon: '◫' },
  register: { label: 'Registers', abbr: 'REG', icon: '▤' },
  ram16: { label: 'Block RAM 16', abbr: 'R16', icon: '▧' },
  ram8: { label: 'Block RAM 8', abbr: 'R8', icon: '▥' },
  dsp: { label: 'DSP Slices', abbr: 'DSP', icon: '◈' },
}

function ResourceBar({ rKey, used, available, utilizationPct, isBottleneck }: {
  rKey: string; used: number; available: number; utilizationPct: number; isBottleneck: boolean
}) {
  const meta = RESOURCE_LABELS[rKey] ?? { label: rKey, abbr: rKey.toUpperCase(), icon: '◻' }
  const noData = available === 0 && used === 0
  const pct = Math.min(100, utilizationPct)
  const barColor = noData ? 'bg-slate-200'
    : pct === 0 ? 'bg-slate-200'
    : pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-400' : pct > 30 ? 'bg-indigo-400' : 'bg-indigo-300'
  const textColor = noData ? 'text-slate-400' : pct > 90 ? 'text-red-700' : pct > 70 ? 'text-amber-700' : 'text-indigo-700'

  return (
    <div className={cn('group/res relative rounded-md border px-2 py-1.5 transition-colors', isBottleneck ? 'border-amber-300 bg-amber-50/60' : 'border-slate-200 bg-white')}>
      {isBottleneck && (
        <span className="absolute -right-1 -top-1.5 rounded bg-amber-400 px-1 py-px text-[8px] font-bold text-white shadow-sm">BOTTLENECK</span>
      )}
      <div className="mb-1 flex items-center justify-between">
        <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-700">
          <span className="text-xs opacity-60">{meta.icon}</span> {meta.abbr}
        </span>
        {noData ? (
          <span className="text-[10px] italic text-slate-400">n/a</span>
        ) : (
          <span className={cn('text-[10px] font-bold tabular-nums', textColor)}>{pct.toFixed(1)}%</span>
        )}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn('h-full rounded-full transition-all duration-500', barColor)}
          style={{ width: `${Math.max(pct > 0 ? 2 : 0, pct)}%` }}
        />
      </div>
      <div className="mt-0.5 flex justify-between text-[9px] text-slate-400 tabular-nums">
        <span>{formatCompact(used)} used</span>
        <span>{formatCompact(available)} avail</span>
      </div>
    </div>
  )
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`
  return n.toFixed(n === Math.floor(n) ? 0 : 1)
}

function FitDiagnosticsBar({ proposal }: { proposal: ProposalGenerateResponse }) {
  const diag = proposal.fitDiagnostics
  if (!diag) return null
  const { candidatesEvaluated, candidatesRejected, failOpenCount } = diag.summary
  const passed = candidatesEvaluated - candidatesRejected
  const hardPassed = passed - failOpenCount
  const total = Math.max(1, candidatesEvaluated)

  const segments = [
    { label: 'Hard pass', count: hardPassed, color: 'bg-green-500', textColor: 'text-green-700' },
    { label: 'Fail-open', count: failOpenCount, color: 'bg-amber-400', textColor: 'text-amber-700' },
    { label: 'Rejected', count: candidatesRejected, color: 'bg-red-400', textColor: 'text-red-700' },
  ].filter(s => s.count > 0)

  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Fit Gate Results</p>
      <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner">
        {segments.map(s => (
          <div
            key={s.label}
            className={cn('flex items-center justify-center text-[8px] font-bold text-white transition-all', s.color)}
            style={{ width: `${(s.count / total) * 100}%` }}
            title={`${s.label}: ${s.count}/${total}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {segments.map(s => (
          <span key={s.label} className={cn('flex items-center gap-1 text-[10px]', s.textColor)}>
            <span className={cn('inline-block h-2 w-2 rounded-full', s.color)} />
            {s.label}: <strong>{s.count}</strong>
          </span>
        ))}
        <span className="text-[10px] text-slate-400">of {candidatesEvaluated} evaluated across {diag.summary.rows} row{diag.summary.rows !== 1 ? 's' : ''}</span>
      </div>
      {/* Per-row rejection reasons */}
      {diag.rows.some(r => Object.keys(r.rejectionsByReason).length > 0) && (
        <div className="mt-1 space-y-0.5">
          {diag.rows.filter(r => Object.keys(r.rejectionsByReason).length > 0).map(r => (
            <div key={r.rowId} className="flex flex-wrap items-center gap-1 text-[9px]">
              <span className="truncate font-medium text-slate-600" title={r.rowId}>
                {r.rowId.split('-').slice(0, 2).join('/')}
              </span>
              {Object.entries(r.rejectionsByReason).map(([reason, count]) => (
                <span key={reason} className="rounded bg-red-50 px-1 py-px text-red-600">
                  {reason.replace(/_/g, ' ')}: {count}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const SW_CATEGORY_META: Record<SoftwareRecommendation['category'], { label: string; icon: string; border: string; bg: string; text: string }> = {
  'custom-config': { label: 'Custom Config', icon: '⚙', border: 'border-violet-300', bg: 'bg-violet-50', text: 'text-violet-800' },
  hcip: { label: 'HDL Coder (HCIP)', icon: '⬡', border: 'border-blue-300', bg: 'bg-blue-50', text: 'text-blue-800' },
  blockset: { label: 'I/O Blockset', icon: '⬢', border: 'border-teal-300', bg: 'bg-teal-50', text: 'text-teal-800' },
}

function FpgaDevPanel({ proposal }: { proposal: ProposalGenerateResponse }) {
  const [expanded, setExpanded] = useState(true)
  const planning = proposal.fpgaResourcePlanning
  const swRecs = proposal.softwareRecommendations
  const swaps = proposal.fpgaOverheadSwaps

  const hasFpga = planning && planning.familiesUsed > 0
  const boardCount = planning?.boardsUsed ?? 0
  const familyCount = planning?.familiesUsed ?? 0

  return (
    <div className="overflow-hidden rounded-lg border border-indigo-200/80 bg-gradient-to-br from-indigo-50/70 via-white to-violet-50/50 shadow-sm">
      {/* Panel header */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-indigo-50/60"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded bg-indigo-600 text-[10px] font-bold text-white shadow-sm">F</span>
        <span className="flex-1 text-xs font-bold tracking-wide text-indigo-900">FPGA Dev Insights</span>
        {hasFpga && (
          <span className="flex items-center gap-1.5">
            <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">{familyCount} fam</span>
            <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">{boardCount} board{boardCount !== 1 ? 's' : ''}</span>
          </span>
        )}
        <svg className={cn('h-4 w-4 text-indigo-400 transition-transform', expanded && 'rotate-180')} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd"/></svg>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-indigo-100 px-3 pb-3 pt-2">
          {/* Fit Diagnostics */}
          <FitDiagnosticsBar proposal={proposal} />

          {/* Resource Planning */}
          {!hasFpga ? (
            <div className="flex items-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-4">
              <span className="text-xl opacity-30">◻</span>
              <span className="text-xs text-slate-400">No FPGA boards selected — all requirements covered by dedicated modules.</span>
            </div>
          ) : (
            <div className="space-y-2.5">
              {planning!.families.map((family) => {
                const peakUtil = Math.max(...family.resources.map(r => r.utilizationPct))
                const statusColor = family.confidence === 'high' ? 'bg-green-500' : 'bg-amber-400'
                const peakColor = peakUtil === 0 ? 'text-slate-400' : peakUtil > 90 ? 'text-red-600' : peakUtil > 70 ? 'text-amber-600' : 'text-indigo-600'

                return (
                  <div key={`${family.family}-${family.boardIndex ?? 0}`} className="rounded-lg border border-slate-200 bg-white shadow-sm">
                    {/* Family header */}
                    <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
                      <span className={cn('h-2 w-2 rounded-full', statusColor)} title={family.confidence} />
                      <span className="text-sm font-bold text-slate-900">
                        {family.family}{family.boardIndex ? ` #${family.boardIndex}` : ''}
                      </span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{family.boardModel}</span>
                      {!family.boardIndex && (
                        <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600">{family.boardsUsed}× board</span>
                      )}
                      <span className={cn('ml-auto text-xs font-bold tabular-nums', peakColor)}>Peak {peakUtil.toFixed(1)}%</span>
                    </div>

                    {/* Extensions / interface boards */}
                    {family.extensions && family.extensions.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-3 py-1.5">
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-violet-400">Extensions:</span>
                        {family.extensions.map((ext) => (
                          <span key={ext} className="inline-flex items-center gap-0.5 rounded-full bg-violet-50 px-1.5 py-0.5 text-[9px] font-medium text-violet-700 ring-1 ring-violet-200">
                            🔌 {ext}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Resource bars grid */}
                    <div className="grid grid-cols-2 gap-1.5 p-2 sm:grid-cols-3 lg:grid-cols-6">
                      {family.resources.map((r) => (
                        <ResourceBar
                          key={r.key}
                          rKey={r.key}
                          used={r.used}
                          available={r.available}
                          utilizationPct={r.utilizationPct}
                          isBottleneck={r.key === family.bottleneckResource && r.utilizationPct > 0}
                        />
                      ))}
                    </div>

                    {/* Covered rows chips */}
                    {family.coveredRows.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 border-t border-slate-100 px-3 py-1.5">
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Covers:</span>
                        {family.coveredRows.map((rowId) => {
                          const diff = proposal.rowDiffs.find(d => d.rowId === rowId)
                          return (
                            <span
                              key={rowId}
                              className="inline-flex items-center gap-0.5 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[9px] font-medium text-indigo-700"
                              title={rowId}
                            >
                              {diff ? `${diff.categoryLabel}/${diff.subLabel}` : rowId.split('-').slice(0, 2).join('/')}
                              <span className="text-indigo-400">·</span>
                              <span className="tabular-nums">{diff?.quantityCovered ?? diff?.quantityRequested ?? '?'}ch</span>
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Overhead Swaps */}
          {swaps && swaps.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-600">⚡ FPGA → Dedicated Swaps</p>
              {swaps.map((swap) => (
                <div key={swap.family} className="flex flex-wrap items-center gap-1.5 rounded-md border border-orange-200 bg-orange-50 px-2 py-1.5">
                  <span className="text-[11px] font-bold text-orange-800">{swap.family}</span>
                  <span className="text-[10px] text-orange-600">
                    {swap.fpgaCount} FPGA board{swap.fpgaCount !== 1 ? 's' : ''} → {swap.dedicatedCount} dedicated
                  </span>
                  <span className="text-[10px] text-orange-500">·</span>
                  {swap.replacements.map(r => (
                    <span key={r.moduleId} className="rounded bg-orange-100 px-1 py-0.5 text-[10px] font-medium text-orange-700">
                      {r.units}× {r.moduleId}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Software Recommendations */}
          {swRecs && swRecs.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-600">Software &amp; Service Recommendations</p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {swRecs.map((rec) => {
                  const meta = SW_CATEGORY_META[rec.category]
                  return (
                    <div key={rec.itemCode} className={cn('rounded-md border px-2.5 py-2', meta.border, meta.bg)}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{meta.icon}</span>
                        <span className={cn('text-[10px] font-bold uppercase tracking-wide', meta.text)}>{meta.label}</span>
                      </div>
                      <p className={cn('mt-0.5 text-[11px] font-semibold', meta.text)}>
                        {rec.name}
                        <span className="ml-1 font-normal opacity-60">{rec.itemCode}</span>
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-600">{rec.reason}</p>
                      <p className="mt-0.5 text-[9px] text-slate-400">for {rec.forFpgaFamily} · {rec.forModuleId}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
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
              {row.categoryLabel} / {row.subLabel} · {row.quantityCovered}/{row.quantityRequested} ch
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

export default function ProposalResultCard({ proposal, machineName, devMode }: ProposalResultCardProps) {
  const [flashActive, setFlashActive] = useState(true)

  // Brief green flash on mount, then fade out
  useEffect(() => {
    const timer = setTimeout(() => setFlashActive(false), 1200)
    return () => clearTimeout(timer)
  }, [])

  const partialRowCount = proposal.rowDiffs.filter((row) => row.status === 'partial').length
  const allOk = proposal.unresolved.length === 0 && !proposal.machineWarnings?.length && partialRowCount === 0
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
          <CompactChip>{coverPct}% channels covered</CompactChip>
          <CompactChip>{proposal.summary.moduleCount} modules</CompactChip>
          {partialRowCount > 0 && (
            <CompactChip>{partialRowCount} partial rows</CompactChip>
          )}
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

      {/* Dev-only FPGA resource planning + software recommendations */}
      {devMode && (
        <FpgaDevPanel proposal={proposal} />
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
