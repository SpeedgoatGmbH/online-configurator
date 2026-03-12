/**
 * Builds a FlowExample from live configurator rows by running the simulator
 * and extracting per-row candidates, scores, and FPGA consolidation data.
 */

import type { OptimizationProfile, RequirementRow, ProposalGenerateRequest } from './proposalTypes'
import type { FlowExample, ModuleShowcase, ModuleCandidate, ScoreBreakdownLine, NodeSnapshot, FpgaInterfaceBoardInfo, SystemSummary } from './decisionFlowExamples'
import type { StarterRow } from './industries'
import {
  simulateProposalWithCandidates,
  type CandidateScore,
  type SimulationWithCandidates,
} from '@/lib/proposal/simulator'
import { MOCK_MODULE_CATALOG } from '@/lib/proposal/catalog'

// ─── Helpers ────────────────────────────────────────────────────────────────────

function requirementLabel(row: { categoryLabel: string; subLabel: string; quantity: number }): string {
  return `${row.categoryLabel} ${row.subLabel} × ${row.quantity}`
}

function buildScoreBreakdown(c: CandidateScore): ScoreBreakdownLine[] {
  const lines: ScoreBreakdownLine[] = []

  if (c.exactCount > 0) {
    lines.push({
      label: 'Exact match',
      points: c.exactPoints,
      detail: `${c.exactCount} spec${c.exactCount > 1 ? 's' : ''} matched perfectly`,
    })
  }
  if (c.compatibleCount > 0) {
    lines.push({
      label: 'Partial match',
      points: c.compatiblePoints,
      detail: `${c.compatibleCount} spec${c.compatibleCount > 1 ? 's' : ''} compatible but not exact`,
    })
  }
  if (c.mismatchCount > 0) {
    lines.push({
      label: 'Mismatch',
      points: c.mismatchPoints,
      detail: `${c.mismatchCount} spec${c.mismatchCount > 1 ? 's' : ''} couldn't be met`,
    })
  }
  if (c.missingCount > 0) {
    lines.push({
      label: 'Missing spec',
      points: c.missingPoints,
      detail: `${c.missingCount} spec${c.missingCount > 1 ? 's' : ''} not supported by module`,
    })
  }
  if (c.consolidationBonus > 0) {
    lines.push({
      label: 'Consolidation',
      points: c.consolidationBonus,
      detail: 'Reuses a module already selected for another row',
    })
  }
  if (c.machineBonus > 0) {
    lines.push({
      label: 'Machine bonus',
      points: c.machineBonus,
      detail: 'Verified compatible with the selected machine',
    })
  }
  if (c.units > 0) {
    lines.push({
      label: 'Unit penalty',
      points: c.unitsPenaltyPoints,
      detail: `${c.units} board${c.units > 1 ? 's' : ''} needed`,
    })
  }
  if (c.fpgaLookAheadBonus > 0) {
    lines.push({
      label: 'FPGA look-ahead',
      points: c.fpgaLookAheadBonus,
      detail: 'FPGA family covers multiple requirement rows proactively',
    })
  }
  if (c.lifecyclePenalty < 0) {
    lines.push({
      label: 'Lifecycle penalty',
      points: c.lifecyclePenalty,
      detail: c.lifecyclePenalty <= -20 ? 'Module is discontinued' : 'Module is end-of-life',
    })
  }
  if (c.configPackageBonus > 0) {
    lines.push({
      label: 'Config package',
      points: c.configPackageBonus,
      detail: c.selectedConfigPackage
        ? `Matched: ${c.selectedConfigPackage}`
        : 'Module configuration package matches the signal context',
    })
  }
  if (c.fpgaCategoryBonus > 0) {
    lines.push({
      label: 'FPGA category',
      points: c.fpgaCategoryBonus,
      detail: c.fpgaCategoryBonus >= 3 ? 'Simulink-programmable (most flexible)' : 'Configurable I/O',
    })
  }
  if (c.dedicatedSimplicityBonus > 0) {
    lines.push({
      label: 'Dedicated simplicity',
      points: c.dedicatedSimplicityBonus,
      detail: 'Non-FPGA module — no extensions or accessories needed',
    })
  }
  if (c.interfaceOverheadPenalty < 0) {
    lines.push({
      label: 'Interface overhead',
      points: c.interfaceOverheadPenalty,
      detail: `${c.estimatedAccessoryUnits} estimated accessory board${c.estimatedAccessoryUnits > 1 ? 's' : ''}`,
    })
  }
  return lines
}

function candidateReason(c: CandidateScore, isWinner: boolean): string {
  if (!isWinner) {
    if (c.units > 1) return `Needs ${c.units} units`
    if (c.mismatchCount > 0) return `${c.mismatchCount} spec mismatch${c.mismatchCount > 1 ? 'es' : ''}`
    return 'Lower overall score'
  }
  if (c.consolidationBonus > 0) return 'Consolidation + best score'
  if (c.machineBonus > 0) return 'Machine compatible + best score'
  if (c.exactCount > 0 && c.mismatchCount === 0) return 'Best spec alignment'
  return 'Highest overall score'
}

// ─── Node snapshot generation ───────────────────────────────────────────────────

function buildNodeSnapshots(sim: SimulationWithCandidates, machineName: string): NodeSnapshot[] {
  const { response, perRow, fpgaConsolidation, catalogSize } = sim
  const rowCount = perRow.length
  const categorySet = new Set(perRow.map((r) => r.categoryLabel))
  const categories = Array.from(categorySet).join(', ')
  const uniqueModules = new Set(response.recommendedModules.map((m) => m.moduleId)).size
  // Detect FPGA: any winning module backed by an FPGA catalog entry
  const hasFpga = response.recommendedModules.some((m) => {
    const cat = MOCK_MODULE_CATALOG.find((c) => c.moduleId === m.moduleId)
    return cat?.fpgaFamily != null
  }) || fpgaConsolidation !== null

  // Typical candidate count range
  const candidateCounts = perRow.map((r) => r.allCandidates.length).filter((n) => n > 0)
  const minCandidates = candidateCounts.length > 0 ? Math.min(...candidateCounts) : 0
  const maxCandidates = candidateCounts.length > 0 ? Math.max(...candidateCounts) : 0

  // Winner examples (up to 2)
  const winners = perRow.filter((r) => r.winner).slice(0, 2)
  const winnerFacts = winners.map((r) => `${r.winner!.module.moduleId} wins ${r.subLabel} (score ${r.winner!.score})`).join(' · ')

  return [
    { nodeId: 'input', fact: `${rowCount} requirement rows → RequirementRow[]` },
    { nodeId: 'normalize', fact: `Sorted: ${categories} (${rowCount} rows)` },
    { nodeId: 'catalog_filter', fact: `${catalogSize} modules → ${minCandidates}–${maxCandidates} candidates per row` },
    { nodeId: 'score', fact: winnerFacts || 'No winners determined' },
    { nodeId: 'pick_best', fact: `${uniqueModules} unique modules selected` },
    { nodeId: 'accumulate', fact: `${response.summary.moduleCount} total boards accumulated` },
    { nodeId: 'fpga_detect', fact: hasFpga ? `FPGA modules detected → branch active` : 'No FPGA modules → branch skipped' },
    { nodeId: 'fpga_consolidate', fact: fpgaConsolidation ? `Before: ${fpgaConsolidation.before} boards → After: ${fpgaConsolidation.after} boards` : hasFpga ? 'No consolidation needed (boards already minimal)' : '—' },
    { nodeId: 'fpga_interface', fact: hasFpga ? (() => {
      const ifcMods = response.recommendedModules.filter((m) => m.interfaceForModule)
      if (ifcMods.length === 0) return 'No interface boards needed'
      const names = ifcMods.map(m => `${m.quantity}× ${m.moduleId}`).join(', ')
      return `Selected: ${names}`
    })() : '—' },
    { nodeId: 'slot_check', fact: `${response.summary.moduleCount} modules · ${machineName}: ${response.machineWarnings ? 'WARNING' : 'OK'}` },
    { nodeId: 'compat_check', fact: response.machineWarnings?.length ? 'Compatibility warnings found' : `All modules compatible with ${machineName}` },
    { nodeId: 'output', fact: `${response.summary.coveredChannels} channels resolved, ${response.summary.unresolvedCount} unresolved` },
    { nodeId: 'system_summary', fact: (() => {
      const mainQty = response.recommendedModules.filter(m => !m.interfaceForModule).reduce((s, m) => s + m.quantity, 0)
      const ifcQty  = response.recommendedModules.filter(m =>  m.interfaceForModule).reduce((s, m) => s + m.quantity, 0)
      const pct = response.summary.unresolvedCount === 0 ? '100%' : `${Math.round((perRow.filter(r => r.winner).length / perRow.length) * 100)}%`
      return `${pct} resolved · ${mainQty} main + ${ifcQty} interface board${ifcQty !== 1 ? 's' : ''}`
    })() },
  ]
}

// ─── Overview facts (7 stages) ──────────────────────────────────────────────────

function buildOverviewFacts(sim: SimulationWithCandidates, machineName: string): [string, string, string, string, string, string, string, string] {
  const { response, perRow, fpgaConsolidation, catalogSize } = sim
  const rowCount = perRow.length
  const categorySet = new Set(perRow.map((r) => r.categoryLabel))

  const candidateCounts = perRow.map((r) => r.allCandidates.length).filter((n) => n > 0)
  const minCandidates = candidateCounts.length > 0 ? Math.min(...candidateCounts) : 0
  const maxCandidates = candidateCounts.length > 0 ? Math.max(...candidateCounts) : 0

  // Top 3 winner facts
  const winnerFacts = perRow
    .filter((r) => r.winner)
    .slice(0, 3)
    .map((r) => `${r.winner!.module.moduleId} wins ${r.subLabel} (score ${r.winner!.score})`)
    .join(' · ')

  // Detect FPGA involvement for the overview
  const overviewHasFpga = response.recommendedModules.some((m) => {
    const cat = MOCK_MODULE_CATALOG.find((c) => c.moduleId === m.moduleId)
    return cat?.fpgaFamily != null
  }) || fpgaConsolidation !== null

  const fpgaFact = fpgaConsolidation
    ? `FPGA consolidation: ${fpgaConsolidation.before} boards → ${fpgaConsolidation.after} (${fpgaConsolidation.before - fpgaConsolidation.after} saved)`
    : overviewHasFpga
      ? 'FPGA modules detected · no consolidation needed'
      : 'No FPGA modules → optimization step skipped'

  // FPGA overhead guard fact
  const overheadSwaps = sim.fpgaOverheadSwaps
  const overheadFact = overheadSwaps.length > 0
    ? overheadSwaps.map(s => {
        const replacedWith = s.replacements.map(r => `${r.units}× ${r.moduleId}`).join(' + ')
        return `${s.family} swapped → ${replacedWith} (${s.fpgaCount} modules → ${s.dedicatedCount})`
      }).join('; ')
    : overviewHasFpga
      ? 'FPGA overhead acceptable — kept all FPGA families'
      : 'No FPGA modules → step skipped'

  const slotFact = response.machineWarnings?.length
    ? `${response.summary.moduleCount} modules · ${machineName}: ${response.machineWarnings.some(w => w.includes('expansion')) ? 'expansion needed' : 'over capacity ⚠'}`
    : `Fits in ${machineName} (${response.summary.moduleCount} modules)`

  const resolvedRows = perRow.filter((r) => r.winner !== null).length

  return [
    `${rowCount} requirements: ${Array.from(categorySet).join(', ')}`,
    `Searched ${catalogSize} I/O modules · found ${minCandidates}–${maxCandidates} candidates per row`,
    `Scored every candidate by spec match, channel count, consolidation, and machine fit`,
    winnerFacts || 'No module winners (all rows unresolved)',
    fpgaFact,
    overheadFact,
    slotFact,
    `${resolvedRows} of ${rowCount} rows resolved`,
  ]
}

// ─── Module showcase ────────────────────────────────────────────────────────────

function buildModuleShowcase(perRow: SimulationWithCandidates['perRow']): ModuleShowcase[] {
  return perRow
    .filter((r) => r.allCandidates.length > 0)
    .map((r) => {
      // Show up to 3 candidates per row
      const top = r.allCandidates.slice(0, 3)
      const winnerId = r.winner?.module.moduleId

      const candidates: ModuleCandidate[] = top.map((c) => {
        const isWinner = c.module.moduleId === winnerId
        return {
          moduleId: c.module.moduleId,
          name: `${c.module.moduleId} – ${c.module.friendlyName}`,
          score: c.score,
          units: c.units,
          isWinner,
          reason: candidateReason(c, isWinner),
          ...(isWinner ? { scoreBreakdown: buildScoreBreakdown(c) } : {}),
        }
      })

      return {
        requirementLabel: requirementLabel(r),
        candidates,
      }
    })
}

// ─── Main builder ───────────────────────────────────────────────────────────────

export function buildLiveFlowExample(
  requirementsRows: RequirementRow[],
  machineId: string,
  machineName: string,
  maxSlots?: number,
  maxSlotsExpanded?: number,
  optimizationProfile?: OptimizationProfile,
): FlowExample | undefined {
  if (requirementsRows.length === 0) return undefined

  const request: ProposalGenerateRequest = {
    machineId,
    machineName,
    version: 'live-flow',
    requirements: requirementsRows,
    maxSlots,
    maxSlotsExpanded,
    ...(optimizationProfile ? { optimizationProfile } : {}),
  }

  const sim = simulateProposalWithCandidates(request)
  // Detect FPGA involvement: any recommended module that comes from an FPGA-backed catalog entry
  const hasFpga = sim.response.recommendedModules.some((m) => {
    const cat = MOCK_MODULE_CATALOG.find((c) => c.moduleId === m.moduleId)
    return cat?.fpgaFamily != null
  }) || sim.fpgaConsolidation !== null

  const starterRows: StarterRow[] = requirementsRows.map((r) => ({
    categoryId: r.categoryId,
    subId: r.subId,
    quantity: r.quantity,
    specs: r.specs,
  }))

  // Count interface boards (extensions + IO33X) added for FPGA modules
  const interfaceMods = sim.response.recommendedModules.filter((m) => m.interfaceForModule)
  const fpgaInterfaceBoardCount = interfaceMods.reduce((sum, m) => sum + m.quantity, 0)

  // Build detailed interface board info for the decision flow
  const allMods = sim.response.recommendedModules
  const fpgaInterfaceBoards: FpgaInterfaceBoardInfo[] = interfaceMods.map((m) => {
    const parent = allMods.find((p) => p.moduleId === m.interfaceForModule)
    return {
      boardId: m.moduleId,
      friendlyName: m.friendlyName,
      parentModuleId: m.interfaceForModule!,
      parentFriendlyName: parent?.friendlyName ?? m.interfaceForModule!,
      quantity: m.quantity,
    }
  })

  // ── System summary ──────────────────────────────────────────────────────────
  const fpgaMainMods   = allMods.filter(m => !m.interfaceForModule && MOCK_MODULE_CATALOG.some(c => c.moduleId === m.moduleId && c.fpgaFamily))
  const dedicatedMods  = allMods.filter(m => !m.interfaceForModule && !MOCK_MODULE_CATALOG.some(c => c.moduleId === m.moduleId && c.fpgaFamily))
  const fpgaBoardsQty    = fpgaMainMods.reduce((s, m) => s + m.quantity, 0)
  const interfaceBoardsQty = interfaceMods.reduce((s, m) => s + m.quantity, 0)
  const dedicatedBoardsQty = dedicatedMods.reduce((s, m) => s + m.quantity, 0)
  const mainBoardsQty    = fpgaBoardsQty + dedicatedBoardsQty
  const totalBoardsQty   = mainBoardsQty + interfaceBoardsQty
  const resolvedRows     = sim.perRow.filter(r => r.winner !== null).length

  const systemSummary: SystemSummary = {
    totalBoardsQty,
    mainBoardsQty,
    fpgaBoardsQty,
    interfaceBoardsQty,
    dedicatedBoardsQty,
    resolvedRows,
    totalRows: requirementsRows.length,
    coveredChannels: sim.response.summary.coveredChannels,
    unresolvedCount: sim.response.summary.unresolvedCount,
  }

  return {
    id: 'live_config',
    label: 'Your Configuration',
    icon: '🔧',
    description: `${requirementsRows.length} requirement rows from your current setup`,
    requirements: starterRows,
    hasFpgaBranch: hasFpga,
    fpgaConsolidation: sim.fpgaConsolidation,
    fpgaInterfaceBoardCount,
    fpgaInterfaceBoards,
    nodeSnapshots: buildNodeSnapshots(sim, machineName),
    overviewFacts: buildOverviewFacts(sim, machineName),
    moduleShowcase: buildModuleShowcase(sim.perRow),
    systemSummary,
    optimizationProfile: sim.response.optimizationProfileApplied ?? optimizationProfile,
  }
}
